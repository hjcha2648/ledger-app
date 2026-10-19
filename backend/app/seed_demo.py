"""시연용 계정과 가상 데이터 생성. 사용법: backend/ 에서

    python -m app.seed_demo --email demo@example.com --password '<시연용 비밀번호>'
    python -m app.seed_demo --email demo@example.com --password '<...>' --reset   # 기존 시연 데이터 지우고 다시 생성

- 최근 6개월(이번 달 포함) 수입·지출 거래, 정기결제 4건, 개인 카테고리 1개를 만든다.
- 실제 금융정보가 아닌 가상 데이터다. 같은 실행 결과가 나오도록 난수 시드를 고정한다.
- 비밀번호를 Git·채팅에 남기지 않도록 주의 (환경 변수 DEMO_PASSWORD로도 전달 가능).
"""

import argparse
import os
import random
import sys
from datetime import date, datetime, timezone

from sqlalchemy import delete, select

from app.database import SessionLocal
from app.models import Category, Subscription, Transaction, User
from app.security import hash_password

MONTHS = 6

# (카테고리명, 사용처 후보, 월 건수 범위, 1건 금액 범위)
EXPENSE_PATTERNS = [
    ("식비", ["김밥천국", "편의점", "회사 앞 식당", "배달앱", "마트"], (8, 14), (6_000, 35_000)),
    ("교통", ["지하철", "버스", "택시"], (6, 10), (1_500, 18_000)),
    ("쇼핑", ["온라인 쇼핑몰", "다이소", "의류 매장"], (1, 4), (10_000, 90_000)),
    ("여가·문화", ["영화관", "서점", "카페"], (2, 5), (5_000, 30_000)),
    ("의료·건강", ["약국", "병원"], (0, 2), (5_000, 40_000)),
]

SUBSCRIPTIONS = [
    ("넷플릭스", 17_000, "MONTHLY", 15, "가족 공유"),
    ("유튜브 프리미엄", 14_900, "MONTHLY", 3, None),
    ("클라우드 저장공간", 33_000, "YEARLY", 1, "연 1회 결제"),
    ("주간 뉴스레터", 3_000, "WEEKLY", 6, None),
]


def shift_month(d: date, months: int) -> date:
    total = d.year * 12 + (d.month - 1) + months
    return date(total // 12, total % 12 + 1, 1)


def month_end(d: date) -> date:
    return date.fromordinal(shift_month(d, 1).toordinal() - 1)


def build_transactions(user_id: int, cats: dict[str, int], pet_cat: int, today: date) -> list[Transaction]:
    rng = random.Random(20261019)
    txs: list[Transaction] = []
    first = shift_month(today.replace(day=1), -(MONTHS - 1))

    for i in range(MONTHS):
        start = shift_month(first, i)
        end = month_end(start)
        last_day = min(end, today)  # 변동 지출은 오늘까지만

        def on(day: int) -> date:
            return start.replace(day=min(day, end.day))  # 고정 지출일이 오늘 이후면 add()에서 건너뜀

        def add(type_: str, cat_id: int, amount: int, d: date, merchant: str | None = None, memo: str | None = None):
            if d <= today:
                txs.append(Transaction(user_id=user_id, type=type_, amount_krw=amount, occurred_on=d,
                                       category_id=cat_id, merchant=merchant, memo=memo))

        # 수입
        add("INCOME", cats["급여"], 3_200_000, on(10), "회사", "월급")  # 시연 당월에도 수입이 보이도록 10일
        if i % 2 == 0:
            add("INCOME", cats["부수입"], rng.randrange(100_000, 400_001, 10_000), on(rng.randint(5, 20)), "외주 작업")

        # 고정 지출
        add("EXPENSE", cats["주거·통신"], 650_000, on(1), "관리비·월세")
        add("EXPENSE", cats["주거·통신"], 55_000, on(10), "통신사")
        add("EXPENSE", cats["교육"], 120_000, on(5), "온라인 강의")
        add("EXPENSE", pet_cat, rng.randrange(30_000, 80_001, 1_000), on(rng.randint(1, 28)), "동물병원·사료")

        # 변동 지출
        for name, merchants, (lo, hi), (amin, amax) in EXPENSE_PATTERNS:
            for _ in range(rng.randint(lo, hi)):
                add("EXPENSE", cats[name], rng.randrange(amin, amax + 1, 100),
                    on(rng.randint(1, last_day.day)), rng.choice(merchants))
    return txs


def main() -> int:
    parser = argparse.ArgumentParser(description="시연용 계정·가상 데이터 생성")
    parser.add_argument("--email", default="demo@example.com")
    parser.add_argument("--password", default=os.environ.get("DEMO_PASSWORD"))
    parser.add_argument("--reset", action="store_true", help="이미 있는 시연 계정의 데이터를 지우고 다시 생성")
    args = parser.parse_args()

    if not args.password or len(args.password) < 8:
        print("비밀번호(8자 이상)를 --password 또는 DEMO_PASSWORD로 지정하세요.", file=sys.stderr)
        return 1
    email = args.email.strip().lower()
    today = datetime.now(timezone.utc).date()

    with SessionLocal() as db:
        cats = {c.name: c.id for c in db.scalars(select(Category).where(Category.user_id.is_(None)))}
        if len(cats) < 13:
            print("기본 카테고리가 없습니다. 먼저 `python -m app.init_db`를 실행하세요.", file=sys.stderr)
            return 1

        user = db.scalar(select(User).where(User.email == email))
        if user and not args.reset:
            print(f"{email} 계정이 이미 있습니다. 다시 만들려면 --reset을 붙이세요.", file=sys.stderr)
            return 1
        if user:
            # 이 계정의 데이터만 삭제 (다른 사용자 데이터는 건드리지 않음)
            db.execute(delete(Transaction).where(Transaction.user_id == user.id))
            db.execute(delete(Subscription).where(Subscription.user_id == user.id))
            db.execute(delete(Category).where(Category.user_id == user.id))
            user.password_hash = hash_password(args.password)
        else:
            user = User(email=email, password_hash=hash_password(args.password))
            db.add(user)
        db.flush()

        pet = Category(user_id=user.id, name="반려동물", type="EXPENSE")
        db.add(pet)
        db.flush()

        txs = build_transactions(user.id, cats, pet.id, today)
        db.add_all(txs)
        for name, amount, cycle, day, memo in SUBSCRIPTIONS:
            anchor = shift_month(today.replace(day=1), -2).replace(day=day)
            db.add(Subscription(user_id=user.id, name=name, category_id=cats["구독·정기결제"], amount_krw=amount,
                                billing_cycle=cycle, billing_anchor_date=anchor, memo=memo))
        db.commit()

    print(f"시연 계정: {email}")
    print(f"거래 {len(txs)}건 (최근 {MONTHS}개월), 정기결제 {len(SUBSCRIPTIONS)}건, 개인 카테고리 1개 생성")
    return 0


if __name__ == "__main__":
    sys.exit(main())

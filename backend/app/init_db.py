"""테이블 생성 + 기본 카테고리 시드. 사용법: backend/ 에서 `python -m app.init_db`

create_all()은 없는 테이블만 만들고 기존 테이블 구조는 바꾸지 않는다.
여러 번 실행해도 기본 카테고리는 중복 등록되지 않는다.
"""

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Category

DEFAULT_CATEGORIES = {
    "EXPENSE": ["식비", "교통", "주거·통신", "쇼핑", "여가·문화", "의료·건강", "교육", "구독·정기결제", "기타지출"],
    "INCOME": ["급여", "용돈", "부수입", "기타수입"],
}


def seed_default_categories() -> int:
    added = 0
    with SessionLocal() as db:
        existing = set(db.execute(select(Category.type, Category.name).where(Category.user_id.is_(None))).all())
        for type_, names in DEFAULT_CATEGORIES.items():
            for name in names:
                if (type_, name) not in existing:
                    db.add(Category(user_id=None, name=name, type=type_))
                    added += 1
        db.commit()
    return added


def main() -> None:
    Base.metadata.create_all(bind=engine)
    print(f"tables: {', '.join(Base.metadata.tables)}")
    print(f"default categories added: {seed_default_categories()}")


if __name__ == "__main__":
    main()

"""대시보드: transactions 테이블에 직접 입력한 수입·지출만 집계 (정기결제 금액 미포함, PRD §14)"""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, extract, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Category, Transaction, User
from app.schemas.dashboard import CategoryExpense, DashboardResponse, MonthlyCompare, Summary
from app.utils import parse_month

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

COMPARE_MONTHS = 6


def _sum_of(type_: str):
    return func.coalesce(func.sum(case((Transaction.type == type_, Transaction.amount_krw), else_=0)), 0)


def _shift_month(d: date, months: int) -> date:
    total = d.year * 12 + (d.month - 1) + months
    return date(total // 12, total % 12 + 1, 1)


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    month: str = Query(description="YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = parse_month(month)
    mine = Transaction.user_id == current_user.id

    # 1) 선택 월 요약
    income, expense = db.execute(
        select(_sum_of("INCOME"), _sum_of("EXPENSE")).where(
            mine, Transaction.occurred_on >= start, Transaction.occurred_on < end
        )
    ).one()
    income, expense = int(income), int(expense)

    # 2) 선택 월 카테고리별 지출 (금액 큰 순)
    total = func.sum(Transaction.amount_krw)
    by_category = db.execute(
        select(Category.id, Category.name, total)
        .join(Category, Transaction.category_id == Category.id)
        .where(
            mine,
            Transaction.type == "EXPENSE",
            Transaction.occurred_on >= start,
            Transaction.occurred_on < end,
        )
        .group_by(Category.id, Category.name)
        .order_by(total.desc(), Category.id)
    ).all()

    # 3) 선택 월 포함 최근 6개월 (오래된 달부터, 거래 없는 달은 0)
    compare_start = _shift_month(start, -(COMPARE_MONTHS - 1))
    year_col = extract("year", Transaction.occurred_on)
    month_col = extract("month", Transaction.occurred_on)
    monthly_rows = db.execute(
        select(year_col, month_col, _sum_of("INCOME"), _sum_of("EXPENSE"))
        .where(mine, Transaction.occurred_on >= compare_start, Transaction.occurred_on < end)
        .group_by(year_col, month_col)
    ).all()
    monthly = {(int(y), int(m)): (int(i), int(e)) for y, m, i, e in monthly_rows}

    compare = []
    for offset in range(COMPARE_MONTHS):
        d = _shift_month(compare_start, offset)
        inc, exp = monthly.get((d.year, d.month), (0, 0))
        compare.append(MonthlyCompare(month=f"{d.year:04d}-{d.month:02d}", income_krw=inc, expense_krw=exp))

    return DashboardResponse(
        month=month,
        summary=Summary(income_krw=income, expense_krw=expense, balance_krw=income - expense),
        expense_by_category=[
            CategoryExpense(category_id=cid, name=name, amount_krw=int(amount)) for cid, name, amount in by_category
        ],
        monthly_compare=compare,
    )

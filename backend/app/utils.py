import re
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Category


_MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def parse_month(month: str) -> tuple[date, date]:
    """'YYYY-MM' → (해당 월 1일, 다음 달 1일). 조회는 start <= 날짜 < end 범위로 한다."""
    if not _MONTH_RE.match(month):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="month는 YYYY-MM 형식이어야 합니다.")
    year, mon = int(month[:4]), int(month[5:])
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end


def visible_to(user_id: int):
    """시스템 기본 카테고리 + 본인 카테고리 조건"""
    return or_(Category.user_id.is_(None), Category.user_id == user_id)


def get_usable_category(db: Session, user_id: int, category_id: int, required_type: str) -> Category:
    """거래/정기결제에 쓸 카테고리 검증: 본인 또는 시스템 카테고리이고 유형이 일치해야 한다."""
    category = db.scalar(select(Category).where(Category.id == category_id, visible_to(user_id)))
    if category is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="사용할 수 없는 카테고리입니다.")
    if category.type != required_type:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"{required_type} 유형의 카테고리만 사용할 수 있습니다.")
    return category

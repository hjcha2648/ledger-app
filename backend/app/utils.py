from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Category


def visible_to(user_id: int):
    """시스템 기본 카테고리 + 본인 카테고리 조건"""
    return or_(Category.user_id.is_(None), Category.user_id == user_id)


def get_usable_category(db: Session, user_id: int, category_id: int, required_type: str) -> Category:
    """거래/정기결제에 쓸 카테고리 검증: 본인 또는 시스템 카테고리이고 유형이 일치해야 한다."""
    category = db.scalar(select(Category).where(Category.id == category_id, visible_to(user_id)))
    if category is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="사용할 수 없는 카테고리입니다.")
    if category.type != required_type:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="거래 유형과 카테고리 유형이 일치하지 않습니다.")
    return category

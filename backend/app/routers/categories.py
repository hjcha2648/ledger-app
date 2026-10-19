from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Category, User
from app.schemas.category import CategoryCreate, CategoryResponse
from app.utils import visible_to

router = APIRouter(prefix="/api/categories", tags=["categories"])


def to_response(category: Category) -> CategoryResponse:
    return CategoryResponse(
        id=category.id,
        name=category.name,
        type=category.type,
        is_default=category.user_id is None,
    )


@router.get("", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    categories = db.scalars(
        select(Category).where(visible_to(current_user.id)).order_by(Category.type, Category.id)
    ).all()
    return [to_response(c) for c in categories]


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    body: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 같은 유형에 같은 이름(기본 카테고리 포함)이 이미 있으면 거부
    duplicate = db.scalar(
        select(Category.id).where(
            visible_to(current_user.id),
            Category.type == body.type,
            Category.name == body.name,
        )
    )
    if duplicate is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="이미 있는 카테고리입니다.")

    category = Category(user_id=current_user.id, name=body.name, type=body.type)
    db.add(category)
    db.commit()
    db.refresh(category)
    return to_response(category)

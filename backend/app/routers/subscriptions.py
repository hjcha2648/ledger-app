"""정기결제: 목록 관리 전용 (등록·조회·삭제만, PRD §3.4)

거래(transactions)를 생성·수정·삭제하지 않고, 결제일 계산도 하지 않는다.
수정 API(PATCH)는 범위에서 제외되었다. 변경은 삭제 후 재등록.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Category, Subscription, User
from app.schemas.subscription import SubscriptionCreate, SubscriptionResponse
from app.utils import get_usable_category

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


def to_response(sub: Subscription, category_name: str) -> SubscriptionResponse:
    return SubscriptionResponse(
        id=sub.id,
        name=sub.name,
        amount_krw=sub.amount_krw,
        billing_cycle=sub.billing_cycle,
        billing_anchor_date=sub.billing_anchor_date,
        category_id=sub.category_id,
        category_name=category_name,
        memo=sub.memo,
        created_at=sub.created_at,
    )


@router.get("", response_model=list[SubscriptionResponse])
def list_subscriptions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.execute(
        select(Subscription, Category.name)
        .join(Category, Subscription.category_id == Category.id)
        .where(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc(), Subscription.id.desc())
    ).all()
    return [to_response(sub, name) for sub, name in rows]


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def create_subscription(
    body: SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 정기결제는 지출 카테고리만 사용
    category = get_usable_category(db, current_user.id, body.category_id, "EXPENSE")
    sub = Subscription(user_id=current_user.id, **body.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return to_response(sub, category.name)


@router.delete("/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = db.scalar(select(Subscription).where(Subscription.id == sub_id, Subscription.user_id == current_user.id))
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="정기결제를 찾을 수 없습니다.")
    db.delete(sub)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

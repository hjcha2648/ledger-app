from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Category, Transaction, User
from app.schemas.transaction import TransactionCreate, TransactionResponse, TransactionUpdate
from app.utils import get_usable_category, parse_month

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def to_response(tx: Transaction, category_name: str) -> TransactionResponse:
    return TransactionResponse(
        id=tx.id,
        type=tx.type,
        amount_krw=tx.amount_krw,
        occurred_on=tx.occurred_on,
        category_id=tx.category_id,
        category_name=category_name,
        merchant=tx.merchant,
        memo=tx.memo,
        created_at=tx.created_at,
        updated_at=tx.updated_at,
    )


def get_own_transaction(db: Session, user_id: int, tx_id: int) -> Transaction:
    # 남의 거래도 "없음"과 같은 404로 응답해 존재 여부를 노출하지 않는다
    tx = db.scalar(select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id))
    if tx is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="거래를 찾을 수 없습니다.")
    return tx


@router.get("", response_model=list[TransactionResponse])
def list_transactions(
    month: str = Query(description="YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = parse_month(month)
    rows = db.execute(
        select(Transaction, Category.name)
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == current_user.id,
            Transaction.occurred_on >= start,
            Transaction.occurred_on < end,
        )
        .order_by(Transaction.occurred_on.desc(), Transaction.id.desc())
    ).all()
    return [to_response(tx, name) for tx, name in rows]


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    body: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = get_usable_category(db, current_user.id, body.category_id, body.type)
    tx = Transaction(user_id=current_user.id, **body.model_dump())
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return to_response(tx, category.name)


@router.patch("/{tx_id}", response_model=TransactionResponse)
def update_transaction(
    tx_id: int,
    body: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = get_own_transaction(db, current_user.id, tx_id)
    changes = body.model_dump(exclude_unset=True)

    # 변경 후 최종 유형·카테고리 조합으로 다시 검증
    category = get_usable_category(
        db,
        current_user.id,
        changes.get("category_id", tx.category_id),
        changes.get("type", tx.type),
    )
    for field, value in changes.items():
        setattr(tx, field, value)
    db.commit()
    db.refresh(tx)
    return to_response(tx, category.name)


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = get_own_transaction(db, current_user.id, tx_id)
    db.delete(tx)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

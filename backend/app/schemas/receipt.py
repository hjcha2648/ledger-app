from datetime import date
from typing import Literal

from pydantic import BaseModel


class ReceiptItem(BaseModel):
    """저장하지 않은 거래 입력 초안. 저장은 프론트가 사용자 확인 후 POST /api/transactions로 한다."""

    type: Literal["INCOME", "EXPENSE"]
    amount_krw: int  # 1 이상
    occurred_on: date | None  # 읽지 못하면 null → 프론트에서 입력 필수
    merchant: str | None
    memo: str | None
    category_id: int | None  # 이 사용자가 쓸 수 있고 유형이 맞는 카테고리만, 아니면 null
    category_name: str | None


class ReceiptAnalyzeResponse(BaseModel):
    items: list[ReceiptItem]
    warnings: list[str]

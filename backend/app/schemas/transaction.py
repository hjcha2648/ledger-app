from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

TransactionType = Literal["INCOME", "EXPENSE"]
AmountKrw = Annotated[int, Field(ge=1, le=2_147_483_647)]  # DB INT 범위
Merchant = Annotated[str, Field(max_length=100)]
Memo = Annotated[str, Field(max_length=500)]


class _TextFields(BaseModel):
    @field_validator("merchant", "memo", mode="before", check_fields=False)
    @classmethod
    def blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class TransactionCreate(_TextFields):
    type: TransactionType
    amount_krw: AmountKrw
    occurred_on: date
    category_id: int
    merchant: Merchant | None = None
    memo: Memo | None = None


class TransactionUpdate(_TextFields):
    """보낸 필드만 수정. merchant/memo는 null로 지울 수 있다."""

    type: TransactionType | None = None
    amount_krw: AmountKrw | None = None
    occurred_on: date | None = None
    category_id: int | None = None
    merchant: Merchant | None = None
    memo: Memo | None = None

    @model_validator(mode="after")
    def required_fields_not_null(self):
        for name in ("type", "amount_krw", "occurred_on", "category_id"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name}은(는) null일 수 없습니다.")
        return self


class TransactionResponse(BaseModel):
    id: int
    type: TransactionType
    amount_krw: int
    occurred_on: date
    category_id: int
    category_name: str
    merchant: str | None
    memo: str | None
    created_at: datetime
    updated_at: datetime

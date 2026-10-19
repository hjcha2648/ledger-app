from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

BillingCycle = Literal["WEEKLY", "MONTHLY", "YEARLY"]


class SubscriptionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    amount_krw: Annotated[int, Field(ge=1, le=2_147_483_647)]
    billing_cycle: BillingCycle
    billing_anchor_date: date  # 사용자가 참고하는 표시용 기준일 (날짜 계산 없음)
    category_id: int
    memo: Annotated[str, Field(max_length=500)] | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("memo", mode="before")
    @classmethod
    def blank_memo_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class SubscriptionResponse(BaseModel):
    id: int
    name: str
    amount_krw: int
    billing_cycle: BillingCycle
    billing_anchor_date: date
    category_id: int
    category_name: str
    memo: str | None
    created_at: datetime

from typing import Literal

from pydantic import BaseModel, Field, field_validator

CategoryType = Literal["INCOME", "EXPENSE"]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    type: CategoryType

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v):
        return v.strip() if isinstance(v, str) else v


class CategoryResponse(BaseModel):
    id: int
    name: str
    type: CategoryType
    is_default: bool  # True = 시스템 기본 카테고리

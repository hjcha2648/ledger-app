from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_TURNS = 10
MAX_CONTENT = 1000


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_CONTENT)

    @field_validator("content", mode="before")
    @classmethod
    def strip_content(cls, v):
        return v.strip() if isinstance(v, str) else v


class ChatRequest(BaseModel):
    month: str  # YYYY-MM, 형식 검증은 parse_month
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_TURNS)  # 오래된 순서

    @model_validator(mode="after")
    def last_is_user(self):
        if self.messages[-1].role != "user":
            raise ValueError("마지막 메시지는 user 여야 합니다.")
        return self


class ChatResponse(BaseModel):
    reply: str

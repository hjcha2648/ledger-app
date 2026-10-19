from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class _Credentials(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class RegisterRequest(_Credentials):
    password: str = Field(min_length=8, max_length=64)


class LoginRequest(_Credentials):
    password: str = Field(min_length=1, max_length=64)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # 초


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime

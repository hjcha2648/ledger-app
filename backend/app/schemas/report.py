from typing import Literal

from pydantic import BaseModel


class MonthlyEmailRequest(BaseModel):
    month: str  # YYYY-MM, 형식 검증은 parse_month


class MonthlyEmailResponse(BaseModel):
    sent_to: str  # 일부를 가린 받는 주소 (예: u***@gmail.com)


class EmailStatusResponse(BaseModel):
    email: str  # 일부를 가린 본인 주소
    status: Literal["verified", "pending", "unverified"]  # 받을 수 있음 / 인증 링크 대기 / 인증 요청 전

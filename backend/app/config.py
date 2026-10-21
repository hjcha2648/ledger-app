from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env (실행 위치와 무관하게 고정 경로에서 로드, EC2에서는 systemd 환경 변수가 우선)
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    cors_origins: str = ""  # 쉼표로 구분, 로컬 개발용
    enable_docs: bool = True

    # AI 챗봇 (Amazon Bedrock, PLAN.md). 기본은 꺼짐 — 켜지 않으면 /api/chat 은 503
    chat_enabled: bool = False
    bedrock_region: str = "ap-northeast-2"
    bedrock_model_id: str = "global.anthropic.claude-opus-5-5"  # 서울 리전은 inference profile ID 필수
    bedrock_fallback_model_id: str = "global.anthropic.claude-opus-4-8"  # 거절(refusal) 시 재시도 모델, 비우면 사용 안 함
    chat_rate_limit_per_min: int = 10

    # 월간 명세서 메일 (Amazon SES, PLAN.md 기능 2). 기본은 꺼짐 — 켜지 않으면 503
    email_enabled: bool = False
    ses_region: str = "ap-northeast-2"
    ses_sender: str = ""  # SES에서 인증한 발신 주소 (예: noreply@lsj.mzsec.cloud)
    email_cooldown_seconds: int = 300  # 사용자별 재발송 대기 시간
    # 시연용 계정 주소(쉼표 구분). 이 계정은 인증된 사용자처럼 보이고 발송 성공(202)을 받지만 실제로는 SES를 부르지 않는다.
    # 메일을 받을 수 없는 가상 주소(예: demo@example.com)로 화면 흐름만 시연할 때 쓴다. 비우면 사용 안 함
    email_demo_addresses: str = ""

    # 영수증·명세서 인식 (Bedrock 멀티모달, PLAN.md 기능 3). 기본은 꺼짐 — 켜지 않으면 503
    receipt_enabled: bool = False
    receipt_max_bytes: int = 5 * 1024 * 1024
    receipt_rate_limit_per_min: int = 5

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def email_demo_address_set(self) -> set[str]:
        return {a.strip().lower() for a in self.email_demo_addresses.split(",") if a.strip()}


settings = Settings()

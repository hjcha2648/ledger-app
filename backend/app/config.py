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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

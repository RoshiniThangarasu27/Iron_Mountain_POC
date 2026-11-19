from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Healthcare Document Ingestion API"
    DATABASE_URL: str = "postgresql+psycopg2://docs:docs@localhost:5432/docs"
    UPLOAD_DIR: Path = Path("/app/storage/uploads")

    MAX_UPLOAD_SIZE_MB: int = Field(default=25, ge=1)
    MAX_FILES_PER_UPLOAD: int = Field(default=50, ge=1)

    CORS_ORIGINS: str = "http://localhost:3000"

    LOG_LEVEL: str = "INFO"

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

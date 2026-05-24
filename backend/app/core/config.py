from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Greenfields Audit System"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = (
        "postgresql://postgres:postgres@localhost:5432/greenfields_audit"
    )
    SECRET_KEY: str = "ganti-ini-dengan-random-string-panjang"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    SUPERADMIN_USERNAME: str = "admin"
    DB_POOL_MIN: int = 4
    DB_POOL_MAX: int = 20
    DB_STATEMENT_TIMEOUT_MS: int = 30000
    DASHBOARD_ATTENTION_LIMIT: int = 50
    ESCALATION_THRESHOLD_HOURS: int = 24
    CRITICAL_SLA_HOURS: int = 4
    HIGH_SLA_HOURS: int = 24

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()

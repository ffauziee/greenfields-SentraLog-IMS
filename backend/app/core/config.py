from pydantic_settings import BaseSettings
from functools import lru_cache
class Settings(BaseSettings):
    APP_NAME: str = "Greenfields Audit System"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/greenfields_audit"
    SECRET_KEY: str = "ganti-ini-dengan-random-string-panjang"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ESCALATION_THRESHOLD_HOURS: int = 24
    CRITICAL_SLA_HOURS: int = 4
    HIGH_SLA_HOURS: int = 24
    class Config:
        env_file = ".env"
@lru_cache()
def get_settings():
    return Settings()
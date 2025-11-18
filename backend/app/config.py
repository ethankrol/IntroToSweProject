from pathlib import Path
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    SECRET_KEY: str
    ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    MONGO_URL: str | None = None
    MONGO_USER: str | None = None
    MONGO_PASS: str | None = None
    MONGO_HOST: str = "localhost:27017"
    MONGO_DB: str | None = None

    EMAIL_FROM: str | None = None
    EMAIL_PROVIDER: str = "smtp"          # smtp | sendgrid
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASS: str | None = None
    SMTP_FROM: str | None = None        # ADD THIS LINE
    SMTP_TLS: bool = True
    SENDGRID_API_KEY: str | None = None

    FRONTEND_URL: str = "http://localhost:19006"
    DEBUG_EMAIL_FALLBACK: bool = True

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent / ".env"),
        extra="ignore"
    )

    @property
    def mongo_url(self) -> str:
        if self.MONGO_URL:
            return self.MONGO_URL
        if self.MONGO_USER and self.MONGO_PASS:
            user = quote_plus(self.MONGO_USER)
            pwd = quote_plus(self.MONGO_PASS)
            db_part = f"/{self.MONGO_DB}" if self.MONGO_DB else "/"
            return f"mongodb+srv://{user}:{pwd}@{self.MONGO_HOST}{db_part}?retryWrites=true&w=majority"
        return f"mongodb://{self.MONGO_HOST}"

settings = Settings()
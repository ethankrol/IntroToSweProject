from pathlib import Path
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # points to backend/

class Settings(BaseSettings):
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    MONGO_URL: str
    model_config = SettingsConfigDict(env_file = 'C:\\Users\\AMW\\Documents\\IntroToSWE\\IntroToSweProject\\backend\\app\\.env')

settings = Settings()

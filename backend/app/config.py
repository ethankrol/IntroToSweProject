from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    SECRET_KEY: str
    ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    MONGO_URL: str
    model_config = SettingsConfigDict(env_file = '/Users/ethankrol/Documents/GitHub/IntroToSweProject/backend/app/.env')

settings = Settings()
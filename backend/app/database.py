from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from contextlib import asynccontextmanager
from .config import settings
from fastapi import FastAPI, Request

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.mongo_client = MongoClient(settings.MONGO_URL)
    app.db = app.mongo_client['GatorGather']
    yield
    app.mongo_client.close()

def get_db(request: Request):
    return request.app.db


# Note: we keep DB helpers minimal. Converting ObjectId -> str should be
# performed explicitly at the repository/DAO boundary so it's obvious where
# types are transformed before creating Pydantic models.
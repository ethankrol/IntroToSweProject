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
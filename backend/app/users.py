from .models import User, UserInDB, UserCreate
from .database import get_db
from passlib.context import CryptContext
from bson import ObjectId
from fastapi import HTTPException, status
import logging

logger = logging.getLogger('uvicorn.error')
logger.setLevel(logging.DEBUG)

pwd_context = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_by_email(db, email: str) -> UserInDB | None:
    user_data = db['users'].find_one({'email': email})
    if user_data:
        return UserInDB(**user_data)
    return None

def authenticate_user(db, email: str, password: str) -> UserInDB | None:
    user = get_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user

def create_user(db, user: UserCreate):
    existing_user = db['users'].find_one({'email': user.email})
    if existing_user:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail='User with this email already exists'
        )
    logger.debug(user.model_dump())
    user.hashed_password = get_password_hash(user.hashed_password)
    user_dict = user.model_dump()
    result = db['users'].insert_one(user_dict)
    user_dict['_id'] = str(result.inserted_id)

    return UserInDB(**user_dict)





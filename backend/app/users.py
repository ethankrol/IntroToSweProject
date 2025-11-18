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
        # If the stored _id is a string (from older records), convert it to
        # a bson.ObjectId so downstream code that expects ObjectId sees a
        # consistent type. If it's already an ObjectId, leave it.
        if '_id' in user_data and isinstance(user_data['_id'], str):
            try:
                user_data['_id'] = ObjectId(user_data['_id'])
            except Exception:
                # leave as-is if it isn't a valid ObjectId string
                pass

        return UserInDB(**user_data)
    return None

def authenticate_user(db, email: str, password: str) -> UserInDB | None:
    user = get_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user

def create_user(db, user_in: UserCreate):
    existing_user = db['users'].find_one({'email': user_in.email})
    if existing_user:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail='User with this email already exists'
        )
    # Build a typed User model from the incoming UserCreate by hashing the password
    if not isinstance(user_in.password, str) or not user_in.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Password is required'
        )

    user = User(
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
    )

    # Never log secrets; if needed, log only keys for debugging
    logger.debug({'keys': list(user.model_dump().keys())})

    # Insert and build response. Dump using aliases so DB field names match
    # the Pydantic model aliases (e.g. 'hashedPassword', 'createdAt'). This
    # ensures later reads can construct UserInDB(**doc) without missing
    # alias-only fields.
    doc = user.model_dump(by_alias=True)
    result = db['users'].insert_one(doc)
    # Store the actual ObjectId returned by Mongo so future reads return
    # a proper bson.ObjectId. This keeps DB representation natural.
    doc['_id'] = result.inserted_id

    return UserInDB(**doc)





from fastapi import FastAPI
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId
from typing import Optional

# For converting ObjectIDs from bson to readable string
'''class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError('Invalid objectid')
        return ObjectId(v)
    
    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type='string')'''

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: EmailStr | None = None


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str

class User(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    hashed_password: str

class UserInDB(User):
    id: Optional[str] = Field(default=None, alias = '_id')
    first_name: str
    last_name: str
    email: EmailStr
    hashed_password: str

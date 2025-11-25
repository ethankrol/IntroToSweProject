from fastapi import FastAPI
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from bson import ObjectId
from typing import Optional, Literal, List
from datetime import datetime

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
    # DB model: accepts bson.ObjectId and uses Mongo field names via aliases.
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[ObjectId] = Field(default=None, alias='_id')
    first_name: str
    last_name: str
    email: EmailStr
    hashed_password: str
    created_at: Optional[datetime] = Field(default=None, alias='createdAt')
    updated_at: Optional[datetime] = Field(default=None, alias='updatedAt')


# API / response models (present-friendly types: ids as strings, datetimes preserved)
class UserOut(BaseModel):
    id: Optional[str] = Field(default=None, alias='_id')
    first_name: str
    last_name: str
    email: EmailStr
    created_at: Optional[datetime] = Field(default=None, alias='createdAt')
    updated_at: Optional[datetime] = Field(default=None, alias='updatedAt')

    model_config = ConfigDict(json_schema_extra={}, populate_by_name=True)

# Events
class Location(BaseModel):
    type: Literal['Point'] = 'Point'
    # GeoJSON coordinates: [lng, lat]
    coordinates: List[float]


# Events
class EventBase(BaseModel):
    name: str
    description: Optional[str] = None
    location: Location
    location_name: Optional[str] = Field(default=None, alias='locationName')
    start_date: datetime = Field(alias='startDate')
    end_date: datetime = Field(alias='endDate')
    delegate_join_code: str = Field(alias='delegateJoinCode')
    volunteer_join_code: str = Field(alias='volunteerJoinCode')


class EventInDB(EventBase):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    id: Optional[ObjectId] = Field(default=None, alias='_id')
    created_by: ObjectId = Field(alias='createdBy')
    created_at: Optional[datetime] = Field(default=None, alias='createdAt')
    updated_at: Optional[datetime] = Field(default=None, alias='updatedAt')


class EventOut(EventBase):
    id: Optional[str] = Field(default=None, alias='_id')
    created_by: Optional[str] = Field(default=None, alias='createdBy')
    created_at: Optional[datetime] = Field(default=None, alias='createdAt')
    updated_at: Optional[datetime] = Field(default=None, alias='updatedAt')


# Event roles (coordinators / delegates)
class EventRoleInDB(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    id: Optional[ObjectId] = Field(default=None, alias='_id')
    event_id: ObjectId = Field(alias='eventId')
    user_id: ObjectId = Field(alias='userId')
    role: Literal['coordinator', 'delegate']


class EventRoleOut(BaseModel):
    id: Optional[str] = Field(default=None, alias='_id')
    event_id: str = Field(alias='eventId')
    user_id: str = Field(alias='userId')
    role: Literal['coordinator', 'delegate']


# Activities
class ActivityBase(BaseModel):
    name: str
    description: Optional[str] = None
    location: Location
    location_name: Optional[str] = Field(default=None, alias='locationName')
    start_time: datetime = Field(alias='startTime')
    end_time: datetime = Field(alias='endTime')
    max_volunteers: Optional[int] = Field(default=None, alias='maxVolunteers')


class ActivityInDB(ActivityBase):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    id: Optional[ObjectId] = Field(default=None, alias='_id')
    event_id: ObjectId = Field(alias='eventId')
    created_by: ObjectId = Field(alias='createdBy')
    created_at: Optional[datetime] = Field(default=None, alias='createdAt')
    updated_at: Optional[datetime] = Field(default=None, alias='updatedAt')


class ActivityOut(ActivityBase):
    id: Optional[str] = Field(default=None, alias='_id')
    event_id: str = Field(alias='eventId')
    created_by: Optional[str] = Field(default=None, alias='createdBy')
    created_at: Optional[datetime] = Field(default=None, alias='createdAt')
    updated_at: Optional[datetime] = Field(default=None, alias='updatedAt')


# Event volunteers (signups)
class EventVolunteerInDB(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    id: Optional[ObjectId] = Field(default=None, alias='_id')
    event_id: ObjectId = Field(alias='eventId')
    user_id: ObjectId = Field(alias='userId')
    role: Literal['delegate', 'volunteer']
    joined_at: datetime = Field(alias='joinedAt')
    notes: Optional[str] = ''


class EventVolunteerOut(BaseModel):
    id: Optional[str] = Field(default=None, alias='_id')
    event_id: str = Field(alias='eventId')
    user_id: str = Field(alias='userId')
    role: Literal['delegate', 'volunteer']
    joined_at: datetime = Field(alias='joinedAt')
    notes: Optional[str] = ''


# Activity assignments
class ActivityAssignmentInDB(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    id: Optional[ObjectId] = Field(default=None, alias='_id')
    event_id: ObjectId = Field(alias='eventId')
    activity_id: ObjectId = Field(alias='activityId')
    user_id: ObjectId = Field(alias='userId')
    assigned_by: ObjectId = Field(alias='assignedBy')
    assigned_at: datetime = Field(alias='assignedAt')


class ActivityAssignmentOut(BaseModel):
    id: Optional[str] = Field(default=None, alias='_id')
    event_id: str = Field(alias='eventId')
    activity_id: str = Field(alias='activityId')
    user_id: str = Field(alias='userId')
    assigned_by: str = Field(alias='assignedBy')
    assigned_at: datetime = Field(alias='assignedAt')

from fastapi import FastAPI
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from bson import ObjectId
from typing import Optional, Literal, List
from datetime import datetime

'''
NOTE: Used ChatGPT to generate pydantic models for our database fields to ensure that we had a working user model from the beginning.
'''

# ------------------------------
# Auth Models
# ------------------------------

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[EmailStr] = None

# ------------------------------
# Users
# ------------------------------

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
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[ObjectId] = Field(default=None, alias="_id")
    first_name: str
    last_name: str
    email: EmailStr
    hashed_password: str
    created_at: Optional[datetime] = Field(default=None, alias="created_at")
    updated_at: Optional[datetime] = Field(default=None, alias="updated_at")

class UserOut(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    first_name: str
    last_name: str
    email: EmailStr
    created_at: Optional[datetime] = Field(default=None, alias="created_at")
    updated_at: Optional[datetime] = Field(default=None, alias="updated_at")

    model_config = ConfigDict(populate_by_name=True)

# ------------------------------
# Location
# ------------------------------

class Location(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: List[float]  # [lng, lat]

# ------------------------------
# Events
# ------------------------------

class EventBase(BaseModel):
    name: str
    description: Optional[str] = None
    location: Location
    location_name: Optional[str] = Field(default=None, alias="location_name")
    start_date: datetime = Field(alias="start_date")
    end_date: datetime = Field(alias="end_date")
    delegate_join_code: str = Field(alias="delegate_join_code")

class EventInDB(EventBase):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[ObjectId] = Field(default=None, alias="_id")
    created_by: str = Field(alias="created_by")  
    created_at: Optional[datetime] = Field(default=None, alias="created_at")
    updated_at: Optional[datetime] = Field(default=None, alias="updated_at")

class EventOut(EventBase):
    id: Optional[str] = Field(default=None, alias="_id")
    created_by: Optional[str] = Field(default=None, alias="created_by")
    created_at: Optional[datetime] = Field(default=None, alias="created_at")
    updated_at: Optional[datetime] = Field(default=None, alias="updated_at")

# ------------------------------
# Event Roles
# ------------------------------

class EventRoleInDB(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[ObjectId] = Field(default=None, alias="_id")
    event_id: str = Field(alias="event_id")  # storing event reference by id string
    user_id: str = Field(alias="user_id")    # storing user reference by email string
    role: Literal["coordinator", "delegate"]

class EventRoleOut(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    event_id: str = Field(alias="event_id")
    user_id: str = Field(alias="user_id")
    role: Literal["coordinator", "delegate"]

# ------------------------------
# Task
# ------------------------------

class TaskBase(BaseModel):
    name: str
    description: Optional[str] = None
    location: Location
    location_name: Optional[str] = Field(default=None, alias="location_name")
    start_time: datetime = Field(alias="start_time")
    end_time: datetime = Field(alias="end_time")
    max_volunteers: Optional[int] = Field(default=None, alias="max_volunteers")
    assigned_delegate: str
    assigned_delegate_org_code: Optional[str] = None
    assigned_delegate_org: Optional[str] = None
    task_join_code: Optional[str] = None # backend will generate the code

class TaskInDB(TaskBase):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[ObjectId] = Field(default=None)
    event_id: str = Field(alias="event_id")
    created_by: str = Field(alias="created_by")  # email string
    created_at: Optional[datetime] = Field(default=None, alias="created_at")
    updated_at: Optional[datetime] = Field(default=None, alias="updated_at")

class TaskCreate(TaskBase):
    pass # This is just going to be used for reading in the data from the frontend

class TaskOut(TaskBase):
    id: Optional[str] = Field(default=None)
    event_id: str = Field(alias="event_id")

# ------------------------------
# Event Volunteers
# ------------------------------

class EventVolunteerInDB(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[ObjectId] = Field(default=None, alias="_id")
    event_id: str = Field(alias="event_id")
    user_id: str = Field(alias="user_id")  # store email string
    role: Literal["delegate", "volunteer"]
    organization: Optional[str] = Field(default=None, alias="organization")
    delegate_org_code: Optional[str] = Field(default=None, alias="delegate_org_code")
    delegate_user_id: Optional[str] = Field(default=None, alias="delegate_user_id")  # for volunteers, track which delegate/org invited them
    joined_at: datetime = Field(alias="joined_at")

class EventVolunteerOut(BaseModel):
    id: str = Field(alias="_id")
    event_id: str = Field(alias="event_id")
    user_id: str = Field(alias="user_id")
    role: Literal["delegate", "volunteer"]
    organization: Optional[str] = Field(default=None, alias="organization")
    delegate_org_code: Optional[str] = Field(default=None, alias="delegate_org_code")
    delegate_user_id: Optional[str] = Field(default=None, alias="delegate_user_id")
    joined_at: datetime = Field(alias="joined_at")

# ------------------------------
# Activity Assignments
# ------------------------------

class ActivityAssignmentInDB(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[ObjectId] = Field(default=None, alias="_id")
    event_id: str = Field(alias="event_id")
    activity_id: str = Field(alias="activity_id")
    user_id: str = Field(alias="user_id")
    assigned_by: str = Field(alias="assigned_by")
    assigned_at: datetime = Field(alias="assigned_at")

class ActivityAssignmentOut(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    event_id: str = Field(alias="event_id")
    activity_id: str = Field(alias="activity_id")
    user_id: str = Field(alias="user_id")
    assigned_by: str = Field(alias="assigned_by")
    assigned_at: datetime = Field(alias="assigned_at")


# NOT AI GENERATED
class OrganizerEventDetails(BaseModel):
    name: str
    description: Optional[str] = None
    location: Location
    location_name: Optional[str] = Field(default=None, alias="location_name")
    start_date: datetime = Field(alias="start_date")
    end_date: datetime = Field(alias="end_date")
    delegate_join_code: str = Field(alias="delegate_join_code")
    total_attendees: Optional[int] # We will use this for computing total attendees
    volunteers: Optional[List] # This will return all of the volunteers 
    delegates: Optional[List] # This will return all of the delegates

class VolunteerEventDetails(BaseModel):
    name: str
    description: Optional[str] = None
    location: Location
    location_name: Optional[str] = Field(default=None, alias="location_name")
    start_date: datetime = Field(alias="start_date")
    end_date: datetime = Field(alias="end_date")
    delegate_join_code: str = Field(alias="delegate_join_code")
    delegate_contact_info: str
    organizer_contact_info: str
    my_role: str
    task_description: str 
    task_location: Location
    task_location_name: str
    #checkin_status: str #add if we have time

class DelegateEventDetails(BaseModel):
    name: str
    description: Optional[str] = None
    location: Location
    location_name: Optional[str] = Field(default=None, alias="location_name")
    start_date: datetime = Field(alias="start_date")
    end_date: datetime = Field(alias="end_date")
    volunteer_join_code: str = Field(alias="volunteer_join_code")  # delegate/org join code
    total_attendees: Optional[int] # We will use this for computing total attendees just for this delegate's task
    volunteers: Optional[List] # This will return all of the volunteers 
    organizer_contact_info: str
    my_role: str
    task_description: str
    task_location: Location 
    task_location_name: str 
    #checkin_status: str  # add if we have time

class DelegateRequest(BaseModel):
    assigned_delegate: str

class JoinTaskIn(BaseModel):
    task_code: str
    

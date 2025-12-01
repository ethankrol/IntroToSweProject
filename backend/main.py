from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
import os
import smtplib
import ssl
import requests
from email.message import EmailMessage
from dotenv import load_dotenv
from fastapi.security import OAuth2PasswordRequestForm
from app.auth import create_access_token
from app.models import *
from app.auth import get_current_user
from app.database import lifespan, get_db
from app.users import get_by_email, create_user, authenticate_user
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Union
from bson import ObjectId
from datetime import datetime
from fastapi import HTTPException
from pydantic import EmailStr
from app.config import settings
from app.email_service import send_password_reset, send_email
import re

app = FastAPI(lifespan=lifespan)

# Load .env from repo root for SMTP and other dev settings
load_dotenv()

app.add_middleware(
    CORSMiddleware,
    # During local development we allow common local origins and enable credentials
    # so the server can set HttpOnly cookies. In production, replace these with
    # your actual allowed origins and keep allow_credentials=True only when needed.
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False
)

def _generate_join_code(length: int = 6) -> str:
    import secrets, string
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def _code_exists(db, code: str, exclude_id: ObjectId | None = None) -> bool:
    query: Dict = {
        '$or': [
            {'delegate_join_code': code},
            {'volunteer_join_code': code},
        ]
    }
    if exclude_id is not None:
        query['_id'] = {'$ne': exclude_id}
    return db['events'].find_one(query) is not None

def _generate_unique_join_code(db, length: int = 6, max_attempts: int = 100, exclude_id: ObjectId | None = None) -> str:
    for _ in range(max_attempts):
        code = _generate_join_code(length)
        if not _code_exists(db, code, exclude_id=exclude_id):
            return code
    raise HTTPException(status_code=500, detail='Failed to generate a unique join code')

def _generate_unique_task_code(db, length: int = 6, max_attempts: int = 100) -> str:
    import secrets, string
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(max_attempts):
        code = ''.join(secrets.choice(alphabet) for _ in range(length))
        if db['event_tasks'].find_one({'task_join_code': code}) is None:
            return code
    raise HTTPException(status_code=500, detail="Failed to generate unique task code")

def _generate_unique_delegate_org_code(db, length: int = 6, max_attempts: int = 100) -> str:
    import secrets, string
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(max_attempts):
        code = ''.join(secrets.choice(alphabet) for _ in range(length))
        if db['event_volunteers'].find_one({'delegate_org_code': code}) is None:
            return code
    raise HTTPException(status_code=500, detail='Failed to generate delegate org code')

def _find_delegate_by_org(db, org_name: str):
    """Find existing delegate record for an organization (case-insensitive)."""
    if not org_name:
        return None
    return db["event_volunteers"].find_one({
        "role": "delegate",
        "organization": {"$regex": f"^{re.escape(org_name)}$", "$options": "i"}
    })

@app.post('/token', response_model=Token)
def login_for_access_token(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db = Depends(get_db),
):
    """Authenticate user and return a JWT access token.

    Also sets an HttpOnly cookie named `access_token` so browser clients can
    store the token. The token is also returned in the response body to
    support clients that prefer to store it themselves.
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token({"sub": user.email})

    # Set cookie for browser-based clients. HttpOnly prevents JS access.
    # For local development we don't set Secure=True so cookies work over http.
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
    )

    return {"access_token": access_token, "token_type": "bearer"}
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    # authenticate_user expects db instance; obtain via request? use app.db via get_db shim
    # Since get_db is a dependency that expects Request, reuse users.authenticate_user by querying directly
    # create a dummy request-like object is not needed; instead access app.db directly
    db_instance = app.db
    user = authenticate_user(db_instance, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Incorrect username or password',
            headers={'WWW-Authenticate': 'Bearer'},
        )
    access_token = create_access_token(data={'sub': user.email})
    return {'access_token': access_token, 'token_type': 'bearer'}

@app.post('/signup')
def signup(user: UserCreate, db = Depends(get_db)):
    try:
        new_user = create_user(db, user)
    except HTTPException as e:
        raise e
    
    return {
        'message': 'User created successfully',
        'user': {
            'id': str(new_user.id) if new_user.id is not None else None,
            'first_name': new_user.first_name,
            'last_name': new_user.last_name,
            'email': new_user.email,
        }
    }

# ------------ Event upsert API (create or update) ------------
class EventUpsert(EventBase):
    id: Optional[str] = Field(default=None, alias="_id")
    # Allow backend to generate codes if omitted on create
    delegate_join_code: Optional[str] = Field(default=None, alias='delegate_join_code')
    volunteer_join_code: Optional[str] = Field(default=None, alias='volunteer_join_code')

@app.patch('/event', response_model=EventOut)
def upsert_event(event: EventUpsert, current_user=Depends(get_current_user)):
    db = app.db
    payload = event.model_dump(by_alias=True, exclude_unset=True)
    now = datetime.utcnow()

    doc: Dict = {}
    if payload.get('_id'):
        try:
            oid = ObjectId(payload['_id'])
        except Exception:
            raise HTTPException(status_code=400, detail='Invalid event id')
        payload.pop('_id', None)
        payload['updated_at'] = now
        res = db['events'].update_one({'_id': oid}, {'$set': payload})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail='Event not found')
        doc = db['events'].find_one({'_id': oid}) or {}
    else:
        payload['created_by'] = getattr(current_user, 'email', None) or (
            current_user.get('email') if isinstance(current_user, dict) else None
        )
        if not payload['created_by']:
            raise HTTPException(status_code=500, detail='Unable to determine creator email')
        payload['delegate_join_code'] = _generate_unique_join_code(db)
        payload['created_at'] = now
        payload['updated_at'] = now
        result = db['events'].insert_one(payload)
        doc = db['events'].find_one({'_id': result.inserted_id}) or {}

    if doc.get('_id'):
        doc['_id'] = str(doc['_id'])
    return EventOut.model_validate(doc)




@app.get("/events/{event_id}")
def get_event_details(event_id: str, role: str, current_user=Depends(get_current_user)):
    db = app.db
    email = getattr(current_user, "email", None)
    if not email:
        raise HTTPException(status_code=500, detail="Missing user email")

    try:
        oid = ObjectId(event_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid event id")

    event = db["events"].find_one({"_id": oid})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event["id"] = str(event["_id"])
    del event["_id"]

    if role == "organizer":
        vols = list(db["event_volunteers"].find({"event_id": event_id, "role": "volunteer"}))
        dels = list(db["event_volunteers"].find({"event_id": event_id, "role": "delegate"}))
        for v in vols:
            v["_id"] = str(v["_id"])
        for d in dels:
            d["_id"] = str(d["_id"])
        event["volunteers"] = vols
        event["delegates"] = dels
        event["total_attendees"] = len(vols) + len(dels)
        return OrganizerEventDetails(**event)

    if role == "volunteer":
        assignment = db["task_assignments"].find_one({"user_id": email, "event_id": event_id})
        if not assignment:
            raise HTTPException(status_code=400, detail="Volunteer is not assigned to a task")

        task = db["event_tasks"].find_one({"_id": ObjectId(assignment["activity_id"])})
        if not task:
            raise HTTPException(status_code=400, detail="Task not found")

        event["delegate_contact_info"] = task.get("assigned_delegate", "")
        event["organizer_contact_info"] = task.get("organizer_contact_info") or event.get("organizer_contact_info", "")
        event["my_role"] = "volunteer"
        event["task_description"] = task.get("description", "")
        event["task_location"] = task.get("location", {})
        event["task_location_name"] = task.get("location_name", "")
        return VolunteerEventDetails(**event)

    if role == "delegate":
        delegate_doc = db["event_volunteers"].find_one({"event_id": event_id, "user_id": email, "role": "delegate"})
        assignment = db["task_assignments"].find_one({"user_id": email, "event_id": event_id})
        if not assignment:
            raise HTTPException(status_code=400, detail="Delegate is not assigned to a task")

        task = db["event_tasks"].find_one({"_id": ObjectId(assignment["activity_id"])})
        if not task:
            raise HTTPException(status_code=400, detail="Task not found")

        volunteers = list(db["event_volunteers"].find({
            "event_id": event_id,
            "role": "volunteer",
            "delegate_org_code": delegate_doc.get("delegate_org_code") if delegate_doc else None
        }))
        event["total_attendees"] = len(volunteers)
        for v in volunteers:
            v["_id"] = str(v.get("_id", ""))
        event["volunteers"] = volunteers
        event["organizer_contact_info"] = task.get("organizer_contact_info") or event.get("organizer_contact_info", "")
        event["my_role"] = "delegate"
        if delegate_doc:
            event["volunteer_join_code"] = delegate_doc.get("delegate_org_code", "")
        event["task_description"] = task.get("description", "")
        event["task_location"] = task.get("location", {})
        event["task_location_name"] = task.get("location_name", "")
        return DelegateEventDetails(**event)

    raise HTTPException(status_code=400, detail="Invalid role")



# -------- Event listing & joining endpoints --------
@app.get('/events', response_model=List[EventOut])
def list_events(role: str, current_user=Depends(get_current_user)):
    """List events for a user by role: organizer|delegate|volunteer."""
    db = app.db
    email = getattr(current_user, 'email', None)
    if not email:
        raise HTTPException(status_code=500, detail='Missing user email')
    cursor = None
    if role == 'organizer':
        cursor = db['events'].find({'created_by': email})
    elif role in ('delegate','volunteer'):
        # Lookup event volunteer docs then fetch events
        ev_docs = list(db['event_volunteers'].find({'user_id': email, 'role': role}))
        event_ids = [d.get('event_id') for d in ev_docs if d.get('event_id')]
        # event_id stored as string; convert back to ObjectId for query
        oids = []
        for eid in event_ids:
            try:
                oids.append(ObjectId(eid))
            except Exception:
                continue
        cursor = db['events'].find({'_id': {'$in': oids}}) if oids else []
    else:
        raise HTTPException(status_code=400, detail='Invalid role')

    results = []
    for doc in cursor:
        if doc.get('_id'):
            doc['_id'] = str(doc['_id'])
        results.append(EventOut.model_validate(doc))
    return results

class JoinEventIn(BaseModel):
    code: str

@app.post("/event/join/{delegate_code}", response_model=EventOut)
def join_event(delegate_code: str, current_user=Depends(get_current_user)):
    db = app.db
    code = delegate_code.strip().upper()
    if len(code) != 6:
        raise HTTPException(status_code=400, detail="Code must be 6 characters")
    event_doc = db["events"].find_one({"delegate_join_code": code})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Invalid delegate join code")
    email = getattr(current_user, "email", None)
    if not email:
        raise HTTPException(status_code=500, detail="Missing user email")
    event_id_str = str(event_doc["_id"])
    existing = db["event_volunteers"].find_one({"event_id": event_id_str, "user_id": email})
    if existing:
        if existing.get("role") != "delegate":
            db["event_volunteers"].update_one({"_id": existing["_id"]}, {"$set": {"role": "delegate"}})
    else:
        db["event_volunteers"].insert_one({
            "event_id": event_id_str,
            "user_id": email,
            "role": "delegate",
            "joined_at": datetime.utcnow(),
    })
    event_doc["_id"] = event_id_str
    return EventOut.model_validate(event_doc)

class DelegateRegister(BaseModel):
    organization: str

@app.post("/delegate/register")
def register_delegate(payload: DelegateRegister, current_user=Depends(get_current_user), event_id: str | None = None):
    """
    Allow a delegate to register without an existing event. They can optionally pass an event_id or delegate code.
    If no event is provided, we store the delegate with event_id=None and generate an org code they can share now.
    """
    db = app.db
    email = getattr(current_user, "email", None)
    if not email:
        raise HTTPException(status_code=500, detail="Missing user email")

    event_doc = None
    if event_id:
        try:
            oid = ObjectId(event_id)
            event_doc = db["events"].find_one({"_id": oid})
        except Exception:
            code = event_id.strip().upper()
            if len(code) == 6:
                event_doc = db["events"].find_one({"delegate_join_code": code})

    event_id_str = str(event_doc["_id"]) if event_doc else None

    # If org already has a delegate record, reuse its code and update linkage/user/org
    existing_org_delegate = _find_delegate_by_org(db, payload.organization)
    delegate_code = None
    if existing_org_delegate:
        delegate_code = existing_org_delegate.get("delegate_org_code") or _generate_unique_delegate_org_code(db)
        db["event_volunteers"].update_one(
            {"_id": existing_org_delegate["_id"]},
            {"$set": {
                "organization": payload.organization,
                "delegate_org_code": delegate_code,
                "user_id": email,  # current user becomes the delegate contact for this org
                "event_id": event_id_str or existing_org_delegate.get("event_id"),
            }},
        )
    else:
        delegate_code = event_doc.get("delegate_join_code") if event_doc else _generate_unique_delegate_org_code(db)
        db["event_volunteers"].insert_one({
            "event_id": event_id_str,
            "user_id": email,
            "role": "delegate",
            "organization": payload.organization,
            "delegate_org_code": delegate_code,
            "joined_at": datetime.utcnow(),
        })

    # Also ensure a delegate record exists for this specific user+event (if different)
    existing_user_delegate = db["event_volunteers"].find_one({"event_id": event_id_str, "user_id": email, "role": "delegate"})
    if existing_user_delegate and existing_user_delegate.get("delegate_org_code") != delegate_code:
        db["event_volunteers"].update_one(
            {"_id": existing_user_delegate["_id"]},
            {"$set": {"delegate_org_code": delegate_code, "organization": payload.organization}},
        )
    elif not existing_user_delegate:
        db["event_volunteers"].insert_one({
            "event_id": event_id_str,
            "user_id": email,
            "role": "delegate",
            "organization": payload.organization,
            "delegate_org_code": delegate_code,
            "joined_at": datetime.utcnow(),
        })

    return {"event_id": event_id_str, "delegate_org_code": delegate_code}

@app.post("/delegate/attach/{event_id}/{delegate_org_code}")
def attach_delegate_to_event(event_id: str, delegate_org_code: str, current_user=Depends(get_current_user)):
    """
    Later step: attach a previously registered delegate/org (and their volunteers) to a specific event.
    """
    db = app.db
    code = delegate_org_code.strip().upper()
    event_doc = None
    try:
        oid = ObjectId(event_id)
        event_doc = db["events"].find_one({"_id": oid})
    except Exception:
        # Try event lookup by delegate join code
        join_code = event_id.strip().upper()
        if len(join_code) == 6:
            event_doc = db["events"].find_one({"delegate_join_code": join_code})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Event not found")
    event_id_str = str(event_doc["_id"])

    delegate_doc = db["event_volunteers"].find_one({"delegate_org_code": code, "role": "delegate"})
    if not delegate_doc:
        raise HTTPException(status_code=404, detail="Delegate org code not found")

    db["event_volunteers"].update_one({"_id": delegate_doc["_id"]}, {"$set": {"event_id": event_id_str}})

    db["event_volunteers"].update_many(
        {"delegate_org_code": code, "role": "volunteer"},
        {"$set": {"event_id": event_id_str}},
    )

    return {"event_id": event_id_str, "delegate_org_code": code}

@app.get("/delegate/profile")
def delegate_profile(current_user=Depends(get_current_user)):
    """Return delegate profile: name/email, organization, code, volunteers list and count."""
    db = app.db
    email = getattr(current_user, "email", None)
    if not email:
        raise HTTPException(status_code=500, detail="Missing user email")

    delegate_doc = db["event_volunteers"].find_one({"user_id": email, "role": "delegate"})
    if not delegate_doc:
        raise HTTPException(status_code=404, detail="Delegate not found")

    code = delegate_doc.get("delegate_org_code")
    org = delegate_doc.get("organization")
    event_id = delegate_doc.get("event_id")

    volunteers = list(db["event_volunteers"].find({
        "delegate_org_code": code,
        "role": "volunteer"
    }))
    volunteer_count = len(volunteers)
    for v in volunteers:
        v["_id"] = str(v.get("_id", ""))

    user_doc = db["users"].find_one({"email": email})
    full_name = ""
    if user_doc:
        first = user_doc.get("first_name") or ""
        last = user_doc.get("last_name") or ""
        full_name = f"{first} {last}".strip()

    return {
        "email": email,
        "name": full_name,
        "organization": org,
        "delegate_org_code": code,
        "event_id": event_id,
        "volunteer_count": volunteer_count,
        "volunteers": [{"email": v.get("user_id"), "organization": v.get("organization")} for v in volunteers],
    }

@app.post("/delegate/join/{delegate_org_code}")
def join_via_delegate(delegate_org_code: str, current_user=Depends(get_current_user)):
    """Volunteers join via a delegate's org code."""
    db = app.db
    code = delegate_org_code.strip().upper()
    email = getattr(current_user, "email", None)
    if not email:
        raise HTTPException(status_code=500, detail="Missing user email")

    delegate_doc = db["event_volunteers"].find_one({"delegate_org_code": code, "role": "delegate"})
    if not delegate_doc:
        raise HTTPException(status_code=404, detail="Invalid delegate org code")

    event_id = delegate_doc.get("event_id")
    organization = delegate_doc.get("organization")
    delegate_user_id = delegate_doc.get("user_id")

    existing = db["event_volunteers"].find_one({"event_id": event_id, "user_id": email})
    if existing:
        db["event_volunteers"].update_one(
            {"_id": existing["_id"]},
            {"$set": {"role": "volunteer", "organization": organization, "delegate_org_code": code, "delegate_user_id": delegate_user_id}},
        )
    else:
        db["event_volunteers"].insert_one({
            "event_id": event_id,
            "user_id": email,
            "role": "volunteer",
            "organization": organization,
            "delegate_org_code": code,
            "delegate_user_id": delegate_user_id,
            "joined_at": datetime.utcnow(),
        })

    try:
        oid = ObjectId(event_id)
        event_doc = db["events"].find_one({"_id": oid})
    except Exception:
        event_doc = None
    if event_doc and event_doc.get("_id"):
        event_doc["_id"] = str(event_doc["_id"])
        return EventOut.model_validate(event_doc)
    return {"event_id": event_id}

@app.get("/volunteer/profile")
def volunteer_profile(current_user=Depends(get_current_user)):
    """Return volunteer profile: delegate info, org code, and volunteers in the same org."""
    db = app.db
    email = getattr(current_user, "email", None)
    if not email:
        raise HTTPException(status_code=500, detail="Missing user email")

    vol_doc = db["event_volunteers"].find_one({"user_id": email, "role": "volunteer"})
    if not vol_doc:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    code = vol_doc.get("delegate_org_code")
    event_id = vol_doc.get("event_id")
    organization = vol_doc.get("organization")
    delegate_doc = db["event_volunteers"].find_one({"delegate_org_code": code, "role": "delegate"})

    volunteers = list(db["event_volunteers"].find({
        "delegate_org_code": code,
        "role": "volunteer"
    }))
    volunteer_count = len(volunteers)
    for v in volunteers:
        v["_id"] = str(v.get("_id", ""))

    return {
        "email": email,
        "organization": organization,
        "delegate_org_code": code,
        "event_id": event_id,
        "delegate_email": delegate_doc.get("user_id") if delegate_doc else None,
        "volunteer_count": volunteer_count,
        "volunteers": [{"email": v.get("user_id"), "organization": v.get("organization")} for v in volunteers],
    }

class RemoveVolunteer(BaseModel):
    volunteer_email: EmailStr

@app.post("/delegate/volunteer/remove")
def remove_volunteer(payload: RemoveVolunteer, current_user=Depends(get_current_user)):
    """Allow a delegate to remove a volunteer from their org."""
    db = app.db
    email = getattr(current_user, "email", None)
    if not email:
        raise HTTPException(status_code=500, detail="Missing user email")
    delegate_doc = db["event_volunteers"].find_one({"user_id": email, "role": "delegate"})
    if not delegate_doc:
        raise HTTPException(status_code=403, detail="Not a delegate")
    code = delegate_doc.get("delegate_org_code")
    vol_doc = db["event_volunteers"].find_one({"delegate_org_code": code, "role": "volunteer", "user_id": payload.volunteer_email})
    if not vol_doc:
        raise HTTPException(status_code=404, detail="Volunteer not found in your org")
    event_id = vol_doc.get("event_id")
    db["event_volunteers"].delete_one({"_id": vol_doc["_id"]})
    if event_id:
        db["task_assignments"].delete_many({"event_id": event_id, "user_id": payload.volunteer_email})
    return {"ok": True}

@app.post("/volunteer/leave")
def volunteer_leave(current_user=Depends(get_current_user)):
    """Volunteer leaves their org; removes their event membership and task assignments."""
    db = app.db
    email = getattr(current_user, "email", None)
    if not email:
        raise HTTPException(status_code=500, detail="Missing user email")
    vol_doc = db["event_volunteers"].find_one({"user_id": email, "role": "volunteer"})
    if not vol_doc:
        raise HTTPException(status_code=404, detail="Not a volunteer")
    event_id = vol_doc.get("event_id")
    code = vol_doc.get("delegate_org_code")
    db["event_volunteers"].delete_one({"_id": vol_doc["_id"]})
    if event_id:
        db["task_assignments"].delete_many({"event_id": event_id, "user_id": email})
    return {"ok": True, "delegate_org_code": code}


@app.post("/delegate/leave")
def delegate_leave(current_user=Depends(get_current_user)):
    """Allow a delegate to detach their org from an event and clear related assignments."""
    db = app.db
    email = getattr(current_user, "email", None)
    if not email:
        raise HTTPException(status_code=500, detail="Missing user email")

    delegate_doc = db["event_volunteers"].find_one({"user_id": email, "role": "delegate"})
    if not delegate_doc:
        raise HTTPException(status_code=404, detail="Delegate not found")

    event_id = delegate_doc.get("event_id")
    delegate_org_code = delegate_doc.get("delegate_org_code")

    # Detach the delegate from the event while keeping their org code
    db["event_volunteers"].update_one({"_id": delegate_doc["_id"]}, {"$set": {"event_id": None}})

    # Detach all volunteers in the same org
    volunteers = list(db["event_volunteers"].find({"delegate_org_code": delegate_org_code, "role": "volunteer"}))
    if volunteers:
        db["event_volunteers"].update_many(
            {"delegate_org_code": delegate_org_code, "role": "volunteer"},
            {"$set": {"event_id": None}},
        )

    # Remove task assignments for this org tied to the event
    if event_id:
        user_ids = [email] + [v.get("user_id") for v in volunteers if v.get("user_id")]
        db["task_assignments"].delete_many({"event_id": event_id, "user_id": {"$in": user_ids}})

    return {"ok": True, "delegate_org_code": delegate_org_code, "event_id": event_id}


# --------------- Task APIs ----------------
@app.post('/events/{event_id}/tasks', response_model=TaskOut)
def create_task(event_id: str, task: TaskCreate, current_user=Depends(get_current_user)):
    db = app.db
    task_dump = task.model_dump()
    task_dump['event_id'] = event_id
    task_dump['created_by'] = getattr(current_user, 'email', None)
    task_dump['organizer_contact_info'] = task_dump.get('organizer_contact_info') or getattr(current_user, 'email', None) or ""
    task_dump['task_join_code'] = _generate_unique_task_code(db)  # unique code per task
    task_dump['created_at'] = datetime.utcnow()
    task_dump['updated_at'] = datetime.utcnow()

    result = db['event_tasks'].insert_one(task_dump)
    task_dump['id'] = str(result.inserted_id)
    task_dump['volunteer_count'] = 0
    return TaskOut(**task_dump)


@app.get('/events/{event_id}/tasks', response_model=List[TaskOut])
def get_tasks_for_event(event_id: str):
    db = app.db
    tasks = list(db['event_tasks'].find({'event_id': event_id}))
    for t in tasks:
        t['id'] = str(t['_id'])
        count = db['task_assignments'].count_documents({"activity_id": t['id']})
        t['volunteer_count'] = count
    return [TaskOut(**t) for t in tasks]


@app.patch("/events/{event_id}/tasks/{task_id}", response_model=TaskOut)
def update_task(
    event_id: str,
    task_id: str,
    task_in: TaskCreate,
    current_user = Depends(get_current_user),
):
    """
    Update an existing task/activity.
    """
    db = app.db
    # Must convert string of object id to type object id
    try:
        oid = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid task_id")

    task = db["event_tasks"].find_one({"_id": oid, "event_id": event_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = task_in.model_dump(exclude_unset=True)
    if update_data:
        db["event_tasks"].update_one({"_id": oid}, {"$set": update_data})

    updated_task = db["event_tasks"].find_one({"_id": oid})
    updated_task["task_id"] = str(updated_task["_id"])
    updated_task["id"] = str(updated_task["_id"])
    updated_task["volunteer_count"] = db["task_assignments"].count_documents({"activity_id": str(updated_task["_id"])})
    return TaskOut(**updated_task)

class DelegateRequest(BaseModel):
    assigned_delegate: str

# Api for adding a delegate to a task
@app.patch("/events/{event_id}/tasks/{task_id}/assign", response_model = TaskOut)
def assign_delegate(event_id: str, task_id: str, request: DelegateRequest, current_user = Depends(get_current_user)):
    db = app.db
    try:
        oid = ObjectId(task_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid task id")

    task = db['event_tasks'].find_one({"_id":oid, 'event_id':event_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    delegate_doc = db['event_volunteers'].find_one({
        "event_id": event_id,
        "user_id": request.assigned_delegate,
        "role": "delegate"
    })
    update_set = {'assigned_delegate': request.assigned_delegate}
    if delegate_doc:
        update_set['assigned_delegate_org_code'] = delegate_doc.get("delegate_org_code")
        update_set['assigned_delegate_org'] = delegate_doc.get("organization")

    db['event_tasks'].update_one({'_id': oid}, {'$set': update_set})
    updated_task = db['event_tasks'].find_one({'_id': oid})
    updated_task['task_id'] = str(updated_task['_id'])
    updated_task['id'] = str(updated_task['_id'])

    # Auto-assign volunteers who joined via this delegate/org to this task
    if delegate_doc and delegate_doc.get("delegate_org_code"):
        code = delegate_doc["delegate_org_code"]
        volunteers = list(db['event_volunteers'].find({
            "event_id": event_id,
            "role": "volunteer",
            "delegate_org_code": code
        }))
        now = datetime.utcnow()
        for vol in volunteers:
            if not vol.get("user_id"):
                continue
            existing_assignment = db["task_assignments"].find_one({
                "activity_id": str(oid),
                "user_id": vol["user_id"],
            })
            if not existing_assignment:
                db["task_assignments"].insert_one({
                    "event_id": event_id,
                    "activity_id": str(oid),
                    "user_id": vol["user_id"],
                    "assigned_by": getattr(current_user, "email", None) or delegate_doc.get("user_id", ""),
                    "assigned_at": now,
                })

    updated_task['volunteer_count'] = db['task_assignments'].count_documents({"activity_id": str(updated_task["_id"])})
    return TaskOut(**updated_task)

@app.post("/tasks/join/{task_code}", response_model=TaskOut)
def join_task(task_code: str, current_user=Depends(get_current_user)):
    db = app.db
    code = task_code.strip().upper()
    email = getattr(current_user, "email", None)
    if not email:
        raise HTTPException(status_code=500, detail="Missing user email")

    task = db["event_tasks"].find_one({"task_join_code": code})
    if not task:
        raise HTTPException(status_code=404, detail="Invalid task join code")

    task_id_str = str(task["_id"])
    event_id = task["event_id"]

    existing_event_member = db["event_volunteers"].find_one({
        "event_id": event_id,
        "user_id": email
    })

    if not existing_event_member:
        db["event_volunteers"].insert_one({
            "event_id": event_id,
            "user_id": email,
            "role": "volunteer",
            "joined_at": datetime.utcnow(),
        })
    else:
        if existing_event_member.get("role") != "volunteer":
            db["event_volunteers"].update_one(
                {"_id": existing_event_member["_id"]},
                {"$set": {"role": "volunteer"}}
            )

    existing_assignment = db["task_assignments"].find_one({
        "activity_id": task_id_str,
        "user_id": email
    })

    if not existing_assignment:
        db["task_assignments"].insert_one({
            "event_id": event_id,
            "activity_id": task_id_str,
            "user_id": email,
            "assigned_by": task.get("assigned_delegate", ""),
            "assigned_at": datetime.utcnow()
        })

    task["id"] = task_id_str
    task["volunteer_count"] = db["task_assignments"].count_documents({"activity_id": task_id_str})
    return TaskOut(**task)

# ------------- Notification APIs -------------

class ResetRequest(BaseModel):
    email: str


@app.post('/request-reset')
def request_password_reset(payload: ResetRequest, request: Request):
    """Generate a one-time reset token and store its hash+expiry on the user doc."""
    db = request.app.db
    email = payload.email
    user = db['users'].find_one({'email': email})
    if not user:
        raise HTTPException(status_code=404, detail='No account found with that email address. Please check your email or sign up for a new account.')

    import secrets, hashlib
    from datetime import datetime, timedelta

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    expires = datetime.utcnow() + timedelta(hours=1)

    db['users'].update_one({'email': email}, {'$set': {'reset_token_hash': token_hash, 'reset_token_expires': expires}})

    sent_ok, err = send_password_reset(email, token)
    if sent_ok:
        return {'ok': True}
    if settings.DEBUG_EMAIL_FALLBACK:
        return {'ok': True, 'token': token, 'email_error': err}
    raise HTTPException(status_code=500, detail='Email send failed')

    


class ResetIn(BaseModel):
    token: str
    new_password: str


@app.post('/reset')
def reset_password(payload: ResetIn, request: Request):
    db = request.app.db
    import hashlib
    from datetime import datetime

    token_hash = hashlib.sha256(payload.token.encode('utf-8')).hexdigest()
    user = db['users'].find_one({'reset_token_hash': token_hash})
    if not user:
        raise HTTPException(status_code=400, detail='Invalid or expired token')
    expires = user.get('reset_token_expires')
    if not expires or expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail='Invalid or expired token')

    # Hash new password and update
    from app.users import get_password_hash
    new_hashed = get_password_hash(payload.new_password)
    db['users'].update_one({'_id': user['_id']}, {'$set': {'hashed_password': new_hashed}, '$unset': {'reset_token_hash': '', 'reset_token_expires': ''}})
    return {'ok': True}

@app.get("/geocode")
def geocode(address: str):
    """
    Proxy to Google Geocoding API so the mobile app never sees the real key.
    """
    if not settings.GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Geocoding not configured")

    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": address, "key": settings.GOOGLE_MAPS_API_KEY},
            timeout=10,
        )
    except Exception:
        raise HTTPException(status_code=502, detail="Error contacting geocoding service")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Bad response from geocoding service")

    data = resp.json()
    status_val = data.get("status")
    results = data.get("results", [])

    if status_val != "OK" or not results:
        raise HTTPException(status_code=400, detail="Geocoding failed")

    first = results[0]
    loc = first["geometry"]["location"]
    return {
        "formatted_address": first["formatted_address"],
        "lat": loc["lat"],
        "lng": loc["lng"],
    }


#@app.post('/login')

# ---------------------- Event + Notification Models ----------------------
#class EventUpdate(BaseModel):
    title: Optional[str] = None
    time: Optional[str] = None  # ISO string or display string
    address: Optional[str] = None
    description: Optional[str] = None
    is_private: Optional[bool] = None

#class EventOut(BaseModel):
    id: str
    title: str
    host: Optional[str] = None
    time: str
    address: str
    description: Optional[str] = None
    attendees: List[str] = []
    volunteers: List[str] = []
    is_private: bool = False

class NotificationOut(BaseModel):
    id: str
    event_id: Optional[str] = None
    message: str
    created_at: datetime
    read: bool = False

'''def _serialize_event(doc: Dict) -> EventOut:
    return EventOut(
        id=str(doc['_id']),
        title=doc.get('title',''),
        host=doc.get('host'),
        time=doc.get('time',''),
        address=doc.get('address',''),
        description=doc.get('description'),
        attendees=doc.get('attendees', []),
        volunteers=doc.get('volunteers', []),
        is_private=doc.get('is_private', False)
    )'''

def _create_notifications(db, event_doc: Dict, changed_fields: Dict):
    if not changed_fields:
        return
    # recipients: only registered users (volunteers + attendees)
    recipients = set(event_doc.get('volunteers', [])) | set(event_doc.get('attendees', []))
    if not recipients:
        return
    human_map = {
        'title': 'title',
        'time': 'time',
        'address': 'address',
        'description': 'description',
        'is_private': 'privacy setting'
    }
    msgs = []
    for field, info in changed_fields.items():
        old_val = info['old']
        new_val = info['new']
        if field == 'is_private':
            text = f"Event '{event_doc.get('title','')}' privacy changed: now {'Private' if new_val else 'Public'}"
        else:
            text = f"Event '{event_doc.get('title','')}' {human_map.get(field, field)} changed from '{old_val}' to '{new_val}'"
        msgs.append(text)
    now = datetime.utcnow()
    bulk_docs = []
    for user_email in recipients:
        for message in msgs:
            bulk_docs.append({
                'user_email': user_email,
                'event_id': event_doc['_id'],
                'message': message,
                'created_at': now,
                'read': False
            })
    if bulk_docs:
        db['notifications'].insert_many(bulk_docs)

# ---------------------- Event Endpoints ----------------------
'''@app.get('/events/{event_id}', response_model=EventOut)
def get_event(event_id: str, request: Request):
    db = request.app.db
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid event id')
    doc = db['events'].find_one({'_id': oid})
    if not doc:
        raise HTTPException(status_code=404, detail='Event not found')
    return _serialize_event(doc)

@app.patch('/events/{event_id}', response_model=EventOut)
def update_event(event_id: str, payload: EventUpdate, request: Request, current_user=Depends(get_current_user)):
    db = request.app.db
    # Simple admin check: assume host email is event host; only host can edit.
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid event id')
    doc = db['events'].find_one({'_id': oid})
    if not doc:
        raise HTTPException(status_code=404, detail='Event not found')
    host_email = doc.get('host')
    if host_email and host_email != current_user.email:
        raise HTTPException(status_code=403, detail='Only the event host can edit this event')

    update_ops = {}
    changed = {}
    for field in ['title','time','address','description','is_private']:
        new_val = getattr(payload, field)
        if new_val is not None and new_val != doc.get(field):
            changed[field] = {'old': doc.get(field), 'new': new_val}
            update_ops[field] = new_val

    if update_ops:
        db['events'].update_one({'_id': oid}, {'$set': update_ops})
        # refresh doc
        doc = db['events'].find_one({'_id': oid})
        _create_notifications(db, doc, changed)

    return _serialize_event(doc)'''

# ---------------------- Notification Endpoints ----------------------
@app.get('/notifications', response_model=List[NotificationOut])
def list_notifications(request: Request, current_user=Depends(get_current_user)):
    db = request.app.db
    cursor = db['notifications'].find({'user_email': current_user.email}).sort('created_at', -1)
    items = []
    for n in cursor:
        items.append(NotificationOut(
            id=str(n['_id']),
            event_id=str(n.get('event_id')) if n.get('event_id') else None,
            message=n.get('message',''),
            created_at=n.get('created_at'),
            read=n.get('read', False)
        ))
    return items

@app.post('/notifications/{notification_id}/read')
def mark_notification_read(notification_id: str, request: Request, current_user=Depends(get_current_user)):
    db = request.app.db
    try:
        oid = ObjectId(notification_id)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid notification id')
    doc = db['notifications'].find_one({'_id': oid})
    if not doc or doc.get('user_email') != current_user.email:
        raise HTTPException(status_code=404, detail='Notification not found')
    db['notifications'].update_one({'_id': oid}, {'$set': {'read': True}})
    return {'ok': True}


# === Dev test endpoint (add this) ===
class DevTestEmailIn(BaseModel):
    to: EmailStr

@app.post("/dev/test-email")
def dev_test_email(payload: DevTestEmailIn):
    ok, err = send_email(payload.to, "Test email", "This is a test from /dev/test-email")
    return {"ok": ok, "error": err}

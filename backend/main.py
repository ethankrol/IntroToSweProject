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




@app.get('/events/{event_id}', response_model=EventOut)
def get_event_details(event_id: str, role: str, current_user=Depends(get_current_user)):
    db = app.db
    email = getattr(current_user, 'email', None)
    if not email:
        raise HTTPException(status_code=500, detail='Missing user email')
    try:
        event_oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid event id')

    event = db['events'].find_one({'_id': event_oid})
    if not event:
        raise HTTPException(status_code=404, detail="Event does not exist in database")
    event['_id'] = str(event['_id'])

    task_cursor = db['event_tasks'].find({'event_id': event_id})
    tasks = []
    for t in task_cursor:
        t['_id'] = str(t['_id'])
        tasks.append({
            'id': t['_id'],
            'name': t.get('name', ''),
            'description': t.get('description', ''),
            'task_join_code': t.get('task_join_code', ''),
            'location_name': t.get('location_name', ''),
            'assigned_delegate': t.get('assigned_delegate', None),
        })
    event['tasks'] = tasks

    if role == 'organizer':
        total_delegates = list(db['event_volunteers'].find({'event_id': event_id, 'role': 'delegate'}))
        total_volunteers = list(db['event_volunteers'].find({'event_id': event_id, 'role': 'volunteer'}))
        for v in total_volunteers:
            v['_id'] = str(v['_id'])
        for d in total_delegates:
            d['_id'] = str(d['_id'])
        event['volunteers'] = [EventVolunteerOut(**v) for v in total_volunteers]
        event['delegates'] = [EventVolunteerOut(**d) for d in total_delegates]
        event['total_attendees'] = len(total_volunteers) + len(total_delegates)
        return OrganizerEventDetails(**event)
    elif role in ('volunteer', 'delegate'):
        user_task = db['event_tasks'].find_one({'event_id': event_id, 'assigned_delegate': email})
        if user_task:
            user_task['_id'] = str(user_task['_id'])
            event['my_task'] = {
                'id': user_task['_id'],
                'name': user_task.get('name', ''),
                'description': user_task.get('description', ''),
                'task_join_code': user_task.get('task_join_code', ''),
                'location_name': user_task.get('location_name', ''),
            }
        return EventOut.model_validate(event)
    else:
        raise HTTPException(status_code=400, detail="Invalid role. Must be volunteer, organizer, or delegate")


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


# --------------- Task APIs ----------------
@app.post('/events/{event_id}/tasks', response_model=TaskOut)
def create_task(event_id: str, task: TaskCreate, current_user=Depends(get_current_user)):
    db = app.db
    task_dump = task.model_dump()
    task_dump['event_id'] = event_id
    task_dump['created_by'] = getattr(current_user, 'email', None)
    task_dump['task_join_code'] = _generate_unique_task_code(db)  # unique code per task
    task_dump['created_at'] = datetime.utcnow()
    task_dump['updated_at'] = datetime.utcnow()

    result = db['event_tasks'].insert_one(task_dump)
    task_dump['id'] = str(result.inserted_id)
    return TaskOut(**task_dump)


@app.get('/events/{event_id}/tasks', response_model=List[TaskOut])
def get_tasks_for_event(event_id: str):
    db = app.db
    tasks = list(db['event_tasks'].find({'event_id': event_id}))
    for t in tasks:
        t['id'] = str(t['_id'])
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
    return TaskOut(**updated_task)

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

    db['event_tasks'].update_one({'_id': oid}, {'$set': {'assigned_delegate': request.assigned_delegate}})
    updated_task = db['event_tasks'].find_one({'_id': oid})
    updated_task['task_id'] = str(updated_task['_id'])
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
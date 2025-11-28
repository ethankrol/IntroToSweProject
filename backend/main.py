from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
import os
import smtplib
import ssl
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
from typing import Optional, List, Dict
from bson import ObjectId
from datetime import datetime
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
def upsert_event(event: EventUpsert, current_user = Depends(get_current_user)):
    """
    Create a new event when `_id` is not provided; otherwise update the existing event.
    """
    db = app.db
    payload = event.model_dump(by_alias=True, exclude_unset=True)
    now = datetime.utcnow()

    doc: Dict = {}
    if payload.get('_id'):
        # Update existing
        try:
            oid = ObjectId(payload['_id'])
        except Exception:
            raise HTTPException(status_code=400, detail='Invalid event id')
        payload.pop('_id', None)
        # If client attempts to change codes, enforce uniqueness
        if 'delegate_join_code' in payload:
            code = payload['delegate_join_code']
            if code and _code_exists(db, code, exclude_id=oid):
                raise HTTPException(status_code=409, detail='delegate_join_code already in use')
        if 'volunteer_join_code' in payload:
            code = payload['volunteer_join_code']
            if code and _code_exists(db, code, exclude_id=oid):
                raise HTTPException(status_code=409, detail='volunteer_join_code already in use')
        payload['updated_at'] = now
        res = db['events'].update_one({'_id': oid}, {'$set': payload})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail='Event not found')
        doc = db['events'].find_one({'_id': oid}) or {}
    else:
        # Create new
        payload['created_by'] = getattr(current_user, 'email', None) or (
            current_user.get('email') if isinstance(current_user, dict) else None
        )
        if not payload['created_by']:
            raise HTTPException(status_code=500, detail='Unable to determine creator email')
        # Generate join codes if not provided
        if not payload.get('delegate_join_code'):
            payload['delegate_join_code'] = _generate_unique_join_code(db)
        if not payload.get('volunteer_join_code'):
            # Ensure volunteer code differs from delegate code too
            code = _generate_unique_join_code(db)
            while code == payload['delegate_join_code']:
                code = _generate_unique_join_code(db)
            payload['volunteer_join_code'] = code
        payload['created_at'] = now
        payload['updated_at'] = now
        result = db['events'].insert_one(payload)
        doc = db['events'].find_one({'_id': result.inserted_id}) or {}

    # Coerce ObjectId to string for response model
    if doc.get('_id'):
        doc['_id'] = str(doc['_id'])
    return EventOut.model_validate(doc)

# -------- Event listing & joining endpoints --------
@app.get('/events', response_model=List[EventOut])
def list_events(role: str, current_user=Depends(get_current_user)):
    """List events for a user by role: organizer|delegate|volunteer."""
    db = app.db
    email = getattr(current_user, 'email', None) or (current_user.get('email') if isinstance(current_user, dict) else None)
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

@app.post('/event/join', response_model=EventOut)
def join_event(payload: JoinEventIn, current_user=Depends(get_current_user)):
    """Join an event using either delegate or volunteer join code."""
    db = app.db
    code = payload.code.strip().upper()
    if len(code) != 6:
        raise HTTPException(status_code=400, detail='Code must be 6 characters')
    doc = db['events'].find_one({'delegate_join_code': code})
    role = 'delegate'
    if not doc:
        doc = db['events'].find_one({'volunteer_join_code': code})
        role = 'volunteer'
    if not doc:
        raise HTTPException(status_code=404, detail='Invalid join code')
    email = getattr(current_user, 'email', None) or (current_user.get('email') if isinstance(current_user, dict) else None)
    if not email:
        raise HTTPException(status_code=500, detail='Missing user email')

    event_id_str = str(doc['_id'])
    existing = db['event_volunteers'].find_one({'event_id': event_id_str, 'user_id': email})
    if existing:
        # Already joined; optionally update role if differs
        if existing.get('role') != role:
            db['event_volunteers'].update_one({'_id': existing['_id']}, {'$set': {'role': role}})
    else:
        db['event_volunteers'].insert_one({
            'event_id': event_id_str,
            'user_id': email,
            'role': role,
            'joined_at': datetime.utcnow(),
            'notes': ''
        })
    doc['_id'] = event_id_str
    return EventOut.model_validate(doc)


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
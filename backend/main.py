from fastapi import FastAPI, Depends, HTTPException, status, Request
import os
import smtplib
import ssl
from email.message import EmailMessage
from dotenv import load_dotenv
from fastapi.security import OAuth2PasswordRequestForm
from app.auth import create_access_token
from app.models import User, Token, UserInDB, UserCreate
from app.dependencies import get_current_user
from app.database import lifespan, get_db
from app.users import get_by_email, create_user, authenticate_user
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(lifespan=lifespan)

# Load .env from repo root for SMTP and other dev settings
load_dotenv()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # or list specific origins instead of "*"
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,  # set True only with specific origins (no "*")
)

@app.post('/token', response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_db
    # authenticate_user expects db instance; obtain via request? use app.db via get_db shim
    # Since get_db is a dependency that expects Request, reuse users.authenticate_user by querying directly
    from app.database import get_db as _get_db
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
            'id': new_user.id,
            'first_name': new_user.first_name,
            'last_name': new_user.last_name,
            'email': new_user.email
            }
        }


@app.post('/request-reset')
def request_password_reset(email: str, request: Request):
    """Generate a one-time reset token and store its hash+expiry on the user doc.
    For minimal dev setup this endpoint returns the plain token in the response so you can
    paste it into the reset form; in production you'd email the token and not return it.
    """
    db = request.app.db
    user = db['users'].find_one({'email': email})
    # Always respond 200 to avoid leaking which emails exist
    if not user:
        return {'ok': True}

    import secrets, hashlib
    from datetime import datetime, timedelta

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    expires = datetime.utcnow() + timedelta(hours=1)

    db['users'].update_one({'email': email}, {'$set': {'reset_token_hash': token_hash, 'reset_token_expires': expires}})

    # Try to send email if SMTP is configured. Read SMTP settings from env.
    smtp_host = os.getenv('SMTP_HOST')
    if smtp_host:
        def send_reset_email(to_address: str, token_value: str) -> bool:
            smtp_port = int(os.getenv('SMTP_PORT', '587'))
            smtp_user = os.getenv('SMTP_USER')
            smtp_pass = os.getenv('SMTP_PASS')
            smtp_from = os.getenv('SMTP_FROM', smtp_user)
            use_tls = os.getenv('SMTP_TLS', 'true').lower() in ('1', 'true', 'yes')
            frontend = os.getenv('FRONTEND_URL', 'http://localhost:19006')
            reset_link = f"{frontend}/reset?token={token_value}"

            msg = EmailMessage()
            msg['Subject'] = 'Password reset for GatorGather'
            msg['From'] = smtp_from
            msg['To'] = to_address
            msg.set_content(f"You requested a password reset. Use the following link to reset your password (expires in 1 hour):\n\n{reset_link}\n\nIf you didn't request this, ignore this message.")

            try:
                if smtp_port == 465:
                    context = ssl.create_default_context()
                    with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context) as server:
                        if smtp_user and smtp_pass:
                            server.login(smtp_user, smtp_pass)
                        server.send_message(msg)
                else:
                    with smtplib.SMTP(smtp_host, smtp_port) as server:
                        if use_tls:
                            server.starttls(context=ssl.create_default_context())
                        if smtp_user and smtp_pass:
                            server.login(smtp_user, smtp_pass)
                        server.send_message(msg)
                return True
            except Exception as e:
                # Log error and fall back to returning token in response for dev
                print('Failed to send reset email:', e)
                return False

        sent = send_reset_email(email, token)
        if sent:
            return {'ok': True}

    # DEV: return token so it can be used in testing (don't do this in production)
    return {'ok': True, 'token': token}


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
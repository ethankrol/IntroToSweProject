from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from app.auth import create_access_token
from app.models import User, Token, UserInDB, UserCreate
from app.dependencies import get_current_user
from app.database import lifespan, get_db
from app.users import get_by_email, create_user, authenticate_user
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(lifespan=lifespan)

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

@app.post('/event')
def create_event()

#@app.post('/login')
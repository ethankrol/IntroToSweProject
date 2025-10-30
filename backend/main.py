from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from app.auth import create_access_token
from app.models import User, Token, UserInDB, UserCreate
from app.dependencies import get_current_user
from app.database import lifespan, get_db
from app.users import get_by_email, create_user
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # or list specific origins instead of "*"
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,  # set True only with specific origins (no "*")
)

@app.post('/token', response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    pass

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

#@app.post('/login')
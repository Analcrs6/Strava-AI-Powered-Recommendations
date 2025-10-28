from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from ..db import get_db
from .. import models
import logging
import hashlib
import secrets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    """Hash a password with a salt."""
    if salt is None:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return pwd_hash.hex(), salt

def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored hash (format: salt$hash)."""
    try:
        salt, pwd_hash = stored_hash.split('$')
        computed_hash, _ = hash_password(password, salt)
        return computed_hash == pwd_hash
    except:
        return False

class UserCreate(BaseModel):
    id: str
    name: str
    email: Optional[str] = None

class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    location: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    name: str
    email: str | None = None
    bio: str | None = None
    location: str | None = None
    profile_image_url: str | None = None

@router.post("/signup", response_model=UserOut)
def signup(payload: UserSignup, db: Session = Depends(get_db)):
    """Register a new user with email and password."""
    # Check if email already exists
    existing_user = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing_user:
        logger.warning(f"Attempt to signup with existing email: {payload.email}")
        raise HTTPException(400, "Email already registered")
    
    # Hash password
    pwd_hash, salt = hash_password(payload.password)
    password_hash = f"{salt}${pwd_hash}"
    
    # Create user
    user_id = f"user_{secrets.token_hex(8)}"
    user = models.User(
        id=user_id,
        name=payload.name,
        email=payload.email,
        password_hash=password_hash,
        location=payload.location
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"✅ User signed up: {user_id} ({payload.name}) - {payload.email}")
    return UserOut.model_validate(user.__dict__)

@router.post("/login", response_model=UserOut)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Login with email and password."""
    # Find user by email
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        logger.warning(f"Login attempt with non-existent email: {payload.email}")
        raise HTTPException(401, "Invalid email or password")
    
    # Verify password
    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        logger.warning(f"Login attempt with wrong password for: {payload.email}")
        raise HTTPException(401, "Invalid email or password")
    
    logger.info(f"✅ User logged in: {user.id} ({user.name}) - {user.email}")
    return UserOut.model_validate(user.__dict__)

@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    """Create a user (for demo/testing purposes)."""
    if db.get(models.User, payload.id):
        logger.warning(f"Attempt to create duplicate user: {payload.id}")
        raise HTTPException(400, "user already exists")
    user = models.User(id=payload.id, name=payload.name, email=payload.email)
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"✅ User created: {payload.id} ({payload.name})")
    return UserOut.model_validate(user.__dict__)

@router.get("", response_model=List[UserOut])
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = db.query(models.User).offset(skip).limit(limit).all()
    logger.info(f"📋 Listed {len(users)} users (skip={skip}, limit={limit})")
    return [UserOut.model_validate(u.__dict__) for u in users]

@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.get(models.User, user_id)
    if not user:
        logger.warning(f"User not found: {user_id}")
        raise HTTPException(404, "user not found")
    logger.info(f"👤 Retrieved user: {user_id}")
    return UserOut.model_validate(user.__dict__)

@router.delete("/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    """
    Delete a user and all associated data.
    This will also delete all activities created by this user.
    """
    user = db.get(models.User, user_id)
    if not user:
        logger.warning(f"Attempt to delete non-existent user: {user_id}")
        raise HTTPException(404, "user not found")
    
    # Count activities before deletion
    activity_count = db.query(models.Activity).filter(models.Activity.user_id == user_id).count()
    
    # Delete all user's activities
    db.query(models.Activity).filter(models.Activity.user_id == user_id).delete()
    
    # Delete the user
    db.delete(user)
    db.commit()
    
    logger.info(f"🗑️  User deleted: {user_id} ({user.name}) - {activity_count} activities removed")
    
    return {
        "success": True,
        "message": f"User {user_id} and {activity_count} associated activities deleted successfully"
    }


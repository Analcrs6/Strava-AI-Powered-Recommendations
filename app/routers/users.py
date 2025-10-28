from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime
from ..db import get_db
from .. import models
from ..auth import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    create_refresh_token,
    create_email_verification_token,
    verify_email_token,
    create_password_reset_token,
    verify_password_reset_token,
    get_current_user,
    decode_token
)
import logging
import secrets
import random

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


async def send_verification_email(email: str, token: str):
    """Send verification email (implement with your email service)."""
    # TODO: Implement with SendGrid, AWS SES, or similar
    verification_link = f"http://localhost:3000/verify-email?token={token}"
    logger.info(f"📧 Verification email would be sent to {email}")
    logger.info(f"   Link: {verification_link}")
    # In production, send actual email here


async def send_password_reset_email(email: str, token: str):
    """Send password reset email."""
    reset_link = f"http://localhost:3000/reset-password?token={token}"
    logger.info(f"📧 Password reset email would be sent to {email}")
    logger.info(f"   Link: {reset_link}")
    # In production, send actual email here

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
    email_verified: bool = False
    preferred_strategy: str = "content_mmr"
    units: str = "metric"

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class UserPreferencesUpdate(BaseModel):
    preferred_strategy: Optional[str] = None
    preferred_lambda: Optional[float] = None
    exclude_seen: Optional[bool] = None
    preferred_sports: Optional[List[str]] = None
    units: Optional[str] = None
    theme: Optional[str] = None

@router.post("/signup", response_model=TokenResponse)
async def signup(
    payload: UserSignup, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Register a new user with email and password."""
    # Check if email already exists
    existing_user = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing_user:
        logger.warning(f"Attempt to signup with existing email: {payload.email}")
        raise HTTPException(400, "Email already registered")
    
    # Hash password
    password_hash = get_password_hash(payload.password)
    
    # Create email verification token
    verification_token = create_email_verification_token(payload.email)
    
    # Assign A/B test group (50/50 split for ensemble_mmr vs content_mmr)
    ab_group = random.choice(["A", "B"])
    
    # Create user
    user_id = f"user_{secrets.token_hex(8)}"
    user = models.User(
        id=user_id,
        name=payload.name,
        email=payload.email,
        password_hash=password_hash,
        location=payload.location,
        email_verification_token=verification_token,
        ab_test_group=ab_group,
        preferred_strategy="ensemble_mmr" if ab_group == "B" else "content_mmr"
    )
    db.add(user)
    
    # Create default preferences
    prefs = models.UserPreference(
        user_id=user_id,
        preferred_strategy=user.preferred_strategy
    )
    db.add(prefs)
    
    db.commit()
    db.refresh(user)
    
    # Send verification email in background
    background_tasks.add_task(send_verification_email, payload.email, verification_token)
    
    # Create JWT tokens
    access_token = create_access_token(data={"sub": user_id})
    refresh_token = create_refresh_token(data={"sub": user_id})
    
    logger.info(f"✅ User signed up: {user_id} ({payload.name}) - {payload.email} [AB: {ab_group}]")
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user.__dict__)
    )


@router.post("/login", response_model=TokenResponse)
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
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create JWT tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    logger.info(f"✅ User logged in: {user.id} ({user.name}) - {user.email}")
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user.__dict__)
    )

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


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Refresh access token using refresh token."""
    try:
        token_data = decode_token(payload.refresh_token)
        
        # Verify it's a refresh token
        if token_data.get("type") != "refresh":
            raise HTTPException(401, "Invalid token type")
        
        user_id = token_data.get("sub")
        user = db.get(models.User, user_id)
        
        if not user:
            raise HTTPException(404, "User not found")
        
        # Create new tokens
        access_token = create_access_token(data={"sub": user_id})
        refresh_token = create_refresh_token(data={"sub": user_id})
        
        logger.info(f"🔄 Token refreshed for user: {user_id}")
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserOut.model_validate(user.__dict__)
        )
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(401, "Invalid or expired refresh token")


@router.post("/verify-email")
async def verify_email(token: str, db: Session = Depends(get_db)):
    """Verify user's email address."""
    email = verify_email_token(token)
    if not email:
        raise HTTPException(400, "Invalid or expired verification token")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(404, "User not found")
    
    user.email_verified = True
    user.email_verification_token = None
    db.commit()
    
    logger.info(f"✅ Email verified: {email}")
    
    return {"success": True, "message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    email: EmailStr,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Resend email verification."""
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        # Don't reveal if email exists
        return {"success": True, "message": "If the email exists, verification link has been sent"}
    
    if user.email_verified:
        raise HTTPException(400, "Email already verified")
    
    # Create new verification token
    verification_token = create_email_verification_token(email)
    user.email_verification_token = verification_token
    db.commit()
    
    # Send verification email
    background_tasks.add_task(send_verification_email, email, verification_token)
    
    return {"success": True, "message": "Verification email sent"}


@router.post("/forgot-password")
async def forgot_password(
    payload: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Request password reset."""
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    
    # Always return success to prevent email enumeration
    if user:
        reset_token = create_password_reset_token(payload.email)
        background_tasks.add_task(send_password_reset_email, payload.email, reset_token)
        logger.info(f"🔑 Password reset requested for: {payload.email}")
    
    return {"success": True, "message": "If the email exists, password reset link has been sent"}


@router.post("/reset-password")
async def reset_password(
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """Reset password using reset token."""
    email = verify_password_reset_token(payload.token)
    if not email:
        raise HTTPException(400, "Invalid or expired reset token")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(404, "User not found")
    
    # Update password
    user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    
    logger.info(f"🔒 Password reset for: {email}")
    
    return {"success": True, "message": "Password reset successfully"}


@router.get("/me", response_model=UserOut)
async def get_current_user_info(
    current_user: models.User = Depends(get_current_user)
):
    """Get current authenticated user info."""
    return UserOut.model_validate(current_user.__dict__)


@router.get("/me/preferences")
async def get_user_preferences(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user preferences."""
    prefs = db.query(models.UserPreference).filter(
        models.UserPreference.user_id == current_user.id
    ).first()
    
    if not prefs:
        # Create default preferences
        prefs = models.UserPreference(user_id=current_user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    
    return prefs


@router.patch("/me/preferences")
async def update_user_preferences(
    payload: UserPreferencesUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user preferences."""
    prefs = db.query(models.UserPreference).filter(
        models.UserPreference.user_id == current_user.id
    ).first()
    
    if not prefs:
        prefs = models.UserPreference(user_id=current_user.id)
        db.add(prefs)
    
    # Update fields
    if payload.preferred_strategy is not None:
        prefs.preferred_strategy = payload.preferred_strategy
        current_user.preferred_strategy = payload.preferred_strategy
    
    if payload.preferred_lambda is not None:
        prefs.preferred_lambda = payload.preferred_lambda
    
    if payload.exclude_seen is not None:
        prefs.exclude_seen = payload.exclude_seen
    
    if payload.preferred_sports is not None:
        prefs.preferred_sports = payload.preferred_sports
    
    if payload.units is not None:
        prefs.units = payload.units
        current_user.units = payload.units
    
    if payload.theme is not None:
        prefs.theme = payload.theme
    
    prefs.updated_at = datetime.utcnow()
    db.commit()
    
    logger.info(f"⚙️  Preferences updated for user: {current_user.id}")
    
    return prefs


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


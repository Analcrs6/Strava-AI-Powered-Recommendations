from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from ..db import get_db
from .. import models
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])

class UserCreate(BaseModel):
    id: str
    name: str

class UserOut(BaseModel):
    id: str
    name: str
    email: str | None = None
    bio: str | None = None
    location: str | None = None
    profile_image_url: str | None = None

@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if db.get(models.User, payload.id):
        logger.warning(f"Attempt to create duplicate user: {payload.id}")
        raise HTTPException(400, "user already exists")
    user = models.User(id=payload.id, name=payload.name)
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


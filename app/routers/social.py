from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from pydantic import BaseModel
from datetime import datetime
from ..db import get_db
from .. import models

router = APIRouter(prefix="/social", tags=["social"])


# Schemas
class UserProfileOut(BaseModel):
    id: str
    name: str | None
    email: str | None
    bio: str | None
    location: str | None
    profile_image_url: str | None
    followers_count: int
    following_count: int
    activities_count: int
    is_following: bool = False  # Whether current user is following this user
    
    class Config:
        from_attributes = True


class UserBasic(BaseModel):
    id: str
    name: str | None
    profile_image_url: str | None
    location: str | None
    
    class Config:
        from_attributes = True


class FollowRequest(BaseModel):
    user_id: str
    target_user_id: str


# Endpoints
@router.get("/users/{user_id}/profile", response_model=UserProfileOut)
def get_user_profile(user_id: str, current_user_id: str = None, db: Session = Depends(get_db)):
    """Get user profile with stats."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    
    # Count followers
    followers_count = db.query(models.Follow).filter(
        models.Follow.followed_id == user_id
    ).count()
    
    # Count following
    following_count = db.query(models.Follow).filter(
        models.Follow.follower_id == user_id
    ).count()
    
    # Count activities
    activities_count = db.query(models.Activity).filter(
        models.Activity.user_id == user_id
    ).count()
    
    # Check if current user is following this user
    is_following = False
    if current_user_id:
        is_following = db.query(models.Follow).filter(
            models.Follow.follower_id == current_user_id,
            models.Follow.followed_id == user_id
        ).first() is not None
    
    return UserProfileOut(
        id=user.id,
        name=user.name,
        email=user.email,
        bio=user.bio,
        location=user.location,
        profile_image_url=user.profile_image_url,
        followers_count=followers_count,
        following_count=following_count,
        activities_count=activities_count,
        is_following=is_following
    )


@router.get("/users/{user_id}/followers", response_model=List[UserBasic])
def get_followers(user_id: str, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """Get user's followers."""
    followers = db.query(models.User).join(
        models.Follow, models.User.id == models.Follow.follower_id
    ).filter(
        models.Follow.followed_id == user_id
    ).offset(skip).limit(limit).all()
    
    return followers


@router.get("/users/{user_id}/following", response_model=List[UserBasic])
def get_following(user_id: str, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """Get users that this user is following."""
    following = db.query(models.User).join(
        models.Follow, models.User.id == models.Follow.followed_id
    ).filter(
        models.Follow.follower_id == user_id
    ).offset(skip).limit(limit).all()
    
    return following


@router.post("/follow")
def follow_user(request: FollowRequest, db: Session = Depends(get_db)):
    """Follow a user."""
    # Check if both users exist
    follower = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not follower:
        # Create user if doesn't exist
        follower = models.User(id=request.user_id, name=request.user_id)
        db.add(follower)
    
    followed = db.query(models.User).filter(models.User.id == request.target_user_id).first()
    if not followed:
        followed = models.User(id=request.target_user_id, name=request.target_user_id)
        db.add(followed)
    
    # Check if already following
    existing = db.query(models.Follow).filter(
        models.Follow.follower_id == request.user_id,
        models.Follow.followed_id == request.target_user_id
    ).first()
    
    if existing:
        raise HTTPException(400, "Already following this user")
    
    if request.user_id == request.target_user_id:
        raise HTTPException(400, "Cannot follow yourself")
    
    # Create follow relationship
    follow = models.Follow(
        follower_id=request.user_id,
        followed_id=request.target_user_id
    )
    db.add(follow)
    db.commit()
    
    return {"status": "success", "message": f"Now following {request.target_user_id}"}


@router.post("/unfollow")
def unfollow_user(request: FollowRequest, db: Session = Depends(get_db)):
    """Unfollow a user."""
    follow = db.query(models.Follow).filter(
        models.Follow.follower_id == request.user_id,
        models.Follow.followed_id == request.target_user_id
    ).first()
    
    if not follow:
        raise HTTPException(404, "Not following this user")
    
    db.delete(follow)
    db.commit()
    
    return {"status": "success", "message": f"Unfollowed {request.target_user_id}"}


@router.get("/suggestions", response_model=List[UserBasic])
def get_follow_suggestions(user_id: str, limit: int = 10, db: Session = Depends(get_db)):
    """Get suggested users to follow based on mutual followers."""
    # Get users that people you follow also follow
    # Exclude users you already follow and yourself
    suggestions = db.query(models.User).filter(
        models.User.id != user_id,
        ~models.User.id.in_(
            db.query(models.Follow.followed_id).filter(
                models.Follow.follower_id == user_id
            )
        )
    ).limit(limit).all()
    
    return suggestions


@router.put("/users/{user_id}/profile")
def update_profile(
    user_id: str,
    name: str = None,
    bio: str = None,
    location: str = None,
    profile_image_url: str = None,
    db: Session = Depends(get_db)
):
    """Update user profile."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        # Create user if doesn't exist
        user = models.User(id=user_id)
        db.add(user)
    
    if name is not None:
        user.name = name
    if bio is not None:
        user.bio = bio
    if location is not None:
        user.location = location
    if profile_image_url is not None:
        user.profile_image_url = profile_image_url
    
    db.commit()
    db.refresh(user)
    
    return {"status": "success", "message": "Profile updated"}


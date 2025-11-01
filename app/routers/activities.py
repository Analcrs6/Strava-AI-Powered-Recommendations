from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from .. import models
from ..schemas import ActivityCreate, ActivityOut
from ..auth import get_current_user
import secrets

router = APIRouter(prefix="/activities", tags=["activities"])

@router.post("", response_model=ActivityOut)
def create_activity(
    payload: ActivityCreate, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Generate unique activity ID
    activity_id = f"activity_{secrets.token_hex(8)}"
    
    # Ensure uniqueness (very unlikely collision, but just in case)
    while db.get(models.Activity, activity_id):
        activity_id = f"activity_{secrets.token_hex(8)}"
    
    obj = models.Activity(
        id=activity_id,
        user_id=current_user.id,  # Auto-fill from authenticated user
        sport=payload.sport,
        duration_s=payload.duration_s,
        distance_m=payload.distance_m,
        elevation_gain_m=payload.elevation_gain_m,
        hr_avg=payload.hr_avg,
        features=payload.features,
    )
    db.add(obj); db.commit(); db.refresh(obj)
    return ActivityOut.model_validate(obj.__dict__)

@router.get("", response_model=List[ActivityOut])
def list_activities(
    skip: int = 0, 
    limit: int = 20, 
    include_demo: bool = False,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List current user's activities (excludes demo data by default)."""
    query = db.query(models.Activity).filter(models.Activity.user_id == current_user.id)
    
    # Filter out demo data unless explicitly requested
    if not include_demo:
        query = query.filter(models.Activity.demo_session_id == None)
    
    activities = query.offset(skip).limit(limit).all()
    return [ActivityOut.model_validate(a.__dict__) for a in activities]

@router.get("/all", response_model=List[ActivityOut])
def list_all_activities(skip: int = 0, limit: int = 20, include_demo: bool = False, db: Session = Depends(get_db)):
    """List all activities (admin endpoint - no authentication required for demo purposes)."""
    query = db.query(models.Activity)
    
    # Filter out demo data unless explicitly requested
    if not include_demo:
        query = query.filter(models.Activity.demo_session_id == None)
    
    activities = query.offset(skip).limit(limit).all()
    return [ActivityOut.model_validate(a.__dict__) for a in activities]

@router.get("/{activity_id}", response_model=ActivityOut)
def get_activity(
    activity_id: str, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    activity = db.get(models.Activity, activity_id)
    if not activity:
        raise HTTPException(404, "activity not found")
    
    # Check if user owns this activity
    if activity.user_id != current_user.id:
        raise HTTPException(403, "access denied - not your activity")
    
    return ActivityOut.model_validate(activity.__dict__)


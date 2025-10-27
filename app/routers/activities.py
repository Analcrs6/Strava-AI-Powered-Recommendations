from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from .. import models
from ..schemas import ActivityCreate, ActivityOut

router = APIRouter(prefix="/activities", tags=["activities"])

@router.post("", response_model=ActivityOut)
def create_activity(payload: ActivityCreate, db: Session = Depends(get_db)):
    if db.get(models.Activity, payload.id):
        raise HTTPException(400, "activity already exists")
    obj = models.Activity(
        id=payload.id,
        user_id=payload.user_id,
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
def list_activities(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    activities = db.query(models.Activity).offset(skip).limit(limit).all()
    return [ActivityOut.model_validate(a.__dict__) for a in activities]

@router.get("/{activity_id}", response_model=ActivityOut)
def get_activity(activity_id: str, db: Session = Depends(get_db)):
    activity = db.get(models.Activity, activity_id)
    if not activity:
        raise HTTPException(404, "activity not found")
    return ActivityOut.model_validate(activity.__dict__)


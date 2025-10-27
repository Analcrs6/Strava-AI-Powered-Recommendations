from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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


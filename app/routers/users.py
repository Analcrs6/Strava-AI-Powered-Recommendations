from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from ..db import get_db
from .. import models

router = APIRouter(prefix="/users", tags=["users"])

class UserCreate(BaseModel):
    id: str
    name: str

class UserOut(BaseModel):
    id: str
    name: str

@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if db.get(models.User, payload.id):
        raise HTTPException(400, "user already exists")
    user = models.User(id=payload.id, name=payload.name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user.__dict__)

@router.get("", response_model=List[UserOut])
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return [UserOut.model_validate(u.__dict__) for u in users]

@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(404, "user not found")
    return UserOut.model_validate(user.__dict__)


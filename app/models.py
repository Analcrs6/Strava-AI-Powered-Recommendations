from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from .db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    name = Column(String)

class Activity(Base):
    __tablename__ = "activities"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    sport = Column(String)
    started_at = Column(DateTime)
    duration_s = Column(Float)
    distance_m = Column(Float)
    elevation_gain_m = Column(Float)
    hr_avg = Column(Float)
    features = Column(JSONB)  # store raw feature dict for now
    user = relationship("User")


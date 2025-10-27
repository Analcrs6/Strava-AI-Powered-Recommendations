from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from .db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    name = Column(String)
    demo_session_id = Column(String, nullable=True)  # Track demo data

class Activity(Base):
    __tablename__ = "activities"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True)  # Made nullable - no FK constraint for flexibility
    sport = Column(String)
    started_at = Column(DateTime, nullable=True)
    duration_s = Column(Float)
    distance_m = Column(Float)
    elevation_gain_m = Column(Float, nullable=True)
    hr_avg = Column(Float, nullable=True)
    features = Column(JSONB, nullable=True)  # store raw feature dict for now
    demo_session_id = Column(String, nullable=True)  # Track demo data


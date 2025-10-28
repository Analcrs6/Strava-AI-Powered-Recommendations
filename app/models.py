from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from .db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    name = Column(String)
    email = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    demo_session_id = Column(String, nullable=True)  # Track demo data
    
    # Real-time location sharing for mutual followers
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    last_location_update = Column(DateTime, nullable=True)
    location_sharing_enabled = Column(Boolean, default=False)
    
    # Relationships
    followers = relationship("Follow", foreign_keys="Follow.followed_id", back_populates="followed_user", cascade="all, delete-orphan")
    following = relationship("Follow", foreign_keys="Follow.follower_id", back_populates="follower_user", cascade="all, delete-orphan")

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


class Follow(Base):
    """User follow relationships (like Instagram followers/following)"""
    __tablename__ = "follows"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    follower_id = Column(String, ForeignKey("users.id"), nullable=False)  # Who is following
    followed_id = Column(String, ForeignKey("users.id"), nullable=False)  # Who is being followed
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    follower_user = relationship("User", foreign_keys=[follower_id], back_populates="following")
    followed_user = relationship("User", foreign_keys=[followed_id], back_populates="followers")


from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, DECIMAL
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from .db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    name = Column(String)
    email = Column(String, unique=True, nullable=True, index=True)
    password_hash = Column(String, nullable=True)  # For email/password authentication
    bio = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    demo_session_id = Column(String, nullable=True)  # Track demo data
    
    # Email verification
    email_verified = Column(Boolean, default=False)
    email_verification_token = Column(String, nullable=True)
    
    # Account status
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    
    # User preferences
    preferred_strategy = Column(String, default="content_mmr")  # Default recommendation strategy
    preferred_lambda = Column(Float, default=0.3)  # Default diversity parameter
    preferred_sport = Column(String, nullable=True)  # Favorite sport
    units = Column(String, default="metric")  # metric or imperial
    
    # A/B Testing
    ab_test_group = Column(String, nullable=True)  # Which A/B test group the user is in
    
    # Real-time location sharing for mutual followers (high-precision)
    latitude = Column(DECIMAL(10, 8), nullable=True)  # ±90.00000000 (~1.1mm precision)
    longitude = Column(DECIMAL(11, 8), nullable=True)  # ±180.00000000 (~1.1mm precision)
    location_accuracy = Column(DECIMAL(8, 2), nullable=True)  # Accuracy in meters
    location_source = Column(String(50), nullable=True)  # 'gps', 'network', 'manual'
    proximity_threshold = Column(Integer, default=500)  # Custom threshold in meters (100-2000)
    last_location_update = Column(DateTime, nullable=True)
    location_sharing_enabled = Column(Boolean, default=False)
    
    # Relationships
    followers = relationship("Follow", foreign_keys="Follow.followed_id", back_populates="followed_user", cascade="all, delete-orphan")
    following = relationship("Follow", foreign_keys="Follow.follower_id", back_populates="follower_user", cascade="all, delete-orphan")

class Activity(Base):
    __tablename__ = "activities"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # Cascade delete when user is deleted
    sport = Column(String)
    started_at = Column(DateTime, nullable=True)
    duration_s = Column(Float)
    distance_m = Column(Float)
    elevation_gain_m = Column(Float, nullable=True)
    hr_avg = Column(Float, nullable=True)
    features = Column(JSONB, nullable=True)  # store raw feature dict for now
    demo_session_id = Column(String, nullable=True)  # Track demo data
    created_at = Column(DateTime, default=datetime.utcnow)


class Follow(Base):
    """User follow relationships (like Instagram followers/following)"""
    __tablename__ = "follows"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    follower_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # Who is following
    followed_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # Who is being followed
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    follower_user = relationship("User", foreign_keys=[follower_id], back_populates="following")
    followed_user = relationship("User", foreign_keys=[followed_id], back_populates="followers")


class RecommendationLog(Base):
    """Track recommendations shown to users for analytics and A/B testing"""
    __tablename__ = "recommendation_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query_activity_id = Column(String, nullable=False)  # Activity used as query
    recommended_activity_id = Column(String, nullable=False)  # Activity recommended
    strategy = Column(String, nullable=False)  # Strategy used
    lambda_diversity = Column(Float, nullable=True)
    score = Column(Float, nullable=False)  # Recommendation score
    rank = Column(Integer, nullable=False)  # Position in results (1-10)
    clicked = Column(Boolean, default=False)  # Did user click?
    completed = Column(Boolean, default=False)  # Did user complete the route?
    created_at = Column(DateTime, default=datetime.utcnow)
    ab_test_group = Column(String, nullable=True)  # A/B test group


class UserPreference(Base):
    """Store detailed user preferences"""
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Recommendation preferences
    preferred_strategy = Column(String, default="content_mmr")
    preferred_lambda = Column(Float, default=0.3)
    exclude_seen = Column(Boolean, default=False)
    
    # Activity preferences
    preferred_sports = Column(JSONB, default=list)  # List of preferred sports
    min_distance = Column(Float, nullable=True)
    max_distance = Column(Float, nullable=True)
    min_elevation = Column(Float, nullable=True)
    max_elevation = Column(Float, nullable=True)
    preferred_surface = Column(String, nullable=True)
    
    # Notification preferences
    email_notifications = Column(Boolean, default=True)
    push_notifications = Column(Boolean, default=True)
    weekly_summary = Column(Boolean, default=True)
    
    # Display preferences
    units = Column(String, default="metric")  # metric or imperial
    theme = Column(String, default="light")  # light or dark
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ABTestExperiment(Base):
    """A/B testing experiments"""
    __tablename__ = "ab_test_experiments"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)  # e.g., "ensemble_vs_content_mmr"
    description = Column(Text, nullable=True)
    
    # Variants (stored as JSON)
    variants = Column(JSONB, nullable=False)  # e.g., {"A": "content_mmr", "B": "ensemble_mmr"}
    
    # Status
    is_active = Column(Boolean, default=True)
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    
    # Metrics
    total_users = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    """User notifications for real-time updates"""
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Notification details
    type = Column(String, nullable=False)  # activity_completed, follower_new, achievement, etc.
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    data = Column(JSONB, default=dict)  # Additional data
    
    # Status
    read = Column(Boolean, default=False, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class LocationHistory(Base):
    """Track user location history for movement validation"""
    __tablename__ = "location_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # High-precision coordinates
    latitude = Column(DECIMAL(10, 8), nullable=False)
    longitude = Column(DECIMAL(11, 8), nullable=False)
    
    # Location metadata
    accuracy = Column(DECIMAL(8, 2), nullable=True)  # Accuracy in meters
    source = Column(String(50), nullable=True)  # 'gps', 'network', 'manual'
    altitude = Column(DECIMAL(8, 2), nullable=True)  # Altitude in meters
    speed = Column(DECIMAL(8, 2), nullable=True)  # Speed in m/s
    heading = Column(DECIMAL(6, 2), nullable=True)  # Direction in degrees (0-360)
    
    # Movement validation
    distance_from_previous = Column(DECIMAL(10, 2), nullable=True)
    time_from_previous = Column(Integer, nullable=True)
    speed_calculated = Column(DECIMAL(8, 2), nullable=True)
    is_valid = Column(Boolean, default=True)
    
    # Timestamps
    recorded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)


class ProximityEvent(Base):
    """Track proximity events for notification management"""
    __tablename__ = "proximity_events"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    nearby_user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Event details
    event_type = Column(String(20), nullable=False)  # 'entered', 'exited', 'within'
    distance_meters = Column(DECIMAL(10, 2), nullable=False)
    threshold_meters = Column(Integer, nullable=False)
    
    # User locations at time of event
    user_latitude = Column(DECIMAL(10, 8), nullable=False)
    user_longitude = Column(DECIMAL(11, 8), nullable=False)
    nearby_latitude = Column(DECIMAL(10, 8), nullable=False)
    nearby_longitude = Column(DECIMAL(11, 8), nullable=False)
    
    # Notification tracking
    notification_sent = Column(Boolean, default=False, index=True)
    notification_sent_at = Column(DateTime, nullable=True)
    
    # Timestamps
    detected_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)


class UserLocationPreference(Base):
    """User preferences for location sharing and notifications"""
    __tablename__ = "user_location_preferences"
    
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    
    # Proximity notification preferences
    notify_on_proximity = Column(Boolean, default=True)
    proximity_cooldown_minutes = Column(Integer, default=30)
    notify_only_favorites = Column(Boolean, default=False)
    
    # Location sharing preferences
    share_with_all_mutual = Column(Boolean, default=True)
    share_accuracy = Column(Boolean, default=True)
    
    # Movement tracking preferences
    min_movement_meters = Column(Integer, default=10)
    max_update_frequency_seconds = Column(Integer, default=30)
    
    # Privacy settings
    ghost_mode = Column(Boolean, default=False)
    visible_distance_limit = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


"""
Location Sharing & Proximity Detection for Mutual Followers
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
import math

from ..db import get_db
from .. import models

router = APIRouter(prefix="/location", tags=["location"])

# Pydantic schemas
class LocationUpdate(BaseModel):
    user_id: str
    latitude: float
    longitude: float
    sharing_enabled: bool = True

class UserLocation(BaseModel):
    user_id: str
    name: str
    latitude: float
    longitude: float
    distance_km: float
    last_update: datetime
    profile_image_url: Optional[str] = None

class ProximityNotification(BaseModel):
    user_id: str
    name: str
    distance_km: float
    message: str

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two coordinates using Haversine formula.
    Returns distance in kilometers.
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2) * math.sin(delta_lat/2) + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * \
        math.sin(delta_lon/2) * math.sin(delta_lon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    distance = R * c
    return distance

def is_mutual_follower(user_id: str, other_user_id: str, db: Session) -> bool:
    """Check if two users follow each other (mutual followers)"""
    follows_them = db.query(models.Follow).filter(
        models.Follow.follower_id == user_id,
        models.Follow.followed_id == other_user_id
    ).first() is not None
    
    they_follow_me = db.query(models.Follow).filter(
        models.Follow.follower_id == other_user_id,
        models.Follow.followed_id == user_id
    ).first() is not None
    
    return follows_them and they_follow_me

@router.post("/update")
def update_location(location: LocationUpdate, db: Session = Depends(get_db)):
    """Update user's current location"""
    try:
        user = db.query(models.User).filter(models.User.id == location.user_id).first()
        if not user:
            raise HTTPException(404, "User not found")
        
        user.latitude = location.latitude
        user.longitude = location.longitude
        user.last_location_update = datetime.utcnow()
        user.location_sharing_enabled = location.sharing_enabled
        
        db.commit()
        
        print(f"📍 Location updated for {user.name}: ({location.latitude}, {location.longitude})")
        
        return {
            "success": True,
            "message": "Location updated successfully",
            "user_id": location.user_id,
            "latitude": location.latitude,
            "longitude": location.longitude
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to update location: {str(e)}")

@router.get("/mutual-followers/{user_id}")
def get_mutual_followers_locations(
    user_id: str,
    max_distance_km: float = 50.0,
    db: Session = Depends(get_db)
) -> List[UserLocation]:
    """
    Get locations of mutual followers who are nearby.
    Only shows users who:
    1. Follow you AND you follow them (mutual)
    2. Have location sharing enabled
    3. Have updated location within last 30 minutes
    """
    try:
        # Get current user
        current_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not current_user:
            raise HTTPException(404, "User not found")
        
        if not current_user.latitude or not current_user.longitude:
            return []
        
        # Get all users following me
        my_followers = db.query(models.Follow).filter(
            models.Follow.followed_id == user_id
        ).all()
        follower_ids = {f.follower_id for f in my_followers}
        
        # Get all users I follow
        i_follow = db.query(models.Follow).filter(
            models.Follow.follower_id == user_id
        ).all()
        following_ids = {f.followed_id for f in i_follow}
        
        # Find mutual followers
        mutual_ids = follower_ids & following_ids
        
        if not mutual_ids:
            return []
        
        # Get users with recent locations and sharing enabled
        cutoff_time = datetime.utcnow() - timedelta(minutes=30)
        nearby_users = []
        
        for mutual_id in mutual_ids:
            user = db.query(models.User).filter(models.User.id == mutual_id).first()
            if not user or not user.location_sharing_enabled:
                continue
            
            if not user.latitude or not user.longitude or not user.last_location_update:
                continue
            
            if user.last_location_update < cutoff_time:
                continue  # Location too old
            
            # Calculate distance
            distance = calculate_distance(
                current_user.latitude,
                current_user.longitude,
                user.latitude,
                user.longitude
            )
            
            if distance <= max_distance_km:
                nearby_users.append(UserLocation(
                    user_id=user.id,
                    name=user.name,
                    latitude=user.latitude,
                    longitude=user.longitude,
                    distance_km=round(distance, 2),
                    last_update=user.last_location_update,
                    profile_image_url=user.profile_image_url
                ))
        
        # Sort by distance
        nearby_users.sort(key=lambda x: x.distance_km)
        
        print(f"📍 Found {len(nearby_users)} nearby mutual followers for {current_user.name}")
        
        return nearby_users
    except Exception as e:
        print(f"Error getting mutual followers locations: {e}")
        raise HTTPException(500, f"Failed to get locations: {str(e)}")

@router.get("/proximity-check/{user_id}")
def check_proximity_notifications(
    user_id: str,
    proximity_threshold_km: float = 5.0,
    db: Session = Depends(get_db)
) -> List[ProximityNotification]:
    """
    Check if any mutual followers are within proximity threshold.
    Returns list of users nearby for notification purposes.
    """
    try:
        nearby_users = get_mutual_followers_locations(
            user_id=user_id,
            max_distance_km=proximity_threshold_km,
            db=db
        )
        
        notifications = []
        for user in nearby_users:
            if user.distance_km <= proximity_threshold_km:
                message = f"{user.name} is {user.distance_km:.1f}km away from you!"
                notifications.append(ProximityNotification(
                    user_id=user.user_id,
                    name=user.name,
                    distance_km=user.distance_km,
                    message=message
                ))
        
        if notifications:
            print(f"🔔 {len(notifications)} proximity notifications for user {user_id}")
        
        return notifications
    except Exception as e:
        print(f"Error checking proximity: {e}")
        raise HTTPException(500, f"Failed to check proximity: {str(e)}")

@router.post("/toggle-sharing/{user_id}")
def toggle_location_sharing(
    user_id: str,
    enabled: bool,
    db: Session = Depends(get_db)
):
    """Enable or disable location sharing"""
    try:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(404, "User not found")
        
        user.location_sharing_enabled = enabled
        db.commit()
        
        status = "enabled" if enabled else "disabled"
        print(f"📍 Location sharing {status} for {user.name}")
        
        return {
            "success": True,
            "message": f"Location sharing {status}",
            "enabled": enabled
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to toggle location sharing: {str(e)}")


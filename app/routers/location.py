"""
Location Sharing & Proximity Detection for Mutual Followers
Enhanced with high-precision coordinates and Vincenty's formula
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
import math

from ..db import get_db
from .. import models
from ..services.precision_distance import (
    PrecisionDistanceCalculator,
    Coordinate,
    get_distance_calculator,
    get_movement_filter
)

router = APIRouter(prefix="/location", tags=["location"])

# Initialize precision calculator
distance_calculator = get_distance_calculator()
movement_filter = get_movement_filter()

# Pydantic schemas with high-precision validation
class LocationUpdate(BaseModel):
    user_id: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = Field(None, ge=0)  # Accuracy in meters
    source: Optional[str] = Field(None, pattern="^(gps|network|manual)$")
    altitude: Optional[float] = None
    speed: Optional[float] = Field(None, ge=0)
    heading: Optional[float] = Field(None, ge=0, le=360)
    sharing_enabled: bool = True
    
    @field_validator('latitude', 'longitude')
    @classmethod
    def validate_precision(cls, v):
        """Ensure coordinates have appropriate precision (8 decimal places)"""
        if v is not None:
            # Round to 8 decimal places for storage
            return round(v, 8)
        return v

class UserLocation(BaseModel):
    user_id: str
    name: str
    latitude: float
    longitude: float
    distance_meters: float  # Changed from distance_km to meters for precision
    distance_km: float  # Keep for backward compatibility
    accuracy: Optional[float] = None
    source: Optional[str] = None
    last_update: datetime
    profile_image_url: Optional[str] = None

class ProximityNotification(BaseModel):
    user_id: str
    name: str
    distance_meters: float
    distance_km: float  # Keep for backward compatibility
    message: str
    event_type: str  # 'entered', 'within', 'exited'

def calculate_distance_precise(
    lat1: float, 
    lon1: float, 
    lat2: float, 
    lon2: float,
    use_vincenty: bool = True
) -> float:
    """
    Calculate distance between two coordinates using Vincenty's formula (default).
    Returns distance in meters with sub-meter accuracy.
    
    Args:
        lat1, lon1: First coordinate
        lat2, lon2: Second coordinate
        use_vincenty: Use Vincenty's formula (True) or Haversine (False)
    
    Returns:
        Distance in meters
    """
    try:
        coord1 = Coordinate(
            latitude=Decimal(str(lat1)),
            longitude=Decimal(str(lon1))
        )
        coord2 = Coordinate(
            latitude=Decimal(str(lat2)),
            longitude=Decimal(str(lon2))
        )
        
        distance_meters = distance_calculator.calculate_distance(
            coord1, 
            coord2,
            use_vincenty=use_vincenty
        )
        
        return distance_meters
    except Exception as e:
        print(f"Error calculating distance: {e}")
        # Fallback to simple Haversine
        return _haversine_fallback(lat1, lon1, lat2, lon2)

def _haversine_fallback(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Fallback Haversine calculation in meters"""
    R = 6371000  # Earth's radius in meters
    
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
    """
    Update user's current location with high-precision coordinates.
    Includes movement validation to filter erratic position jumps.
    """
    try:
        user = db.query(models.User).filter(models.User.id == location.user_id).first()
        if not user:
            print(f"User {location.user_id} not found for location update")
            return {
                "success": False,
                "message": "User not found",
                "user_id": location.user_id
            }
        
        # Validate movement if we have previous location
        validation_passed = True
        validation_message = None
        
        if user.latitude and user.longitude and user.last_location_update:
            try:
                # Create coordinates for validation
                previous_coord = Coordinate(
                    latitude=Decimal(str(user.latitude)),
                    longitude=Decimal(str(user.longitude)),
                    timestamp=user.last_location_update
                )
                
                current_coord = Coordinate(
                    latitude=Decimal(str(location.latitude)),
                    longitude=Decimal(str(location.longitude)),
                    accuracy=Decimal(str(location.accuracy)) if location.accuracy else None,
                    timestamp=datetime.utcnow(),
                    source=location.source
                )
                
                # Validate movement
                validation = distance_calculator.validate_movement(previous_coord, current_coord)
                
                if not validation.is_valid:
                    validation_passed = False
                    validation_message = validation.reason
                    print(f"Invalid movement for {user.name}: {validation.reason}")
                    
                    return {
                        "success": False,
                        "message": f"Movement validation failed: {validation.reason}",
                        "user_id": location.user_id,
                        "validation": {
                            "distance_meters": validation.distance_meters,
                            "speed_mps": validation.speed_mps,
                            "reason": validation.reason
                        }
                    }
            except Exception as e:
                print(f"Error validating movement: {e}")
                # Continue with update if validation fails
        
        # Update user location with high precision
        user.latitude = Decimal(str(location.latitude))
        user.longitude = Decimal(str(location.longitude))
        user.location_accuracy = Decimal(str(location.accuracy)) if location.accuracy else None
        user.location_source = location.source or 'unknown'
        user.last_location_update = datetime.utcnow()
        user.location_sharing_enabled = location.sharing_enabled
        
        db.commit()
        
        print(f"Location updated for {user.name}: ({location.latitude:.8f}, {location.longitude:.8f}) "
              f"± {location.accuracy}m from {location.source}")
        
        return {
            "success": True,
            "message": "Location updated successfully",
            "user_id": location.user_id,
            "latitude": float(location.latitude),
            "longitude": float(location.longitude),
            "accuracy": location.accuracy,
            "source": location.source,
            "validation_passed": validation_passed
        }
    except Exception as e:
        db.rollback()
        print(f"Error updating location: {e}")
        return {
            "success": False,
            "message": str(e),
            "user_id": location.user_id
        }

@router.get("/mutual-followers/{user_id}")
def get_mutual_followers_locations(
    user_id: str,
    max_distance_meters: float = 50000.0,  # Changed to meters (default 50km)
    use_vincenty: bool = True,  # Use high-precision Vincenty formula
    db: Session = Depends(get_db)
) -> List[UserLocation]:
    """
    Get locations of mutual followers who are nearby using high-precision calculations.
    Only shows users who:
    1. Follow you AND you follow them (mutual)
    2. Have location sharing enabled
    3. Have updated location within last 30 minutes
    
    Args:
        user_id: Current user ID
        max_distance_meters: Maximum distance in meters (default 50km)
        use_vincenty: Use Vincenty's formula for sub-meter accuracy
    """
    try:
        # Get current user
        current_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not current_user:
            print(f"User {user_id} not found for location lookup")
            return []
        
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
            
            # Calculate distance with high precision (Vincenty's formula)
            distance_meters = calculate_distance_precise(
                float(current_user.latitude),
                float(current_user.longitude),
                float(user.latitude),
                float(user.longitude),
                use_vincenty=use_vincenty
            )
            
            if distance_meters <= max_distance_meters:
                nearby_users.append(UserLocation(
                    user_id=user.id,
                    name=user.name,
                    latitude=float(user.latitude),
                    longitude=float(user.longitude),
                    distance_meters=round(distance_meters, 2),
                    distance_km=round(distance_meters / 1000, 2),  # Convert to km
                    accuracy=float(user.location_accuracy) if user.location_accuracy else None,
                    source=user.location_source,
                    last_update=user.last_location_update,
                    profile_image_url=user.profile_image_url
                ))
        
        # Sort by distance
        nearby_users.sort(key=lambda x: x.distance_meters)
        
        print(f"Found {len(nearby_users)} nearby mutual followers for {current_user.name}")
        
        return nearby_users
    except Exception as e:
        print(f"Error getting mutual followers locations: {e}")
        return []

@router.get("/proximity-check/{user_id}")
def check_proximity_notifications(
    user_id: str,
    proximity_threshold_meters: float = 500.0,  # Changed to 500m (from 5km)
    db: Session = Depends(get_db)
) -> List[ProximityNotification]:
    """
    Check if any mutual followers are within proximity threshold.
    Now uses 500m default threshold (changed from 5km) for more precise notifications.
    Implements enter/exit hysteresis to prevent notification spam.
    
    Args:
        user_id: Current user ID
        proximity_threshold_meters: Proximity threshold in meters (default 500m)
    """
    try:
        # Get user's custom proximity threshold if set
        current_user = db.query(models.User).filter(models.User.id == user_id).first()
        if current_user and current_user.proximity_threshold:
            proximity_threshold_meters = float(current_user.proximity_threshold)
        
        # Add hysteresis (10% buffer to prevent oscillation)
        search_threshold = proximity_threshold_meters * 1.1
        
        nearby_users = get_mutual_followers_locations(
            user_id=user_id,
            max_distance_meters=search_threshold,
            use_vincenty=True,
            db=db
        )
        
        notifications = []
        for user in nearby_users:
            distance_meters = user.distance_meters
            
            # Check if within threshold
            if distance_meters <= proximity_threshold_meters:
                # Determine event type
                event_type = 'within'
                
                # Check for recent proximity events to determine if this is an 'enter' event
                recent_event = db.query(models.ProximityEvent).filter(
                    models.ProximityEvent.user_id == user_id,
                    models.ProximityEvent.nearby_user_id == user.user_id,
                    models.ProximityEvent.detected_at > datetime.utcnow() - timedelta(minutes=30)
                ).order_by(models.ProximityEvent.detected_at.desc()).first()
                
                if not recent_event or recent_event.event_type == 'exited':
                    event_type = 'entered'
                
                # Create notification message
                if distance_meters < 100:
                    message = f"{user.name} is very close - {distance_meters:.0f}m away!"
                elif distance_meters < 250:
                    message = f"{user.name} is nearby - {distance_meters:.0f}m away!"
                else:
                    message = f"{user.name} is {distance_meters:.0f}m away from you!"
                
                notifications.append(ProximityNotification(
                    user_id=user.user_id,
                    name=user.name,
                    distance_meters=round(distance_meters, 1),
                    distance_km=round(distance_meters / 1000, 2),
                    message=message,
                    event_type=event_type
                ))
                
                # Log proximity event
                try:
                    proximity_event = models.ProximityEvent(
                        user_id=user_id,
                        nearby_user_id=user.user_id,
                        event_type=event_type,
                        distance_meters=Decimal(str(distance_meters)),
                        threshold_meters=int(proximity_threshold_meters),
                        user_latitude=current_user.latitude if current_user else None,
                        user_longitude=current_user.longitude if current_user else None,
                        nearby_latitude=Decimal(str(user.latitude)),
                        nearby_longitude=Decimal(str(user.longitude)),
                        detected_at=datetime.utcnow()
                    )
                    db.add(proximity_event)
                    db.commit()
                except Exception as e:
                    print(f"Error logging proximity event: {e}")
                    db.rollback()
        
        if notifications:
            print(f"{len(notifications)} proximity notifications for user {user_id}")
        
        return notifications
    except Exception as e:
        print(f"Error checking proximity: {e}")
        return []

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
            # Gracefully handle non-existent user
            print(f"User {user_id} not found for location sharing toggle")
            return {
                "success": False,
                "message": "User not found",
                "enabled": False
            }
        
        user.location_sharing_enabled = enabled
        db.commit()
        
        status = "enabled" if enabled else "disabled"
        print(f"Location sharing {status} for {user.name}")
        
        return {
            "success": True,
            "message": f"Location sharing {status}",
            "enabled": enabled
        }
    except Exception as e:
        db.rollback()
        print(f"Error toggling location sharing: {e}")
        return {
            "success": False,
            "message": str(e),
            "enabled": False
        }


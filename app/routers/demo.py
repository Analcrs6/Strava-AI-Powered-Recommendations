from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import pandas as pd
import uuid
from datetime import datetime
from ..db import get_db, get_demo_db
from .. import models
from ..config import settings
from ..services.recommender import recsys
from ..schemas import RecommendRequest, RecommendResponse, RecommendItem, RouteMetadata

router = APIRouter(prefix="/demo", tags=["demo"])

# Store current demo session ID (in production, use Redis or similar)
CURRENT_DEMO_SESSION = None

def check_demo_enabled():
    """Check if demo mode is enabled."""
    if not settings.demo_mode_enabled:
        raise HTTPException(
            status_code=403, 
            detail="Demo mode is disabled. Set DEMO_MODE_ENABLED=true to enable it."
        )

def get_or_create_demo_session():
    """Get or create a demo session ID."""
    global CURRENT_DEMO_SESSION
    if not CURRENT_DEMO_SESSION:
        CURRENT_DEMO_SESSION = f"demo_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{str(uuid.uuid4())[:8]}"
    return CURRENT_DEMO_SESSION

def clear_demo_session():
    """Clear the current demo session."""
    global CURRENT_DEMO_SESSION
    CURRENT_DEMO_SESSION = None


class UserInfo(BaseModel):
    user_id: str
    activity_count: int
    total_distance: float
    total_duration: float


class DemoLoadRequest(BaseModel):
    user_id: str


class DemoLoadResponse(BaseModel):
    status: str
    user_id: str
    activities_loaded: int
    message: str
    session_id: str


class DemoSessionResponse(BaseModel):
    session_id: Optional[str]
    active: bool
    users_count: int
    activities_count: int


@router.get("/users", response_model=List[UserInfo])
def get_demo_users():
    """Get list of available users from CSV for demo."""
    check_demo_enabled()
    try:
        import os
        csv_path = settings.csv_seed_path
        
        # Check if file exists
        if not os.path.exists(csv_path):
            print(f"❌ CSV file not found at: {csv_path}")
            print(f"   Current working directory: {os.getcwd()}")
            print(f"   Files in app/resources/: {os.listdir('app/resources') if os.path.exists('app/resources') else 'directory not found'}")
            raise HTTPException(404, f"CSV file not found at {csv_path}")
        
        print(f"📊 Loading demo users from: {csv_path}")
        df = pd.read_csv(csv_path)
        print(f"   Loaded {len(df)} rows")
        print(f"   Columns: {df.columns.tolist()}")
        
        # Ensure we have the right columns
        if "distance_km_user" in df.columns:
            df["distance_m"] = df["distance_km_user"] * 1000
        elif "distance_m" not in df.columns:
            df["distance_m"] = 5000  # default 5km
            
        if "average_pace_min_per_km" in df.columns and "distance_km_user" in df.columns:
            df["duration_s"] = df["average_pace_min_per_km"] * df["distance_km_user"] * 60
        elif "duration_s" not in df.columns:
            df["duration_s"] = 1800  # default 30 minutes
        
        # Check if user_id column exists
        if "user_id" not in df.columns:
            raise HTTPException(500, "CSV file missing 'user_id' column")
        
        # Get user statistics
        user_stats = df.groupby('user_id', as_index=False).agg({
            'route_id': 'count',  # Count activities per user
            'distance_m': 'sum',
            'duration_s': 'sum'
        })
        
        user_stats.columns = ['user_id', 'activity_count', 'total_distance', 'total_duration']
        
        # Sort by activity count and return top users
        # Show top 50 users (all users have 50 activities in synthetic data)
        total_users = len(user_stats)
        user_stats = user_stats.sort_values('activity_count', ascending=False).head(50)
        
        print(f"   Found {len(user_stats)} users (out of {total_users} total)")
        
        return [
            UserInfo(
                user_id=str(row['user_id']),
                activity_count=int(row['activity_count']),
                total_distance=float(row['total_distance']),
                total_duration=float(row['total_duration'])
            )
            for _, row in user_stats.iterrows()
        ]
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error loading demo users: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Failed to load demo users: {str(e)}")


@router.get("/session", response_model=DemoSessionResponse)
def get_demo_session(db: Session = Depends(get_demo_db)):
    """Get current demo session info."""
    check_demo_enabled()
    session_id = CURRENT_DEMO_SESSION
    
    if session_id:
        users_count = db.query(models.User).count()
        activities_count = db.query(models.Activity).count()
        return DemoSessionResponse(
            session_id=session_id,
            active=True,
            users_count=users_count,
            activities_count=activities_count
        )
    else:
        users_count = db.query(models.User).count()
        activities_count = db.query(models.Activity).count()
        return DemoSessionResponse(
            session_id=None,
            active=False,
            users_count=users_count,
            activities_count=activities_count
        )


@router.post("/load", response_model=DemoLoadResponse)
def load_demo_data(req: DemoLoadRequest, db: Session = Depends(get_demo_db)):
    """
    Load activities for a specific user from CSV into the demo database.
    
    This creates isolated demo data in a separate database that won't affect production data.
    """
    check_demo_enabled()
    
    # Get or create demo session
    session_id = get_or_create_demo_session()
    
    try:
        # Load CSV
        df = pd.read_csv(settings.csv_seed_path)
        
        # Filter for selected user
        user_df = df[df['user_id'] == req.user_id].copy()
        
        if len(user_df) == 0:
            raise HTTPException(404, f"User {req.user_id} not found in CSV")
        
        # Transform data
        if "distance_km_user" in user_df.columns:
            user_df["distance_m"] = user_df["distance_km_user"] * 1000
        if "elevation_meters_user" in user_df.columns:
            user_df["elevation_gain_m"] = user_df["elevation_meters_user"]
        if "average_pace_min_per_km" in user_df.columns:
            user_df["duration_s"] = user_df["average_pace_min_per_km"] * user_df.get("distance_km_user", 5.0) * 60
        
        # Create activity IDs
        if "route_id" in user_df.columns:
            user_df["id"] = user_df["user_id"].astype(str) + "_" + user_df["route_id"].astype(str)
        else:
            user_df["id"] = [f"{req.user_id}_activity_{i}" for i in range(len(user_df))]
        
        # Ensure required columns
        for col in ['distance_m', 'duration_s', 'elevation_gain_m']:
            if col not in user_df.columns:
                user_df[col] = 0.0
        
        user_df = user_df.fillna(0.0)
        
        # Create demo user (no session ID needed - different database)
        demo_user_id = req.user_id  # Use original user ID in demo database
        existing_user = db.get(models.User, demo_user_id)
        if not existing_user:
            user = models.User(
                id=demo_user_id,
                name=f"Demo User: {req.user_id}"
            )
            db.add(user)
            db.flush()  # Flush to make user available for foreign key constraints
        
        # Load activities into demo database
        activities_loaded = 0
        for _, row in user_df.iterrows():
            activity_id = str(row['id'])
            
            # Check if activity already exists in demo database
            existing = db.query(models.Activity).filter(
                models.Activity.id == activity_id
            ).first()
            if existing:
                continue
            
            # Determine sport type
            sport = "running"  # default
            if "surface_type_route" in row:
                surface = str(row["surface_type_route"]).lower()
                if "trail" in surface or "gravel" in surface:
                    sport = "hiking"
                elif "road" in surface:
                    sport = "cycling" if row.get("distance_m", 0) > 15000 else "running"
            
            try:
                activity = models.Activity(
                    id=activity_id,
                    user_id=demo_user_id,
                    sport=sport,
                    distance_m=float(row['distance_m']),
                    duration_s=float(row['duration_s']),
                    elevation_gain_m=float(row.get('elevation_gain_m', 0)),
                    hr_avg=float(row.get('hr_avg', 0)),
                    features={}
                )
                db.add(activity)
                db.flush()
                activities_loaded += 1
            except Exception as e:
                db.rollback()
                print(f"   ⚠️  Skipping activity {activity_id}: {str(e)[:100]}")
                continue
        
        db.commit()
        
        return DemoLoadResponse(
            status="success",
            user_id=req.user_id,
            activities_loaded=activities_loaded,
            message=f"Successfully loaded {activities_loaded} activities for user {req.user_id} in demo database",
            session_id=session_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to load demo data: {str(e)}")


@router.post("/clear")
def clear_demo_data(db: Session = Depends(get_demo_db)):
    """Clear all data from demo database."""
    check_demo_enabled()
    
    try:
        # Delete all activities and users from demo database
        activities_deleted = db.query(models.Activity).delete()
        users_deleted = db.query(models.User).delete()
        
        db.commit()
        
        # Clear session
        clear_demo_session()
        
        return {
            "status": "success",
            "message": f"Demo database cleared: {users_deleted} users, {activities_deleted} activities removed"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to clear demo data: {str(e)}")


@router.get("/activities")
def get_demo_activities(
    skip: int = 0,
    limit: int = 50,
    user_id: Optional[str] = None,
    db: Session = Depends(get_demo_db)
):
    """Get activities from demo database."""
    check_demo_enabled()
    
    try:
        query = db.query(models.Activity)
        
        if user_id:
            query = query.filter(models.Activity.user_id == user_id)
        
        activities = query.order_by(models.Activity.created_at.desc()).offset(skip).limit(limit).all()
        
        return [
            {
                "id": activity.id,
                "user_id": activity.user_id,
                "sport": activity.sport,
                "distance_m": activity.distance_m,
                "duration_s": activity.duration_s,
                "elevation_gain_m": activity.elevation_gain_m,
                "hr_avg": activity.hr_avg,
                "created_at": activity.created_at.isoformat() if activity.created_at else None
            }
            for activity in activities
        ]
    except Exception as e:
        print(f"Error getting demo activities: {e}")
        raise HTTPException(500, f"Failed to get demo activities: {str(e)}")


@router.get("/stats")
def get_demo_stats(db: Session = Depends(get_demo_db)):
    """Get statistics about demo database."""
    check_demo_enabled()
    
    session_id = CURRENT_DEMO_SESSION
    
    try:
        # Count all data in demo database
        user_count = db.query(models.User).count()
        activity_count = db.query(models.Activity).count()
        
        # Get users with activity counts
        from sqlalchemy import func
        user_activities = db.query(
            models.User.id,
            func.count(models.Activity.id).label('activity_count')
        ).outerjoin(
            models.Activity,
            models.Activity.user_id == models.User.id
        ).group_by(models.User.id).all()
        
        return {
            "total_users": user_count,
            "total_activities": activity_count,
            "session_id": session_id,
            "users": [
                {"user_id": user_id, "activities": count}
                for user_id, count in user_activities
            ]
        }
    except Exception as e:
        print(f"Error getting demo stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Failed to get demo stats: {str(e)}")


@router.post("/recommend", response_model=RecommendResponse)
def demo_recommend(req: RecommendRequest, db: Session = Depends(get_demo_db)):
    """
    Get recommendations using demo database.
    Same as /recommend but queries demo database for activity data.
    """
    check_demo_enabled()
    
    if not req.activity_id:
        raise HTTPException(400, "activity_id is required")
    
    # Validate strategy
    valid_strategies = ["content", "content_mmr", "ensemble", "ensemble_mmr", "popularity"]
    if req.strategy not in valid_strategies:
        raise HTTPException(400, f"Invalid strategy. Must be one of: {valid_strategies}")
    
    # Validate lambda_diversity
    if not (0.0 <= req.lambda_diversity <= 1.0):
        raise HTTPException(400, "lambda_diversity must be between 0.0 and 1.0")
    
    try:
        # Extract route ID from activity ID
        activity_id_for_search = req.activity_id
        
        # Remove demo session suffix if present
        if "_demo_" in req.activity_id:
            parts = req.activity_id.split("_demo_")
            activity_id_for_search = parts[0]
            print(f"🔍 Demo activity detected: {req.activity_id} → {activity_id_for_search}")
        
        # Extract just the route ID (format: "userid_R049" → "R049")
        if "_" in activity_id_for_search:
            id_parts = activity_id_for_search.split("_")
            for part in id_parts:
                if part.startswith("R") or part.isdigit():
                    route_id = part
                    print(f"🔍 Extracted route ID: {activity_id_for_search} → {route_id}")
                    activity_id_for_search = route_id
                    break
        
        print(f"🔍 [DEMO] Final search ID: {activity_id_for_search}")
        print(f"⚙️  [DEMO] Strategy: {req.strategy}, Lambda: {req.lambda_diversity}, K: {req.k}")
        
        # Get recommendations from FAISS
        recsys.ensure_ready()
        items = recsys.search_by_activity(
            activity_id_for_search, 
            req.k,
            strategy=req.strategy,
            lambda_diversity=req.lambda_diversity
        )
        
        print(f"📊 [DEMO] Returned {len(items)} items using strategy: {req.strategy}")
        
    except Exception as e:
        import traceback
        print(f"❌ [DEMO] Recommendation error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(500, f"Recommendation failed: {str(e)}")
    
    # Add metadata
    metadata = {
        "description": f"Demo recommendation using {req.strategy}",
        "uses_mmr": "mmr" in req.strategy,
        "query_route_id": activity_id_for_search,
        "demo_mode": True
    }
    
    # Filter out seen routes if requested (using DEMO database)
    filtered_items = items
    seen_routes = set()
    
    if req.exclude_seen and req.user_id:
        try:
            # Get user's activity history from DEMO database
            user_activities = db.query(models.Activity).filter(
                models.Activity.user_id == req.user_id
            ).all()
            
            print(f"🔍 [DEMO] Found {len(user_activities)} activities for user {req.user_id} in demo database")
            
            # Extract route IDs from activity IDs
            for activity in user_activities:
                act_id = activity.id
                if "_" in act_id:
                    parts = act_id.split("_")
                    for part in parts:
                        if part.startswith("R") or part.isdigit():
                            seen_routes.add(part)
                            break
                else:
                    seen_routes.add(act_id)
            
            print(f"🚫 [DEMO] Filtering {len(seen_routes)} seen routes for user {req.user_id}")
            
            # Filter recommendations
            filtered_items = [(aid, score) for aid, score in items if aid not in seen_routes]
            
            if len(filtered_items) < len(items):
                print(f"   [DEMO] Filtered: {len(items)} → {len(filtered_items)} recommendations")
        except Exception as e:
            print(f"⚠️  [DEMO] Error filtering seen routes: {e}")
            # Continue with unfiltered results
    
    # Enrich items with route metadata
    enriched_items = []
    for activity_id, score in filtered_items:
        route_meta = recsys.get_route_metadata(activity_id)
        if route_meta:
            enriched_items.append(RecommendItem(
                activity_id=activity_id,
                score=score,
                metadata=RouteMetadata(**route_meta)
            ))
        else:
            enriched_items.append(RecommendItem(activity_id=activity_id, score=score))
    
    # Update metadata
    if req.exclude_seen:
        metadata["filtered_seen_count"] = len(items) - len(filtered_items)
        metadata["seen_routes"] = list(seen_routes)[:5]
    
    return RecommendResponse(
        items=enriched_items,
        strategy=req.strategy,
        lambda_diversity=req.lambda_diversity if "mmr" in req.strategy else None,
        metadata=metadata
    )

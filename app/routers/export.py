"""
Activity Export Router
Supports exporting activities to GPX and TCX formats
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models
from ..auth import get_current_user
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["export"])


def create_gpx(activity: models.Activity) -> str:
    """
    Create GPX XML from activity data.
    GPX is the standard GPS exchange format.
    """
    # Extract route from features
    route = []
    if activity.features and isinstance(activity.features, dict):
        route = activity.features.get('route', [])
    
    if not route or len(route) < 2:
        raise HTTPException(400, "Activity doesn't have GPS data to export")
    
    # Build GPX XML
    gpx_template = '''<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" 
     creator="Strava Recommender" 
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>{activity_name}</name>
    <desc>{description}</desc>
    <time>{timestamp}</time>
  </metadata>
  <trk>
    <name>{activity_name}</name>
    <type>{sport}</type>
    <trkseg>
{trackpoints}
    </trkseg>
  </trk>
</gpx>'''
    
    # Generate trackpoints
    trackpoints = []
    start_time = activity.started_at or datetime.utcnow()
    duration_per_point = activity.duration_s / len(route) if len(route) > 1 else 0
    
    for i, point in enumerate(route):
        lat, lon = point
        # Calculate time for this point
        point_time = start_time.replace(microsecond=0) if i == 0 else start_time.replace(microsecond=0)
        point_time = point_time.replace(second=0, microsecond=0)
        
        trackpoint = f'''      <trkpt lat="{lat}" lon="{lon}">
        <time>{point_time.isoformat()}Z</time>
      </trkpt>'''
        trackpoints.append(trackpoint)
    
    # Format values
    activity_name = f"{activity.sport.capitalize()} Activity - {activity.id}"
    description = f"Distance: {activity.distance_m/1000:.2f}km, Duration: {activity.duration_s/60:.1f}min"
    timestamp = (activity.started_at or datetime.utcnow()).isoformat() + "Z"
    
    gpx_content = gpx_template.format(
        activity_name=activity_name,
        description=description,
        timestamp=timestamp,
        sport=activity.sport,
        trackpoints='\n'.join(trackpoints)
    )
    
    return gpx_content


def create_tcx(activity: models.Activity) -> str:
    """
    Create TCX (Training Center XML) from activity data.
    TCX format includes more training-specific data.
    """
    route = []
    if activity.features and isinstance(activity.features, dict):
        route = activity.features.get('route', [])
    
    if not route or len(route) < 2:
        raise HTTPException(400, "Activity doesn't have GPS data to export")
    
    # Determine sport type for TCX
    sport_map = {
        'running': 'Running',
        'cycling': 'Biking',
        'walking': 'Walking',
        'hiking': 'Other'
    }
    tcx_sport = sport_map.get(activity.sport, 'Other')
    
    tcx_template = '''<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="{sport}">
      <Id>{timestamp}</Id>
      <Lap StartTime="{timestamp}">
        <TotalTimeSeconds>{duration}</TotalTimeSeconds>
        <DistanceMeters>{distance}</DistanceMeters>
        <Calories>0</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
{trackpoints}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>'''
    
    # Generate trackpoints
    trackpoints = []
    start_time = activity.started_at or datetime.utcnow()
    
    for i, point in enumerate(route):
        lat, lon = point
        point_time = start_time.replace(microsecond=0)
        
        trackpoint = f'''          <Trackpoint>
            <Time>{point_time.isoformat()}Z</Time>
            <Position>
              <LatitudeDegrees>{lat}</LatitudeDegrees>
              <LongitudeDegrees>{lon}</LongitudeDegrees>
            </Position>
          </Trackpoint>'''
        trackpoints.append(trackpoint)
    
    timestamp = (activity.started_at or datetime.utcnow()).isoformat() + "Z"
    
    tcx_content = tcx_template.format(
        sport=tcx_sport,
        timestamp=timestamp,
        duration=activity.duration_s,
        distance=activity.distance_m,
        trackpoints='\n'.join(trackpoints)
    )
    
    return tcx_content


@router.get("/activity/{activity_id}/gpx")
async def export_activity_gpx(
    activity_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export activity as GPX file."""
    activity = db.get(models.Activity, activity_id)
    
    if not activity:
        raise HTTPException(404, "Activity not found")
    
    # Check ownership (optional - you might want to allow exporting any activity)
    # if activity.user_id != current_user.id:
    #     raise HTTPException(403, "Access denied")
    
    try:
        gpx_content = create_gpx(activity)
        
        logger.info(f"📤 Activity {activity_id} exported as GPX by user {current_user.id}")
        
        return Response(
            content=gpx_content,
            media_type="application/gpx+xml",
            headers={
                "Content-Disposition": f"attachment; filename=activity_{activity_id}.gpx"
            }
        )
    except Exception as e:
        logger.error(f"GPX export error: {e}")
        raise HTTPException(500, f"Export failed: {str(e)}")


@router.get("/activity/{activity_id}/tcx")
async def export_activity_tcx(
    activity_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export activity as TCX file."""
    activity = db.get(models.Activity, activity_id)
    
    if not activity:
        raise HTTPException(404, "Activity not found")
    
    try:
        tcx_content = create_tcx(activity)
        
        logger.info(f"📤 Activity {activity_id} exported as TCX by user {current_user.id}")
        
        return Response(
            content=tcx_content,
            media_type="application/vnd.garmin.tcx+xml",
            headers={
                "Content-Disposition": f"attachment; filename=activity_{activity_id}.tcx"
            }
        )
    except Exception as e:
        logger.error(f"TCX export error: {e}")
        raise HTTPException(500, f"Export failed: {str(e)}")


@router.get("/activity/{activity_id}/json")
async def export_activity_json(
    activity_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export activity as JSON (includes all metadata)."""
    activity = db.get(models.Activity, activity_id)
    
    if not activity:
        raise HTTPException(404, "Activity not found")
    
    # Build comprehensive JSON export
    export_data = {
        "id": activity.id,
        "user_id": activity.user_id,
        "sport": activity.sport,
        "started_at": activity.started_at.isoformat() if activity.started_at else None,
        "duration_seconds": activity.duration_s,
        "distance_meters": activity.distance_m,
        "elevation_gain_meters": activity.elevation_gain_m,
        "average_heart_rate": activity.hr_avg,
        "route": activity.features.get('route', []) if activity.features else [],
        "created_at": activity.created_at.isoformat() if hasattr(activity, 'created_at') and activity.created_at else None,
        "export_timestamp": datetime.utcnow().isoformat() + "Z",
        "format": "strava_recommender_v1"
    }
    
    logger.info(f"📤 Activity {activity_id} exported as JSON by user {current_user.id}")
    
    return Response(
        content=json.dumps(export_data, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=activity_{activity_id}.json"
        }
    )


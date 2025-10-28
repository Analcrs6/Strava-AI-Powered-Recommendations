"""
Real-time Notifications System with WebSockets
Provides instant updates for user activities, recommendations, and social interactions
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, List, Set
from datetime import datetime
import json
import logging
from ..db import get_db
from .. import models
from ..auth import get_current_user
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])

# WebSocket connection manager
class ConnectionManager:
    """Manages active WebSocket connections."""
    
    def __init__(self):
        # user_id -> Set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept and store new connection."""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"🔌 WebSocket connected: {user_id} (total: {len(self.active_connections[user_id])} connections)")
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove connection."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"🔌 WebSocket disconnected: {user_id}")
    
    async def send_personal_message(self, message: dict, user_id: str):
        """Send message to specific user (all their connections)."""
        if user_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to {user_id}: {e}")
                    disconnected.add(connection)
            
            # Remove disconnected connections
            for conn in disconnected:
                self.active_connections[user_id].discard(conn)
    
    async def broadcast(self, message: dict, exclude_user: str = None):
        """Broadcast message to all connected users."""
        for user_id, connections in self.active_connections.items():
            if user_id != exclude_user:
                for connection in connections:
                    try:
                        await connection.send_json(message)
                    except:
                        pass  # Ignore errors for broadcast

# Global connection manager
manager = ConnectionManager()


# Pydantic models
class NotificationCreate(BaseModel):
    user_id: str
    type: str
    title: str
    message: str
    data: dict = {}


class NotificationOut(BaseModel):
    id: int
    user_id: str
    type: str
    title: str
    message: str
    data: dict
    read: bool
    created_at: datetime


# WebSocket endpoint
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """
    WebSocket endpoint for real-time notifications.
    
    Connect: ws://localhost:8000/notifications/ws/{user_id}
    """
    await manager.connect(websocket, user_id)
    
    try:
        # Send welcome message
        await websocket.send_json({
            "type": "connection",
            "message": "Connected to notifications",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            
            # Handle ping/pong for keepalive
            if data == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                logger.info(f"Received from {user_id}: {data}")
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        logger.info(f"🔌 Client disconnected: {user_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {user_id}: {e}")
        manager.disconnect(websocket, user_id)


# HTTP endpoints for notifications
@router.get("", response_model=List[NotificationOut])
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's notifications."""
    query = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    )
    
    if unread_only:
        query = query.filter(models.Notification.read == False)
    
    notifications = query.order_by(
        models.Notification.created_at.desc()
    ).limit(limit).all()
    
    return notifications


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark notification as read."""
    notification = db.get(models.Notification, notification_id)
    
    if not notification:
        raise HTTPException(404, "Notification not found")
    
    if notification.user_id != current_user.id:
        raise HTTPException(403, "Access denied")
    
    notification.read = True
    db.commit()
    
    return {"success": True, "message": "Notification marked as read"}


@router.post("/mark-all-read")
async def mark_all_read(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all notifications as read."""
    updated = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.read == False
    ).update({"read": True})
    
    db.commit()
    
    return {"success": True, "marked_read": updated}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a notification."""
    notification = db.get(models.Notification, notification_id)
    
    if not notification:
        raise HTTPException(404, "Notification not found")
    
    if notification.user_id != current_user.id:
        raise HTTPException(403, "Access denied")
    
    db.delete(notification)
    db.commit()
    
    return {"success": True, "message": "Notification deleted"}


# Helper functions to send notifications
async def send_notification(
    db: Session,
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    data: dict = None
):
    """
    Send a notification to a user (store in DB and send via WebSocket).
    
    Types:
    - activity_completed: Friend completed an activity
    - recommendation_update: New recommendations available
    - follower_new: New follower
    - achievement: Achievement unlocked
    - weekly_summary: Weekly summary available
    - kudos: Someone gave kudos
    """
    # Create notification in database
    notification = models.Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        data=data or {}
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    
    # Send via WebSocket if user is connected
    await manager.send_personal_message({
        "type": notification_type,
        "id": notification.id,
        "title": title,
        "message": message,
        "data": data or {},
        "timestamp": notification.created_at.isoformat()
    }, user_id)
    
    logger.info(f"📬 Notification sent to {user_id}: {title}")
    
    return notification


async def notify_followers_activity_completed(
    db: Session,
    user_id: str,
    activity_id: str,
    activity_name: str
):
    """Notify all followers when a user completes an activity."""
    # Get user's followers
    user = db.get(models.User, user_id)
    if not user:
        return
    
    # Get all followers
    followers = db.query(models.Follow).filter(
        models.Follow.followed_id == user_id
    ).all()
    
    # Send notification to each follower
    for follow in followers:
        await send_notification(
            db=db,
            user_id=follow.follower_id,
            notification_type="activity_completed",
            title=f"{user.name} completed an activity!",
            message=f"{user.name} just finished: {activity_name}",
            data={
                "user_id": user_id,
                "user_name": user.name,
                "activity_id": activity_id,
                "activity_name": activity_name
            }
        )


async def notify_new_follower(
    db: Session,
    followed_user_id: str,
    follower_user_id: str
):
    """Notify user when someone follows them."""
    follower = db.get(models.User, follower_user_id)
    if not follower:
        return
    
    await send_notification(
        db=db,
        user_id=followed_user_id,
        notification_type="follower_new",
        title="New Follower!",
        message=f"{follower.name} started following you",
        data={
            "follower_id": follower_user_id,
            "follower_name": follower.name
        }
    )


async def notify_recommendation_update(
    db: Session,
    user_id: str,
    new_count: int
):
    """Notify user about new recommendations."""
    await send_notification(
        db=db,
        user_id=user_id,
        notification_type="recommendation_update",
        title="New Recommendations Available",
        message=f"We found {new_count} new routes you might like!",
        data={"new_routes": new_count}
    )


async def notify_achievement(
    db: Session,
    user_id: str,
    achievement_name: str,
    achievement_desc: str
):
    """Notify user about unlocked achievement."""
    await send_notification(
        db=db,
        user_id=user_id,
        notification_type="achievement",
        title=f"Achievement Unlocked: {achievement_name}! 🏆",
        message=achievement_desc,
        data={"achievement": achievement_name}
    )


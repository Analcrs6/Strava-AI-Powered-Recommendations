#!/usr/bin/env python3
"""
Proximity Alert Server - Strava Webhook Handler

Monitors Strava activities and sends proximity alerts when friends
are nearby or just completed an activity close to your location.

Features:
- Strava webhook subscription handling
- Real-time distance calculation using geopy
- Alert logging and storage
- REST API for fetching alerts
"""

import os
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

import requests
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from geopy.distance import geodesic

# Load environment variables
load_dotenv()

# Configuration
CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
VERIFY_TOKEN = os.getenv("WEBHOOK_VERIFY_TOKEN", "STRAVA_WEBHOOK_2025")
CALLBACK_DOMAIN = os.getenv("CALLBACK_DOMAIN", "http://localhost:5000")

# Storage paths
ALERTS_PATH = Path("proximity_alerts.json")
USER_LOCATIONS_PATH = Path("user_locations.json")

# Proximity threshold (in km)
PROXIMITY_THRESHOLD_KM = 5.0

# Flask app
app = Flask(__name__)

# ====================
# Data Storage
# ====================

def load_alerts() -> List[Dict]:
    """Load proximity alerts from JSON file"""
    if ALERTS_PATH.exists():
        return json.loads(ALERTS_PATH.read_text())
    return []

def save_alert(alert: Dict):
    """Save a new proximity alert"""
    alerts = load_alerts()
    alerts.insert(0, alert)  # Most recent first

    # Keep only last 100 alerts
    alerts = alerts[:100]

    ALERTS_PATH.write_text(json.dumps(alerts, indent=2))
    print(f"[ALERT SAVED] {alert['message']}")

def load_user_locations() -> Dict:
    """Load user home locations"""
    if USER_LOCATIONS_PATH.exists():
        return json.loads(USER_LOCATIONS_PATH.read_text())

    # Default user locations (NYC area)
    return {
        "anaisl": {"lat": 40.7580, "lon": -73.9855, "name": "Anais"},
        "mrudulad": {"lat": 40.7489, "lon": -73.9680, "name": "Mrudula"},
        "user_runner": {"lat": 40.7061, "lon": -74.0087, "name": "Jake"},
        "user_biker": {"lat": 40.6782, "lon": -73.9442, "name": "Alex"}
    }

def save_user_locations(locations: Dict):
    """Save user home locations"""
    USER_LOCATIONS_PATH.write_text(json.dumps(locations, indent=2))

# ====================
# Distance Calculations
# ====================

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers"""
    return geodesic((lat1, lon1), (lat2, lon2)).kilometers

def check_proximity(activity_location: tuple, user_id: str) -> Optional[Dict]:
    """Check if activity is near any user's home location"""
    users = load_user_locations()
    activity_lat, activity_lon = activity_location

    for username, user_info in users.items():
        if username == user_id:
            continue  # Skip self

        distance = calculate_distance(
            activity_lat, activity_lon,
            user_info['lat'], user_info['lon']
        )

        if distance <= PROXIMITY_THRESHOLD_KM:
            return {
                "user": username,
                "name": user_info['name'],
                "distance_km": round(distance, 2),
                "location": user_info
            }

    return None

# ====================
# Strava Webhook Handlers
# ====================

@app.route("/webhook", methods=["GET"])
def webhook_challenge():
    """Handle Strava webhook subscription challenge"""
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    if mode == "subscribe" and token == VERIFY_TOKEN:
        print("[WEBHOOK] Subscription validated!")
        return jsonify({"hub.challenge": challenge})

    return jsonify({"error": "Invalid verification token"}), 403

@app.route("/webhook", methods=["POST"])
def webhook_event():
    """Handle incoming Strava webhook events"""
    try:
        event = request.json
        print(f"[WEBHOOK EVENT] Received: {event}")

        # Extract event details
        aspect_type = event.get("aspect_type")  # create, update, delete
        object_type = event.get("object_type")  # activity, athlete
        object_id = event.get("object_id")
        owner_id = event.get("owner_id")

        # Only process activity creation events
        if object_type == "activity" and aspect_type == "create":
            # Simulate getting activity details
            # In production, you would fetch from Strava API
            activity = simulate_activity_details(object_id, owner_id)

            # Create webhook log alert
            timestamp = datetime.now().strftime("%I:%M %p")
            save_alert({
                "timestamp": timestamp,
                "type": "webhook_log",
                "message": f"[{timestamp}] LOG: Webhook received. Activity created by {activity['user']}.",
                "details": {
                    "activity_id": object_id,
                    "user": activity['user'],
                    "type": activity['type']
                }
            })

            # Check for proximity
            if activity.get("start_latlng"):
                proximity = check_proximity(activity["start_latlng"], activity['user'])

                if proximity:
                    # Create proximity alert
                    save_alert({
                        "timestamp": timestamp,
                        "type": "proximity_alert",
                        "message": f"[{timestamp}] ALERT: User '{proximity['name']}' {activity['action']} {proximity['distance_km']} km from {proximity['user']}'s location.",
                        "details": {
                            "activity_id": object_id,
                            "user": activity['user'],
                            "nearby_user": proximity['user'],
                            "distance_km": proximity['distance_km'],
                            "activity_type": activity['type']
                        }
                    })

        return jsonify({"status": "success"}), 200

    except Exception as e:
        print(f"[WEBHOOK ERROR] {e}")
        return jsonify({"error": str(e)}), 500

def simulate_activity_details(activity_id: int, owner_id: int) -> Dict:
    """Simulate activity details (in production, fetch from Strava API)"""
    import random

    users = ["anaisl", "mrudulad", "user_runner", "user_biker"]
    user = random.choice(users)

    # NYC area coordinates
    lat = 40.7128 + random.uniform(-0.05, 0.05)
    lon = -74.0060 + random.uniform(-0.05, 0.05)

    activity_type = random.choice(["a run", "a ride", "a walk"])
    action = random.choice(["started", "finished", "completed"])

    return {
        "id": activity_id,
        "user": user,
        "type": activity_type,
        "action": action,
        "start_latlng": (lat, lon),
        "distance": random.uniform(3, 15)
    }

# ====================
# REST API for Alerts
# ====================

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    """Get recent proximity alerts"""
    limit = request.args.get("limit", 10, type=int)
    alerts = load_alerts()[:limit]
    return jsonify({"alerts": alerts, "count": len(alerts)})

@app.route("/api/alerts/clear", methods=["POST"])
def clear_alerts():
    """Clear all alerts"""
    ALERTS_PATH.write_text(json.dumps([]))
    return jsonify({"status": "cleared"})

@app.route("/api/simulate", methods=["POST"])
def simulate_activity():
    """Simulate a nearby activity (for testing)"""
    data = request.json or {}

    user = data.get("user", "user_runner")
    activity_type = data.get("type", "a run")
    action = data.get("action", "finished")

    # Random location near NYC
    lat = 40.7128 + data.get("lat_offset", 0.01)
    lon = -74.0060 + data.get("lon_offset", 0.01)

    # Check proximity
    proximity = check_proximity((lat, lon), user)

    timestamp = datetime.now().strftime("%I:%M %p")

    if proximity:
        alert = {
            "timestamp": timestamp,
            "type": "proximity_alert",
            "message": f"[{timestamp}] ALERT: User '{user}' {action} {activity_type} {proximity['distance_km']} km from your location.",
            "details": {
                "user": user,
                "nearby_user": proximity['user'],
                "distance_km": proximity['distance_km'],
                "activity_type": activity_type
            }
        }
        save_alert(alert)
        return jsonify({"status": "alert_created", "alert": alert})

    return jsonify({"status": "no_alert", "message": "Activity not within proximity threshold"})

@app.route("/api/users", methods=["GET", "POST"])
def manage_users():
    """Get or update user locations"""
    if request.method == "GET":
        return jsonify(load_user_locations())

    if request.method == "POST":
        locations = request.json
        save_user_locations(locations)
        return jsonify({"status": "updated"})

# ====================
# Dashboard
# ====================

@app.route("/")
def index():
    """Simple dashboard"""
    alerts = load_alerts()[:5]
    users = load_user_locations()

    html = f"""
    <html>
    <head>
        <title>Proximity Alert Server</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; }}
            h1 {{ color: #FC4C02; }}
            .alert {{ background: #f0f0f0; padding: 10px; margin: 10px 0; border-left: 4px solid #FC4C02; }}
            .stats {{ background: #e8f4f8; padding: 15px; margin: 20px 0; }}
            code {{ background: #333; color: #0f0; padding: 2px 6px; }}
        </style>
    </head>
    <body>
        <h1>🔔 Proximity Alert Server</h1>
        <p>Monitoring Strava activities for proximity alerts</p>

        <div class="stats">
            <h3>📊 Statistics</h3>
            <p><b>Total Alerts:</b> {len(load_alerts())}</p>
            <p><b>Monitored Users:</b> {len(users)}</p>
            <p><b>Proximity Threshold:</b> {PROXIMITY_THRESHOLD_KM} km</p>
        </div>

        <h3>📌 Recent Alerts ({len(alerts)})</h3>
        {''.join(f'<div class="alert">{a["message"]}</div>' for a in alerts) or '<p>No alerts yet</p>'}

        <h3>🧪 Test the System</h3>
        <p>Simulate a nearby activity:</p>
        <code>curl -X POST http://localhost:5000/api/simulate</code>

        <h3>📡 API Endpoints</h3>
        <ul>
            <li><code>GET /api/alerts</code> - Get recent alerts</li>
            <li><code>POST /api/simulate</code> - Simulate activity</li>
            <li><code>GET /api/users</code> - Get user locations</li>
            <li><code>POST /webhook</code> - Strava webhook endpoint</li>
        </ul>

        <p style="margin-top: 40px; color: #666;">
            Server running on port 5000 | <a href="/api/alerts">View JSON</a>
        </p>
    </body>
    </html>
    """
    return html

# ====================
# Main
# ====================

if __name__ == "__main__":
    print("=" * 60)
    print("🔔 PROXIMITY ALERT SERVER")
    print("=" * 60)
    print(f"Proximity threshold: {PROXIMITY_THRESHOLD_KM} km")
    print(f"Alerts file: {ALERTS_PATH}")
    print(f"Webhook verify token: {VERIFY_TOKEN}")
    print()
    print("API Endpoints:")
    print("  - http://localhost:5000 (Dashboard)")
    print("  - http://localhost:5000/api/alerts (Get alerts)")
    print("  - http://localhost:5000/api/simulate (Simulate activity)")
    print("  - http://localhost:5000/webhook (Strava webhook)")
    print()
    print("Test command:")
    print('  curl -X POST http://localhost:5000/api/simulate')
    print("=" * 60)

    app.run(host="0.0.0.0", port=5000, debug=True)

#!/usr/bin/env python3
"""
Fetch REAL Strava routes from authenticated user's activities

Uses Strava API to download actual GPS data from real activities,
replacing synthetic routes with genuine, followable routes.
"""

import json
import time
import requests
import pandas as pd
import polyline
import os
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

print("=" * 70)
print("🏃 STRAVA REAL ROUTE FETCHER")
print("=" * 70)
print("Fetching real GPS routes from your Strava activities...")
print()

# Load environment variables from 'env' file (not .env)
ENV_PATH = Path("env")
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

# Get client credentials from env file
CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")

if not CLIENT_ID or not CLIENT_SECRET:
    print("❌ Error: Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET in env file!")
    print(f"   Looked in: {ENV_PATH}")
    exit(1)

# Load tokens
TOKENS_PATH = Path("tokens.json")

if not TOKENS_PATH.exists():
    print("❌ Error: tokens.json not found!")
    print()
    print("Please authenticate first:")
    print("  python auth_server.py")
    print()
    exit(1)

tokens = json.loads(TOKENS_PATH.read_text())
access_token = tokens.get('access_token')
athlete = tokens.get('athlete', {})

print(f"✓ Authenticated as: {athlete.get('firstname', 'Unknown')} {athlete.get('lastname', '')}")
print(f"  Username: @{athlete.get('username', 'unknown')}")
print(f"  Location: {athlete.get('city', 'Unknown')}, {athlete.get('state', '')}")
print()

# API headers
headers = {
    "Authorization": f"Bearer {access_token}"
}

def refresh_token_if_needed():
    """Refresh access token if expired"""
    global access_token, headers, tokens

    if time.time() >= tokens.get('expires_at', 0):
        print("⚠️  Access token expired, refreshing...")

        refresh_url = "https://www.strava.com/oauth/token"
        refresh_data = {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": tokens.get('refresh_token')
        }

        try:
            response = requests.post(refresh_url, data=refresh_data)
            response.raise_for_status()
            new_tokens = response.json()

            TOKENS_PATH.write_text(json.dumps(new_tokens, indent=2))
            tokens = new_tokens
            access_token = new_tokens['access_token']
            headers = {"Authorization": f"Bearer {access_token}"}

            print("✓ Token refreshed successfully")
        except Exception as e:
            print(f"❌ Token refresh failed: {e}")
            print(f"   Response: {response.text if 'response' in locals() else 'No response'}")
            exit(1)

def fetch_activities(per_page=50, max_activities=100):
    """Fetch user's activities"""
    print(f"Step 1: Fetching your activities (limit: {max_activities})...")

    refresh_token_if_needed()

    activities = []
    page = 1

    while len(activities) < max_activities:
        url = f"https://www.strava.com/api/v3/athlete/activities"
        params = {
            "per_page": per_page,
            "page": page
        }

        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            batch = response.json()

            if not batch:
                break

            activities.extend(batch)
            print(f"  Page {page}: Fetched {len(batch)} activities (total: {len(activities)})")

            if len(batch) < per_page:
                break

            page += 1
            time.sleep(0.5)  # Rate limiting

        except Exception as e:
            print(f"  ✗ Error fetching page {page}: {e}")
            break

    print(f"\n✓ Found {len(activities)} total activities")
    return activities[:max_activities]

def fetch_activity_streams(activity_id):
    """Fetch GPS stream (polyline) for an activity"""
    refresh_token_if_needed()

    url = f"https://www.strava.com/api/v3/activities/{activity_id}/streams"
    params = {
        "keys": "latlng,distance,altitude,time",
        "key_by_type": True
    }

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        streams = response.json()

        return streams

    except Exception as e:
        return None

def create_routes_from_activities(activities, max_routes=100):
    """Create route database from Strava activities"""
    print(f"\nStep 2: Extracting GPS data from activities...")
    print()

    routes = []
    activity_count = 0

    for idx, activity in enumerate(activities[:max_routes]):
        activity_count += 1
        activity_id = activity['id']
        name = activity['name']
        distance_km = activity['distance'] / 1000
        elevation = activity.get('total_elevation_gain', 0)
        activity_type = activity['type']
        start_date = activity['start_date']

        print(f"[{idx+1:3d}/{min(len(activities), max_routes)}] {name[:40]:40s} {distance_km:5.1f}km ... ", end='', flush=True)

        # Get GPS stream
        streams = fetch_activity_streams(activity_id)

        if streams and 'latlng' in streams:
            latlng_data = streams['latlng']['data']

            if len(latlng_data) < 2:
                print("✗ No GPS data")
                continue

            # Encode polyline
            encoded = polyline.encode(latlng_data, 5)

            # Extract data
            start_lat, start_lon = latlng_data[0]
            end_lat, end_lon = latlng_data[-1]

            # Determine surface type
            surface_type = 'road' if activity_type in ['Run', 'Ride'] else 'trail'

            # Check if loop
            start_point = latlng_data[0]
            end_point = latlng_data[-1]
            from geopy.distance import geodesic
            loop_distance = geodesic(start_point, end_point).meters
            is_loop = loop_distance < 100  # Within 100m = loop

            routes.append({
                'route_id': f"STRAVA_{activity_id}",
                'activity_id': activity_id,
                'name': name,
                'distance_km_route': distance_km,
                'elevation_meters_route': elevation,
                'surface_type_route': surface_type,
                'activity_type': activity_type,
                'start_date': start_date,
                'gps_polyline': encoded,
                'start_lat': start_lat,
                'start_lon': start_lon,
                'end_lat': end_lat,
                'end_lon': end_lon,
                'is_likely_loop': 1.0 if is_loop else 0.0,
                'is_likely_out_back': 1.0 if not is_loop and loop_distance < 500 else 0.0,
                'actual_distance_km': distance_km,
                'num_gps_points': len(latlng_data),
                'area_name': f"{athlete.get('city', 'Unknown')} - Real Strava Route"
            })

            print(f"✓ {len(latlng_data)} GPS points")

        else:
            print("✗ No GPS stream")

        # Rate limiting
        time.sleep(0.3)

    print(f"\n✓ Successfully extracted {len(routes)} routes with GPS data")
    return routes

def main():
    # Fetch activities
    activities = fetch_activities(max_activities=100)

    if not activities:
        print("\n❌ No activities found!")
        print("\nPossible reasons:")
        print("  - Your Strava account has no recorded activities")
        print("  - API permissions are insufficient")
        print("  - Token has expired")
        exit(1)

    # Create routes from activities
    routes = create_routes_from_activities(activities)

    if not routes:
        print("\n❌ Could not extract any GPS routes!")
        print("\nPossible reasons:")
        print("  - Activities don't have GPS data (e.g., manual entries)")
        print("  - GPS recording was turned off")
        print("  - Privacy zones are hiding GPS data")
        exit(1)

    # Create DataFrame
    routes_df = pd.DataFrame(routes)

    # Add additional columns for compatibility
    routes_df['difficulty_score'] = (
        routes_df['distance_km_route'] * 0.5 +
        routes_df['elevation_meters_route'] * 0.01
    )
    routes_df['grade_percent'] = (
        routes_df['elevation_meters_route'] / (routes_df['distance_km_route'] * 1000) * 100
    ).fillna(0)

    # Save to CSV
    print(f"\nStep 3: Saving routes.csv...")
    routes_df.to_csv('routes.csv', index=False)

    print("\n" + "=" * 70)
    print("✅ SUCCESS!")
    print("=" * 70)
    print(f"Saved {len(routes_df)} REAL Strava routes to routes.csv")
    print()
    print("Route Statistics:")
    print(f"  Total routes: {len(routes_df)}")
    print(f"  Distance range: {routes_df['distance_km_route'].min():.1f} - {routes_df['distance_km_route'].max():.1f} km")
    print(f"  Average distance: {routes_df['distance_km_route'].mean():.1f} km")
    print(f"  Loop routes: {(routes_df['is_likely_loop'] > 0.5).sum()}")
    print(f"  Out-and-back: {(routes_df['is_likely_out_back'] > 0.5).sum()}")
    print(f"  Activity types: {', '.join(routes_df['activity_type'].unique())}")
    print()
    print("Columns:")
    print(f"  {', '.join(routes_df.columns.tolist())}")
    print()

    # Show sample
    sample = routes_df.iloc[0]
    print("Sample Route:")
    print(f"  Name: {sample['name']}")
    print(f"  ID: {sample['route_id']}")
    print(f"  Distance: {sample['distance_km_route']:.2f} km")
    print(f"  Elevation: {sample['elevation_meters_route']:.0f} m")
    print(f"  Type: {sample['activity_type']}")
    print(f"  GPS Points: {sample['num_gps_points']}")
    print(f"  Start: ({sample['start_lat']:.6f}, {sample['start_lon']:.6f})")
    print(f"  End: ({sample['end_lat']:.6f}, {sample['end_lon']:.6f})")
    print(f"  Polyline: {sample['gps_polyline'][:60]}...")
    print()
    print("=" * 70)
    print("✅ Your Streamlit app will now show REAL Strava routes!")
    print("=" * 70)
    print()
    print("Next steps:")
    print("  1. Run: streamlit run streamlit_app.py")
    print("  2. View your actual Strava routes on the map")
    print("  3. Get recommendations based on real GPS data")

if __name__ == '__main__':
    main()

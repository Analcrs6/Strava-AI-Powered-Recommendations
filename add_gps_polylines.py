#!/usr/bin/env python3
"""
Add realistic GPS polylines to routes.csv

Generates mock GPS coordinates based on route distance and type,
creating realistic running/cycling routes around NYC.
"""

import pandas as pd
import numpy as np
import polyline
from geopy.distance import geodesic

# NYC area coordinates (various neighborhoods)
NYC_LOCATIONS = [
    (40.7589, -73.9851),  # Times Square
    (40.7829, -73.9654),  # Central Park
    (40.7061, -74.0087),  # Brooklyn Bridge
    (40.7484, -73.9857),  # Empire State Building
    (40.7614, -73.9776),  # Rockefeller Center
    (40.6782, -73.9442),  # Prospect Park
    (40.7580, -73.9855),  # Bryant Park
    (40.7411, -73.9897),  # Union Square
    (40.7285, -73.9967),  # East Village
    (40.7223, -74.0009),  # SoHo
    (40.7489, -73.9680),  # East Side
    (40.7614, -73.9776),  # Midtown East
]

def generate_loop_route(center_lat, center_lon, distance_km, num_points=30):
    """Generate a loop route around a center point"""
    coords = []

    # Calculate radius based on distance (rough approximation)
    radius_km = distance_km / (2 * np.pi)

    # Generate points in a circle with some randomness
    for i in range(num_points):
        angle = (2 * np.pi * i / num_points) + np.random.uniform(-0.1, 0.1)

        # Add some variation to make it less perfect
        r = radius_km * (1 + np.random.uniform(-0.2, 0.2))

        # Calculate offset (rough approximation: 1 degree lat ≈ 111 km)
        lat_offset = (r / 111.0) * np.cos(angle)
        lon_offset = (r / (111.0 * np.cos(np.radians(center_lat)))) * np.sin(angle)

        coords.append((center_lat + lat_offset, center_lon + lon_offset))

    # Close the loop
    coords.append(coords[0])

    return coords

def generate_out_and_back_route(start_lat, start_lon, distance_km, num_points=20):
    """Generate an out-and-back route"""
    coords = []

    # Random direction
    bearing = np.random.uniform(0, 2 * np.pi)

    # Half distance for each direction
    half_distance = distance_km / 2

    # Go out
    for i in range(num_points // 2):
        frac = i / (num_points // 2)
        dist = half_distance * frac

        # Add slight curvature
        bearing_offset = np.sin(frac * np.pi) * 0.3
        current_bearing = bearing + bearing_offset

        lat_offset = (dist / 111.0) * np.cos(current_bearing)
        lon_offset = (dist / (111.0 * np.cos(np.radians(start_lat)))) * np.sin(current_bearing)

        coords.append((start_lat + lat_offset, start_lon + lon_offset))

    # Come back (reverse)
    for i in range(num_points // 2):
        frac = 1 - (i / (num_points // 2))
        dist = half_distance * frac

        bearing_offset = np.sin(frac * np.pi) * 0.3
        current_bearing = bearing + bearing_offset

        lat_offset = (dist / 111.0) * np.cos(current_bearing)
        lon_offset = (dist / (111.0 * np.cos(np.radians(start_lat)))) * np.sin(current_bearing)

        coords.append((start_lat + lat_offset, start_lon + lon_offset))

    # End at start
    coords.append((start_lat, start_lon))

    return coords

def generate_point_to_point_route(start_lat, start_lon, distance_km, num_points=25):
    """Generate a point-to-point route with some curvature"""
    coords = []

    # Random direction
    bearing = np.random.uniform(0, 2 * np.pi)

    for i in range(num_points):
        frac = i / (num_points - 1)
        dist = distance_km * frac

        # Add S-curve for realism
        curve = np.sin(frac * 2 * np.pi) * 0.5
        current_bearing = bearing + curve

        lat_offset = (dist / 111.0) * np.cos(current_bearing)
        lon_offset = (dist / (111.0 * np.cos(np.radians(start_lat)))) * np.sin(current_bearing)

        coords.append((start_lat + lat_offset, start_lon + lon_offset))

    return coords

def generate_route_polyline(distance_km, route_type='loop', location_idx=0):
    """Generate a GPS polyline for a route"""

    # Get starting location
    start_lat, start_lon = NYC_LOCATIONS[location_idx % len(NYC_LOCATIONS)]

    # Add small random offset to vary routes
    start_lat += np.random.uniform(-0.01, 0.01)
    start_lon += np.random.uniform(-0.01, 0.01)

    # Generate coordinates based on route type
    if route_type == 'loop':
        coords = generate_loop_route(start_lat, start_lon, distance_km)
    elif route_type == 'out_back':
        coords = generate_out_and_back_route(start_lat, start_lon, distance_km)
    else:
        coords = generate_point_to_point_route(start_lat, start_lon, distance_km)

    # Encode to polyline
    encoded = polyline.encode(coords, 5)

    return encoded, coords[0]  # Return polyline and start location

def main():
    print("Loading routes.csv...")
    routes_df = pd.read_csv('routes.csv')

    print(f"Generating GPS polylines for {len(routes_df)} routes...")

    polylines = []
    start_lats = []
    start_lons = []

    for idx, row in routes_df.iterrows():
        distance_km = row['distance_km_route']

        # Determine route type based on characteristics
        if row.get('is_likely_loop', 0) > 0.5:
            route_type = 'loop'
        elif row.get('is_likely_out_back', 0) > 0.5:
            route_type = 'out_back'
        else:
            route_type = np.random.choice(['loop', 'out_back', 'point'])

        # Generate polyline
        encoded, (start_lat, start_lon) = generate_route_polyline(
            distance_km,
            route_type=route_type,
            location_idx=idx
        )

        polylines.append(encoded)
        start_lats.append(start_lat)
        start_lons.append(start_lon)

        if (idx + 1) % 20 == 0:
            print(f"  Generated {idx + 1}/{len(routes_df)} polylines...")

    # Add to dataframe
    routes_df['gps_polyline'] = polylines
    routes_df['start_lat'] = start_lats
    routes_df['start_lon'] = start_lons

    # Save updated CSV
    print("\nSaving updated routes.csv...")
    routes_df.to_csv('routes.csv', index=False)

    print(f"\n✅ Success! Added GPS polylines to {len(routes_df)} routes")
    print(f"   New columns: gps_polyline, start_lat, start_lon")

    # Show sample
    print("\nSample route:")
    sample = routes_df.iloc[0]
    print(f"  Route ID: {sample['route_id']}")
    print(f"  Distance: {sample['distance_km_route']:.1f} km")
    print(f"  Start: ({sample['start_lat']:.4f}, {sample['start_lon']:.4f})")
    print(f"  Polyline: {sample['gps_polyline'][:50]}...")

if __name__ == '__main__':
    main()

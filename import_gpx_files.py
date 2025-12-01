#!/usr/bin/env python3
"""
Import real Strava routes from GPX files

Accepts GPX files exported from Strava and creates routes.csv
with real GPS data.
"""

import os
import xml.etree.ElementTree as ET
import pandas as pd
import polyline
from geopy.distance import geodesic
from pathlib import Path
import re

print("=" * 70)
print("📂 GPX FILE IMPORTER")
print("=" * 70)
print("Importing real Strava routes from GPX files...")
print()

# GPX namespace
GPX_NS = {
    'gpx': 'http://www.topografix.com/GPX/1/1',
    'gpxtpx': 'http://www.garmin.com/xmlschemas/TrackPointExtension/v1'
}

def parse_gpx_file(filepath):
    """Parse a GPX file and extract route data"""
    try:
        tree = ET.parse(filepath)
        root = tree.getroot()

        # Extract track points
        coords = []
        elevations = []

        # Try to find track points
        for trkpt in root.findall('.//gpx:trkpt', GPX_NS):
            lat = float(trkpt.get('lat'))
            lon = float(trkpt.get('lon'))
            coords.append((lat, lon))

            # Get elevation if available
            ele = trkpt.find('gpx:ele', GPX_NS)
            if ele is not None:
                elevations.append(float(ele.text))

        if not coords:
            return None

        # Extract metadata
        name_elem = root.find('.//gpx:name', GPX_NS)
        name = name_elem.text if name_elem is not None else Path(filepath).stem

        # Calculate distance
        total_distance_km = sum(
            geodesic(coords[i], coords[i+1]).kilometers
            for i in range(len(coords) - 1)
        )

        # Calculate elevation gain
        elevation_gain = 0
        if elevations and len(elevations) > 1:
            for i in range(len(elevations) - 1):
                diff = elevations[i+1] - elevations[i]
                if diff > 0:
                    elevation_gain += diff

        # Encode polyline
        encoded = polyline.encode(coords, 5)

        # Check if loop
        loop_distance = geodesic(coords[0], coords[-1]).meters
        is_loop = loop_distance < 100

        return {
            'name': name,
            'coords': coords,
            'polyline': encoded,
            'distance_km': total_distance_km,
            'elevation_gain': elevation_gain,
            'is_loop': is_loop,
            'num_points': len(coords)
        }

    except Exception as e:
        print(f"  ✗ Error parsing {filepath}: {e}")
        return None

def main():
    # Look for GPX files
    gpx_dirs = ['gpx_files', 'exports', 'activities', '.']

    gpx_files = []
    for gpx_dir in gpx_dirs:
        if os.path.exists(gpx_dir):
            gpx_files.extend(Path(gpx_dir).glob('*.gpx'))

    if not gpx_files:
        print("❌ No GPX files found!")
        print()
        print("Please place GPX files in one of these locations:")
        for d in gpx_dirs:
            print(f"  - {d}/")
        print()
        print("To export GPX from Strava:")
        print("  1. Go to an activity on Strava")
        print("  2. Click the '...' menu → Export GPX")
        print("  3. Save to this directory")
        print()
        exit(1)

    print(f"Found {len(gpx_files)} GPX files\n")

    # Parse all GPX files
    routes = []
    for idx, gpx_file in enumerate(gpx_files):
        print(f"[{idx+1:3d}/{len(gpx_files)}] {gpx_file.name[:50]:50s} ... ", end='', flush=True)

        route_data = parse_gpx_file(gpx_file)

        if route_data:
            # Create route entry
            route_id = f"GPX_{idx+1:03d}"

            routes.append({
                'route_id': route_id,
                'name': route_data['name'],
                'distance_km_route': route_data['distance_km'],
                'elevation_meters_route': route_data['elevation_gain'],
                'surface_type_route': 'mixed',  # Unknown from GPX
                'gps_polyline': route_data['polyline'],
                'start_lat': route_data['coords'][0][0],
                'start_lon': route_data['coords'][0][1],
                'end_lat': route_data['coords'][-1][0],
                'end_lon': route_data['coords'][-1][1],
                'is_likely_loop': 1.0 if route_data['is_loop'] else 0.0,
                'is_likely_out_back': 0.5,  # Unknown
                'actual_distance_km': route_data['distance_km'],
                'num_gps_points': route_data['num_points'],
                'area_name': 'Imported from GPX',
                'difficulty_score': route_data['distance_km'] * 0.5 + route_data['elevation_gain'] * 0.01,
                'grade_percent': (route_data['elevation_gain'] / (route_data['distance_km'] * 1000) * 100) if route_data['distance_km'] > 0 else 0
            })

            print(f"✓ {route_data['distance_km']:.2f}km, {route_data['num_points']} points")
        else:
            print(f"✗ Failed")

    if not routes:
        print("\n❌ No valid routes extracted from GPX files!")
        exit(1)

    # Create DataFrame
    routes_df = pd.DataFrame(routes)

    # Save
    print(f"\nSaving {len(routes_df)} routes to routes.csv...")
    routes_df.to_csv('routes.csv', index=False)

    print("\n" + "=" * 70)
    print("✅ SUCCESS!")
    print("=" * 70)
    print(f"Imported {len(routes_df)} real routes from GPX files")
    print()
    print("Statistics:")
    print(f"  Distance range: {routes_df['distance_km_route'].min():.1f} - {routes_df['distance_km_route'].max():.1f} km")
    print(f"  Average distance: {routes_df['distance_km_route'].mean():.1f} km")
    print(f"  Total elevation: {routes_df['elevation_meters_route'].sum():.0f} m")
    print(f"  Loop routes: {(routes_df['is_likely_loop'] > 0.5).sum()}")
    print()

    # Show sample
    sample = routes_df.iloc[0]
    print("Sample Route:")
    print(f"  Name: {sample['name']}")
    print(f"  ID: {sample['route_id']}")
    print(f"  Distance: {sample['distance_km_route']:.2f} km")
    print(f"  Elevation: {sample['elevation_meters_route']:.0f} m")
    print(f"  GPS Points: {sample['num_gps_points']}")
    print()
    print("=" * 70)
    print("✅ Routes ready for Streamlit app!")
    print("=" * 70)
    print()
    print("Next: streamlit run streamlit_app.py")

if __name__ == '__main__':
    main()

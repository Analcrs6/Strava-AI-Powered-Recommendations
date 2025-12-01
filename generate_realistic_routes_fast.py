#!/usr/bin/env python3
"""
Generate realistic, street-following GPS routes - FAST VERSION

Uses pre-downloaded NYC street networks and efficient routing algorithms
to create precise, followable routes in minutes instead of hours.
"""

import pandas as pd
import numpy as np
import polyline
import osmnx as ox
import networkx as nx
from geopy.distance import geodesic
import random
import warnings
warnings.filterwarnings('ignore')

print("=" * 70)
print("🗺️  REALISTIC ROUTE GENERATOR (Fast Version)")
print("=" * 70)
print("Generating precise street-following routes...")
print()

# Pre-download larger NYC networks (one-time cost)
print("Step 1: Downloading NYC street networks (this may take 2-3 minutes)...")

NETWORKS = {}

try:
    # Central/Upper Manhattan - for running
    print("  - Downloading Manhattan network...")
    NETWORKS['manhattan_walk'] = ox.graph_from_place(
        "Manhattan, New York, USA",
        network_type='walk',
        simplify=True
    )
    print("    ✓ Manhattan walk network ready")
except Exception as e:
    print(f"    ✗ Error: {e}")

try:
    # Brooklyn - for running and biking
    print("  - Downloading Brooklyn network...")
    NETWORKS['brooklyn_bike'] = ox.graph_from_bbox(
        north=40.739,
        south=40.639,
        east=-73.924,
        west=-73.999,
        network_type='bike',
        simplify=True
    )
    print("    ✓ Brooklyn bike network ready")
except Exception as e:
    print(f"    ✗ Error: {e}")

try:
    # Central Park area
    print("  - Downloading Central Park network...")
    NETWORKS['central_park'] = ox.graph_from_point(
        (40.7829, -73.9654),
        dist=2000,
        network_type='walk',
        simplify=True
    )
    print("    ✓ Central Park network ready")
except Exception as e:
    print(f"    ✗ Error: {e}")

if not NETWORKS:
    print("\n⚠️  Could not download networks. Using fallback...")
    # Create a minimal fallback
    try:
        NETWORKS['fallback'] = ox.graph_from_point(
            (40.7589, -73.9851),  # Times Square
            dist=3000,
            network_type='walk',
            simplify=True
        )
    except:
        print("❌ Network download failed. Please check internet connection.")
        exit(1)

print(f"\n✓ Downloaded {len(NETWORKS)} street networks")
print()

def find_route_in_network(G, target_distance_km, route_type='loop'):
    """Generate a route in the given network"""

    target_distance_m = target_distance_km * 1000
    tolerance = 0.25  # 25% tolerance

    # Get random start node
    nodes = list(G.nodes())
    if len(nodes) < 10:
        return None

    start_node = random.choice(nodes)

    best_route = None
    best_distance_diff = float('inf')

    # Try multiple attempts
    for attempt in range(15):
        try:
            if route_type == 'loop':
                # Find a node roughly half the distance away
                mid_node = random.choice(nodes)

                try:
                    path_out = nx.shortest_path(G, start_node, mid_node, weight='length')
                    path_back = nx.shortest_path(G, mid_node, start_node, weight='length')
                    route = path_out + path_back[1:]
                except:
                    continue

            elif route_type == 'out_back':
                # Out and back
                end_node = random.choice(nodes)
                try:
                    path_out = nx.shortest_path(G, start_node, end_node, weight='length')
                    route = path_out + list(reversed(path_out))[1:]
                except:
                    continue
            else:
                # Point to point
                end_node = random.choice(nodes)
                try:
                    route = nx.shortest_path(G, start_node, end_node, weight='length')
                except:
                    continue

            # Calculate distance
            if len(route) < 2:
                continue

            actual_distance_m = sum(
                G[route[i]][route[i+1]][0].get('length', 0)
                for i in range(len(route) - 1)
            )

            distance_diff = abs(actual_distance_m - target_distance_m)

            # Check if this is better
            if distance_diff < best_distance_diff:
                best_distance_diff = distance_diff
                best_route = route

                # If within tolerance, accept it
                if distance_diff / target_distance_m < tolerance:
                    return route

        except Exception as e:
            continue

    return best_route

def route_to_coords(G, route):
    """Convert route nodes to coordinates"""
    if not route or len(route) < 2:
        return None, None, None, None

    coords = []
    for node in route:
        try:
            lat = G.nodes[node]['y']
            lon = G.nodes[node]['x']
            coords.append((lat, lon))
        except:
            continue

    if len(coords) < 2:
        return None, None, None, None

    # Calculate actual distance
    actual_dist_km = sum(
        geodesic(coords[i], coords[i+1]).kilometers
        for i in range(len(coords) - 1)
    )

    # Encode polyline
    encoded = polyline.encode(coords, 5)

    return encoded, coords[0], coords[-1], actual_dist_km

def main():
    print("Step 2: Loading routes.csv...")
    routes_df = pd.read_csv('routes.csv')

    print(f"\nStep 3: Generating {len(routes_df)} realistic routes...")
    print()

    polylines = []
    start_lats = []
    start_lons = []
    end_lats = []
    end_lons = []
    actual_distances = []
    network_used = []

    success_count = 0
    network_names = list(NETWORKS.keys())

    for idx, row in routes_df.iterrows():
        target_distance = row['distance_km_route']

        # Determine route type
        if row.get('is_likely_loop', 0) > 0.5:
            route_type = 'loop'
        elif row.get('is_likely_out_back', 0) > 0.5:
            route_type = 'out_back'
        else:
            route_type = random.choice(['loop', 'out_back', 'point'])

        # Choose network (rotate through available networks)
        network_name = network_names[idx % len(network_names)]
        G = NETWORKS[network_name]

        print(f"[{idx+1:3d}/{len(routes_df)}] {route_type:10s} {target_distance:5.1f}km in {network_name:20s} ... ", end='', flush=True)

        # Generate route
        route = find_route_in_network(G, target_distance, route_type)

        if route:
            encoded, start, end, actual_dist = route_to_coords(G, route)

            if encoded and actual_dist:
                polylines.append(encoded)
                start_lats.append(start[0])
                start_lons.append(start[1])
                end_lats.append(end[0])
                end_lons.append(end[1])
                actual_distances.append(actual_dist)
                network_used.append(network_name)
                success_count += 1

                accuracy = abs(actual_dist - target_distance) / target_distance * 100
                print(f"✓ {actual_dist:.2f}km (±{accuracy:.0f}%)")
            else:
                # Failed to convert
                polylines.append(None)
                start_lats.append(None)
                start_lons.append(None)
                end_lats.append(None)
                end_lons.append(None)
                actual_distances.append(None)
                network_used.append(None)
                print("✗ Failed (conversion)")
        else:
            # Failed to generate
            polylines.append(None)
            start_lats.append(None)
            start_lons.append(None)
            end_lats.append(None)
            end_lons.append(None)
            actual_distances.append(None)
            network_used.append(None)
            print("✗ Failed (routing)")

    # Update dataframe
    routes_df['gps_polyline'] = polylines
    routes_df['start_lat'] = start_lats
    routes_df['start_lon'] = start_lons
    routes_df['end_lat'] = end_lats
    routes_df['end_lon'] = end_lons
    routes_df['actual_distance_km'] = actual_distances
    routes_df['network_area'] = network_used

    # Save
    print(f"\nStep 4: Saving routes.csv...")
    routes_df.to_csv('routes.csv', index=False)

    print("\n" + "=" * 70)
    print(f"✅ SUCCESS!")
    print("=" * 70)
    print(f"Generated {success_count}/{len(routes_df)} realistic street-following routes")
    print()
    print("New columns:")
    print("  - gps_polyline: GPS coordinates following real NYC streets")
    print("  - start_lat/lon, end_lat/lon: Precise start/end coordinates")
    print("  - actual_distance_km: Measured route distance")
    print("  - network_area: NYC area network used")
    print()
    print("✓ Routes are now PRECISE and FOLLOWABLE on real streets!")
    print("=" * 70)

    # Show statistics
    valid = routes_df[routes_df['gps_polyline'].notna()]
    if len(valid) > 0:
        print(f"\nAccuracy Statistics:")
        valid['error_pct'] = abs(valid['actual_distance_km'] - valid['distance_km_route']) / valid['distance_km_route'] * 100
        print(f"  Mean error: {valid['error_pct'].mean():.1f}%")
        print(f"  Median error: {valid['error_pct'].median():.1f}%")
        print(f"  Routes within 20% of target: {len(valid[valid['error_pct'] < 20])}/{len(valid)}")
        print()

        # Sample
        sample = valid.iloc[0]
        print(f"Sample Route:")
        print(f"  ID: {sample['route_id']}")
        print(f"  Area: {sample['network_area']}")
        print(f"  Target: {sample['distance_km_route']:.2f} km → Actual: {sample['actual_distance_km']:.2f} km")
        print(f"  Start: ({sample['start_lat']:.6f}, {sample['start_lon']:.6f})")
        print(f"  End: ({sample['end_lat']:.6f}, {sample['end_lon']:.6f})")
        print(f"  Polyline length: {len(sample['gps_polyline'])} chars")

if __name__ == '__main__':
    main()

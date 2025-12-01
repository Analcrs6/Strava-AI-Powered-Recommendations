#!/usr/bin/env python3
"""
Generate realistic, street-following GPS routes using OpenStreetMap data

Creates precise routes that users can actually follow on real streets.
Routes are generated using OSMnx to fetch real street networks and NetworkX
for routing algorithms.
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
print("🗺️  REALISTIC ROUTE GENERATOR")
print("=" * 70)
print("Generating street-following routes using OpenStreetMap data...")
print()

# NYC neighborhoods for route variety
NYC_AREAS = [
    {"name": "Central Park", "point": (40.7829, -73.9654), "type": "walk"},
    {"name": "Prospect Park", "point": (40.6602, -73.9690), "type": "walk"},
    {"name": "East River Greenway", "point": (40.7614, -73.9776), "type": "bike"},
    {"name": "Hudson River Greenway", "point": (40.7489, -73.9897), "type": "bike"},
    {"name": "Brooklyn Bridge Area", "point": (40.7061, -74.0087), "type": "walk"},
    {"name": "Williamsburg", "point": (40.7081, -73.9571), "type": "bike"},
    {"name": "Upper East Side", "point": (40.7736, -73.9566), "type": "walk"},
    {"name": "Lower Manhattan", "point": (40.7223, -74.0009), "type": "walk"},
]

# Cache for street networks
_network_cache = {}

def get_street_network(center, dist=3000, network_type='walk'):
    """Get street network around a center point with caching"""
    cache_key = (center, dist, network_type)

    if cache_key in _network_cache:
        return _network_cache[cache_key]

    try:
        print(f"  Downloading street network near {center}...")
        G = ox.graph_from_point(center, dist=dist, network_type=network_type, simplify=True)
        _network_cache[cache_key] = G
        return G
    except Exception as e:
        print(f"  Warning: Could not download network: {e}")
        return None

def find_nearest_node(G, point):
    """Find nearest node in graph to a point"""
    return ox.nearest_nodes(G, point[1], point[0])

def calculate_route_distance(G, route):
    """Calculate actual distance of a route in kilometers"""
    total_distance = 0
    for i in range(len(route) - 1):
        try:
            edge_data = G[route[i]][route[i+1]][0]
            total_distance += edge_data.get('length', 0)
        except:
            pass
    return total_distance / 1000  # Convert to km

def generate_loop_route(G, start_node, target_distance_km):
    """Generate a loop route of approximately target distance"""
    target_distance_m = target_distance_km * 1000

    # Try multiple attempts to find a good loop
    best_route = None
    best_distance_diff = float('inf')

    for attempt in range(10):
        try:
            # Pick a random far node
            all_nodes = list(G.nodes())
            random_nodes = random.sample(all_nodes, min(20, len(all_nodes)))

            for mid_node in random_nodes:
                # Calculate distance from start to mid
                try:
                    route_out = nx.shortest_path(G, start_node, mid_node, weight='length')
                    route_back = nx.shortest_path(G, mid_node, start_node, weight='length')

                    # Combine routes
                    full_route = route_out + route_back[1:]  # Avoid duplicate node

                    # Check distance
                    actual_distance_m = sum(
                        G[full_route[i]][full_route[i+1]][0].get('length', 0)
                        for i in range(len(full_route) - 1)
                    )

                    distance_diff = abs(actual_distance_m - target_distance_m)

                    # If close enough, use this route
                    if distance_diff < best_distance_diff:
                        best_distance_diff = distance_diff
                        best_route = full_route

                        # If within 20% of target, good enough
                        if distance_diff / target_distance_m < 0.2:
                            return full_route

                except:
                    continue
        except:
            continue

    return best_route if best_route else [start_node]

def generate_out_and_back_route(G, start_node, target_distance_km):
    """Generate an out-and-back route"""
    target_distance_m = target_distance_km * 1000 / 2  # Half distance each way

    all_nodes = list(G.nodes())
    best_route = None
    best_distance_diff = float('inf')

    # Try to find a good destination
    for _ in range(20):
        try:
            dest_node = random.choice(all_nodes)
            route_out = nx.shortest_path(G, start_node, dest_node, weight='length')

            actual_distance_m = sum(
                G[route_out[i]][route_out[i+1]][0].get('length', 0)
                for i in range(len(route_out) - 1)
            )

            distance_diff = abs(actual_distance_m - target_distance_m)

            if distance_diff < best_distance_diff:
                best_distance_diff = distance_diff
                best_route = route_out

                if distance_diff / target_distance_m < 0.2:
                    # Good enough, create out and back
                    route_back = list(reversed(route_out))
                    return route_out + route_back[1:]
        except:
            continue

    if best_route:
        route_back = list(reversed(best_route))
        return best_route + route_back[1:]

    return [start_node]

def generate_point_to_point_route(G, start_node, target_distance_km):
    """Generate a point-to-point route"""
    target_distance_m = target_distance_km * 1000

    all_nodes = list(G.nodes())
    best_route = None
    best_distance_diff = float('inf')

    for _ in range(20):
        try:
            end_node = random.choice(all_nodes)
            route = nx.shortest_path(G, start_node, end_node, weight='length')

            actual_distance_m = sum(
                G[route[i]][route[i+1]][0].get('length', 0)
                for i in range(len(route) - 1)
            )

            distance_diff = abs(actual_distance_m - target_distance_m)

            if distance_diff < best_distance_diff:
                best_distance_diff = distance_diff
                best_route = route

                if distance_diff / target_distance_m < 0.2:
                    return route
        except:
            continue

    return best_route if best_route else [start_node]

def route_to_polyline(G, route):
    """Convert route nodes to GPS polyline"""
    coords = []
    for node in route:
        lat = G.nodes[node]['y']
        lon = G.nodes[node]['x']
        coords.append((lat, lon))

    return polyline.encode(coords, 5), coords[0], coords[-1]

def generate_realistic_route(distance_km, route_type, area_info):
    """Generate a realistic route following real streets"""

    center = area_info['point']
    network_type = area_info['type']

    # Get street network
    # Adjust download distance based on target route distance
    download_dist = min(int(distance_km * 800), 5000)  # Scale with route distance, max 5km radius
    G = get_street_network(center, dist=download_dist, network_type=network_type)

    if G is None or len(G.nodes()) == 0:
        print(f"  Warning: No street network available for {area_info['name']}")
        return None, None, None, None

    # Find starting node
    start_node = find_nearest_node(G, center)

    # Generate route based on type
    if route_type == 'loop':
        route_nodes = generate_loop_route(G, start_node, distance_km)
    elif route_type == 'out_back':
        route_nodes = generate_out_and_back_route(G, start_node, distance_km)
    else:
        route_nodes = generate_point_to_point_route(G, start_node, distance_km)

    if not route_nodes or len(route_nodes) < 2:
        return None, None, None, None

    # Convert to polyline
    encoded, start_point, end_point = route_to_polyline(G, route_nodes)
    actual_distance = calculate_route_distance(G, route_nodes)

    return encoded, start_point, end_point, actual_distance

def main():
    print("Loading routes.csv...")
    routes_df = pd.read_csv('routes.csv')

    print(f"\nGenerating realistic street-following routes for {len(routes_df)} routes...")
    print("This will take a few minutes as we download real street data from OpenStreetMap...")
    print()

    polylines = []
    start_lats = []
    start_lons = []
    end_lats = []
    end_lons = []
    actual_distances = []
    area_names = []

    success_count = 0

    for idx, row in routes_df.iterrows():
        target_distance = row['distance_km_route']

        # Determine route type
        if row.get('is_likely_loop', 0) > 0.5:
            route_type = 'loop'
        elif row.get('is_likely_out_back', 0) > 0.5:
            route_type = 'out_back'
        else:
            route_type = random.choice(['loop', 'out_back', 'point'])

        # Choose area
        area = NYC_AREAS[idx % len(NYC_AREAS)]

        print(f"[{idx+1}/{len(routes_df)}] Generating {route_type} route in {area['name']} ({target_distance:.1f} km)...", end=' ')

        # Generate route
        encoded, start_point, end_point, actual_dist = generate_realistic_route(
            target_distance,
            route_type,
            area
        )

        if encoded and actual_dist:
            polylines.append(encoded)
            start_lats.append(start_point[0])
            start_lons.append(start_point[1])
            end_lats.append(end_point[0])
            end_lons.append(end_point[1])
            actual_distances.append(actual_dist)
            area_names.append(area['name'])
            success_count += 1

            accuracy = abs(actual_dist - target_distance) / target_distance * 100
            print(f"✓ {actual_dist:.2f} km (±{accuracy:.1f}%)")
        else:
            # Fallback to previous data or None
            polylines.append(None)
            start_lats.append(None)
            start_lons.append(None)
            end_lats.append(None)
            end_lons.append(None)
            actual_distances.append(None)
            area_names.append(None)
            print("✗ Failed")

    # Update dataframe
    routes_df['gps_polyline'] = polylines
    routes_df['start_lat'] = start_lats
    routes_df['start_lon'] = start_lons
    routes_df['end_lat'] = end_lats
    routes_df['end_lon'] = end_lons
    routes_df['actual_distance_km'] = actual_distances
    routes_df['area_name'] = area_names

    # Save
    print(f"\nSaving updated routes.csv...")
    routes_df.to_csv('routes.csv', index=False)

    print("\n" + "=" * 70)
    print(f"✅ SUCCESS!")
    print("=" * 70)
    print(f"Generated {success_count}/{len(routes_df)} realistic street-following routes")
    print(f"\nNew columns:")
    print(f"  - gps_polyline: Encoded GPS coordinates following real streets")
    print(f"  - start_lat/lon: Starting coordinates")
    print(f"  - end_lat/lon: Ending coordinates")
    print(f"  - actual_distance_km: Precise route distance")
    print(f"  - area_name: NYC neighborhood")
    print()
    print("Routes now follow real streets and are precisely measurable!")
    print("=" * 70)

    # Show sample
    if success_count > 0:
        valid_routes = routes_df[routes_df['gps_polyline'].notna()]
        if len(valid_routes) > 0:
            sample = valid_routes.iloc[0]
            print(f"\nSample Route:")
            print(f"  ID: {sample['route_id']}")
            print(f"  Area: {sample['area_name']}")
            print(f"  Target Distance: {sample['distance_km_route']:.2f} km")
            print(f"  Actual Distance: {sample['actual_distance_km']:.2f} km")
            print(f"  Start: ({sample['start_lat']:.6f}, {sample['start_lon']:.6f})")
            print(f"  End: ({sample['end_lat']:.6f}, {sample['end_lon']:.6f})")
            print(f"  Polyline: {sample['gps_polyline'][:60]}...")

if __name__ == '__main__':
    main()

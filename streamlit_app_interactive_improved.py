# -*- coding: utf-8 -*-
"""
Strava AI-Powered Personalized Activity Recommender - IMPROVED MAP VERSION

A Capstone Project by Anais Lacreuse & Mrudula Dama

Features:
- MAIN MAP showing ALL routes at once
- Refueling stations always visible
- Click routes to highlight and view details
- Route creator with drawing capability
"""

import streamlit as st
import pandas as pd
import numpy as np
import folium
from streamlit_folium import st_folium
import plotly.express as px
import plotly.graph_objects as go
import os
import json
import polyline
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler
from pathlib import Path
from datetime import datetime, timedelta
import requests

st.set_page_config(
    page_title="Strava AI Recommender - Interactive",
    page_icon="🏃‍♀️",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    .main-header {
        background: linear-gradient(90deg, #FC4C02 0%, #FF6B35 100%);
        padding: 20px;
        border-radius: 10px;
        color: white;
        text-align: center;
        margin-bottom: 20px;
    }
</style>
""", unsafe_allow_html=True)

REFUELING_STATIONS = [
    {"name": "Juice Generation", "lat": 40.7580, "lon": -73.9855, "type": "protein", "amenities": ["protein shakes", "smoothies"]},
    {"name": "Juice Press", "lat": 40.7829, "lon": -73.9654, "type": "protein", "amenities": ["cold-pressed juice", "protein"]},
    {"name": "Smoothie King", "lat": 40.7489, "lon": -73.9680, "type": "protein", "amenities": ["smoothies", "supplements"]},
    {"name": "Blue Bottle Coffee", "lat": 40.7614, "lon": -73.9776, "type": "cafe", "amenities": ["coffee", "snacks"]},
    {"name": "Starbucks Reserve", "lat": 40.7411, "lon": -73.9897, "type": "cafe", "amenities": ["coffee", "food"]},
    {"name": "Central Park Fountain", "lat": 40.7812, "lon": -73.9665, "type": "water", "amenities": ["water fountain"]},
    {"name": "Prospect Park Fountain", "lat": 40.6610, "lon": -73.9695, "type": "water", "amenities": ["water fountain"]},
    {"name": "Whole Foods", "lat": 40.7223, "lon": -74.0009, "type": "store", "amenities": ["snacks", "drinks", "energy bars"]},
    {"name": "7-Eleven", "lat": 40.7061, "lon": -74.0087, "type": "store", "amenities": ["sports drinks", "snacks"]},
]

if 'selected_route' not in st.session_state:
    st.session_state.selected_route = None
if 'favorite_routes' not in st.session_state:
    st.session_state.favorite_routes = []
if 'completed_routes' not in st.session_state:
    st.session_state.completed_routes = []
if 'show_refueling' not in st.session_state:
    st.session_state.show_refueling = True

@st.cache_data
def load_strava_user():
    tokens_path = Path('tokens.json')
    if tokens_path.exists():
        try:
            tokens = json.loads(tokens_path.read_text())
            athlete = tokens.get('athlete', {})
            return {
                'username': athlete.get('username', 'unknown'),
                'firstname': athlete.get('firstname', ''),
                'lastname': athlete.get('lastname', ''),
                'city': athlete.get('city', '')
            }
        except:
            return None
    return None

@st.cache_data
def load_data():
    try:
        processed_df = pd.read_csv('processed_activities.csv')
        routes_df = pd.read_csv('routes.csv')
        processed_df['start_date'] = pd.to_datetime(processed_df['start_date'])
        return processed_df, routes_df
    except FileNotFoundError as e:
        st.error(f"Data files not found: {e}")
        st.error("Run `python generate_csv_exports.py` first")
        st.stop()

processed_df, routes_df = load_data()
ALL_USERS = sorted(processed_df['user_id'].unique().tolist())

@st.cache_resource
def prepare_recommendation_model(processed_df):
    route_features_df = processed_df[['route_id', 'distance_km_route', 'elevation_meters_route', 'surface_type_route']].drop_duplicates(subset=['route_id']).set_index('route_id')
    route_features_encoded = pd.get_dummies(route_features_df, columns=['surface_type_route'])
    scaler = MinMaxScaler()
    numerical_cols = ['distance_km_route', 'elevation_meters_route']
    route_features_encoded[numerical_cols] = scaler.fit_transform(route_features_encoded[numerical_cols])
    route_vectors = route_features_encoded.values
    item_similarity_matrix = cosine_similarity(route_vectors)
    route_map = {route_id: i for i, route_id in enumerate(route_features_encoded.index)}
    return route_features_encoded, item_similarity_matrix, route_map

route_features_encoded, item_similarity_matrix, route_map = prepare_recommendation_model(processed_df)

def get_personalized_recommendations(user_id, desired_distance, k=10):
    user_ratings = processed_df[(processed_df['user_id'] == user_id) & (processed_df['rating'] >= 4)]

    if user_ratings.empty:
        most_popular = processed_df.groupby('route_id')['rating'].mean().sort_values(ascending=False).head(k * 2).index.tolist()
        final_recommendations = routes_df[routes_df['route_id'].isin(most_popular)].head(k).copy()
        final_recommendations['score'] = np.random.uniform(70, 85, len(final_recommendations)).round(1)
        return final_recommendations

    preferred_routes = user_ratings['route_id'].unique()
    sim_scores = {}

    for route_id in route_features_encoded.index:
        if route_id not in preferred_routes and route_id in route_map:
            index = route_map[route_id]
            sim_scores[route_id] = sum(
                item_similarity_matrix[index][route_map[pref_id]]
                for pref_id in preferred_routes if pref_id in route_map
            )

    if not sim_scores:
        return routes_df.head(k)

    recommendation_scores = pd.DataFrame(list(sim_scores.items()), columns=['route_id', 'similarity_score'])
    recommendation_scores = pd.merge(recommendation_scores, routes_df, on='route_id')
    recommendation_scores['distance_diff'] = abs(recommendation_scores['distance_km_route'] - desired_distance)
    recommendation_scores = recommendation_scores[recommendation_scores['distance_diff'] <= 10]

    if len(recommendation_scores) == 0:
        recommendation_scores = pd.DataFrame(list(sim_scores.items()), columns=['route_id', 'similarity_score'])
        recommendation_scores = pd.merge(recommendation_scores, routes_df, on='route_id')

    recommendation_scores['context_boost'] = recommendation_scores['similarity_score'] * 1.2
    final_recommendations = recommendation_scores.sort_values(by=['context_boost', 'similarity_score'], ascending=False).head(k)
    final_recommendations = final_recommendations.copy()
    final_recommendations['score'] = (final_recommendations['context_boost'] * 100).round(1)

    return final_recommendations

st.markdown('<div class="main-header"><h1>🏃‍♀️ Strava AI Recommender - Map View 🗺️</h1><p>By Anais Lacreuse & Mrudula Dama</p></div>', unsafe_allow_html=True)

strava_user = load_strava_user()
if strava_user:
    st.info(f"🔗 Connected: **{strava_user['firstname']} {strava_user['lastname']}** (@{strava_user['username']}) - {strava_user['city']}")

with st.sidebar:
    st.header("🎯 Controls")

    mode = st.radio(
        "**Choose Mode:**",
        ["🗺️ Map View (All Routes)", "📊 Data Analytics", "✏️ Route Creator"],
        index=0
    )

    st.markdown("---")

    selected_user = st.selectbox(
        "**User Profile:**",
        options=ALL_USERS,
        index=0
    )

    st.subheader("⚙️ Filters")

    desired_distance = st.slider(
        "Distance (km)",
        min_value=1.0,
        max_value=50.0,
        value=15.0,
        step=0.5
    )

    surface_types = st.multiselect(
        "Surface Types:",
        ['road', 'trail', 'track', 'mixed'],
        default=['road', 'trail']
    )

    elevation_range = st.slider(
        "Elevation Gain (m)",
        min_value=0,
        max_value=1000,
        value=(0, 500),
        step=50
    )

    st.markdown("---")

    st.subheader("🥤 Refueling Stations")
    st.session_state.show_refueling = st.checkbox("Show on Map", value=True)

    refuel_types = st.multiselect(
        "Station Types:",
        ['Protein Shops', 'Cafes', 'Water Fountains', 'Stores'],
        default=['Protein Shops', 'Water Fountains', 'Cafes', 'Stores']
    )

    st.markdown("---")

    with st.expander("📊 Dataset Info"):
        st.metric("Total Routes", len(routes_df))
        st.metric("Total Activities", len(processed_df))
        st.metric("Avg Distance", f"{routes_df['distance_km_route'].mean():.1f} km")

recommendations = get_personalized_recommendations(selected_user, desired_distance, k=10)

if surface_types:
    recommendations = recommendations[recommendations['surface_type_route'].isin(surface_types)]

recommendations = recommendations[
    (recommendations['elevation_meters_route'] >= elevation_range[0]) &
    (recommendations['elevation_meters_route'] <= elevation_range[1])
]

if mode == "🗺️ Map View (All Routes)":
    st.header("🗺️ Interactive Route Map")

    user_activities = processed_df[processed_df['user_id'] == selected_user]
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Recommended Routes", len(recommendations))
    with col2:
        st.metric("Avg Distance", f"{recommendations['distance_km_route'].mean():.1f} km")
    with col3:
        st.metric("Avg Elevation", f"{recommendations['elevation_meters_route'].mean():.0f} m")
    with col4:
        st.metric("Favorites", len(st.session_state.favorite_routes))

    st.markdown("---")

    # Create main map with ALL routes
    all_lats = []
    all_lons = []

    # Get center point from all routes
    for idx, route in recommendations.iterrows():
        if 'gps_polyline' in route and pd.notna(route['gps_polyline']):
            try:
                decoded = polyline.decode(route['gps_polyline'])
                all_lats.extend([lat for lat, lon in decoded])
                all_lons.extend([lon for lat, lon in decoded])
            except:
                pass

    if all_lats and all_lons:
        center_lat = np.mean(all_lats)
        center_lon = np.mean(all_lons)
    else:
        center_lat, center_lon = 40.7589, -73.9851  # Default NYC

    m = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=12,
        tiles="OpenStreetMap"
    )

    # Add ALL recommended routes to the map
    route_colors = ['#FC4C02', '#FF6B35', '#FFA07A', '#FF8C69', '#E9967A']

    for idx, route in recommendations.iterrows():
        if 'gps_polyline' in route and pd.notna(route['gps_polyline']):
            try:
                decoded_coords = polyline.decode(route['gps_polyline'])

                color = route_colors[idx % len(route_colors)]
                is_selected = st.session_state.selected_route == route['route_id']

                route_name = route.get('area_name', route['route_id'])
                route_dist = route['distance_km_route']
                route_elev = route['elevation_meters_route']
                route_surface = route['surface_type_route']

                popup_html = f"""
                <div style="font-family: Arial; width: 200px;">
                    <h4 style="color: #FC4C02; margin: 0;">{route_name}</h4>
                    <p style="margin: 5px 0;"><b>Distance:</b> {route_dist:.1f} km</p>
                    <p style="margin: 5px 0;"><b>Elevation:</b> {route_elev:.0f} m</p>
                    <p style="margin: 5px 0;"><b>Surface:</b> {route_surface}</p>
                    <p style="margin: 5px 0;"><b>Route ID:</b> {route['route_id']}</p>
                </div>
                """

                folium.PolyLine(
                    decoded_coords,
                    color=color if not is_selected else '#FF0000',
                    weight=4 if not is_selected else 6,
                    opacity=0.7 if not is_selected else 1.0,
                    popup=folium.Popup(popup_html, max_width=250),
                    tooltip=f"{route_name} - {route_dist:.1f}km"
                ).add_to(m)

                # Add start marker
                folium.CircleMarker(
                    decoded_coords[0],
                    radius=5,
                    color=color,
                    fill=True,
                    fillColor=color,
                    fillOpacity=0.8,
                    popup=f"START: {route_name}"
                ).add_to(m)

            except Exception as e:
                st.warning(f"Could not load route {route['route_id']}: {e}")

    # Add refueling stations
    if st.session_state.show_refueling:
        type_map = {
            'Protein Shops': 'protein',
            'Cafes': 'cafe',
            'Water Fountains': 'water',
            'Stores': 'store'
        }

        selected_refuel_types = [type_map[t] for t in refuel_types if t in type_map]

        for station in REFUELING_STATIONS:
            if station['type'] in selected_refuel_types:
                icon_map = {
                    'protein': {'color': 'orange', 'icon': 'tint'},
                    'cafe': {'color': 'darkred', 'icon': 'coffee'},
                    'water': {'color': 'lightblue', 'icon': 'tint'},
                    'store': {'color': 'green', 'icon': 'shopping-cart'}
                }

                icon_props = icon_map.get(station['type'], {'color': 'gray', 'icon': 'info-sign'})

                station_html = f"""
                <div style="font-family: Arial;">
                    <h4 style="color: {icon_props['color']}; margin: 0;">{station['name']}</h4>
                    <p style="margin: 5px 0;"><b>Type:</b> {station['type'].title()}</p>
                    <p style="margin: 5px 0;"><b>Amenities:</b></p>
                    <ul style="margin: 0; padding-left: 20px;">
                        {"".join([f"<li>{a}</li>" for a in station['amenities']])}
                    </ul>
                </div>
                """

                folium.Marker(
                    [station['lat'], station['lon']],
                    popup=folium.Popup(station_html, max_width=200),
                    tooltip=f"🥤 {station['name']}",
                    icon=folium.Icon(color=icon_props['color'], icon=icon_props['icon'], prefix='fa')
                ).add_to(m)

    # Display the map
    map_data = st_folium(m, height=600, use_container_width=True)

    st.markdown("---")

    # Route list below the map
    st.subheader(f"📋 Recommended Routes ({len(recommendations)})")

    for idx, route in recommendations.iterrows():
        col1, col2, col3 = st.columns([3, 1, 1])

        with col1:
            route_name = route.get('area_name', route['route_id'])
            is_fav = route['route_id'] in st.session_state.favorite_routes
            is_done = route['route_id'] in st.session_state.completed_routes

            status = ""
            if is_fav:
                status += "⭐ "
            if is_done:
                status += "✅ "

            st.write(f"{status}**{route_name}** - {route['distance_km_route']:.1f}km, {route['elevation_meters_route']:.0f}m ↗️, {route['surface_type_route']}")

        with col2:
            if st.button("⭐ Favorite" if route['route_id'] not in st.session_state.favorite_routes else "★ Unfavorite",
                        key=f"fav_{idx}"):
                if route['route_id'] in st.session_state.favorite_routes:
                    st.session_state.favorite_routes.remove(route['route_id'])
                else:
                    st.session_state.favorite_routes.append(route['route_id'])
                st.rerun()

        with col3:
            if st.button("✓ Done" if route['route_id'] not in st.session_state.completed_routes else "↺ Undo",
                        key=f"done_{idx}"):
                if route['route_id'] in st.session_state.completed_routes:
                    st.session_state.completed_routes.remove(route['route_id'])
                else:
                    st.session_state.completed_routes.append(route['route_id'])
                st.rerun()

elif mode == "📊 Data Analytics":
    st.header("📊 Data Analytics Mode")

    user_activities = processed_df[processed_df['user_id'] == selected_user]

    tab1, tab2 = st.tabs(["📈 Overview", "🎯 Performance"])

    with tab1:
        st.subheader("Activity Overview")

        fig = px.histogram(
            user_activities,
            x='distance_km_user',
            nbins=20,
            title="Distance Distribution",
            labels={'distance_km_user': 'Distance (km)'},
            color_discrete_sequence=['#FC4C02']
        )
        st.plotly_chart(fig, use_container_width=True)

        activities_by_date = user_activities.groupby(user_activities['start_date'].dt.date).size().reset_index(name='count')
        fig2 = px.line(
            activities_by_date,
            x='start_date',
            y='count',
            title="Activities Over Time",
            labels={'start_date': 'Date', 'count': 'Number of Activities'},
            color_discrete_sequence=['#FC4C02']
        )
        st.plotly_chart(fig2, use_container_width=True)

    with tab2:
        st.subheader("Performance Metrics")

        col1, col2 = st.columns(2)

        with col1:
            if 'average_pace_min_per_km' in user_activities.columns:
                fig = px.box(
                    user_activities,
                    y='average_pace_min_per_km',
                    title="Pace Distribution",
                    labels={'average_pace_min_per_km': 'Pace (min/km)'},
                    color_discrete_sequence=['#FC4C02']
                )
                st.plotly_chart(fig, use_container_width=True)

        with col2:
            fig = px.pie(
                user_activities.groupby('rating').size().reset_index(name='count'),
                values='count',
                names='rating',
                title="Rating Distribution",
                color_discrete_sequence=px.colors.sequential.Oranges
            )
            st.plotly_chart(fig, use_container_width=True)

elif mode == "✏️ Route Creator":
    st.header("✏️ Route Creator Mode")

    st.subheader("🎨 Create Your Custom Route")

    st.info("**Click on the map to add waypoints for your custom route!**")

    # Create empty map for route drawing
    center_lat, center_lon = 40.7589, -73.9851

    m = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=13,
        tiles="OpenStreetMap"
    )

    # Add draw plugin
    from folium import plugins
    draw = plugins.Draw(
        export=True,
        filename='my_route.geojson',
        position='topleft',
        draw_options={
            'polyline': {'allowIntersection': False},
            'polygon': False,
            'circle': False,
            'rectangle': False,
            'circlemarker': False,
            'marker': True
        }
    )
    draw.add_to(m)

    # Add refueling stations for reference
    if st.session_state.show_refueling:
        for station in REFUELING_STATIONS:
            folium.Marker(
                [station['lat'], station['lon']],
                popup=station['name'],
                tooltip=f"🥤 {station['name']}",
                icon=folium.Icon(color='blue', icon='tint', prefix='fa')
            ).add_to(m)

    st_folium(m, height=500, use_container_width=True)

    st.write("**Instructions:**")
    st.write("1. Click the ✏️ polyline tool on the map")
    st.write("2. Click points on the map to create your route")
    st.write("3. Double-click to finish drawing")
    st.write("4. Use markers to add waypoints (water, rest stops, etc.)")

    st.markdown("---")

    st.subheader("⭐ Your Favorite Routes")

    if st.session_state.favorite_routes:
        fav_routes = routes_df[routes_df['route_id'].isin(st.session_state.favorite_routes)]

        for idx, route in fav_routes.iterrows():
            col1, col2 = st.columns([4, 1])
            with col1:
                route_name = route.get('area_name', route['route_id'])
                st.write(f"**{route_name}**: {route['distance_km_route']:.1f}km, {route['elevation_meters_route']:.0f}m")
            with col2:
                if st.button("Remove", key=f"rem_fav_{idx}"):
                    st.session_state.favorite_routes.remove(route['route_id'])
                    st.rerun()
    else:
        st.info("No favorite routes yet. Mark routes as favorites from the Map View!")

st.markdown("---")
col1, col2, col3 = st.columns(3)
with col1:
    st.caption(f"**Routes:** {len(routes_df)}")
with col2:
    st.caption(f"**Activities:** {len(processed_df)}")
with col3:
    st.caption("Built with ❤️ using Streamlit")

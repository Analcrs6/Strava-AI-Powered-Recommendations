# -*- coding: utf-8 -*-
"""
Strava AI-Powered Personalized Activity Recommender - INTERACTIVE VERSION

A Capstone Project by Anais Lacreuse & Mrudula Dama

Features:
- Route Explorer Mode: Click, hover, compare routes
- Social Runner: Live feed, challenges, leaderboards
- Data Nerd: Interactive charts, elevation profiles, analytics
- Route Creator: Draw routes, get AI suggestions
- Refueling Stations: Protein drinks, cafes, water fountains
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

# --- Configuration ---
st.set_page_config(
    page_title="Strava AI Recommender - Interactive",
    page_icon="🏃‍♀️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better interactivity
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
    .route-card {
        background: #f0f2f6;
        padding: 15px;
        border-radius: 8px;
        border-left: 4px solid #FC4C02;
        margin: 10px 0;
        cursor: pointer;
        transition: all 0.3s;
    }
    .route-card:hover {
        background: #e1e5eb;
        transform: translateX(5px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .metric-card {
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        text-align: center;
    }
    .refuel-marker {
        background: #28a745;
        color: white;
        padding: 5px 10px;
        border-radius: 5px;
        font-size: 12px;
    }
</style>
""", unsafe_allow_html=True)

# --- Refueling Stations Data (NYC) ---
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

# --- Session State Initialization ---
if 'selected_routes' not in st.session_state:
    st.session_state.selected_routes = []
if 'favorite_routes' not in st.session_state:
    st.session_state.favorite_routes = []
if 'completed_routes' not in st.session_state:
    st.session_state.completed_routes = []
if 'comparison_mode' not in st.session_state:
    st.session_state.comparison_mode = False
if 'show_refueling' not in st.session_state:
    st.session_state.show_refueling = True

# --- Load Strava User ---
@st.cache_data
def load_strava_user():
    """Load authenticated Strava user"""
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

# --- Load Data ---
@st.cache_data
def load_data():
    """Load and prepare data"""
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

# --- Recommendation Model ---
@st.cache_resource
def prepare_recommendation_model(processed_df):
    """Prepare recommendation model"""
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

# --- Recommendation Function ---
def get_personalized_recommendations(user_id, desired_distance, time_of_day, k=10):
    """Get personalized recommendations"""
    user_ratings = processed_df[(processed_df['user_id'] == user_id) & (processed_df['rating'] >= 4)]

    if user_ratings.empty:
        most_popular = processed_df.groupby('route_id')['rating'].mean().sort_values(ascending=False).head(k * 2).index.tolist()
        final_recommendations = routes_df[routes_df['route_id'].isin(most_popular)].head(k).copy()
        final_recommendations['logic'] = "Popular Routes"
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
    recommendation_scores = recommendation_scores[recommendation_scores['distance_diff'] <= 5]

    if len(recommendation_scores) == 0:
        recommendation_scores = pd.DataFrame(list(sim_scores.items()), columns=['route_id', 'similarity_score'])
        recommendation_scores = pd.merge(recommendation_scores, routes_df, on='route_id')

    recommendation_scores['context_boost'] = recommendation_scores['similarity_score'] * 1.2
    final_recommendations = recommendation_scores.sort_values(by=['context_boost', 'similarity_score'], ascending=False).head(k)

    final_recommendations = final_recommendations.copy()
    final_recommendations['logic'] = "Personalized Match"
    final_recommendations['score'] = (final_recommendations['context_boost'] * 100).round(1)

    return final_recommendations

# --- Proximity Alerts ---
@st.cache_data(ttl=30)
def fetch_proximity_alerts():
    """Fetch live proximity alerts"""
    try:
        response = requests.get("http://localhost:5000/api/alerts?limit=5", timeout=2)
        if response.status_code == 200:
            return response.json().get('alerts', [])
    except:
        pass
    return []

# --- Header ---
st.markdown('<div class="main-header"><h1>🏃‍♀️ Strava AI Recommender - Interactive Edition 🚴</h1><p>By Anais Lacreuse & Mrudula Dama</p></div>', unsafe_allow_html=True)

# Show authenticated user
strava_user = load_strava_user()
if strava_user:
    st.info(f"🔗 Connected: **{strava_user['firstname']} {strava_user['lastname']}** (@{strava_user['username']}) - {strava_user['city']}")

# --- SIDEBAR ---
with st.sidebar:
    st.header("🎯 Controls")

    mode = st.radio(
        "**Choose Mode:**",
        ["🗺️ Route Explorer", "📊 Data Analytics", "👥 Social Feed", "✏️ Route Creator"],
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

    time_of_day = st.radio(
        "Time of Day:",
        ['Morning (5-9 AM)', 'Midday (9 AM - 2 PM)', 'Evening (After 5 PM)'],
        index=2
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

    difficulty = st.select_slider(
        "Difficulty:",
        options=['Easy', 'Moderate', 'Hard', 'Very Hard'],
        value='Moderate'
    )

    route_type_filter = st.multiselect(
        "Route Type:",
        ['Loop', 'Out-and-Back', 'Point-to-Point'],
        default=['Loop', 'Out-and-Back']
    )

    st.markdown("---")

    st.subheader("🥤 Refueling Stations")
    st.session_state.show_refueling = st.checkbox("Show on Map", value=True)

    refuel_types = st.multiselect(
        "Station Types:",
        ['Protein Shops', 'Cafes', 'Water Fountains', 'Stores'],
        default=['Protein Shops', 'Water Fountains']
    )

    st.markdown("---")

    st.session_state.comparison_mode = st.checkbox("Comparison Mode", value=False)

    if st.session_state.comparison_mode:
        num_compare = st.number_input("Routes to Compare:", min_value=2, max_value=3, value=2)

    st.markdown("---")

    with st.expander("📊 Dataset Info"):
        st.metric("Total Routes", len(routes_df))
        st.metric("Total Activities", len(processed_df))
        st.metric("Avg Distance", f"{routes_df['distance_km_route'].mean():.1f} km")

# --- Get Recommendations ---
recommendations = get_personalized_recommendations(selected_user, desired_distance, time_of_day, k=10)

if surface_types:
    recommendations = recommendations[recommendations['surface_type_route'].isin(surface_types)]

recommendations = recommendations[
    (recommendations['elevation_meters_route'] >= elevation_range[0]) &
    (recommendations['elevation_meters_route'] <= elevation_range[1])
]

# --- MAIN CONTENT ---

if mode == "🗺️ Route Explorer":
    st.header("🗺️ Route Explorer Mode")

    user_activities = processed_df[processed_df['user_id'] == selected_user]
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Activities", len(user_activities), help="Total activities completed")
    with col2:
        st.metric("Avg Rating", f"{user_activities['rating'].mean():.1f}⭐")
    with col3:
        st.metric("Total Distance", f"{user_activities['distance_km_user'].sum():.0f} km")
    with col4:
        st.metric("Favorites", len(st.session_state.favorite_routes), delta=len(st.session_state.favorite_routes))

    st.markdown("---")

    st.subheader(f"✨ Top {len(recommendations)} Recommended Routes")

    if len(recommendations) > 0:
        for idx, route in recommendations.iterrows():
            col_card, col_actions = st.columns([4, 1])

            with col_card:
                is_favorite = route['route_id'] in st.session_state.favorite_routes
                is_completed = route['route_id'] in st.session_state.completed_routes

                status_icons = ""
                if is_favorite:
                    status_icons += " ⭐"
                if is_completed:
                    status_icons += " ✅"

                route_name = route.get('name', 'Unnamed Route')[:30]
                route_dist = route['distance_km_route']
                route_elev = route['elevation_meters_route']

                if st.button(
                    f"{'📍' if idx == 0 else '🗺️'} {route['route_id']}: {route_name} - {route_dist:.1f}km, {route_elev:.0f}m ↗️ {status_icons}",
                    key=f"route_{idx}",
                    use_container_width=True
                ):
                    if route['route_id'] not in st.session_state.selected_routes:
                        st.session_state.selected_routes = [route['route_id']]

            with col_actions:
                col_fav, col_done = st.columns(2)
                with col_fav:
                    if st.button("⭐" if route['route_id'] not in st.session_state.favorite_routes else "★",
                                key=f"fav_{idx}", help="Add to favorites"):
                        if route['route_id'] in st.session_state.favorite_routes:
                            st.session_state.favorite_routes.remove(route['route_id'])
                        else:
                            st.session_state.favorite_routes.append(route['route_id'])
                        st.rerun()

                with col_done:
                    if st.button("✓", key=f"done_{idx}", help="Mark as completed"):
                        if route['route_id'] in st.session_state.completed_routes:
                            st.session_state.completed_routes.remove(route['route_id'])
                        else:
                            st.session_state.completed_routes.append(route['route_id'])
                        st.rerun()

        st.markdown("---")

        if len(st.session_state.selected_routes) > 0:
            selected_route_id = st.session_state.selected_routes[0]
            selected_route = routes_df[routes_df['route_id'] == selected_route_id].iloc[0]

            st.subheader(f"🗺️ {selected_route.get('name', selected_route_id)}")

            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Distance", f"{selected_route['distance_km_route']:.2f} km")
            with col2:
                st.metric("Elevation", f"{selected_route['elevation_meters_route']:.0f} m")
            with col3:
                st.metric("Surface", selected_route['surface_type_route'].title())
            with col4:
                st.metric("Difficulty", f"{selected_route.get('difficulty_score', 0):.1f}")

            if 'gps_polyline' in selected_route and pd.notna(selected_route['gps_polyline']):
                try:
                    decoded_coords = polyline.decode(selected_route['gps_polyline'])
                    center_lat = np.mean([lat for lat, lon in decoded_coords])
                    center_lon = np.mean([lon for lat, lon in decoded_coords])

                    m = folium.Map(
                        location=[center_lat, center_lon],
                        zoom_start=13,
                        tiles="OpenStreetMap"
                    )

                    route_name_display = selected_route.get('name', selected_route_id)
                    route_distance = selected_route['distance_km_route']
                    popup_text = f"{route_name_display}: {route_distance:.1f} km"

                    folium.PolyLine(
                        decoded_coords,
                        color='#FC4C02',
                        weight=5,
                        opacity=0.8,
                        popup=popup_text
                    ).add_to(m)

                    folium.Marker(
                        decoded_coords[0],
                        popup="<b>Start</b>",
                        icon=folium.Icon(color='green', icon='play', prefix='fa')
                    ).add_to(m)

                    folium.Marker(
                        decoded_coords[-1],
                        popup="<b>End</b>",
                        icon=folium.Icon(color='red', icon='stop', prefix='fa')
                    ).add_to(m)

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
                                    'cafe': {'color': 'brown', 'icon': 'coffee'},
                                    'water': {'color': 'blue', 'icon': 'tint'},
                                    'store': {'color': 'green', 'icon': 'shopping-cart'}
                                }

                                icon_props = icon_map.get(station['type'], {'color': 'gray', 'icon': 'map-marker'})

                                station_popup = f"<b>{station['name']}</b><br>{'<br>'.join(station['amenities'])}"

                                folium.Marker(
                                    [station['lat'], station['lon']],
                                    popup=station_popup,
                                    tooltip=station['name'],
                                    icon=folium.Icon(color=icon_props['color'], icon=icon_props['icon'], prefix='fa')
                                ).add_to(m)

                    st_folium(m, height=500, use_container_width=True)

                except Exception as e:
                    st.error(f"Map error: {e}")
            else:
                st.warning("GPS data not available for this route")
        else:
            st.info("👆 Click a route above to view it on the map")

elif mode == "📊 Data Analytics":
    st.header("📊 Data Analytics Mode")

    user_activities = processed_df[processed_df['user_id'] == selected_user]

    tab1, tab2, tab3 = st.tabs(["📈 Overview", "📏 Elevation Profile", "🎯 Performance"])

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
        st.subheader("Elevation Profiles")

        if len(st.session_state.selected_routes) > 0:
            selected_route_id = st.session_state.selected_routes[0]
            selected_route = routes_df[routes_df['route_id'] == selected_route_id].iloc[0]

            distance_points = np.linspace(0, selected_route['distance_km_route'], 50)
            elevation_points = np.random.normal(
                selected_route['elevation_meters_route'] / 2,
                selected_route['elevation_meters_route'] / 4,
                50
            ).cumsum()
            elevation_points = elevation_points - elevation_points.min()
            elevation_points = elevation_points * (selected_route['elevation_meters_route'] / elevation_points.max())

            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=distance_points,
                y=elevation_points,
                mode='lines',
                fill='tozeroy',
                line=dict(color='#FC4C02', width=3),
                name='Elevation'
            ))

            fig.update_layout(
                title=f"Elevation Profile: {selected_route.get('name', selected_route_id)}",
                xaxis_title="Distance (km)",
                yaxis_title="Elevation (m)",
                hovermode='x unified'
            )

            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("Select a route to see its elevation profile")

    with tab3:
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

elif mode == "👥 Social Feed":
    st.header("👥 Social Runner Mode")

    col1, col2 = st.columns([2, 1])

    with col1:
        st.subheader("🔔 Live Activity Feed")

        alerts = fetch_proximity_alerts()

        if alerts:
            for alert in alerts:
                alert_type = alert.get('type', 'info')
                message = alert.get('message', '')
                timestamp = alert.get('timestamp', '')

                if alert_type == 'proximity_alert':
                    st.warning(f"⚠️ **{timestamp}** - {message}")
                elif alert_type == 'webhook_log':
                    st.info(f"📡 **{timestamp}** - {message}")
                else:
                    st.text(f"{timestamp} - {message}")
        else:
            st.info("No recent activities. Start the proximity server to see live updates!")

            with st.expander("How to enable"):
                st.code("python proximity_alert_server.py", language="bash")

        st.subheader("🏆 Route Leaderboard")

        popular_routes = processed_df.groupby('route_id').agg({
            'rating': 'mean',
            'user_id': 'count'
        }).reset_index()
        popular_routes.columns = ['route_id', 'avg_rating', 'num_activities']
        popular_routes = popular_routes.sort_values('num_activities', ascending=False).head(10)
        popular_routes = pd.merge(popular_routes, routes_df[['route_id', 'distance_km_route']], on='route_id')

        st.dataframe(
            popular_routes[['route_id', 'num_activities', 'avg_rating', 'distance_km_route']].style.format({
                'avg_rating': '{:.1f} ⭐',
                'distance_km_route': '{:.1f} km'
            }),
            use_container_width=True
        )

    with col2:
        st.subheader("🎯 Challenges")

        st.info("🏃‍♀️ **Weekly Challenge**\n\nComplete 3 routes over 10km\n\nProgress: 1/3")
        st.progress(0.33)

        st.info("🚴 **Distance Goal**\n\nRide 100km this month\n\nProgress: 45/100 km")
        st.progress(0.45)

        st.info("⛰️ **Elevation Challenge**\n\nClimb 1000m total\n\nProgress: 680/1000 m")
        st.progress(0.68)

elif mode == "✏️ Route Creator":
    st.header("✏️ Route Creator Mode")

    st.subheader("🎨 Create Your Custom Route")

    st.info("**Feature Coming Soon**: Draw custom routes on the map and get AI-powered similar route suggestions!")

    st.write("Features:")
    st.write("- ✏️ Click on map to create waypoints")
    st.write("- 🔄 Get AI suggestions for similar routes")
    st.write("- 💾 Save custom routes")
    st.write("- 📏 Auto-calculate distance and elevation")

    st.subheader("⭐ Your Favorite Routes")

    if st.session_state.favorite_routes:
        fav_routes = routes_df[routes_df['route_id'].isin(st.session_state.favorite_routes)]

        for idx, route in fav_routes.iterrows():
            col1, col2 = st.columns([4, 1])
            with col1:
                st.write(f"**{route['route_id']}**: {route['distance_km_route']:.1f}km, {route['elevation_meters_route']:.0f}m")
            with col2:
                if st.button("Remove", key=f"rem_fav_{idx}"):
                    st.session_state.favorite_routes.remove(route['route_id'])
                    st.rerun()
    else:
        st.info("No favorite routes yet. Click ⭐ on routes to add them!")

# --- Footer ---
st.markdown("---")
col1, col2, col3 = st.columns(3)
with col1:
    st.caption(f"**Routes:** {len(routes_df)}")
with col2:
    st.caption(f"**Activities:** {len(processed_df)}")
with col3:
    st.caption("Built with ❤️ using Streamlit")

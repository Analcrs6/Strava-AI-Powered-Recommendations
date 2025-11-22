# -*- coding: utf-8 -*-
"""Strava AI-Powered Personalized Activity Recommender

A Capstone Project by Anais Lacreuse & Mrudula Dama
"""

import streamlit as st
import pandas as pd
import numpy as np
import folium
from streamlit_folium import st_folium
import os
import json
import polyline
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler
from pathlib import Path

# --- Configuration ---
st.set_page_config(
    page_title="Strava AI Recommender",
    page_icon="🏃‍♀️",
    layout="wide"
)

# --- Load Strava Auth Token (Optional Integration) ---
@st.cache_data
def load_strava_user():
    """Load authenticated Strava user from tokens.json if available"""
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

# --- Setup: Load Data ---
@st.cache_data
def load_data():
    """Load and prepare data for recommendations"""
    try:
        # Load the generated dataframes from CSV files
        processed_df = pd.read_csv('processed_activities.csv')
        routes_df = pd.read_csv('routes.csv')

        # Ensure start_date is datetime
        processed_df['start_date'] = pd.to_datetime(processed_df['start_date'])

        return processed_df, routes_df
    except FileNotFoundError as e:
        st.error(f"Data files not found: {e}")
        st.error("Please run `python generate_csv_exports.py` first to generate the required CSV files.")
        st.stop()
    except Exception as e:
        st.error(f"Error loading data: {e}")
        st.stop()

# Load data
processed_df, routes_df = load_data()

# Get list of unique users
ALL_USERS = sorted(processed_df['user_id'].unique().tolist())

# --- Feature Engineering for Recommendations ---
@st.cache_resource
def prepare_recommendation_model(processed_df):
    """Prepare the content-based recommendation model"""

    # 1. Create the Route-Feature Matrix (The 'Content' Vector)
    # Use the route-level columns from processed_activities
    route_features_df = processed_df[['route_id', 'distance_km_route', 'elevation_meters_route', 'surface_type_route']].drop_duplicates(subset=['route_id']).set_index('route_id')

    # One-Hot Encode categorical features
    route_features_encoded = pd.get_dummies(route_features_df, columns=['surface_type_route'])

    # Normalize numerical features (Distance and Elevation)
    scaler = MinMaxScaler()
    numerical_cols = ['distance_km_route', 'elevation_meters_route']
    route_features_encoded[numerical_cols] = scaler.fit_transform(route_features_encoded[numerical_cols])

    # 2. Calculate Item-Item Similarity Matrix (Cosine Similarity)
    route_vectors = route_features_encoded.values
    item_similarity_matrix = cosine_similarity(route_vectors)
    route_map = {route_id: i for i, route_id in enumerate(route_features_encoded.index)}
    inverse_route_map = {i: route_id for route_id, i in route_map.items()}

    return route_features_encoded, item_similarity_matrix, route_map, inverse_route_map

# Prepare model
route_features_encoded, item_similarity_matrix, route_map, inverse_route_map = prepare_recommendation_model(processed_df)

# --- Recommendation Function ---
def get_personalized_recommendations(user_id, desired_distance, time_of_day, k=5):
    """Generates recommendations based on user history and dynamic filters."""

    # 1. Identify routes the user rated highly (Score 4 or 5)
    user_ratings = processed_df[(processed_df['user_id'] == user_id) & (processed_df['rating'] >= 4)]

    if user_ratings.empty:
        # Fallback to the most popular routes if no high ratings exist (Cold Start)
        most_popular = processed_df.groupby('route_id')['rating'].mean().sort_values(ascending=False).head(k * 2).index.tolist()
        final_recommendations = routes_df[routes_df['route_id'].isin(most_popular)].head(k)

        if len(final_recommendations) > 0:
            final_recommendations = final_recommendations.copy()
            final_recommendations['logic'] = "Cold Start: Recommended popular routes."
            final_recommendations['score'] = np.random.uniform(70, 80, len(final_recommendations)).round(1)
        return final_recommendations

    # 2. Compute the weighted average preference vector for the user
    preferred_routes = user_ratings['route_id'].unique()

    # Calculate weighted similarity scores for all routes
    sim_scores = {}
    for route_id in route_features_encoded.index:
        if route_id not in preferred_routes and route_id in route_map:
            # Sum of similarity scores to all preferred routes
            index = route_map[route_id]
            sim_scores[route_id] = sum(
                item_similarity_matrix[index][route_map[pref_id]]
                for pref_id in preferred_routes if pref_id in route_map
            )

    if not sim_scores:
        # Fallback if no similarity scores
        return routes_df.head(k)

    # 3. Create a DataFrame from similarity scores and combine with route features
    recommendation_scores = pd.DataFrame(list(sim_scores.items()), columns=['route_id', 'similarity_score'])
    recommendation_scores = pd.merge(recommendation_scores, routes_df, on='route_id')

    # 4. Apply Dynamic Contextual Filtering (Distance & Time of Day)

    # Filter 1: Distance proximity (within 3km of desired distance)
    recommendation_scores['distance_diff'] = abs(recommendation_scores['distance_km_route'] - desired_distance)
    recommendation_scores = recommendation_scores[recommendation_scores['distance_diff'] <= 3]

    # Filter 2: Time of Day Preference
    # Create time categories from the processed data
    time_mapping = {
        'Morning (5-9 AM)': 'is_morning',
        'Midday (9 AM - 2 PM)': 'is_afternoon',
        'Evening (After 5 PM)': 'is_evening'
    }

    # Use time preference from routes if available
    if time_of_day in time_mapping:
        time_col = time_mapping[time_of_day]
        if time_col in routes_df.columns:
            # Boost routes that match the preferred time
            recommendation_scores['time_boost'] = recommendation_scores[time_col].fillna(0.5)
        else:
            recommendation_scores['time_boost'] = 0.5
    else:
        recommendation_scores['time_boost'] = 0.5

    recommendation_scores['context_boost'] = recommendation_scores['similarity_score'] * (1 + recommendation_scores['time_boost'])

    # Final Ranking
    if len(recommendation_scores) == 0:
        # If no routes match the filters, relax the distance filter
        recommendation_scores = pd.DataFrame(list(sim_scores.items()), columns=['route_id', 'similarity_score'])
        recommendation_scores = pd.merge(recommendation_scores, routes_df, on='route_id')
        recommendation_scores['context_boost'] = recommendation_scores['similarity_score']

    final_recommendations = recommendation_scores.sort_values(by=['context_boost', 'similarity_score'], ascending=False).head(k)

    # Add display columns
    if len(final_recommendations) > 0:
        final_recommendations = final_recommendations.copy()
        final_recommendations['logic'] = "Content-Based: Matched pace, distance, and surface preferences."
        final_recommendations['score'] = (final_recommendations['context_boost'] * 100).round(1)

    return final_recommendations

# --- STREAMLIT UI ---

st.title("🏃‍♀️ AI-Powered Personalized Activity Recommender 🚴")
st.markdown("A Capstone Project by **Anais Lacreuse** & **Mrudula Dama**")

# Show authenticated user if available
strava_user = load_strava_user()
if strava_user:
    st.info(f"🔗 Connected to Strava: **{strava_user['firstname']} {strava_user['lastname']}** (@{strava_user['username']}) from {strava_user['city']}")

st.markdown("---")

# --- SIDEBAR (The Interactive Widget) ---
st.sidebar.header("🎯 Adjust Parameters")

selected_user = st.sidebar.selectbox(
    "1. Select a User Profile:",
    options=ALL_USERS,
    index=0,
    help="Choose a user profile to get personalized recommendations"
)

desired_distance = st.sidebar.slider(
    "2. Desired Distance (km):",
    min_value=5.0,
    max_value=40.0,
    value=15.0,
    step=0.5,
    help="Target distance for route recommendations (±3km tolerance)"
)

time_of_day = st.sidebar.radio(
    "3. Preferred Time of Day:",
    options=['Morning (5-9 AM)', 'Midday (9 AM - 2 PM)', 'Evening (After 5 PM)'],
    index=2,
    help="When do you prefer to exercise?"
)

# Add information about the dataset
with st.sidebar.expander("📊 Dataset Info"):
    st.write(f"**Total Users:** {len(ALL_USERS)}")
    st.write(f"**Total Routes:** {len(routes_df)}")
    st.write(f"**Total Activities:** {len(processed_df)}")

with st.sidebar.expander("ℹ️ About"):
    st.write("""
    This recommender uses **Content-Based Filtering** with:
    - Route similarity (distance, elevation, surface)
    - User historical preferences
    - Contextual factors (time, distance)
    - Cold-start handling
    """)

# --- MAIN PAGE (Recommendation Output) ---

st.header(f"Recommendations for: **{selected_user}**")

# Show user stats
user_activities = processed_df[processed_df['user_id'] == selected_user]
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Activities", len(user_activities))
with col2:
    st.metric("Avg Rating", f"{user_activities['rating'].mean():.1f}⭐")
with col3:
    st.metric("Total Distance", f"{user_activities['distance_km_user'].sum():.1f} km")
with col4:
    st.metric("Avg Pace", f"{user_activities['average_pace_min_per_km'].mean():.1f} min/km")

st.markdown("---")

# Run the recommendation function with the selected parameters
with st.spinner("🔄 Generating personalized recommendations..."):
    top_recommendations = get_personalized_recommendations(
        user_id=selected_user,
        desired_distance=desired_distance,
        time_of_day=time_of_day
    )

if len(top_recommendations) > 0:
    st.success(f"✅ Top {len(top_recommendations)} Personalized Routes Generated (Content-Based Filtering)")

    # Display the results table
    display_cols = ['route_id', 'distance_km_route', 'elevation_meters_route', 'surface_type_route', 'difficulty_score', 'score', 'logic']
    display_cols = [col for col in display_cols if col in top_recommendations.columns]

    st.dataframe(
        top_recommendations[display_cols].style.format({
            'distance_km_route': '{:.1f} km',
            'elevation_meters_route': '{:,.0f} m',
            'difficulty_score': '{:.2f}',
            'score': '{:.1f}%'
        }),
        use_container_width=True,
        height=250
    )

    # --- Map Visualization with Real GPS Data ---
    st.markdown("---")
    st.subheader(f"🗺️ Route: {top_recommendations.iloc[0]['route_id']}")

    # Get the polyline for the top recommended route
    top_route = top_recommendations.iloc[0]

    if 'gps_polyline' in top_route and pd.notna(top_route['gps_polyline']):
        try:
            # Decode the polyline
            decoded_coordinates = polyline.decode(top_route['gps_polyline'])

            # Calculate map center
            center_lat = np.mean([lat for lat, lon in decoded_coordinates])
            center_lon = np.mean([lon for lat, lon in decoded_coordinates])

            # Create map
            m = folium.Map(
                location=[center_lat, center_lon],
                zoom_start=13,
                tiles="OpenStreetMap"
            )

            # Add the route as a polyline
            folium.PolyLine(
                decoded_coordinates,
                color='#FC4C02',  # Strava orange
                weight=4,
                opacity=0.8,
                popup=f"{top_route['route_id']}: {top_route['distance_km_route']:.1f} km",
                tooltip=f"Distance: {top_route['distance_km_route']:.1f} km, Elevation: {top_route['elevation_meters_route']:.0f} m"
            ).add_to(m)

            # Add start marker
            folium.Marker(
                decoded_coordinates[0],
                popup=f"<b>Start</b><br>{top_route['route_id']}",
                tooltip="Start",
                icon=folium.Icon(color='green', icon='play', prefix='fa')
            ).add_to(m)

            # Add end marker
            folium.Marker(
                decoded_coordinates[-1],
                popup=f"<b>End</b><br>{top_route['distance_km_route']:.1f} km",
                tooltip="End",
                icon=folium.Icon(color='red', icon='stop', prefix='fa')
            ).add_to(m)

            # Display the map
            st_folium(m, height=450, width=None)

            # Show route details
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Distance", f"{top_route['distance_km_route']:.1f} km")
            with col2:
                st.metric("Elevation Gain", f"{top_route['elevation_meters_route']:.0f} m")
            with col3:
                st.metric("Surface", top_route['surface_type_route'].title())

        except Exception as e:
            st.error(f"Error rendering map: {e}")
            st.info("There was an issue decoding the GPS data for this route.")
    else:
        # Fallback if no GPS data
        st.warning("📍 GPS data not available for this route. Showing approximate location.")

        # Use start_lat/start_lon if available
        if 'start_lat' in top_route and pd.notna(top_route['start_lat']):
            location = [top_route['start_lat'], top_route['start_lon']]
        else:
            location = [40.7128, -74.0060]  # Default NYC

        m = folium.Map(location=location, zoom_start=12, tiles="OpenStreetMap")
        folium.Marker(
            location,
            popup=f"{top_route['route_id']}: {top_route['distance_km_route']:.1f} km",
            icon=folium.Icon(color='orange', icon='info-sign')
        ).add_to(m)

        st_folium(m, height=400, width=None)

else:
    st.warning("⚠️ No recommendations found matching your criteria. Try adjusting the filters.")

# --- Proximity Alerts ---
st.markdown("---")
st.subheader("🔔 Proximity Alerts")

# Try to fetch real alerts from the proximity server
try:
    import requests
    response = requests.get("http://localhost:5000/api/alerts?limit=10", timeout=2)

    if response.status_code == 200:
        data = response.json()
        alerts = data.get('alerts', [])

        if alerts:
            st.success(f"✅ Live alerts from proximity server ({len(alerts)} recent)")

            for alert in alerts:
                alert_type = alert.get('type', 'info')
                message = alert.get('message', '')

                if alert_type == 'proximity_alert':
                    st.warning(f"⚠️ {message}")
                elif alert_type == 'webhook_log':
                    st.info(f"📡 {message}")
                else:
                    st.text(message)

            # Add simulate button
            col1, col2 = st.columns([3, 1])
            with col2:
                if st.button("🧪 Simulate Activity"):
                    try:
                        sim_response = requests.post("http://localhost:5000/api/simulate", timeout=2)
                        if sim_response.status_code == 200:
                            st.success("Activity simulated! Refresh to see alert.")
                            st.rerun()
                    except:
                        st.error("Could not simulate activity")

        else:
            st.info("No proximity alerts yet. Activities from friends within 5km will appear here.")

            # Show how to start the server
            with st.expander("ℹ️ How to enable proximity alerts"):
                st.markdown("""
                **Start the proximity alert server:**
                ```bash
                python proximity_alert_server.py
                ```

                The server will:
                - Monitor Strava webhooks for new activities
                - Calculate distances between users
                - Generate alerts when friends are nearby (< 5km)
                - Provide a REST API for this app to fetch alerts

                **Test it:**
                ```bash
                curl -X POST http://localhost:5000/api/simulate
                ```
                """)

    else:
        raise Exception("Server not responding")

except Exception as e:
    # Fallback to demo mode if server not running
    with st.expander("🔔 Proximity Alerts (Demo Mode - Server Offline)"):
        st.warning("📡 Proximity alert server is not running. Showing demo data.")

        st.code(
            """
[10:15 AM] ALERT: User 'Jake' finished a run 1.2 km from your location.
[08:45 AM] LOG: Webhook received. Activity created by user_runner.
[06:30 AM] ALERT: User 'Anais' started an activity near your home at 6:25 AM!
            """,
            language=None
        )

        st.markdown("""
        **To enable real-time proximity alerts:**

        1. Start the proximity alert server:
           ```bash
           python proximity_alert_server.py
           ```

        2. The server will run on `http://localhost:5000`

        3. Test it:
           ```bash
           curl -X POST http://localhost:5000/api/simulate
           ```

        4. Refresh this page to see live alerts!

        **Features:**
        - Real-time Strava webhook monitoring
        - Automatic distance calculation (geopy)
        - Alert logging and history
        - 5km proximity threshold
        """)

# --- Footer ---
st.markdown("---")
st.caption("Built with ❤️ using Streamlit | Data: Strava API + Synthetic Dataset")

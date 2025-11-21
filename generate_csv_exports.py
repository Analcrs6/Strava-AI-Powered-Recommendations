"""
Generate CSV files needed for Streamlit deployment
==========================================

This script extracts data from the Strave_recommender_ver4.ipynb processing pipeline
and saves the required CSV files for the Streamlit app.

Usage:
    python generate_csv_exports.py

Requirements:
    - synthetic_strava_data.csv must exist in the same directory
    - pandas, numpy, scikit-learn installed

Output Files:
    - processed_activities.csv
    - routes.csv
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from pathlib import Path


def engineer_rich_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Engineer richer route features including:
    - Terrain shape (grade profile buckets)
    - Loop vs out-and-back detection
    - Traffic/stress proxy
    - Time-of-day and weekday preferences
    """
    df_enriched = df.copy()
    
    # 1. TERRAIN SHAPE: Grade profile buckets
    df_enriched["grade_percent"] = (df_enriched["elevation_meters_route"] / 
                                     (df_enriched["distance_km_route"] * 1000 + 1e-8)) * 100
    
    df_enriched["grade_flat"] = (df_enriched["grade_percent"].abs() < 2).astype(int)
    df_enriched["grade_rolling"] = ((df_enriched["grade_percent"].abs() >= 2) & 
                                     (df_enriched["grade_percent"].abs() < 5)).astype(int)
    df_enriched["grade_hilly"] = ((df_enriched["grade_percent"].abs() >= 5) & 
                                   (df_enriched["grade_percent"].abs() < 10)).astype(int)
    df_enriched["grade_steep"] = (df_enriched["grade_percent"].abs() >= 10).astype(int)
    
    # 2. LOOP VS OUT-AND-BACK
    elevation_ratio = df_enriched["elevation_meters_route"] / (df_enriched["distance_km_route"] + 1e-8)
    df_enriched["is_likely_loop"] = ((df_enriched["distance_km_route"] > 8) & 
                                      (elevation_ratio < 80)).astype(int)
    df_enriched["is_likely_out_back"] = ((elevation_ratio > 80) | 
                                          (df_enriched["distance_km_route"] < 8)).astype(int)
    
    # 3. TRAFFIC/STRESS PROXY
    df_enriched["traffic_stress"] = 0.0
    if "surface_type_route" in df_enriched.columns:
        df_enriched.loc[df_enriched["surface_type_route"] == "paved", "traffic_stress"] = 0.7
        df_enriched.loc[df_enriched["surface_type_route"] == "gravel", "traffic_stress"] = 0.4
        df_enriched.loc[df_enriched["surface_type_route"] == "dirt", "traffic_stress"] = 0.2
    
    df_enriched["traffic_stress"] += (1.0 / (df_enriched["distance_km_route"] + 1)) * 0.3
    df_enriched["traffic_stress"] = df_enriched["traffic_stress"].clip(0, 1)
    
    # 4. GEO PROXIMITY PROXY
    df_enriched["geo_cluster"] = pd.cut(
        df_enriched["distance_km_route"] * df_enriched["elevation_meters_route"],
        bins=10,
        labels=False,
        duplicates='drop'
    ).fillna(0).astype(int)
    
    # 5. TIME-OF-DAY PREFERENCES
    if "start_date" in df_enriched.columns:
        df_enriched["hour_of_day"] = pd.to_datetime(df_enriched["start_date"]).dt.hour
        df_enriched["is_morning"] = ((df_enriched["hour_of_day"] >= 5) & 
                                      (df_enriched["hour_of_day"] < 12)).astype(int)
        df_enriched["is_afternoon"] = ((df_enriched["hour_of_day"] >= 12) & 
                                        (df_enriched["hour_of_day"] < 17)).astype(int)
        df_enriched["is_evening"] = ((df_enriched["hour_of_day"] >= 17) & 
                                      (df_enriched["hour_of_day"] < 22)).astype(int)
        df_enriched["is_night"] = ((df_enriched["hour_of_day"] >= 22) | 
                                    (df_enriched["hour_of_day"] < 5)).astype(int)
    
    # 6. WEEKDAY PREFERENCES
    if "start_date" in df_enriched.columns:
        df_enriched["day_of_week"] = pd.to_datetime(df_enriched["start_date"]).dt.dayofweek
        df_enriched["is_weekend"] = (df_enriched["day_of_week"] >= 5).astype(int)
        df_enriched["is_weekday"] = (df_enriched["day_of_week"] < 5).astype(int)
    
    return df_enriched


def generate_csv_exports():
    """
    Generate processed_activities.csv and routes.csv from synthetic data.
    """
    
    # Configuration
    DATA_PATH = "synthetic_strava_data.csv"
    
    # Step 1: Load synthetic data
    print("Step 1: Loading synthetic data...")
    if not Path(DATA_PATH).exists():
        print(f"ERROR: {DATA_PATH} not found!")
        return False
    
    df = pd.read_csv(DATA_PATH)
    print(f"   Loaded {len(df)} activities")
    
    # Step 2: Clean and deduplicate
    print("\nStep 2: Cleaning and deduplicating...")
    df_clean = (
        df.sort_values("start_date")
          .drop_duplicates(["user_id", "route_id"], keep="last")
          .reset_index(drop=True)
    )
    print(f"   After dedup: {len(df_clean)} activities")
    
    # Step 3: Engineer features
    print("\nStep 3: Engineering rich features...")
    df_enriched = engineer_rich_features(df_clean)
    print(f"   Added features: grade_percent, grade_flat/rolling/hilly/steep,")
    print(f"                   is_likely_loop/out_back, traffic_stress, geo_cluster,")
    print(f"                   hour_of_day, is_morning/afternoon/evening/night,")
    print(f"                   day_of_week, is_weekend/weekday")
    
    # Step 4: Save processed_activities.csv
    print("\nStep 4: Saving processed_activities.csv...")
    processed_path = "processed_activities.csv"
    df_enriched.to_csv(processed_path, index=False)
    print(f"   Saved {processed_path} ({len(df_enriched)} rows, {len(df_enriched.columns)} columns)")
    print(f"   Columns: {', '.join(df_enriched.columns.tolist()[:5])}...")
    
    # Step 5: Create and save routes.csv
    print("\nStep 5: Creating route metadata...")
    
    # Define feature groups
    NUMERIC_ROUTE_COLS = [
        "distance_km_route", "elevation_meters_route", "difficulty_score",
        "grade_percent", "traffic_stress"
    ]
    BINARY_ROUTE_COLS = [
        "grade_flat", "grade_rolling", "grade_hilly", "grade_steep",
        "is_likely_loop", "is_likely_out_back"
    ]
    TEMPORAL_COLS = [
        "is_morning", "is_afternoon", "is_evening", "is_night",
        "is_weekend", "is_weekday"
    ]
    CATEGORICAL_ROUTE_COL = "surface_type_route"
    
    # Aggregate route metadata
    route_meta = df_enriched.groupby("route_id").agg({
        CATEGORICAL_ROUTE_COL: lambda x: x.mode()[0] if len(x.mode()) > 0 else x.iloc[0],
        **{col: "mean" for col in NUMERIC_ROUTE_COLS + BINARY_ROUTE_COLS + TEMPORAL_COLS},
        "geo_cluster": lambda x: x.mode()[0] if len(x.mode()) > 0 else x.iloc[0]
    }).reset_index()
    
    print(f"   Created route metadata for {len(route_meta)} routes")
    
    # Step 6: Save routes.csv
    print("\nStep 6: Saving routes.csv...")
    routes_path = "routes.csv"
    route_meta.to_csv(routes_path, index=False)
    print(f"   Saved {routes_path} ({len(route_meta)} rows, {len(route_meta.columns)} columns)")
    print(f"   Columns: {', '.join(route_meta.columns.tolist()[:5])}...")
    
    # Summary
    print("\n" + "="*60)
    print("SUCCESS: CSV exports generated!")
    print("="*60)
    print(f"\nFiles created:")
    print(f"  1. {processed_path}")
    print(f"     - Activities with engineered features")
    print(f"     - {len(df_enriched)} rows, {len(df_enriched.columns)} columns")
    print(f"\n  2. {routes_path}")
    print(f"     - Route metadata aggregated from activities")
    print(f"     - {len(route_meta)} rows, {len(route_meta.columns)} columns")
    print(f"\nReady for Streamlit deployment!")
    
    return True


if __name__ == "__main__":
    generate_csv_exports()

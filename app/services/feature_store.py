import pandas as pd
from typing import Tuple, List
from sklearn.preprocessing import StandardScaler
import numpy as np

FEATURE_COLUMNS = ["distance_m","duration_s","elevation_gain_m","hr_avg"]

def load_csv_features(path: str) -> Tuple[pd.DataFrame, np.ndarray, StandardScaler]:
    df = pd.read_csv(path)
    
    # Map CSV columns to expected feature columns
    # Handle the actual synthetic_strava_data.csv format
    if "distance_km_user" in df.columns:
        df["distance_m"] = df["distance_km_user"] * 1000  # km to m
    if "elevation_meters_user" in df.columns:
        df["elevation_gain_m"] = df["elevation_meters_user"]
    if "average_pace_min_per_km" in df.columns:
        # Convert pace to duration estimate (assuming avg 5km activity)
        df["duration_s"] = df["average_pace_min_per_km"] * df.get("distance_km_user", 5.0) * 60
    
    # Create activity ID if not present
    if "id" not in df.columns:
        if "route_id" in df.columns:
            # Use route_id with user_id to create unique activity IDs
            df["id"] = df["user_id"].astype(str) + "_" + df["route_id"].astype(str)
        else:
            df["id"] = ["activity_" + str(i) for i in range(len(df))]
    
    # ensure missing cols exist
    for c in FEATURE_COLUMNS:
        if c not in df.columns:
            df[c] = 0.0
    
    feats = df[FEATURE_COLUMNS].fillna(0.0).astype(float).values
    scaler = StandardScaler()
    X = scaler.fit_transform(feats)
    df["__vector_row__"] = range(len(df))
    return df, X.astype("float32"), scaler

def features_from_records(records) -> np.ndarray:
    # future: pull from DB; for now CSV flow is primary
    pass


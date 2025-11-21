# Key Code Snippets from Strave_recommender_ver4.ipynb

This document contains the essential code snippets extracted from the notebook for reference and implementation.

---

## 1. Data Loading (Cell 4)

```python
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler

DATA_PATH = "synthetic_strava_data.csv"

# Load the data
df = pd.read_csv(DATA_PATH)
print(f"Loaded {len(df)} activities with columns: {df.columns.tolist()}")
```

**Input Schema (12 columns):**
- user_id, route_id
- distance_km_user, elevation_meters_user, surface_type_user
- average_pace_min_per_km, rating, start_date
- distance_km_route, elevation_meters_route, surface_type_route, difficulty_score

---

## 2. Data Cleaning (Cell 10)

```python
# Clean and deduplicate: keep most recent activity per (user, route) pair
df_clean = (
    df.sort_values("start_date")
      .drop_duplicates(["user_id", "route_id"], keep="last")
      .reset_index(drop=True)
)

print(f"After cleaning: {len(df_clean)} activities")
print(f"Unique users: {df_clean['user_id'].nunique()}")
print(f"Unique routes: {df_clean['route_id'].nunique()}")
```

---

## 3. Feature Engineering (Cell 12)

```python
def engineer_rich_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Engineer richer route features including:
    - Terrain shape (grade profile buckets)
    - Loop vs out-and-back detection
    - Traffic/stress proxy (based on distance & surface)
    - Time-of-day and weekday preferences
    """
    df_enriched = df.copy()
    
    # 1. TERRAIN SHAPE: Grade profile buckets
    # Calculate grade (elevation gain per km)
    df_enriched["grade_percent"] = (df_enriched["elevation_meters_route"] / 
                                     (df_enriched["distance_km_route"] * 1000 + 1e-8)) * 100
    
    # Bucket grades into categories
    df_enriched["grade_flat"] = (df_enriched["grade_percent"].abs() < 2).astype(int)
    df_enriched["grade_rolling"] = ((df_enriched["grade_percent"].abs() >= 2) & 
                                     (df_enriched["grade_percent"].abs() < 5)).astype(int)
    df_enriched["grade_hilly"] = ((df_enriched["grade_percent"].abs() >= 5) & 
                                   (df_enriched["grade_percent"].abs() < 10)).astype(int)
    df_enriched["grade_steep"] = (df_enriched["grade_percent"].abs() >= 10).astype(int)
    
    # 2. LOOP VS OUT-AND-BACK: Heuristic based on route characteristics
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
    
    # Adjust by distance (shorter urban routes = higher stress)
    df_enriched["traffic_stress"] += (1.0 / (df_enriched["distance_km_route"] + 1)) * 0.3
    df_enriched["traffic_stress"] = df_enriched["traffic_stress"].clip(0, 1)
    
    # 4. GEOGRAPHIC CLUSTERING PROXY
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


# Apply feature engineering
df_clean = engineer_rich_features(df_clean)
print(f"After feature engineering: {df_clean.shape[1]} columns")
```

---

## 4. Route Metadata Aggregation (Cell 14)

```python
# Define feature column groups
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

# Aggregate route metadata with all features
all_feature_cols = (
    [CATEGORICAL_ROUTE_COL] + NUMERIC_ROUTE_COLS + 
    BINARY_ROUTE_COLS + TEMPORAL_COLS + ["geo_cluster"]
)

# For routes, aggregate temporal features (e.g., most common time/day for this route)
route_meta = df_clean.groupby("route_id").agg({
    CATEGORICAL_ROUTE_COL: lambda x: x.mode()[0] if len(x.mode()) > 0 else x.iloc[0],
    **{col: "mean" for col in NUMERIC_ROUTE_COLS + BINARY_ROUTE_COLS + TEMPORAL_COLS},
    "geo_cluster": lambda x: x.mode()[0] if len(x.mode()) > 0 else x.iloc[0]
}).reset_index()

print(f"Route metadata: {route_meta.shape}")
print(f"Routes: {len(route_meta)}")
print(f"Columns: {route_meta.columns.tolist()}")
```

---

## 5. Feature Standardization (Cell 15)

```python
from sklearn.preprocessing import StandardScaler

# Set index for later reference
route_meta = route_meta.set_index("route_id")

# One-hot encode categorical features
surf_ohe = pd.get_dummies(route_meta[CATEGORICAL_ROUTE_COL], prefix="surface")
geo_ohe = pd.get_dummies(route_meta["geo_cluster"], prefix="geo")

# Combine all features
numeric_features = route_meta[NUMERIC_ROUTE_COLS + BINARY_ROUTE_COLS + TEMPORAL_COLS]
feat_df = pd.concat([numeric_features, surf_ohe, geo_ohe], axis=1)

# Standardize all feature columns using StandardScaler
scaler = StandardScaler()
route_features = scaler.fit_transform(feat_df.values)

# Keep references
route_index = feat_df.index  # route_id index
feature_columns = feat_df.columns.tolist()  # feature names

print(f"Feature matrix: {route_features.shape}")
print(f"Features: {len(feature_columns)}")
print(f"Feature names: {feature_columns}")
```

---

## 6. User Interaction Tracking (Cell 24)

```python
# Track which routes each user has interacted with (to optionally exclude seen)
user_seen = df_clean.groupby("user_id")["route_id"].apply(lambda s: set(s.values))

print(f"Users tracked: {len(user_seen)}")
# Access example:
example_user = df_clean["user_id"].iloc[0]
print(f"Routes seen by {example_user}: {list(user_seen[example_user])[:5]}")
```

---

## 7. Export to CSV (For Streamlit Deployment)

```python
# EXPORT 1: Save processed activities with engineered features
processed_activities_path = "processed_activities.csv"
df_clean.to_csv(processed_activities_path, index=False)
print(f"Saved {processed_activities_path} ({len(df_clean)} rows, {len(df_clean.columns)} columns)")

# EXPORT 2: Save route metadata
routes_path = "routes.csv"
route_meta.reset_index().to_csv(routes_path, index=False)
print(f"Saved {routes_path} ({len(route_meta)} rows, {len(route_meta.columns)} columns)")
```

---

## Summary of Data Transformations

```
synthetic_strava_data.csv (12 cols, N rows)
    ↓ pd.read_csv()
    ↓ 
df (12 cols, N rows)
    ↓ sort + deduplicate
    ↓ 
df_clean (12 cols, M rows where M ≤ N)
    ↓ engineer_rich_features()
    ↓ 
df_clean (32+ cols, M rows)
    ↓ [split into two paths]
    ├─→ processed_activities.csv (32+ cols, M rows)
    │
    └─→ groupby("route_id").agg()
        ↓
        route_meta (26+ cols, K rows where K = unique routes)
        ↓ one-hot encode + standardize
        ↓
        feat_df / route_features (standardized features)
        ↓
        routes.csv (26+ cols, K rows)
```

---

## Column Inventory

### Input Columns (12)
- user_id, route_id
- distance_km_user, elevation_meters_user, surface_type_user
- average_pace_min_per_km, rating, start_date
- distance_km_route, elevation_meters_route, surface_type_route, difficulty_score

### Added Columns (20+)

**Terrain (5):** grade_percent, grade_flat, grade_rolling, grade_hilly, grade_steep

**Route Type (2):** is_likely_loop, is_likely_out_back

**Environment (1):** traffic_stress

**Geo (1):** geo_cluster

**Temporal (8):** hour_of_day, is_morning, is_afternoon, is_evening, is_night, day_of_week, is_weekend, is_weekday

**One-Hot Encoded (at standardization):**
- surface_Road, surface_Trail, surface_Mixed, surface_Track, surface_Dirt, etc.
- geo_0, geo_1, ..., geo_9

### Total Output Columns
- **processed_activities.csv:** 12 + 20 = 32+ columns
- **routes.csv:** 26+ columns (aggregated + one-hot encoded)

---

## Important Notes

1. **Feature Scaling:** Route features are StandardScaler normalized (mean=0, std=1)
2. **Categorical Handling:** One-hot encoding for surface_type and geo_cluster
3. **Aggregation:** Numeric/binary features use mean; categorical use mode
4. **Deduplication:** Keeps most recent interaction per (user, route)
5. **Temporal Reference:** Hour extraction from 'start_date' column


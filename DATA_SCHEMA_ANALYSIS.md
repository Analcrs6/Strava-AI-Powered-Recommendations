# Strave_recommender_ver4.ipynb Data Analysis Report

## Executive Summary

The notebook **Strave_recommender_ver4.ipynb** is a comprehensive machine learning model development notebook that:
1. Loads synthetic activity data from `synthetic_strava_data.csv`
2. Performs feature engineering to create rich route features
3. Builds and evaluates multiple recommendation models
4. **Does NOT export** `processed_activities.csv` and `routes.csv` files

The Streamlit app requires these CSV files, which need to be generated from the notebook's data processing pipeline.

---

## 1. Data Loading

### Source Data File
- **File:** `synthetic_strava_data.csv`
- **Path:** Root directory
- **Variable:** Loaded as `df` in Cell 4

### Initial Schema (synthetic_strava_data.csv)
```
Columns:
- user_id                    (str) - User identifier (e.g., "brenda53", "john_doe")
- route_id                   (str) - Route identifier (e.g., "R031", "R090")
- distance_km_user           (float) - Distance of activity (km)
- elevation_meters_user      (float) - Elevation gain (meters)
- surface_type_user          (str) - Surface type (Road, Trail, Track, Mixed)
- average_pace_min_per_km    (float) - Average pace (min/km)
- rating                     (int) - User's rating (1-5 scale)
- start_date                 (datetime) - Activity start timestamp
- distance_km_route          (float) - Route distance (km)
- elevation_meters_route     (float) - Route elevation (meters)
- surface_type_route         (str) - Route surface type
- difficulty_score           (float) - Calculated difficulty metric
```

### Data Statistics (from notebook)
- Multiple users with varying activity histories
- Routes from R001-R099 (synthetic routes)
- Ratings distributed across 1-5 scale
- Dates spanning 2024-2025

---

## 2. Data Cleaning & Deduplication

### Cell 10: Data Cleaning
```python
df_clean = (
    df.sort_values("start_date")
      .drop_duplicates(["user_id", "route_id"], keep="last")
      .reset_index(drop=True)
)
```

**Operations:**
- Sort by `start_date` (ascending)
- Remove duplicates keeping the most recent interaction per (user, route) pair
- Reset index

**Result:** `df_clean` - deduplicated activity data

---

## 3. Feature Engineering

### Cell 12: engineer_rich_features() Function

Adds the following columns to `df_clean`:

#### A. TERRAIN SHAPE FEATURES
1. **grade_percent** (float)
   - Formula: `(elevation_meters_route / (distance_km_route * 1000)) * 100`
   - Represents grade as percentage

2. **grade_flat** (int, binary)
   - 1 if `grade_percent.abs() < 2`, else 0

3. **grade_rolling** (int, binary)
   - 1 if `2 <= grade_percent.abs() < 5`, else 0

4. **grade_hilly** (int, binary)
   - 1 if `5 <= grade_percent.abs() < 10`, else 0

5. **grade_steep** (int, binary)
   - 1 if `grade_percent.abs() >= 10`, else 0

#### B. ROUTE TYPE FEATURES
1. **is_likely_loop** (int, binary)
   - 1 if `distance_km_route > 8` AND `elevation_ratio < 80`, else 0

2. **is_likely_out_back** (int, binary)
   - 1 if `elevation_ratio > 80` OR `distance_km_route < 8`, else 0

#### C. TRAFFIC/STRESS PROXY
1. **traffic_stress** (float, range 0-1)
   - Initialized based on surface_type_route:
     - "paved" → 0.7
     - "gravel" → 0.4
     - "dirt" → 0.2
   - Adjusted by distance: `+ (1.0 / (distance_km_route + 1)) * 0.3`
   - Clipped to [0, 1]

#### D. GEOGRAPHIC CLUSTERING
1. **geo_cluster** (int)
   - Created by binning `distance_km_route * elevation_meters_route`
   - 10 bins with categorical codes (0-9)

#### E. TIME-OF-DAY FEATURES
1. **hour_of_day** (int)
   - Extracted from `start_date`: `pd.to_datetime().dt.hour`

2. **is_morning** (int, binary)
   - 1 if `5 <= hour_of_day < 12`, else 0

3. **is_afternoon** (int, binary)
   - 1 if `12 <= hour_of_day < 17`, else 0

4. **is_evening** (int, binary)
   - 1 if `17 <= hour_of_day < 22`, else 0

5. **is_night** (int, binary)
   - 1 if `hour_of_day >= 22` OR `hour_of_day < 5`, else 0

#### F. WEEKDAY FEATURES
1. **day_of_week** (int)
   - Extracted from `start_date`: `pd.to_datetime().dt.dayofweek`
   - 0=Monday, 6=Sunday

2. **is_weekend** (int, binary)
   - 1 if `day_of_week >= 5`, else 0

3. **is_weekday** (int, binary)
   - 1 if `day_of_week < 5`, else 0

### Result DataFrame: df_clean (after feature engineering)
- **Shape:** Same as input plus new columns
- **Total new columns:** 20+ features

---

## 4. Route Aggregation

### Cell 14-15: Route Metadata Aggregation

**Process:**
1. Group `df_clean` by `route_id`
2. Aggregate features per route

**route_meta DataFrame Creation:**
```python
route_meta = df_clean.groupby("route_id").agg({
    "surface_type_route": lambda x: x.mode()[0] if len(x.mode()) > 0 else x.iloc[0],
    # Numeric columns: mean
    "distance_km_route": "mean",
    "elevation_meters_route": "mean",
    "difficulty_score": "mean",
    "grade_percent": "mean",
    "traffic_stress": "mean",
    # Binary features: mean (represents prevalence)
    "grade_flat": "mean",
    "grade_rolling": "mean",
    "grade_hilly": "mean",
    "grade_steep": "mean",
    "is_likely_loop": "mean",
    "is_likely_out_back": "mean",
    # Temporal features: mean
    "is_morning": "mean",
    "is_afternoon": "mean",
    "is_evening": "mean",
    "is_night": "mean",
    "is_weekend": "mean",
    "is_weekday": "mean",
    # Geo cluster: mode
    "geo_cluster": lambda x: x.mode()[0] if len(x.mode()) > 0 else x.iloc[0]
}).reset_index()
```

### Column Definitions for route_meta

#### Feature Column Groups

**NUMERIC_ROUTE_COLS:**
- distance_km_route
- elevation_meters_route
- difficulty_score
- grade_percent
- traffic_stress

**BINARY_ROUTE_COLS:**
- grade_flat
- grade_rolling
- grade_hilly
- grade_steep
- is_likely_loop
- is_likely_out_back

**TEMPORAL_COLS:**
- is_morning
- is_afternoon
- is_evening
- is_night
- is_weekend
- is_weekday

**CATEGORICAL_ROUTE_COL:**
- surface_type_route

**OTHER:**
- geo_cluster

### One-Hot Encoding

**Cell 15 creates:**
```python
surf_ohe = pd.get_dummies(route_meta["surface_type_route"], prefix="surface")
# Columns: surface_Dirt, surface_Mixed, surface_Paved, surface_Road, surface_Trail, surface_Track
# (actual columns depend on unique surface types in data)

geo_ohe = pd.get_dummies(route_meta["geo_cluster"], prefix="geo")
# Columns: geo_0, geo_1, ..., geo_9
```

---

## 5. Feature Matrix Construction

### Cell 15: Feature Standardization

```python
# Combine all features
numeric_features = route_meta[NUMERIC_ROUTE_COLS + BINARY_ROUTE_COLS + TEMPORAL_COLS]
feat_df = pd.concat([numeric_features, surf_ohe, geo_ohe], axis=1)

# Standardize all features
scaler = StandardScaler()
route_features = scaler.fit_transform(feat_df.values)

# References
route_index = feat_df.index  # route_id index
feature_columns = feat_df.columns.tolist()  # feature names
```

### Final Feature Matrix Composition

**route_features:**
- Type: numpy ndarray, shape (n_routes, n_features)
- All values standardized (mean=0, std=1)

**feature_columns (example):**
```
[
  'distance_km_route', 'elevation_meters_route', 'difficulty_score',
  'grade_percent', 'traffic_stress',
  'grade_flat', 'grade_rolling', 'grade_hilly', 'grade_steep',
  'is_likely_loop', 'is_likely_out_back',
  'is_morning', 'is_afternoon', 'is_evening', 'is_night',
  'is_weekend', 'is_weekday',
  'surface_Dirt', 'surface_Mixed', 'surface_Road', 'surface_Trail',
  'surface_Track',
  'geo_0', 'geo_1', 'geo_2', ..., 'geo_9'
]
```

**route_index:**
- Pandas Index of route_id values (sorted order from route_meta)

---

## 6. User Interaction Tracking

### Cell 24: User-Route Interaction Sets

```python
user_seen = df_clean.groupby("user_id")["route_id"].apply(lambda s: set(s.values))
```

**Result:** Dictionary-like object
- **Key:** user_id
- **Value:** Set of route_id the user has interacted with
- **Purpose:** Filter out already-seen routes from recommendations

---

## 7. Alternative Data Path: Clustering

### Cell 68: Route Clustering (Alternative)

Used when route coverage is low (temporal holdout creates "new" routes):

```python
# Features: distance, elevation, pace, difficulty
X_cluster = df[cluster_features].fillna(df[cluster_features].median())
scaler_cluster = StandardScaler()
X_scaled = scaler_cluster.fit_transform(X_cluster)

# Optimal clusters: min(50, n_activities // 20), max(10, ...)
kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
cluster_labels = kmeans.fit_predict(X_scaled)

# Assign cluster-based route IDs
df["route_id"] = "C_" + cluster_labels.astype(str)
```

**Result:** Routes are compressed into ~10-50 clusters
- Ensures better coverage in train-test splits
- Trade-off: loses granular route identity

---

## 8. Data Split: Temporal Holdout

### Cell 49: Train-Test Split

```python
# Combine API + CSV data (if available)
all_df = df_clean.copy()  # or concat with api_interactions

# Temporal split
train_df, test_df = temporal_holdout(all_df, min_hist=3, test_size=1)
```

**temporal_holdout() Logic:**
1. For each user, sort interactions by date
2. Users with < (min_hist + test_size) interactions → all go to train
3. Users with >= (min_hist + test_size) interactions:
   - Train: all but most recent `test_size` interactions
   - Test: most recent `test_size` interactions

**Result:**
- train_df: ~80-90% of data
- test_df: ~10-20% of data
- Maintains chronological order for realistic evaluation

---

## 9. CSV Files NEEDED FOR STREAMLIT APP

### Missing: processed_activities.csv

Should contain:
```
Columns (based on df_clean after feature engineering):
- user_id
- route_id
- distance_km_user
- elevation_meters_user
- surface_type_user
- average_pace_min_per_km
- rating
- start_date
- distance_km_route
- elevation_meters_route
- surface_type_route
- difficulty_score
- grade_percent (added)
- grade_flat, grade_rolling, grade_hilly, grade_steep (added)
- is_likely_loop, is_likely_out_back (added)
- traffic_stress (added)
- geo_cluster (added)
- hour_of_day (added)
- is_morning, is_afternoon, is_evening, is_night (added)
- day_of_week (added)
- is_weekend, is_weekday (added)
```

**How to generate:**
```python
df_with_features = engineer_rich_features(df_clean)
df_with_features.to_csv('processed_activities.csv', index=False)
```

### Missing: routes.csv

Should contain route metadata:
```
Columns (based on route_meta after aggregation):
- route_id
- surface_type_route
- distance_km_route (mean)
- elevation_meters_route (mean)
- difficulty_score (mean)
- grade_percent (mean)
- traffic_stress (mean)
- grade_flat (mean), grade_rolling (mean), etc.
- is_morning (mean), is_afternoon (mean), etc.
- is_weekend (mean), is_weekday (mean)
- geo_cluster
```

**How to generate:**
```python
route_meta.reset_index().to_csv('routes.csv', index=False)
```

---

## 10. Key Data Transformations Summary

```
synthetic_strava_data.csv
        ↓
    pd.read_csv()
        ↓
    df (basic data)
        ↓
  [CLEAN: deduplicate]
        ↓
  df_clean (deduplicated)
        ↓
  [ENGINEER: add features]
        ↓
  df_clean + engineered features
        ↓
  [AGGREGATE: group by route_id]
        ↓
  route_meta (route summary)
        ↓
  [ONE-HOT: encode categorical]
  [STANDARDIZE: scale features]
        ↓
  route_features (numpy array)
  route_index (route IDs)
  feature_columns (column names)
```

---

## 11. Important Notes

### What the Notebook DOES
- ✅ Loads synthetic data
- ✅ Cleans and deduplicates
- ✅ Engineers 20+ features
- ✅ Aggregates to route level
- ✅ Creates feature matrices
- ✅ Trains multiple models
- ✅ Evaluates with various metrics
- ✅ Tests temporal splits
- ✅ Handles cold-start problems

### What the Notebook DOES NOT DO
- ❌ Export processed_activities.csv
- ❌ Export routes.csv
- ❌ Has no .to_csv() calls
- ❌ Explicitly save data for Streamlit

### For Streamlit Deployment

To generate the required CSV files, you need to:

1. **Run the notebook** to get to Cell 15 (feature engineering complete)
2. **Extract and save the processed activities:**
   ```python
   df_engineered = engineer_rich_features(df_clean)
   df_engineered.to_csv('processed_activities.csv', index=False)
   ```

3. **Extract and save route metadata:**
   ```python
   route_meta.reset_index().to_csv('routes.csv', index=False)
   ```

---

## Appendix: Data Generation Code Pattern

The notebook assumes `synthetic_strava_data.csv` already exists. If creating synthetic data:

```python
# Pattern used in notebook (from Cell 1 setup)
DATA_PATH = "synthetic_strava_data.csv"
df = pd.read_csv(DATA_PATH)

# Number of rows varies, but typically 1000+ interactions
# for multiple users (e.g., 10-20 users, 100 routes)
```

The synthetic data is realistic with:
- Multiple user profiles with different preferences
- Varying surface types (Road, Trail, Mixed, Track)
- Different distance ranges (1-30+ km)
- Ratings distributed across 1-5 scale
- Timestamps throughout 2024-2025


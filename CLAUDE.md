# CLAUDE.md - AI Assistant Guide for Strava AI-Powered Recommendations

**Last Updated:** 2025-11-21
**Project Lead:** Anais Lacreuse and Mrudula Dama
**Status:** Active Development

---

## Project Overview

This is an AI-powered personalized activity recommendation system for Strava users. The project uses machine learning (content-based filtering with potential collaborative filtering) to provide personalized route and workout recommendations based on user activity history, preferences, and contextual factors.

**Core Objective:** Build a recommendation engine that generates personalized route suggestions tailored to individual Strava users' profiles, training goals, and preferences regarding distance, elevation, and terrain.

---

## Repository Structure

```
Strava-AI-Powered-Recommendations/
├── .git/                           # Git repository metadata
├── .gitignore                      # Git ignore patterns
├── README.md                       # Project documentation
├── CLAUDE.md                       # This file - AI assistant guide
├── auth_server.py                  # Flask OAuth2 server for Strava authentication
├── streamlit_app.py                # Streamlit web application (prototype UI)
├── env                             # Environment variables (CLIENT_ID, CLIENT_SECRET)
├── tokens.json                     # OAuth tokens (DO NOT COMMIT - already in .gitignore as .env)
├── structure                       # Planned directory structure reference
├── synthetic_strava_data.csv       # Generated synthetic training data
├── Strava_AI_Recommendation.ipynb  # Main ML model development notebook (~3,600 lines)
├── Strava_recommender.ipynb        # Recommender system experiments (~6,940 lines)
├── Strave_recommender_ver4.ipynb   # Latest recommender version (~7,602 lines)
└── app_py.ipynb                    # App development notebook (~340 lines)
```

### Planned Structure (from `structure` file)
The project aims to organize into:
- `data/` - Raw, processed, and interim data
- `notebooks/` - Jupyter notebooks for experimentation
- `src/` - Source code modules
- `models/` - Trained model artifacts
- `requirements.txt` - Python dependencies

**Note:** This structure is aspirational; current code is flat in the root directory.

---

## Tech Stack

### Core Technologies
- **Python 3.x** - Primary programming language
- **Jupyter Notebooks** - Experimentation and model development
- **Streamlit** - Interactive web application framework
- **Flask** - OAuth2 authentication server

### Machine Learning & Data Science
- **pandas** - Data manipulation and analysis
- **numpy** - Numerical computations
- **scikit-learn** - ML algorithms (cosine similarity, MinMaxScaler, TfidfVectorizer)
- **Surprise library** - Collaborative filtering (planned)
- **PyTorch** - Deep learning (stretch goal)

### Visualization
- **matplotlib** - Static plotting
- **plotly** - Interactive visualizations
- **folium** - Interactive map rendering
- **streamlit-folium** - Folium integration for Streamlit

### APIs & Authentication
- **Strava API** - Activity data access
- **requests** - HTTP client for API calls
- **python-dotenv** - Environment variable management
- **polyline** - GPS polyline encoding/decoding

### Geographic Data
- **OpenStreetMap (OSM)** - Route attributes (planned)
- **GeoPandas** - Geospatial data manipulation (planned)
- **geopy** - Distance calculations (stretch goal)

---

## Key Files and Their Purposes

### 1. `auth_server.py` (151 lines)
**Purpose:** Flask-based OAuth2 authentication server for Strava API access.

**Key Functions:**
- `build_auth_url()` - Constructs Strava authorization URL
- `exchange_code_for_token(code)` - Exchanges auth code for access token
- `refresh_access_token(refresh_token)` - Refreshes expired tokens
- `save_tokens(tokens)` - Persists tokens to `tokens.json`
- `load_tokens()` - Loads existing tokens

**Routes:**
- `GET /` - Landing page with authorization button
- `GET /start` - Redirects to Strava authorization
- `GET /exchange` - OAuth callback endpoint
- `POST/GET /refresh` - Token refresh endpoint

**Configuration:**
- Reads from `env` file: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `CALLBACK_DOMAIN`
- Default port: 8888 (inferred from `CALLBACK_DOMAIN`)
- Scopes: `read`, `profile:read_all`, `activity:read_all`

**Security Notes:**
- `tokens.json` contains sensitive access tokens
- Never commit `tokens.json` or `env` file to version control
- Current `env` file contains real credentials - should be using `.env` instead

### 2. `streamlit_app.py` (230 lines, mostly commented)
**Purpose:** Prototype web application for interactive recommendations.

**Architecture:**
- Content-based filtering using cosine similarity
- Item-item similarity matrix computed from route features
- Dynamic contextual filtering (distance, time of day)

**Key Components:**
- User profile selector (4 users: anaisl, mrudulad, user_runner, user_biker)
- Distance slider (5-40 km)
- Time of day selector (Morning/Midday/Evening)
- Route visualization with Folium maps
- Recommendation logic with fallback to popular routes (cold start problem)

**Data Dependencies:**
- Expects `processed_activities.csv` and `routes.csv`
- Uses pre-computed route feature vectors
- Applies MinMaxScaler for normalization

**Note:** Currently commented out - entire file is inactive code meant for deployment.

### 3. Jupyter Notebooks

#### `Strava_AI_Recommendation.ipynb` (~3,600 lines)
Main model development notebook with project planning and initial implementation.

#### `Strava_recommender.ipynb` (~6,940 lines)
Recommender system experimentation with various approaches.

#### `Strave_recommender_ver4.ipynb` (~7,602 lines)
**Most recent and comprehensive implementation.**
Contains:
- Complete data generation pipeline
- Feature engineering
- Content-based filtering implementation
- Evaluation metrics
- Prototype UI code

#### `app_py.ipynb` (~340 lines)
Streamlit app development and testing.

### 4. `synthetic_strava_data.csv`
Generated synthetic Strava activity data for model training. Used as a substitute for real user data during development.

### 5. `tokens.json`
**CRITICAL - SENSITIVE FILE**
Contains OAuth2 tokens for authenticated Strava API access:
- `access_token` - Short-lived API access token
- `refresh_token` - Long-lived token for obtaining new access tokens
- `expires_at` - Token expiration timestamp
- `athlete` - Authenticated user profile data

**Current User:** mrudula_lakshmi (ID: 188299995, New York, NY)

---

## Data Flow

### 1. Authentication Flow
```
User → auth_server.py:/ → Strava Authorization Page
     ← Authorization Code
User → auth_server.py:/exchange → Strava Token Endpoint
     ← Access Token + Refresh Token → tokens.json
```

### 2. Data Collection Flow
```
Strava API → Activity Data (distance, pace, elevation, GPS traces)
OpenStreetMap → Route Attributes (surface type, elevation, POIs)
Weather APIs → Contextual Features (optional)
     ↓
Synthetic/Real Data → CSV files → Pandas DataFrames
```

### 3. Recommendation Flow
```
User Input (user_id, desired_distance, time_of_day)
     ↓
Load User Activity History → Filter High Ratings (≥4)
     ↓
Compute Similarity Scores (Cosine Similarity)
     ↓
Apply Contextual Filters (Distance ±3km, Time Preference)
     ↓
Rank by Context-Boosted Similarity
     ↓
Return Top K Recommendations → Streamlit UI
```

---

## Model Architecture

### Content-Based Filtering (Primary Approach)

**Feature Vector Components:**
1. **Numerical Features** (normalized with MinMaxScaler):
   - Distance (km)
   - Elevation gain (meters)

2. **Categorical Features** (one-hot encoded):
   - Surface type (road, trail, track, mixed)

3. **Derived Features:**
   - Average pace (calculated from distance and duration)
   - Difficulty score (function of distance and elevation)
   - Time category (Morning/Midday/Evening based on start hour)

**Similarity Computation:**
- Item-item cosine similarity matrix
- Weighted average of preferred routes
- Context boost factor based on time-of-day preference

**Cold Start Handling:**
- Fallback to most popular routes (highest average ratings)
- Used when user has no high ratings (≥4)

### Collaborative Filtering (Planned)
- Matrix factorization using Surprise library
- User-user similarity for finding similar athletes
- Hybrid approach combining content-based and collaborative signals

---

## Development Workflow

### Initial Setup

1. **Clone Repository:**
   ```bash
   git clone https://github.com/Analcrs6/Strava-AI-Powered-Recommendations.git
   cd Strava-AI-Powered-Recommendations
   ```

2. **Install Dependencies:**
   ```bash
   pip install requests pandas numpy scikit-learn matplotlib plotly folium streamlit streamlit-folium polyline flask python-dotenv
   ```

3. **Configure Strava API Credentials:**
   - Create a Strava API application at https://www.strava.com/settings/api
   - Copy `env` to `.env` (better practice)
   - Update `.env` with your `CLIENT_ID` and `CLIENT_SECRET`
   - Add `.env` to `.gitignore` if not already present

4. **Authenticate with Strava:**
   ```bash
   python auth_server.py
   ```
   - Visit http://localhost:8888 in browser
   - Click "Authorize Strava" button
   - Approve permissions on Strava
   - Tokens saved to `tokens.json`

### Development Cycle

1. **Experiment in Notebooks:**
   - Use `Strave_recommender_ver4.ipynb` for latest model experiments
   - Generate synthetic data or fetch real data via Strava API
   - Test feature engineering and model iterations

2. **Extract Code to Python Modules:**
   - Move stable code from notebooks to `src/` directory
   - Create modular functions for data collection, preprocessing, and modeling

3. **Test Locally with Streamlit:**
   ```bash
   streamlit run streamlit_app.py
   ```
   - Requires `processed_activities.csv` and `routes.csv`
   - Interactive UI for testing recommendations

4. **Evaluate Model Performance:**
   - Precision@k, Recall@k, NDCG
   - RMSE/MAE for quantitative predictions (optional)
   - Qualitative user simulation feedback

---

## Git Branch Strategy

**Current Branch:** `claude/claude-md-mi97ojng6tepj7o9-015pHtkUCuphP2tryQ9cZAar`

**Branch Naming Convention:**
- Feature branches: `claude/claude-md-<session-id>-<identifier>`
- All development should occur on designated feature branches
- Branch names must start with `claude/` for successful push (403 error otherwise)

**Git Operations:**
```bash
# Create and switch to feature branch (if not exists)
git checkout -b claude/feature-name

# Commit changes
git add .
git commit -m "Descriptive commit message"

# Push to remote (use -u for first push)
git push -u origin claude/feature-name

# Retry logic for network failures (up to 4 retries with exponential backoff)
# 2s, 4s, 8s, 16s
```

**Network Retry Strategy:**
- Both `git push` and `git fetch/pull` should retry on network failures
- Do NOT retry on 403 errors (branch naming issue)

---

## Conventions and Best Practices

### Code Style
- Python PEP 8 style guide
- Descriptive variable names (e.g., `user_ratings`, `similarity_score`)
- Type hints encouraged (e.g., `def tokens_exist() -> bool:`)
- Docstrings for complex functions

### Security
- **NEVER commit sensitive files:**
  - `tokens.json` - contains access tokens
  - `.env` or `env` - contains API credentials
- Use `.gitignore` to exclude sensitive files
- Current issue: `env` file is committed with real credentials - should be removed from git history

### Data Management
- Use CSV files for intermediate data storage
- Keep synthetic data in repository for reproducibility
- Store large datasets outside repository (add to `.gitignore`)

### Notebooks
- Use clear markdown headings for each section
- Include explanatory text between code cells
- Save outputs for reference (but not large visualizations)
- Latest version is `Strave_recommender_ver4.ipynb`

### API Usage
- Respect Strava API rate limits (600 requests/15 minutes, 30,000 requests/day)
- Implement token refresh logic before API calls
- Handle API errors gracefully with try-except blocks

---

## Common Tasks

### Task 1: Add New Features to Recommendation Model

**Location:** `Strave_recommender_ver4.ipynb` or `src/` modules

**Steps:**
1. Identify new feature in `processed_df` or `routes_df`
2. Add feature to `route_features_df` in feature engineering section
3. Update encoding logic (one-hot for categorical, scaling for numerical)
4. Recompute similarity matrix
5. Test recommendations with new feature
6. Evaluate impact on recommendation quality

**Example Features:**
- Weather conditions (sunny, rainy, cloudy)
- Terrain difficulty (flat, rolling, hilly, mountainous)
- User fitness level (beginner, intermediate, advanced)
- Social factors (popular routes, friend recommendations)

### Task 2: Fetch Real Strava Data

**Prerequisites:** Valid `tokens.json` from authentication

**Steps:**
1. Load tokens from `tokens.json`
2. Check token expiration (`expires_at`)
3. Refresh token if expired:
   ```bash
   curl -X POST http://localhost:8888/refresh
   ```
4. Use `access_token` in API requests:
   ```python
   headers = {"Authorization": f"Bearer {access_token}"}
   response = requests.get("https://www.strava.com/api/v3/athlete/activities", headers=headers)
   ```
5. Parse JSON response into pandas DataFrame
6. Save to CSV for offline processing

**Strava API Endpoints:**
- `GET /athlete` - Authenticated user profile
- `GET /athlete/activities` - User's activities (paginated)
- `GET /activities/{id}` - Activity details including GPS streams
- `GET /segments/explore` - Discover segments in a geographic area

### Task 3: Deploy Streamlit App

**Steps:**
1. Uncomment code in `streamlit_app.py`
2. Generate required CSV files:
   - Run `Strave_recommender_ver4.ipynb` to create `processed_activities.csv` and `routes.csv`
3. Install dependencies:
   ```bash
   pip install streamlit streamlit-folium folium polyline
   ```
4. Run locally:
   ```bash
   streamlit run streamlit_app.py
   ```
5. For production deployment:
   - Use Streamlit Cloud (connect GitHub repository)
   - Or deploy on cloud platform (AWS, GCP, Heroku)
   - Set environment variables for API credentials
   - Use persistent storage for tokens and data

### Task 4: Implement Collaborative Filtering

**Location:** Create new notebook or add to `Strave_recommender_ver4.ipynb`

**Steps:**
1. Install Surprise library:
   ```bash
   pip install scikit-surprise
   ```
2. Create user-item rating matrix (users × routes)
3. Split data into train/test sets
4. Train SVD or NMF model from Surprise
5. Generate predictions for unseen user-route pairs
6. Evaluate with RMSE, MAE, Precision@k
7. Combine with content-based scores (hybrid approach)

**Code Skeleton:**
```python
from surprise import Dataset, Reader, SVD
from surprise.model_selection import cross_validate

reader = Reader(rating_scale=(1, 5))
data = Dataset.load_from_df(processed_df[['user_id', 'route_id', 'rating']], reader)

svd = SVD()
cross_validate(svd, data, measures=['RMSE', 'MAE'], cv=5, verbose=True)
```

### Task 5: Add OpenStreetMap Route Enrichment

**Steps:**
1. Install OSMnx library:
   ```bash
   pip install osmnx
   ```
2. Extract bounding box from route GPS coordinates
3. Query OSM for route features:
   ```python
   import osmnx as ox
   graph = ox.graph_from_bbox(north, south, east, west, network_type='all')
   ```
4. Match route to OSM edges (map matching)
5. Extract attributes:
   - Surface type (paved, unpaved, gravel)
   - Highway type (path, track, road)
   - Elevation data (requires DEM source)
   - Points of interest (parks, water fountains, restrooms)
6. Add to route feature vectors

### Task 6: Refresh OAuth Tokens

**When:** Access token expires (every 6 hours)

**Manual Method:**
```bash
curl -X POST http://localhost:8888/refresh
```

**Programmatic Method:**
```python
import json
import time
from pathlib import Path

def get_valid_token():
    tokens = json.loads(Path('tokens.json').read_text())

    if time.time() >= tokens['expires_at']:
        # Refresh token
        response = requests.post('http://localhost:8888/refresh')
        tokens = response.json()

    return tokens['access_token']
```

**Best Practice:** Implement automatic token refresh in API client wrapper.

### Task 7: Generate Synthetic Data

**Location:** `Strave_recommender_ver4.ipynb`

**Purpose:** Create realistic training data when real user data is unavailable.

**Components:**
- User profiles with preferences (distance, pace, surface type)
- Route library with attributes (distance, elevation, GPS polylines)
- Activity logs with ratings (1-5 stars)
- Temporal patterns (time of day, day of week)

**Customization:**
- Adjust number of users, routes, activities
- Modify preference distributions
- Add noise and outliers for realism
- Simulate different user archetypes (casual, competitive, varied)

---

## Evaluation Metrics

### Ranking Metrics
- **Precision@k:** Proportion of top-k recommendations that are relevant
- **Recall@k:** Proportion of relevant items found in top-k recommendations
- **NDCG (Normalized Discounted Cumulative Gain):** Measures ranking quality with position-dependent weights

### Prediction Metrics
- **RMSE (Root Mean Square Error):** For rating predictions
- **MAE (Mean Absolute Error):** For rating predictions

### Qualitative Metrics
- User simulation feedback
- Recommendation diversity (not all similar routes)
- Serendipity (unexpected but relevant suggestions)

### Baseline Comparison
- Random recommendation
- Most popular routes (highest average rating)
- Strava's default suggestions (when available)

---

## Known Issues and TODOs

### Security
- ⚠️ **CRITICAL:** `env` file contains real credentials and is committed to repository
  - Action: Remove from git history, rename to `.env`, add to `.gitignore`
- ⚠️ `tokens.json` is in repository (should only be in `.gitignore` as `.env`)

### Code Organization
- Flat structure - needs refactoring to planned structure (data/, src/, models/, notebooks/)
- Duplicate code across notebooks - extract to shared modules
- `streamlit_app.py` is entirely commented out - needs activation or removal

### Model Improvements
- Implement collaborative filtering
- Add real-time weather integration
- Incorporate social features (friend recommendations)
- Handle cold start problem more elegantly
- Add explanation for recommendations (XAI)

### Deployment
- No `requirements.txt` - dependencies not formally specified
- No Docker configuration for reproducible environment
- No CI/CD pipeline
- No production-ready error handling

### Testing
- No unit tests
- No integration tests
- No model evaluation on held-out test set

### Documentation
- No API documentation
- No user guide for Streamlit app
- No contribution guidelines

---

## Stretch Goals

### Graph Neural Networks (GNNs)
Model the geographic network of routes for sophisticated similarity analysis.

**Libraries:**
- PyTorch Geometric
- DGL (Deep Graph Library)

**Approach:**
- Represent routes as nodes in a spatial graph
- Connect routes based on geographic proximity or shared segments
- Use node embeddings for similarity computation

### Reinforcement Learning
Dynamically adjust training plans based on real-time user progress and feedback.

**Libraries:**
- Stable-Baselines3
- Ray RLlib

**Approach:**
- State: User fitness level, recent performance, goals
- Action: Recommend specific route/workout
- Reward: User completion, performance improvement, satisfaction

### Explainable AI (XAI)
Provide transparency into recommendation reasoning.

**Libraries:**
- SHAP (SHapley Additive exPlanations)
- LIME (Local Interpretable Model-agnostic Explanations)

**Approach:**
- Generate SHAP values for feature contributions
- Display top factors influencing each recommendation
- Example: "Recommended because: similar elevation (+35%), preferred surface type (+25%), good distance match (+20%)"

### Proximity Alerts (Webhooks)
Real-time notifications when friends are nearby or just completed an activity.

**Requirements:**
- Persistent Flask/FastAPI server
- Strava webhook subscription
- Real-time distance calculation (geopy)
- Push notification system

---

## Contact and Resources

**Project Leads:**
- Anais Lacreuse
- Mrudula Dama

**Strava API Documentation:**
- https://developers.strava.com/docs/reference/

**Key Libraries:**
- scikit-learn: https://scikit-learn.org/
- Surprise: https://surpriselib.com/
- Streamlit: https://streamlit.io/
- Folium: https://python-visualization.github.io/folium/

**Related Projects:**
- Strava Recommendation Systems on GitHub
- Collaborative Filtering tutorials
- Content-Based Filtering examples

---

## For AI Assistants

### Key Principles
1. **Preserve Security:** Never expose or commit sensitive files (`tokens.json`, `.env`)
2. **Follow Structure:** Use planned directory structure (data/, src/, models/, notebooks/)
3. **Maintain Reproducibility:** Document all changes, use version control
4. **Test Thoroughly:** Validate recommendations with metrics before deployment
5. **Respect API Limits:** Implement rate limiting and error handling for Strava API

### Common Patterns
- Feature engineering: numerical scaling + categorical encoding
- Similarity computation: cosine similarity on feature vectors
- Cold start: fallback to popular items
- Token management: check expiration, refresh automatically
- Data flow: CSV → pandas → numpy → model → JSON/DataFrame

### File Modification Guidelines
- **Edit:** Existing notebooks for experiments
- **Create:** New modules in `src/` for stable code
- **Update:** This CLAUDE.md when architecture changes
- **Never commit:** Tokens, credentials, large datasets

### When in Doubt
- Refer to `Strave_recommender_ver4.ipynb` as the authoritative implementation
- Check `README.md` for project objectives and methodology
- Test with synthetic data before using real user data
- Validate API responses before processing

---

**End of CLAUDE.md**

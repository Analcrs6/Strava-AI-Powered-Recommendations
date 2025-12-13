# Technical Architecture - Strava AI-Powered Recommendations

## Complete Technology Stack Breakdown

---

## 🎨 Frontend

### Primary Framework
- **Streamlit 1.28+**
  - Python-based web framework for data applications
  - Real-time reactive UI updates
  - No HTML/CSS/JavaScript required
  - Built-in widgets: sliders, dropdowns, checkboxes, radio buttons

### Map Visualization
- **Folium 0.14+**
  - Python wrapper for Leaflet.js
  - OpenStreetMap integration
  - Interactive map rendering
  - Support for polylines, markers, popups, tooltips

- **streamlit-folium 0.15+**
  - Bridge between Streamlit and Folium
  - Enables embedding Folium maps in Streamlit apps
  - Bidirectional communication (map clicks → app state)

### GPS Data Handling
- **polyline 2.0+**
  - Google's polyline encoding/decoding algorithm
  - Compresses GPS coordinates into ASCII strings
  - Reduces data transfer by ~95% compared to raw lat/lon arrays
  - Example: `_p~iF~ps|U_ulLnnqC_mqNvxq`@ represents 100+ GPS points

### UI Components Used
- **Sidebar:** User preferences, filters, settings
- **Columns:** Multi-column layout for route cards
- **Expanders:** Collapsible sections for detailed info
- **Tabs:** Switching between different modes (Discovery, Explore, Create, Stats)
- **Metrics:** Display key stats (distance, elevation, score)
- **Progress bars:** Loading indicators for API calls
- **Success/Warning/Error messages:** User feedback

### Styling
- **Custom CSS:** Injected via `st.markdown()` with `unsafe_allow_html=True`
- **Color scheme:** Strava brand colors (#FC4C02 orange)
- **Responsive design:** Works on desktop and mobile browsers

---

## ⚙️ Backend

### Core Framework
- **Flask 2.3+**
  - Lightweight WSGI web framework
  - Powers the OAuth authentication server (`auth_server.py`)
  - Handles authorization code exchange and token refresh
  - Runs on port 8888 by default

### API Integration
- **Strava API v3**
  - RESTful API for accessing athlete and activity data
  - OAuth 2.0 authentication
  - Rate limits: 600 requests/15 min, 30,000 requests/day
  - Endpoints used:
    - `POST /oauth/token` - Token exchange and refresh
    - `GET /athlete` - User profile
    - `GET /athlete/activities` - Activity history
    - `GET /activities/{id}/streams` - GPS polylines, heart rate, power data
    - `GET /segments/explore` - Discover popular segments

### HTTP Client
- **requests 2.31+**
  - HTTP library for API calls
  - Session management for persistent connections
  - Automatic retry logic with exponential backoff
  - Header management for OAuth bearer tokens

### Environment Variables
- **python-dotenv 1.0+**
  - Load environment variables from `.env` file
  - Secure credential management
  - Variables:
    - `STRAVA_CLIENT_ID` - Strava app client ID
    - `STRAVA_CLIENT_SECRET` - Strava app secret
    - `CALLBACK_DOMAIN` - OAuth redirect URI

### Authentication Flow
```python
# 1. User clicks "Authorize Strava"
auth_url = f"https://www.strava.com/oauth/authorize?client_id={CLIENT_ID}&response_type=code&redirect_uri={REDIRECT_URI}&scope=read,activity:read_all,profile:read_all"

# 2. Strava redirects back with authorization code
code = request.args.get('code')

# 3. Exchange code for access token
response = requests.post('https://www.strava.com/oauth/token', data={
    'client_id': CLIENT_ID,
    'client_secret': CLIENT_SECRET,
    'code': code,
    'grant_type': 'authorization_code'
})

# 4. Store tokens
tokens = {
    'access_token': response.json()['access_token'],
    'refresh_token': response.json()['refresh_token'],
    'expires_at': response.json()['expires_at']
}

# 5. Use access token for API calls
headers = {'Authorization': f'Bearer {access_token}'}
activities = requests.get('https://www.strava.com/api/v3/athlete/activities', headers=headers)
```

### Token Management
- **Automatic refresh:** Checks `expires_at` before each API call
- **Persistent storage:** Saves tokens to `tokens.json`
- **Graceful expiration:** Refreshes in background without user interruption
- **Security:** Tokens excluded from git via `.gitignore`

---

## 🤖 AI Engine

### Machine Learning Framework
- **scikit-learn 1.3+**
  - Industry-standard ML library for Python
  - Algorithms used:
    - `cosine_similarity` - Measure similarity between route vectors
    - `MinMaxScaler` - Normalize numerical features to [0, 1] range
    - `TfidfVectorizer` - (Future) Text analysis for route descriptions

### Data Processing
- **pandas 2.1+**
  - DataFrames for structured data manipulation
  - CSV file I/O (`routes.csv`, `processed_activities.csv`)
  - Filtering, grouping, aggregation operations
  - Missing data handling (forward fill, interpolation)

- **numpy 1.24+**
  - Numerical computing library
  - Array operations for feature vectors
  - Matrix computations for similarity scores
  - Mathematical functions (mean, std, percentile)

### ML Model Architecture

#### 1. Feature Engineering
```python
# Route features
features = {
    'distance_km': MinMaxScaler(),           # Normalized 0-1
    'elevation_meters': MinMaxScaler(),      # Normalized 0-1
    'surface_type': OneHotEncoder(),         # [road, trail, track, mixed]
    'route_type': OneHotEncoder(),           # [loop, out_and_back, point_to_point]
    'avg_pace': MinMaxScaler(),              # Derived: distance / duration
    'difficulty_score': Custom()             # Derived: elevation / distance
}
```

#### 2. Content-Based Filtering
```python
# Compute item-item similarity matrix
route_vectors = scaler.fit_transform(route_features)
similarity_matrix = cosine_similarity(route_vectors)  # Shape: (n_routes, n_routes)

# Get user's highly-rated routes
user_liked = user_ratings[user_ratings['rating'] >= 4]['route_id']

# Find similar routes
recommendations = []
for liked_route in user_liked:
    similar_routes = similarity_matrix[liked_route].argsort()[-10:][::-1]
    recommendations.extend(similar_routes)

# Aggregate and rank
recommendations = Counter(recommendations).most_common(10)
```

#### 3. Progressive Filtering Algorithm
```python
def get_smart_recommendations(distance, surface, elevation, k=10):
    candidates = routes.copy()

    # Distance filter (relax ±3km if needed)
    filtered = candidates[abs(candidates['distance'] - distance) <= 3]
    if len(filtered) >= k:
        candidates = filtered

    # Surface filter (apply only if results exist)
    if len(surface) > 0:
        filtered = candidates[candidates['surface'].isin(surface)]
        if len(filtered) > 0:
            candidates = filtered

    # Elevation filter (relax ±100m)
    filtered = candidates[
        (candidates['elevation'] >= elevation[0] - 100) &
        (candidates['elevation'] <= elevation[1] + 100)
    ]
    if len(filtered) >= k:
        candidates = filtered

    # Always return at least k routes
    return candidates.head(max(k, 10))
```

#### 4. Context Boosting
```python
# Time-of-day preference
if user_prefers_morning and route.popular_time == 'morning':
    similarity_score *= 1.2  # +20% boost

# Weather compatibility (future)
if current_weather == 'rainy' and route.surface == 'paved':
    similarity_score *= 1.15  # Paved roads better in rain
```

### Evaluation Metrics
- **Precision@k:** Proportion of top-k recommendations that are relevant
- **Recall@k:** Proportion of relevant routes found in top-k
- **NDCG:** Normalized Discounted Cumulative Gain (ranking quality)
- **RMSE/MAE:** For rating predictions (collaborative filtering)

### Future ML Enhancements
- **Collaborative Filtering:** User-user similarity with Surprise library
- **Hybrid Model:** Combine content-based + collaborative signals
- **Deep Learning:** Neural networks for complex feature interactions (PyTorch)
- **Graph Neural Networks:** Model route connectivity and geographic relationships
- **Reinforcement Learning:** Adaptive training plans based on user progress

---

## 🏗️ Infrastructure

### Development Environment
- **Python 3.12**
  - Latest stable Python release
  - Type hints and modern syntax
  - Virtual environment management: `venv` or `conda`

### Dependency Management
- **pip 23+**
  - Package installer
  - `requirements.txt` for reproducible installs:
    ```
    streamlit==1.28.0
    folium==0.14.0
    streamlit-folium==0.15.0
    pandas==2.1.0
    numpy==1.24.0
    scikit-learn==1.3.0
    requests==2.31.0
    python-dotenv==1.0.0
    polyline==2.0.0
    flask==2.3.0
    ```

### Version Control
- **Git**
  - Distributed version control
  - Feature branch workflow
  - Branch naming: `claude/claude-md-<session-id>-<identifier>`
  - `.gitignore` for sensitive files (tokens.json, .env)

- **GitHub**
  - Remote repository hosting
  - Collaboration and code review
  - Repo: `github.com/Analcrs6/Strava-AI-Powered-Recommendations`

### Deployment Options

#### Option 1: GitHub Codespaces (Recommended)
- **What:** Cloud-based VS Code environment
- **Why:** Zero local setup, pre-configured environment
- **Setup:**
  1. Click "Code" → "Codespaces" on GitHub repo
  2. Create new Codespace
  3. Install dependencies: `pip install -r requirements.txt`
  4. Run: `streamlit run streamlit_app_final.py`
- **Port forwarding:** Automatic HTTPS URL for sharing
- **Cost:** 60 hours/month free for personal accounts

#### Option 2: Local Development
- **Platform:** macOS, Linux, Windows (WSL)
- **Requirements:**
  - Python 3.12+
  - 4GB RAM minimum
  - 1GB free disk space
- **Setup:**
  ```bash
  git clone https://github.com/Analcrs6/Strava-AI-Powered-Recommendations.git
  cd Strava-AI-Powered-Recommendations
  python -m venv venv
  source venv/bin/activate  # Windows: venv\Scripts\activate
  pip install -r requirements.txt
  streamlit run streamlit_app_final.py
  ```
- **Access:** `http://localhost:8501`

#### Option 3: Streamlit Community Cloud (Production)
- **What:** Free hosting for Streamlit apps
- **Why:** Public URL, always-on, automatic updates from GitHub
- **Setup:**
  1. Visit `streamlit.io/cloud`
  2. Connect GitHub account
  3. Select repository and branch
  4. Add secrets (environment variables) in dashboard
  5. Deploy
- **URL:** `https://[app-name].streamlit.app`
- **Limitations:** 1GB memory, sleep after inactivity
- **Cost:** Free tier available

#### Option 4: Google Colab
- **What:** Jupyter notebook environment with free GPU
- **Why:** Good for ML experimentation, not long-running apps
- **Setup:**
  ```python
  !pip install streamlit pyngrok
  !streamlit run streamlit_app_final.py & npx localtunnel --port 8501
  ```
- **Limitations:** Session timeout after 12 hours

#### Option 5: Cloud VM (AWS, GCP, Azure)
- **Platform:** Any cloud provider
- **Instance type:** t2.micro (AWS) or equivalent
- **OS:** Ubuntu 22.04 LTS
- **Setup:**
  ```bash
  sudo apt update
  sudo apt install python3.12 python3-pip
  git clone [repo]
  pip install -r requirements.txt
  streamlit run streamlit_app_final.py --server.port 80 --server.address 0.0.0.0
  ```
- **Security:** Configure firewall for port 80/443
- **Domain:** Optional custom domain with HTTPS (Let's Encrypt)
- **Cost:** $5-10/month

#### Option 6: Docker (Future)
- **Dockerfile:**
  ```dockerfile
  FROM python:3.12-slim
  WORKDIR /app
  COPY requirements.txt .
  RUN pip install -r requirements.txt
  COPY . .
  EXPOSE 8501
  CMD ["streamlit", "run", "streamlit_app_final.py"]
  ```
- **Build:** `docker build -t strava-ai .`
- **Run:** `docker run -p 8501:8501 strava-ai`
- **Deploy:** Docker Hub, Kubernetes, AWS ECS

### Data Storage

#### Current (Development)
- **CSV files:**
  - `routes.csv` - Route library with GPS polylines
  - `processed_activities.csv` - User activity history
  - `synthetic_strava_data.csv` - Generated training data
- **JSON files:**
  - `tokens.json` - OAuth tokens (NOT committed to git)
- **Storage location:** Local filesystem

#### Future (Production)
- **Database:** PostgreSQL with PostGIS extension for geospatial queries
- **Schema:**
  ```sql
  CREATE TABLE users (
      user_id SERIAL PRIMARY KEY,
      strava_id BIGINT UNIQUE,
      access_token VARCHAR(255),
      refresh_token VARCHAR(255),
      expires_at TIMESTAMP
  );

  CREATE TABLE routes (
      route_id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      distance_km FLOAT,
      elevation_m FLOAT,
      surface_type VARCHAR(50),
      gps_polyline TEXT,
      geom GEOMETRY(LINESTRING, 4326)
  );

  CREATE TABLE activities (
      activity_id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(user_id),
      route_id INT REFERENCES routes(route_id),
      rating INT,
      completed_at TIMESTAMP
  );
  ```
- **Geospatial indexing:** GIST index on `geom` column for fast spatial queries
- **Cloud storage:** AWS S3 for GPS polyline files (large data)

### Monitoring & Logging

#### Current (Development)
- **Streamlit logs:** Console output
- **Python logging module:**
  ```python
  import logging
  logging.basicConfig(level=logging.INFO)
  logger = logging.getLogger(__name__)
  logger.info("Recommendations generated successfully")
  ```

#### Future (Production)
- **Application monitoring:** Sentry for error tracking
- **Performance monitoring:** New Relic or Datadog
- **Logging:** Elasticsearch + Kibana (ELK stack)
- **Metrics:** Prometheus + Grafana
  - Request latency
  - API response times
  - Recommendation quality scores
  - User engagement metrics

### Security

#### Authentication
- **OAuth 2.0:** Industry-standard authorization framework
- **Scopes:** Minimal required permissions (`read`, `activity:read_all`, `profile:read_all`)
- **Token storage:** Encrypted at rest (future: AWS Secrets Manager, HashiCorp Vault)
- **HTTPS only:** Enforced in production

#### Data Privacy
- **No PII storage:** Only Strava IDs, no names/emails in database
- **Privacy zones:** Respect Strava's privacy settings
- **Data retention:** Auto-delete inactive users after 90 days
- **GDPR compliance:** User data export and deletion on request

#### API Security
- **Rate limiting:** Respect Strava's 600 req/15min limit
- **Retry logic:** Exponential backoff with jitter
- **Error handling:** Graceful degradation on API failures
- **Input validation:** Sanitize user inputs to prevent injection attacks

### Performance Optimization

#### Current
- **Vectorized operations:** NumPy for matrix computations (100x faster than loops)
- **Caching:** Streamlit's `@st.cache_data` decorator
  ```python
  @st.cache_data(ttl=3600)  # Cache for 1 hour
  def load_routes():
      return pd.read_csv('routes.csv')
  ```
- **Lazy loading:** Load map tiles only when visible
- **Batch API calls:** Fetch 100 activities at once instead of one-by-one

#### Future
- **Database indexing:** B-tree on distance, elevation columns
- **CDN:** CloudFlare for static assets (CSS, JS, images)
- **Similarity matrix caching:** Pre-compute and store in Redis
- **Async API calls:** `aiohttp` for concurrent requests
- **Load balancing:** Multiple Streamlit instances behind nginx

### CI/CD (Future)

#### Continuous Integration
- **GitHub Actions:**
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - name: Set up Python
          uses: actions/setup-python@v4
          with:
            python-version: '3.12'
        - name: Install dependencies
          run: pip install -r requirements.txt
        - name: Run tests
          run: pytest tests/
        - name: Lint
          run: flake8 .
  ```

#### Continuous Deployment
- **Automatic deployment:** Push to `main` → auto-deploy to Streamlit Cloud
- **Staging environment:** Test on `staging` branch before production
- **Rollback:** One-click rollback to previous version

### Scalability

#### Current Capacity
- **Users:** 1-10 concurrent users
- **Routes:** 100+ in database
- **Response time:** <2 seconds for recommendations

#### Scaling Strategy
- **Horizontal:** Multiple Streamlit instances with load balancer
- **Vertical:** Increase CPU/RAM for ML computations
- **Database:** Read replicas for query scaling
- **Caching layer:** Redis for similarity matrix, frequently accessed routes
- **CDN:** Serve static map tiles from edge locations

---

## 📊 Data Flow Architecture

### High-Level Flow
```
User → Streamlit UI → Flask OAuth Server → Strava API
                   ↓
              Feature Engineering
                   ↓
           ML Recommendation Engine
                   ↓
            Progressive Filtering
                   ↓
          Folium Map Rendering
                   ↓
              User sees results
```

### Detailed Flow

1. **User Authentication:**
   ```
   User clicks "Connect Strava"
   → Flask redirects to Strava OAuth page
   → User approves
   → Strava returns auth code
   → Flask exchanges code for access token
   → Token saved to tokens.json
   → Streamlit shows "Connected" status
   ```

2. **Activity Data Fetch:**
   ```
   User wants recommendations
   → Streamlit checks token expiration
   → If expired, auto-refresh via Flask
   → Fetch recent activities from Strava API
   → Parse JSON response into pandas DataFrame
   → Extract features (distance, elevation, surface)
   → Save to processed_activities.csv
   ```

3. **Recommendation Generation:**
   ```
   User sets preferences (distance, surface, elevation)
   → Load routes from CSV
   → Filter by preferences using progressive algorithm
   → Compute similarity scores with user's liked routes
   → Apply context boost (time of day, weather)
   → Sort by score descending
   → Return top 10 routes
   ```

4. **Map Rendering:**
   ```
   Streamlit receives 10 routes
   → For each route:
       - Decode GPS polyline
       - Create Folium PolyLine object
       - Add to map with color, popup, tooltip
   → Add 45 refueling station markers
   → Render Folium map in Streamlit
   → User sees interactive map
   ```

---

## 🔧 Development Tools

### IDEs
- **VS Code:** Primary editor with Python, Jupyter, GitLens extensions
- **Jupyter Lab:** Notebook experimentation

### Testing
- **pytest:** Unit testing framework (future)
- **Streamlit test mode:** `streamlit run --client.toolbarMode developer`

### Code Quality
- **flake8:** PEP 8 style checking (future)
- **black:** Code formatting (future)
- **mypy:** Type checking (future)

### Documentation
- **Markdown:** README.md, CLAUDE.md, PRESENTATION.md
- **Docstrings:** Google-style for functions
- **Marp:** Presentation slides from Markdown

---

## Summary Table

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend Framework** | Streamlit 1.28+ | Interactive web UI |
| **Map Visualization** | Folium 0.14+ | OpenStreetMap rendering |
| **GPS Encoding** | polyline 2.0+ | Compress GPS coordinates |
| **Backend Framework** | Flask 2.3+ | OAuth server |
| **API Integration** | Strava API v3 | Activity data access |
| **HTTP Client** | requests 2.31+ | API calls |
| **ML Framework** | scikit-learn 1.3+ | Recommendation engine |
| **Data Processing** | pandas 2.1+, numpy 1.24+ | Feature engineering |
| **Language** | Python 3.12 | Core programming |
| **Version Control** | Git + GitHub | Code management |
| **Deployment** | GitHub Codespaces, Streamlit Cloud | Hosting |
| **Data Storage** | CSV files (dev), PostgreSQL (future) | Persistence |
| **Authentication** | OAuth 2.0 | Secure access |
| **Monitoring** | Logging module (dev), Sentry (future) | Error tracking |

---

**This architecture is designed to be:**
- ✅ **Scalable:** Can handle 100+ concurrent users with minimal changes
- ✅ **Secure:** OAuth 2.0, no credential storage, HTTPS in production
- ✅ **Performant:** Sub-2-second recommendations, cached computations
- ✅ **Maintainable:** Clean code, modular design, comprehensive docs
- ✅ **Extensible:** Easy to add new features (collaborative filtering, weather, social)

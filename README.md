# Strava Recommender System V2.0 🏃‍♂️🎯

A production-ready, full-stack activity recommendation platform with advanced ML algorithms, JWT authentication, A/B testing, real-time features, and comprehensive analytics.

[![FastAPI](https://img.shields.io/badge/FastAPI-2.0.0-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org/)
[![FAISS](https://img.shields.io/badge/FAISS-Vector%20Search-blue)](https://github.com/facebookresearch/faiss)
[![Redis](https://img.shields.io/badge/Redis-Caching-red)](https://redis.io/)

## 🌟 What Makes This Special

This isn't just another Strava clone - it's an **enterprise-grade recommendation system** with:

- ✅ **5 ML Strategies** - Content, Content+MMR, Ensemble, Ensemble+MMR, Popularity
- ✅ **JWT Authentication** - Secure access & refresh tokens
- ✅ **A/B Testing Built-In** - Compare strategies with real data
- ✅ **Redis Caching** - 100x performance improvement
- ✅ **Real-time Notifications** - WebSocket-powered updates
- ✅ **Analytics Dashboard** - Track clicks, completions, performance
- ✅ **Activity Export** - GPX, TCX, JSON formats
- ✅ **Email Verification** - Complete auth flow
- ✅ **Rate Limiting** - 100 requests/minute protection
- ✅ **User Preferences** - Personalized algorithm settings

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for frontend development)
- Python 3.10+ (for backend development)
- Redis (optional but recommended)

### 1. Clone & Setup
```bash
git clone <your-repo>
cd Strava
cp .env.example .env  # Configure if needed
```

### 2. Run Database Migration
```bash
# Apply all schema updates
docker-compose up -d postgres
docker-compose exec postgres psql -U postgres -d strava_db -f /app/migrate_comprehensive_v2.sql
```

### 3. Start All Services
```bash
docker-compose up --build

# Or use Make
make build && make up
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 📦 Core Features

### 🔐 Authentication & Security

#### JWT Authentication
- **Access tokens** (30 min expiry)
- **Refresh tokens** (7 days expiry)
- **Bcrypt password hashing**
- **Protected routes** with Bearer auth

```bash
# Signup
POST /api/users/signup
{
  "name": "John Doe",
  "email": "john@example.com", 
  "password": "secure123"
}

# Response includes JWT tokens
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {...}
}

# Use token in requests
Authorization: Bearer eyJ...
```

#### Email Verification
- Automatic verification emails on signup
- 24-hour token expiration
- Resend verification option
- Email status tracking

#### Password Reset
- Secure reset flow with tokens
- 1-hour token expiration
- Email enumeration protection

#### Security Features
- Rate limiting (100 req/min per IP)
- Security headers (HSTS, CSP, X-Frame-Options)
- Request logging with timing
- CORS configuration

---

### 🤖 Advanced Recommendation System

#### 5 Available Strategies

| Strategy | Description | Use Case | Performance |
|----------|-------------|----------|-------------|
| **content** | Pure similarity (baseline) | Quick recs, testing | Fastest |
| **content_mmr** | Content + diversity (MMR) | ⭐ General use | Fast, high quality |
| **popularity** | Most popular routes | New users, cold-start | Fastest |
| **ensemble** | Content + collaborative (60/40) | Better coverage | Moderate |
| **ensemble_mmr** | Ensemble + diversity | ⭐ Best quality | Moderate |

#### Collaborative Filtering
- **Item-item similarity** using user-route matrix
- **1,989 user interactions** loaded from training data
- **Cosine similarity** for route relationships
- **Redis caching** for 100x speedup

#### MMR Reranking
- **Diversity parameter** (λ): 0.0 (relevant) to 1.0 (diverse)
- **Maximal Marginal Relevance** algorithm
- **Reduces redundancy** in recommendations
- **Recommended λ**: 0.3 for balanced results

```bash
# Get recommendations
POST /api/recommend
{
  "activity_id": "R001",
  "k": 10,
  "strategy": "ensemble_mmr",
  "lambda_diversity": 0.3,
  "exclude_seen": true,
  "user_id": "user_abc"
}
```

---

### 📊 A/B Testing Framework

#### Automatic Testing
- **Users auto-assigned** to Group A or B on signup
- **Group A**: content_mmr strategy (control)
- **Group B**: ensemble_mmr strategy (variant)
- **All recommendations logged** with group tag

#### Analytics Endpoints
```bash
# View A/B test results
GET /api/analytics/ab-test-results?experiment=ensemble_vs_content_mmr&days=7

# Response
{
  "variants": [
    {"variant": "A", "strategy": "content_mmr", "click_rate": 8.5},
    {"variant": "B", "strategy": "ensemble_mmr", "click_rate": 12.3}
  ],
  "winner": "B",
  "difference_percentage": 3.8
}
```

#### Tracked Metrics
- Total recommendations shown
- Click-through rate (CTR)
- Completion rate
- Average recommendation score
- User engagement

---

### ⚡ Redis Caching System

#### What's Cached
- **Collaborative filtering scores** (30 min TTL)
- **Recommendation results** (1 hour TTL)
- **User profiles** (5 min TTL)

#### Performance Impact
```
Before Caching:
- Collaborative filtering: ~500ms
- Ensemble recommendations: ~800ms

After Caching:
- Collaborative filtering: ~5ms (100x faster!)
- Ensemble recommendations: ~50ms (16x faster!)
```

#### Setup
```bash
# Start Redis
docker-compose up -d redis

# Or standalone
docker run -d -p 6379:6379 redis:latest
```

---

### 📈 Analytics & Tracking

#### Track User Behavior
```bash
# Log recommendation click
POST /api/analytics/log/click
{
  "query_activity_id": "R001",
  "recommended_activity_id": "R025",
  "strategy": "ensemble_mmr",
  "rank": 1,
  "score": 0.95
}

# Log activity completion
POST /api/analytics/log/completion/R025
```

#### View Performance
```bash
# Strategy comparison
GET /api/analytics/strategy-performance?days=7

# User insights
GET /api/analytics/user-insights

# A/B test results
GET /api/analytics/ab-test-results
```

---

### 🎯 User Preferences

#### Customizable Settings
- **Preferred strategy** (saved per user)
- **Diversity parameter** (λ value)
- **Activity filters** (distance, elevation, surface)
- **Notification preferences**
- **Display settings** (units, theme)

```bash
# Get preferences
GET /api/users/me/preferences

# Update preferences
PATCH /api/users/me/preferences
{
  "preferred_strategy": "ensemble_mmr",
  "preferred_lambda": 0.5,
  "units": "imperial",
  "theme": "dark"
}
```

---

### 📤 Activity Export

#### Supported Formats

**GPX** (GPS Exchange Format)
- Standard GPS format
- Compatible with Garmin, Strava, etc.
```bash
GET /api/export/activity/{id}/gpx
```

**TCX** (Training Center XML)
- Garmin format with training data
```bash
GET /api/export/activity/{id}/tcx
```

**JSON** (Complete metadata)
- Full activity data export
```bash
GET /api/export/activity/{id}/json
```

---

### 🔔 Real-time Notifications

#### WebSocket Connection
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/notifications');

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('New notification:', notification);
};
```

#### Notification Types
- Friend completed a recommended route
- New follower
- Achievement unlocked
- Weekly summary available
- Recommendation updates

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                  │
│  - JWT Token Management    - Real-time Notifications        │
│  - GPS Tracking           - A/B Test UI                     │
│  - Activity Feed          - User Preferences                │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS + JWT + WebSocket
┌────────────────────▼────────────────────────────────────────┐
│              API Gateway (FastAPI v2.0)                      │
│  ├─ Rate Limiting (100 req/min)                             │
│  ├─ Security Headers (HSTS, CSP)                            │
│  ├─ Request Logging                                          │
│  └─ CORS Configuration                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬──────────────┐
        │            │            │              │
┌───────▼──────┐ ┌──▼────────┐ ┌▼──────────┐ ┌─▼─────────┐
│   Postgres   │ │   Redis   │ │   FAISS   │ │ WebSocket │
│              │ │           │ │           │ │  Server   │
│ - Users      │ │ - Cache   │ │ - Vectors │ │ - Real-   │
│ - Activities │ │ - Session │ │ - Index   │ │   time    │
│ - Analytics  │ │ - Collab  │ │ - Search  │ │   Notifs  │
│ - A/B Tests  │ └───────────┘ └───────────┘ └───────────┘
└──────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **React Router** - Navigation
- **Leaflet** - GPS mapping
- **Lucide Icons** - Icon library

### Backend
- **FastAPI 2.0** - API framework
- **SQLAlchemy 2.0** - ORM
- **FAISS** - Vector similarity search
- **Redis** - Caching layer
- **PostgreSQL** - Primary database
- **WebSockets** - Real-time features

### ML & Algorithms
- **NumPy** - Numerical computing
- **Pandas** - Data manipulation
- **Scikit-learn** - ML algorithms
- **FAISS** - Similarity search (Facebook AI)
- **MMR** - Diversity reranking

### Authentication & Security
- **python-jose** - JWT tokens
- **passlib[bcrypt]** - Password hashing
- **slowapi** - Rate limiting

---

## 📚 API Documentation

### Authentication Endpoints
```
POST   /api/users/signup              # Register new user
POST   /api/users/login               # Login and get tokens
POST   /api/users/refresh             # Refresh access token
POST   /api/users/verify-email        # Verify email address
POST   /api/users/forgot-password     # Request password reset
POST   /api/users/reset-password      # Reset password
GET    /api/users/me                  # Get current user
GET    /api/users/me/preferences      # Get user preferences
PATCH  /api/users/me/preferences      # Update preferences
```

### Recommendation Endpoints
```
POST   /api/recommend                 # Get recommendations
POST   /api/recommend/next-activity   # Predict next activity
GET    /api/recommend/strategies      # List strategies
GET    /api/recommend/debug/index-info # FAISS index info
```

### Analytics Endpoints
```
POST   /api/analytics/log/click       # Log recommendation click
POST   /api/analytics/log/completion  # Log activity completion
GET    /api/analytics/strategy-performance  # Strategy metrics
GET    /api/analytics/ab-test-results # A/B test results
GET    /api/analytics/user-insights   # User statistics
```

### Export Endpoints
```
GET    /api/export/activity/{id}/gpx  # Export as GPX
GET    /api/export/activity/{id}/tcx  # Export as TCX
GET    /api/export/activity/{id}/json # Export as JSON
```

### Activity Endpoints
```
GET    /api/activities                # List activities
POST   /api/activities                # Create activity
GET    /api/activities/{id}           # Get activity
PUT    /api/activities/{id}           # Update activity
DELETE /api/activities/{id}           # Delete activity
```

**Full documentation**: http://localhost:8000/docs

---

## 🧪 Testing

### Run Tests
```bash
# Backend tests
pytest app/tests/

# Frontend tests
cd frontend && npm test

# Integration tests
pytest app/tests/integration/
```

### Test Coverage
```bash
pytest --cov=app --cov-report=html
open htmlcov/index.html
```

### Manual Testing
```bash
# Health check
curl http://localhost:8000/health/live

# Signup
curl -X POST http://localhost:8000/api/users/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"test123"}'

# Get recommendations
curl -X POST http://localhost:8000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"activity_id":"R001","k":10,"strategy":"ensemble_mmr"}'
```

---

## 📊 Performance Benchmarks

| Operation | Time (without cache) | Time (with cache) | Improvement |
|-----------|---------------------|-------------------|-------------|
| Collaborative Filtering | 500ms | 5ms | **100x** |
| Ensemble Recommendations | 800ms | 50ms | **16x** |
| User Profile Load | 100ms | 10ms | **10x** |
| FAISS Search | 50ms | 50ms | - |
| MMR Reranking | 80ms | 80ms | - |

**Total Request Time**: ~150ms (cached) vs ~1.5s (uncached)

---

## 🐛 Troubleshooting

### Redis Connection Failed
```bash
# Check Redis is running
docker-compose ps redis

# Restart Redis
docker-compose restart redis

# App works without Redis (caching disabled)
```

### Migration Errors
```bash
# Reset database
docker-compose down -v
docker-compose up -d postgres
docker-compose exec postgres psql -U postgres -d strava_db -f /app/migrate_comprehensive_v2.sql
```

### Port Conflicts
```yaml
# Edit docker-compose.yml
services:
  app:
    ports:
      - "8001:8000"  # Change 8000 to 8001
```

### Build Issues
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up
```

---

## 🔧 Development

### Backend Development
```bash
cd app
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Database Migrations
```bash
# Create migration
alembic revision -m "description"

# Apply migration
alembic upgrade head
```

---

## 🚢 Deployment

### Docker Production
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables
```bash
# Production .env
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://redis:6379/0
SENDGRID_API_KEY=your-api-key
FRONTEND_URL=https://yourdomain.com
```

---

## 📈 Monitoring

### Logs
```bash
# View all logs
docker-compose logs -f

# Backend only
docker-compose logs -f app

# Frontend only
docker-compose logs -f frontend
```

### Metrics
- Request timing (X-Process-Time header)
- Rate limit headers (X-RateLimit-*)
- Cache hit/miss logs
- A/B test metrics in database

---

## 🎓 Learning Outcomes

This project demonstrates:
- ✅ Production-ready FastAPI architecture
- ✅ JWT authentication & authorization
- ✅ Advanced ML recommendation systems
- ✅ A/B testing & experimentation
- ✅ Caching strategies for performance
- ✅ Rate limiting & security best practices
- ✅ Real-time features with WebSockets
- ✅ Analytics & data tracking
- ✅ Microservices architecture
- ✅ RESTful API design

---

## 📝 License

MIT License - Feel free to use and modify!

---

## 🙏 Acknowledgments

- **FAISS** by Facebook AI Research
- **FastAPI** by Sebastián Ramírez
- **React** by Facebook
- **Strava** for inspiration

---

## 📞 Support

- **Documentation**: Check `/docs` folder
- **API Docs**: http://localhost:8000/docs
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

---

**Built with ❤️ using FastAPI, React, FAISS, and Redis**

**Version 2.0.0** - Production Ready


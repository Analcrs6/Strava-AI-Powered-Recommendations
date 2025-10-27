# Strava Clone with AI Recommender 🏃‍♂️🤖

A full-stack Strava clone with an integrated FAISS-powered activity recommendation system.

## 🎯 Features

- **Modern React UI** - Beautiful, responsive frontend
- **Activity Tracking** - Create and manage workouts
- **AI Recommendations** - FAISS similarity search for activity suggestions
- **FastAPI Backend** - High-performance REST API
- **PostgreSQL + PostGIS** - Spatial database
- **Docker Compose** - One-command deployment

## 🚀 Quick Start

```bash
# Build and start all services
docker compose up --build

# Or use Make commands
make build
make up
```

### Access the Application

- **Frontend UI**: http://localhost:3000 ← **Start here!**
- **Backend API**: http://localhost:8080
- **API Docs**: http://localhost:8080/docs

## 📦 What's Included

### Frontend (React + Vite)
- Activity dashboard with stats
- Create new activities
- AI-powered recommendations panel
- Responsive design with Tailwind CSS
- Strava-inspired UI

### Backend (FastAPI + FAISS)
- REST API for activities
- FAISS vector similarity search
- CSV data seeding (200+ activities)
- Background index rebuilding
- Health monitoring

### Infrastructure
- PostgreSQL with PostGIS
- Redis (for future job queuing)
- MinIO (for future file storage)

## 📖 Documentation

- **[UI_GUIDE.md](./UI_GUIDE.md)** - Frontend features and usage
- **[QUICKSTART.md](./QUICKSTART.md)** - Testing the API
- **[SETUP.md](./SETUP.md)** - Detailed setup guide
- **[API_EXAMPLES.md](./API_EXAMPLES.md)** - API examples

## 🎮 Quick Commands

```bash
make help           # Show all commands
make build          # Build all images
make up             # Start services
make down           # Stop services
make logs           # View all logs
make logs-frontend  # View frontend logs only
make logs-app       # View backend logs only
make health         # Test backend health
make recommend      # Test recommendations
```

## 🧪 Try It Out

### 1. Create an Activity (UI)

1. Open http://localhost:3000
2. Click **"+ New Activity"**
3. Fill in details and save

### 2. Get Recommendations

1. Click any activity on the dashboard
2. See similar activities in the right panel
3. View match percentages

### 3. Test API Directly

```bash
# Health check
curl http://localhost:8080/health/live

# Get recommendations
curl -X POST http://localhost:8080/recommend \
  -H "Content-Type: application/json" \
  -d '{"activity_id":"1_1","k":5"}'
```

## 📊 Data

- **CSV Seed Data**: `app/resources/synthetic_strava_data.csv` (200+ activities)
- **Activity IDs**: Format is `{user_id}_{route_id}` (e.g., "1_1", "5_3")
- **FAISS Index**: Auto-builds on startup, saved to `/data/recsys`

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  React Frontend │────▶│  FastAPI Backend │
│   (Port 3000)   │     │    (Port 8080)   │
└─────────────────┘     └──────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                ┌───▼────┐          ┌────▼─────┐
                │ PostgreSQL│         │  FAISS   │
                │  + PostGIS│         │  Index   │
                └──────────┘          └──────────┘
```

## 🛠️ Tech Stack

**Frontend:**
- React 18 + Vite
- TailwindCSS
- React Router
- Axios
- Lucide Icons

**Backend:**
- FastAPI
- FAISS (similarity search)
- SQLAlchemy
- Pandas + NumPy
- APScheduler

**Infrastructure:**
- Docker + Docker Compose
- PostgreSQL with PostGIS
- Redis
- MinIO

## 🔧 Development

### Backend only
```bash
cd app
python -m uvicorn app.main:app --reload
```

### Frontend only
```bash
cd frontend
npm install
npm run dev
```

### Full stack
```bash
docker compose up
```

## 📝 Environment Variables

Copy `.env.example` to `.env` - defaults work out of the box!

Key settings:
- `CSV_SEED_PATH` - Path to activity data
- `RECSYS_METRIC` - `cosine` or `l2` similarity
- `RECSYS_K` - Number of recommendations (default: 20)

## 🐛 Troubleshooting

**Port conflicts?**
- Frontend: Change port in `frontend/vite.config.js`
- Backend: Edit `API_PORT` in `.env`

**Build issues?**
```bash
docker compose down
docker compose build --no-cache
docker compose up
```

**Need help?** Check the docs in `/SETUP.md` and `/UI_GUIDE.md`

## 🎯 Next Steps

- 📊 Add charts and analytics
- 🗺️ Integrate maps for routes
- 👥 Add user authentication
- 🏆 Create achievement system
- 📱 Build mobile app
- 🌐 Deploy to production

## 📄 License

MIT License - Feel free to use and modify!

---

**Built with ❤️ using FastAPI, React, and FAISS**


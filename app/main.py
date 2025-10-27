from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import Base, engine
from .routers import health, activities, recommend, users, demo
from .services.recommender import recsys
from .services.scheduler import start as start_scheduler

app = FastAPI(
    title="Strava Recommender System",
    description="Multi-strategy recommender system with FAISS + MMR",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# create tables
Base.metadata.create_all(bind=engine)

# mount routers
app.include_router(health)
app.include_router(users)
app.include_router(activities)
app.include_router(recommend)
app.include_router(demo)

@app.on_event("startup")
def on_startup():
    """Initialize the application - load trained model and build FAISS index."""
    print("🚀 Starting Strava Recommender System...")
    
    # Initialize recommender (loads trained model if available, otherwise builds from CSV)
    print("🔨 Loading recommender...")
    recsys.ensure_ready()
    
    # Start background scheduler
    print("⏰ Starting background scheduler...")
    start_scheduler()
    print("✅ Scheduler started!")
    
    print("\n🎉 Strava Recommender System is ready!")
    print(f"   📊 API Docs: http://localhost:8080/docs")
    print(f"   🎨 Frontend: http://localhost:3000\n")


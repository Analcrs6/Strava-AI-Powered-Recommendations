import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError
from .db import Base, engine, demo_engine
from .routers import health, activities, recommend, users, demo, social, location, export, analytics, notifications
from .services.recommender import recsys
from .services.scheduler import start as start_scheduler
from .middleware import RateLimitMiddleware, RequestLoggingMiddleware, SecurityHeadersMiddleware
from .cache import cache
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Strava Recommender System",
    description="Multi-strategy recommender system with FAISS + MMR + JWT + Analytics",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add middleware (order matters - they execute in reverse order)
# 1. Security headers (first to apply)
app.add_middleware(SecurityHeadersMiddleware)

# 2. Request logging
app.add_middleware(RequestLoggingMiddleware)

# 3. Rate limiting (100 requests per minute)
app.add_middleware(RateLimitMiddleware, requests_per_minute=100)

# 4. CORS (last to apply)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(health)
app.include_router(users)
app.include_router(activities)
app.include_router(recommend)
app.include_router(demo)
app.include_router(social)
app.include_router(location)
app.include_router(export)
app.include_router(analytics)
app.include_router(notifications)

def init_db_with_retry(max_retries=5, retry_delay=2):
    """Initialize databases with retry logic for container startup."""
    # Initialize main database
    for attempt in range(max_retries):
        try:
            print(f"🗄️  Attempting to connect to MAIN database (attempt {attempt + 1}/{max_retries})...")
            Base.metadata.create_all(bind=engine)
            print("✅ Main database tables created successfully!")
            break
        except OperationalError as e:
            if attempt < max_retries - 1:
                print(f"⚠️  Main database not ready yet, retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print(f"❌ Failed to connect to main database after {max_retries} attempts")
                raise
    
    # Initialize demo database (same schema, different database)
    for attempt in range(max_retries):
        try:
            print(f"🗄️  Attempting to connect to DEMO database (attempt {attempt + 1}/{max_retries})...")
            Base.metadata.create_all(bind=demo_engine)
            print("✅ Demo database tables created successfully!")
            break
        except OperationalError as e:
            if attempt < max_retries - 1:
                print(f"⚠️  Demo database not ready yet, retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print(f"❌ Failed to connect to demo database after {max_retries} attempts")
                raise

@app.on_event("startup")
def on_startup():
    """Initialize the application - load trained model and build FAISS index."""
    logger.info("🚀 Starting Strava Recommender System v2.0...")
    
    # Initialize database tables
    init_db_with_retry()
    
    # Test cache connection
    cache_stats = cache.get_stats()
    if cache_stats.get("enabled"):
        logger.info(f"✅ Redis cache connected")
    else:
        logger.warning("⚠️  Redis cache not available (using in-memory only)")
    
    # Initialize recommender (loads trained model if available, otherwise builds from CSV)
    logger.info("🔨 Loading recommender system...")
    recsys.ensure_ready()
    
    # Start background scheduler
    logger.info("⏰ Starting background scheduler...")
    start_scheduler()
    logger.info("✅ Scheduler started!")
    
    logger.info("\n" + "="*60)
    logger.info("🎉 Strava Recommender System v2.0 is ready!")
    logger.info("="*60)
    logger.info("Features Enabled:")
    logger.info("  ✅ JWT Authentication with Refresh Tokens")
    logger.info("  ✅ Email Verification & Password Reset")
    logger.info("  ✅ User Preferences & Settings")
    logger.info("  ✅ A/B Testing Framework")
    logger.info("  ✅ Redis Caching (Collaborative Filtering)")
    logger.info("  ✅ Rate Limiting (100 req/min)")
    logger.info("  ✅ Recommendation Analytics")
    logger.info("  ✅ Activity Export (GPX/TCX/JSON)")
    logger.info("  ✅ Ensemble Strategies (Content + Collaborative)")
    logger.info("  ✅ Real-time Notifications (WebSocket)")
    logger.info("="*60)
    logger.info(f"📊 API Docs: http://localhost:8000/docs")
    logger.info(f"🎨 Frontend: http://localhost:3000")
    logger.info("="*60 + "\n")


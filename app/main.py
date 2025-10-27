from fastapi import FastAPI
from .db import Base, engine
from .routers import health, activities, recommend
from .services.recommender import recsys
from .services.scheduler import start as start_scheduler

app = FastAPI(title="Strava Clone (Single App with Recommender)")

# create tables
Base.metadata.create_all(bind=engine)

# mount routers
app.include_router(health)
app.include_router(activities)
app.include_router(recommend)

@app.on_event("startup")
def on_startup():
    recsys.ensure_ready()
    start_scheduler()


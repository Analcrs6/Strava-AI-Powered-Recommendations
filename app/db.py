from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

# Shared declarative base for models
Base = declarative_base()

# Main database (production)
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Demo database (isolated for demo purposes)
demo_engine = create_engine(settings.demo_database_url, pool_pre_ping=True)
DemoSessionLocal = sessionmaker(bind=demo_engine, autoflush=False, autocommit=False)

def get_db():
    """Get main database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_demo_db():
    """Get demo database session."""
    db = DemoSessionLocal()
    try:
        yield db
    finally:
        db.close()


from pydantic import BaseModel
import os

class Settings(BaseModel):
    environment: str = os.getenv("ENVIRONMENT", "dev")
    api_host: str = os.getenv("API_HOST", "0.0.0.0")
    api_port: int = int(os.getenv("API_PORT", "8000"))

    # DB
    pg_user: str = os.getenv("POSTGRES_USER", "strava")
    pg_pass: str = os.getenv("POSTGRES_PASSWORD", "strava")
    pg_db: str = os.getenv("POSTGRES_DB", "strava")
    pg_host: str = os.getenv("POSTGRES_HOST", "db")
    pg_port: str = os.getenv("POSTGRES_PORT", "5432")

    # Recsys
    recsys_index_dir: str = os.getenv("RECSYS_INDEX_DIR", "/data/recsys")
    recsys_k: int = int(os.getenv("RECSYS_K", "20"))
    recsys_metric: str = os.getenv("RECSYS_METRIC", "cosine")

    # Seed
    csv_seed_path: str = os.getenv("CSV_SEED_PATH", "/datasets/synthetic_strava_data.csv")

    @property
    def database_url(self) -> str:
        return f"postgresql://{self.pg_user}:{self.pg_pass}@{self.pg_host}:{self.pg_port}/{self.pg_db}"

settings = Settings()


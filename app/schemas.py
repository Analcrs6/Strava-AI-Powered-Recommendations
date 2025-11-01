from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ActivityCreate(BaseModel):
    sport: str
    duration_s: float
    distance_m: float
    elevation_gain_m: float | None = None
    hr_avg: float | None = None
    started_at: Optional[str] = None
    features: Dict[str, Any] = Field(default_factory=dict)

class ActivityOut(BaseModel):
    id: str
    user_id: str
    sport: str
    duration_s: float
    distance_m: float
    elevation_gain_m: float | None = None
    hr_avg: float | None = None

class RecommendRequest(BaseModel):
    user_id: Optional[str] = None
    activity_id: Optional[str] = None
    k: int = 10
    strategy: str = "content_mmr"  # content, content_mmr, ensemble, ensemble_mmr, popularity
    lambda_diversity: float = 0.3  # 0-1, only used for MMR strategies
    exclude_seen: bool = False  # Filter out routes the user has already done

class RouteMetadata(BaseModel):
    """Metadata about a recommended route."""
    route_id: str
    surface_type: Optional[str] = None
    distance_km: Optional[float] = None
    elevation_m: Optional[float] = None
    difficulty_score: Optional[float] = None
    grade_percent: Optional[float] = None
    is_loop: Optional[bool] = None
    popularity: Optional[float] = None

class RecommendItem(BaseModel):
    activity_id: str
    score: float
    metadata: Optional[RouteMetadata] = None

class RecommendResponse(BaseModel):
    items: List[RecommendItem]
    strategy: str
    lambda_diversity: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


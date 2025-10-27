from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ActivityCreate(BaseModel):
    id: str
    user_id: str
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
    k: int = 20

class RecommendItem(BaseModel):
    activity_id: str
    score: float

class RecommendResponse(BaseModel):
    items: List[RecommendItem]


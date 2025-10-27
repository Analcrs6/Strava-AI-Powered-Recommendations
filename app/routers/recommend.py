from fastapi import APIRouter
from ..schemas import RecommendRequest, RecommendResponse, RecommendItem
from ..services.recommender import recsys
from ..config import settings

router = APIRouter(prefix="/recommend", tags=["recommend"])

@router.post("", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    if req.activity_id:
        items = recsys.search_by_activity(req.activity_id, req.k)
    else:
        # future: build vector from user context/features
        items = []
    return RecommendResponse(items=[RecommendItem(activity_id=i, score=s) for i,s in items])

@router.post("/rebuild")
def rebuild_index():
    recsys.rebuild_from_csv(settings.csv_seed_path)
    return {"status":"rebuilt"}


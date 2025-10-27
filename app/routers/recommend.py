from fastapi import APIRouter, HTTPException
from ..schemas import RecommendRequest, RecommendResponse, RecommendItem
from ..services.recommender import recsys
from ..config import settings

router = APIRouter(prefix="/recommend", tags=["recommend"])

@router.post("", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    """
    Get activity recommendations using different strategies.
    
    **Strategies:**
    - `content`: Pure similarity (baseline, fastest)
    - `content_mmr`: Content + diversity via MMR (⭐ **recommended**)
    - `ensemble`: Content + collaborative (future)
    - `ensemble_mmr`: Ensemble + diversity (future, best recall)
    
    **Lambda Diversity** (for MMR strategies):
    - `0.0`: Pure relevance/similarity
    - `0.3`: Balanced (⭐ **recommended**)
    - `0.6`: High diversity
    - `1.0`: Maximum diversity
    
    **Based on evaluation metrics:**
    - `content_mmr` has best MAP and NDCG (ranking quality)
    - `ensemble_mmr` has best Recall (coverage)
    """
    if not req.activity_id:
        raise HTTPException(400, "activity_id is required")
    
    # Validate strategy
    valid_strategies = ["content", "content_mmr", "ensemble", "ensemble_mmr"]
    if req.strategy not in valid_strategies:
        raise HTTPException(400, f"Invalid strategy. Must be one of: {valid_strategies}")
    
    # Validate lambda_diversity
    if not (0.0 <= req.lambda_diversity <= 1.0):
        raise HTTPException(400, "lambda_diversity must be between 0.0 and 1.0")
    
    try:
        items = recsys.search_by_activity(
            req.activity_id, 
            req.k,
            strategy=req.strategy,
            lambda_diversity=req.lambda_diversity
        )
    except Exception as e:
        raise HTTPException(500, f"Recommendation failed: {str(e)}")
    
    # Add metadata about the strategy
    metadata = {
        "description": get_strategy_description(req.strategy),
        "uses_mmr": "mmr" in req.strategy,
        "evaluation_notes": get_strategy_performance(req.strategy)
    }
    
    return RecommendResponse(
        items=[RecommendItem(activity_id=i, score=s) for i, s in items],
        strategy=req.strategy,
        lambda_diversity=req.lambda_diversity if "mmr" in req.strategy else None,
        metadata=metadata
    )

@router.post("/rebuild")
def rebuild_index():
    """Manually rebuild the recommendation index from CSV data."""
    try:
        recsys.rebuild_from_csv(settings.csv_seed_path)
        return {
            "status": "rebuilt",
            "message": "Recommendation index successfully rebuilt from CSV"
        }
    except Exception as e:
        raise HTTPException(500, f"Rebuild failed: {str(e)}")

@router.get("/strategies")
def get_strategies():
    """Get information about available recommendation strategies."""
    return {
        "strategies": [
            {
                "name": "content",
                "display_name": "Pure Similarity",
                "description": "Baseline content-based filtering using feature similarity",
                "speed": "fastest",
                "quality": "baseline",
                "use_case": "Quick recommendations, testing"
            },
            {
                "name": "content_mmr",
                "display_name": "Content + Diversity (MMR)",
                "description": "Content-based with MMR reranking for diverse results",
                "speed": "fast",
                "quality": "best MAP & NDCG",
                "use_case": "⭐ Recommended for most applications",
                "recommended": True
            },
            {
                "name": "ensemble",
                "display_name": "Ensemble (Content + Collaborative)",
                "description": "Combines content-based and collaborative filtering",
                "speed": "moderate",
                "quality": "improved coverage",
                "use_case": "When user interaction data is available",
                "status": "future"
            },
            {
                "name": "ensemble_mmr",
                "display_name": "Ensemble + Diversity",
                "description": "Ensemble approach with MMR reranking",
                "speed": "moderate",
                "quality": "best Recall",
                "use_case": "Maximum coverage with diversity",
                "status": "future"
            }
        ],
        "evaluation_summary": {
            "content_mmr": {
                "recall_at_10": 0.10,
                "map_at_10": 0.043,
                "ndcg_at_10": "highest",
                "recommendation": "Best for ranking quality and diversity"
            },
            "ensemble_mmr": {
                "recall_at_10": 0.12,
                "map_at_10": "good",
                "ndcg_at_10": "good",
                "recommendation": "Best for maximizing relevant items found"
            }
        }
    }

def get_strategy_description(strategy: str) -> str:
    descriptions = {
        "content": "Pure similarity-based recommendations using activity features",
        "content_mmr": "Similarity-based with diversity optimization via MMR reranking",
        "ensemble": "Hybrid content-based and collaborative filtering",
        "ensemble_mmr": "Hybrid approach with diversity optimization"
    }
    return descriptions.get(strategy, "Unknown strategy")

def get_strategy_performance(strategy: str) -> str:
    notes = {
        "content": "Baseline performance. Fast but may return similar/redundant results.",
        "content_mmr": "Best MAP@10 (0.043) and NDCG. Balanced relevance and diversity. ⭐ Recommended",
        "ensemble": "Modest improvements over baseline. Better with more user data.",
        "ensemble_mmr": "Best Recall@10 (0.12). Finds more relevant items overall."
    }
    return notes.get(strategy, "")


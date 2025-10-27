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
        # Handle demo session activity IDs and extract route ID
        # Demo activities have format: "userid_routeid_demo_sessionid"
        # But trained FAISS index only has route IDs: "routeid" (e.g., "R049")
        activity_id_for_search = req.activity_id
        
        # Remove demo session suffix if present
        if "_demo_" in req.activity_id:
            parts = req.activity_id.split("_demo_")
            activity_id_for_search = parts[0]
            print(f"🔍 Demo activity detected: {req.activity_id} → {activity_id_for_search}")
        
        # Extract just the route ID (the FAISS index uses route IDs without user prefix)
        # Format: "userid_R049" → "R049"
        if "_" in activity_id_for_search:
            id_parts = activity_id_for_search.split("_")
            # Find the part that looks like a route ID (starts with R or is numeric)
            for part in id_parts:
                if part.startswith("R") or part.isdigit():
                    route_id = part
                    print(f"🔍 Extracted route ID: {activity_id_for_search} → {route_id}")
                    activity_id_for_search = route_id
                    break
        
        print(f"🔍 Final search ID: {activity_id_for_search}")
        
        # Debug: Check if activity exists in FAISS index
        recsys.ensure_ready()
        if recsys.idmap is not None:
            import numpy as np
            if activity_id_for_search in recsys.idmap:
                print(f"✅ Activity found in FAISS index")
            else:
                print(f"❌ Activity NOT found in FAISS index")
                print(f"   Available IDs sample (first 10): {list(recsys.idmap[:min(10, len(recsys.idmap))])}")
                print(f"   Total routes in index: {len(recsys.idmap)}")
        
        items = recsys.search_by_activity(
            activity_id_for_search, 
            req.k,
            strategy=req.strategy,
            lambda_diversity=req.lambda_diversity
        )
        
        if not items:
            print(f"⚠️  No recommendations returned for {activity_id_for_search}")
        else:
            print(f"✅ Found {len(items)} recommendations")
            
    except Exception as e:
        import traceback
        print(f"❌ Recommendation error: {str(e)}")
        traceback.print_exc()
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

@router.get("/debug/index-info")
def get_index_info():
    """Debug endpoint: Get information about the FAISS index."""
    try:
        recsys.ensure_ready()
        
        if recsys.index is None or recsys.idmap is None:
            return {
                "status": "not_loaded",
                "message": "FAISS index not loaded"
            }
        
        # Get sample IDs
        sample_ids = list(recsys.idmap[:min(20, len(recsys.idmap))])
        
        # Get statistics
        total_routes = len(recsys.idmap)
        index_size = recsys.index.ntotal if recsys.index else 0
        
        # Get unique users
        users = set()
        for route_id in recsys.idmap:
            if '_' in str(route_id):
                user = str(route_id).split('_')[0]
                users.add(user)
        
        return {
            "status": "loaded",
            "total_routes": total_routes,
            "index_size": index_size,
            "unique_users": len(users),
            "sample_users": list(users)[:10],
            "sample_route_ids": sample_ids,
            "modelcard": recsys.modelcard if hasattr(recsys, 'modelcard') else {}
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }

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


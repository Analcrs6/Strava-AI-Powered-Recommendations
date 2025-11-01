from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from ..schemas import RecommendRequest, RecommendResponse, RecommendItem, RouteMetadata
from ..services.recommender import recsys
from ..config import settings
from ..db import get_db
from .. import models

router = APIRouter(prefix="/recommend", tags=["recommend"])

@router.post("", response_model=RecommendResponse)
def recommend(req: RecommendRequest, db: Session = Depends(get_db)):
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
    valid_strategies = ["content", "content_mmr", "ensemble", "ensemble_mmr", "popularity"]
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
        print(f"⚙️  Strategy: {req.strategy}, Lambda: {req.lambda_diversity}, K: {req.k}")
        
        # Debug: Check if activity exists in FAISS index
        recsys.ensure_ready()
        activity_in_index = False
        if recsys.idmap is not None:
            import numpy as np
            if activity_id_for_search in recsys.idmap:
                print(f"✅ Activity found in FAISS index")
                activity_in_index = True
            else:
                print(f"❌ Activity NOT found in FAISS index")
                print(f"   Available IDs sample (first 10): {list(recsys.idmap[:min(10, len(recsys.idmap))])}")
                print(f"   Total routes in index: {len(recsys.idmap)}")
        
        # If activity not in index, try to search by features (for real user activities)
        if not activity_in_index:
            print(f"🔍 Activity not in index, searching for it in main database...")
            activity = db.query(models.Activity).filter(
                models.Activity.id == req.activity_id
            ).first()
            
            if activity:
                print(f"✅ Found activity in database: {activity.id}")
                print(f"   Features: distance={activity.distance_m}m, duration={activity.duration_s}s, elevation={activity.elevation_gain_m}m, hr={activity.hr_avg}bpm")
                
                # Extract features and compute recommendations using feature vector
                # Search in main database, not the demo FAISS index
                items = recsys.search_by_activity_features(
                    distance_m=activity.distance_m,
                    duration_s=activity.duration_s,
                    elevation_gain_m=activity.elevation_gain_m or 0.0,
                    hr_avg=activity.hr_avg or 0.0,
                    k=req.k,
                    strategy=req.strategy,
                    lambda_diversity=req.lambda_diversity,
                    db_session=db,
                    exclude_activity_id=activity.id
                )
                print(f"📊 Found {len(items)} recommendations using feature-based search")
            else:
                print(f"❌ Activity not found in main database either")
                raise HTTPException(404, f"Activity {req.activity_id} not found in index or database")
        else:
            # Activity in index, use normal search
            items = recsys.search_by_activity(
                activity_id_for_search, 
                req.k,
                strategy=req.strategy,
                lambda_diversity=req.lambda_diversity
            )
        
        print(f"📊 Returned {len(items)} items using strategy: {req.strategy}")
        
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
        "evaluation_notes": get_strategy_performance(req.strategy),
        "query_route_id": activity_id_for_search
    }
    
    # Filter out seen routes if requested
    filtered_items = items
    seen_routes = set()
    
    if req.exclude_seen and req.user_id:
        try:
            # Get user's activity history
            user_activities = db.query(models.Activity).filter(
                models.Activity.user_id == req.user_id
            ).all()
            
            # Extract route IDs from activity IDs (format: userid_routeid or just routeid)
            for activity in user_activities:
                act_id = activity.id
                # Extract route ID
                if "_" in act_id:
                    parts = act_id.split("_")
                    for part in parts:
                        if part.startswith("R") or part.isdigit():
                            seen_routes.add(part)
                            break
                else:
                    seen_routes.add(act_id)
            
            print(f"🚫 Filtering {len(seen_routes)} seen routes for user {req.user_id}")
            
            # Filter recommendations
            filtered_items = [(aid, score) for aid, score in items if aid not in seen_routes]
            
            if len(filtered_items) < len(items):
                print(f"   Filtered: {len(items)} → {len(filtered_items)} recommendations")
        except Exception as e:
            print(f"⚠️  Error filtering seen routes: {e}")
            # Continue with unfiltered results
    
    # Enrich items with route metadata
    enriched_items = []
    for activity_id, score in filtered_items:
        route_meta = recsys.get_route_metadata(activity_id)
        if route_meta:
            enriched_items.append(RecommendItem(
                activity_id=activity_id,
                score=score,
                metadata=RouteMetadata(**route_meta)
            ))
        else:
            enriched_items.append(RecommendItem(activity_id=activity_id, score=score))
    
    # Update metadata
    if req.exclude_seen:
        metadata["filtered_seen_count"] = len(items) - len(filtered_items)
        metadata["seen_routes"] = list(seen_routes)[:5]  # Sample of seen routes
    
    return RecommendResponse(
        items=enriched_items,
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

@router.post("/next-activity")
def recommend_next_activity(
    user_id: str,
    top_k: int = 10,
    strategy: str = "content_mmr",
    lambda_diversity: float = 0.3,
    db: Session = Depends(get_db)
):
    """
    Recommend the NEXT activity to do based on user's activity history.
    This is predictive - suggests what to do next based on patterns.
    """
    try:
        # Get user's recent activities (last 10)
        user_activities = db.query(models.Activity).filter(
            models.Activity.user_id == user_id
        ).order_by(models.Activity.created_at.desc()).limit(10).all()
        
        if not user_activities:
            # No history - return popular routes
            print(f"🔍 No activity history for user {user_id}, returning popular routes")
            return recommend(RecommendRequest(
                activity_id=None,
                top_k=top_k,
                strategy="popularity",
                lambda_diversity=lambda_diversity,
                exclude_seen=False,
                user_id=user_id
            ), db)
        
        # Get the most recent activity
        last_activity = user_activities[0]
        print(f"🎯 Predicting next activity based on last activity: {last_activity.id}")
        
        # Calculate average stats from user history to understand their patterns
        avg_distance = sum(a.distance_m for a in user_activities) / len(user_activities)
        avg_elevation = sum(a.elevation_gain_m or 0 for a in user_activities) / len(user_activities)
        
        # Get sport preferences (what they do most)
        sport_counts = {}
        for activity in user_activities:
            sport = activity.sport
            sport_counts[sport] = sport_counts.get(sport, 0) + 1
        preferred_sport = max(sport_counts, key=sport_counts.get)
        
        print(f"📊 User patterns: avg_distance={avg_distance:.0f}m, avg_elevation={avg_elevation:.0f}m, preferred_sport={preferred_sport}")
        
        # Get recommendations based on last activity but filter to similar difficulty/length
        recommendations = recommend(RecommendRequest(
            activity_id=last_activity.id,
            top_k=top_k * 3,  # Get more to filter
            strategy=strategy,
            lambda_diversity=lambda_diversity,
            exclude_seen=True,  # Always exclude seen for next activity
            user_id=user_id
        ), db)
        
        # Filter recommendations to match user's typical pattern
        # Look for routes that are:
        # - Similar sport type (or progression to harder variants)
        # - Within reasonable range of their average (not too easy, not too hard)
        filtered_recs = []
        for rec in recommendations.items:
            if rec.metadata:
                # Check if distance is within 50% to 150% of their average
                rec_distance = rec.metadata.distance_km * 1000
                if avg_distance * 0.5 <= rec_distance <= avg_distance * 1.5:
                    filtered_recs.append(rec)
        
        # If we filtered too much, use all recommendations
        if len(filtered_recs) < top_k:
            filtered_recs = recommendations.items
        
        # Take top K
        final_recs = filtered_recs[:top_k]
        
        print(f"✅ Returning {len(final_recs)} next activity recommendations")
        
        return RecommendResponse(
            items=final_recs,
            metadata={
                "strategy": "next_activity",
                "based_on": last_activity.id,
                "user_pattern": {
                    "avg_distance_m": int(avg_distance),
                    "avg_elevation_m": int(avg_elevation),
                    "preferred_sport": preferred_sport,
                    "total_activities": len(user_activities)
                },
                "description": f"Predicted next activities based on your recent {len(user_activities)} workouts"
            }
        )
        
    except Exception as e:
        print(f"❌ Error in next activity recommendation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Failed to generate next activity recommendations: {str(e)}")


@router.get("/strategies")
def get_strategies():
    """Get information about available recommendation strategies."""
    # Get model config
    config = recsys.get_config()
    modelcard = config.get('modelcard', {})
    
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
                "name": "popularity",
                "display_name": "Popularity",
                "description": "Recommends popular routes based on usage frequency",
                "speed": "fastest",
                "quality": "cold-start friendly",
                "use_case": "New users, exploration"
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
        "model_info": {
            "name": modelcard.get('model_name', 'Unknown'),
            "version": modelcard.get('version', '1.0.0'),
            "total_routes": config.get('total_routes', 0),
            "has_popularity": config.get('has_popularity', False),
            "has_metadata": config.get('has_metadata', False)
        },
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
        "content_mmr": "Similarity-based with diversity optimization via MMR reranking (⭐ Recommended)",
        "ensemble": "Hybrid content-based and collaborative filtering",
        "ensemble_mmr": "Hybrid approach with diversity optimization",
        "popularity": "Popularity-based recommendations (cold-start/fallback)"
    }
    return descriptions.get(strategy, "Unknown strategy")

def get_strategy_performance(strategy: str) -> str:
    # Load actual metrics from modelcard if available
    config = recsys.get_config()
    metrics = config.get('modelcard', {}).get('evaluation_metrics', {})
    
    if metrics and strategy in ["content", "content_mmr"]:
        recall = metrics.get('recall_at_10', 0)
        map_score = metrics.get('map_at_10', 0)
        return f"Recall@10: {recall:.3f}, MAP@10: {map_score:.3f}"
    
    notes = {
        "content": "Baseline performance. Fast but may return similar/redundant results.",
        "content_mmr": "Best MAP and NDCG. Balanced relevance and diversity. ⭐ Recommended",
        "ensemble": "Modest improvements over baseline. Better with more user data.",
        "ensemble_mmr": "Best Recall. Finds more relevant items overall.",
        "popularity": "Good for cold-start, explores popular routes"
    }
    return notes.get(strategy, "")


"""
Analytics Router
Track and analyze recommendation performance and user behavior
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List
from datetime import datetime, timedelta
from ..db import get_db
from .. import models
from ..auth import get_current_user
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


class RecommendationClickLog(BaseModel):
    """Log a recommendation click."""
    query_activity_id: str
    recommended_activity_id: str
    strategy: str
    rank: int
    score: float
    lambda_diversity: Optional[float] = None


class ABTestMetrics(BaseModel):
    """A/B test metrics."""
    experiment_name: str
    variant: str
    total_users: int
    total_recommendations: int
    avg_click_rate: float
    avg_completion_rate: float


@router.post("/log/click")
async def log_recommendation_click(
    log: RecommendationClickLog,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log that a user clicked on a recommendation."""
    log_entry = models.RecommendationLog(
        user_id=current_user.id,
        query_activity_id=log.query_activity_id,
        recommended_activity_id=log.recommended_activity_id,
        strategy=log.strategy,
        lambda_diversity=log.lambda_diversity,
        score=log.score,
        rank=log.rank,
        clicked=True,
        ab_test_group=current_user.ab_test_group
    )
    
    db.add(log_entry)
    db.commit()
    
    logger.info(
        f"📊 Recommendation click logged: {current_user.id} -> "
        f"{log.recommended_activity_id} (strategy: {log.strategy}, rank: {log.rank})"
    )
    
    return {"success": True, "message": "Click logged"}


@router.post("/log/completion/{activity_id}")
async def log_activity_completion(
    activity_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark that a user completed a recommended activity."""
    # Update all logs where this was recommended to this user
    updated = db.query(models.RecommendationLog).filter(
        models.RecommendationLog.user_id == current_user.id,
        models.RecommendationLog.recommended_activity_id == activity_id,
        models.RecommendationLog.clicked == True
    ).update({"completed": True})
    
    db.commit()
    
    if updated > 0:
        logger.info(f"✅ Activity completion logged: {current_user.id} completed {activity_id}")
    
    return {"success": True, "completed_logs": updated}


@router.get("/strategy-performance")
async def get_strategy_performance(
    days: int = Query(default=7, ge=1, le=90),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get performance metrics for different recommendation strategies."""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Query strategy performance
    results = db.query(
        models.RecommendationLog.strategy,
        func.count(models.RecommendationLog.id).label('total_recommendations'),
        func.sum(func.cast(models.RecommendationLog.clicked, Integer)).label('total_clicks'),
        func.sum(func.cast(models.RecommendationLog.completed, Integer)).label('total_completions'),
        func.avg(models.RecommendationLog.score).label('avg_score')
    ).filter(
        models.RecommendationLog.created_at >= cutoff_date
    ).group_by(
        models.RecommendationLog.strategy
    ).all()
    
    # Calculate metrics
    performance = []
    for row in results:
        click_rate = (row.total_clicks / row.total_recommendations * 100) if row.total_recommendations > 0 else 0
        completion_rate = (row.total_completions / row.total_clicks * 100) if row.total_clicks and row.total_clicks > 0 else 0
        
        performance.append({
            "strategy": row.strategy,
            "total_recommendations": row.total_recommendations,
            "total_clicks": row.total_clicks or 0,
            "total_completions": row.total_completions or 0,
            "click_rate": round(click_rate, 2),
            "completion_rate": round(completion_rate, 2),
            "avg_score": round(float(row.avg_score), 4) if row.avg_score else 0
        })
    
    return {
        "period_days": days,
        "strategies": performance
    }


@router.get("/ab-test-results")
async def get_ab_test_results(
    experiment_name: str = "ensemble_vs_content_mmr",
    days: int = Query(default=7, ge=1, le=90),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get A/B test results comparing strategies."""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Get experiment
    experiment = db.query(models.ABTestExperiment).filter(
        models.ABTestExperiment.name == experiment_name
    ).first()
    
    if not experiment:
        raise HTTPException(404, "Experiment not found")
    
    # Query results by A/B group
    results = db.query(
        models.RecommendationLog.ab_test_group,
        func.count(func.distinct(models.RecommendationLog.user_id)).label('unique_users'),
        func.count(models.RecommendationLog.id).label('total_recommendations'),
        func.sum(func.cast(models.RecommendationLog.clicked, Integer)).label('total_clicks'),
        func.sum(func.cast(models.RecommendationLog.completed, Integer)).label('total_completions')
    ).filter(
        models.RecommendationLog.created_at >= cutoff_date,
        models.RecommendationLog.ab_test_group.in_(['A', 'B'])
    ).group_by(
        models.RecommendationLog.ab_test_group
    ).all()
    
    # Calculate metrics for each variant
    metrics = []
    for row in results:
        click_rate = (row.total_clicks / row.total_recommendations * 100) if row.total_recommendations > 0 else 0
        completion_rate = (row.total_completions / row.total_clicks * 100) if row.total_clicks and row.total_clicks > 0 else 0
        
        variant_strategy = experiment.variants.get(row.ab_test_group, "unknown")
        
        metrics.append({
            "variant": row.ab_test_group,
            "strategy": variant_strategy,
            "unique_users": row.unique_users,
            "total_recommendations": row.total_recommendations,
            "total_clicks": row.total_clicks or 0,
            "total_completions": row.total_completions or 0,
            "click_rate": round(click_rate, 2),
            "completion_rate": round(completion_rate, 2)
        })
    
    # Calculate winner (if significant difference)
    if len(metrics) == 2:
        diff = abs(metrics[0]['click_rate'] - metrics[1]['click_rate'])
        winner = None
        if diff > 5:  # 5% difference threshold
            winner = max(metrics, key=lambda x: x['click_rate'])['variant']
        
        return {
            "experiment": experiment_name,
            "period_days": days,
            "variants": metrics,
            "winner": winner,
            "difference_percentage": round(diff, 2) if len(metrics) == 2 else 0
        }
    
    return {
        "experiment": experiment_name,
        "period_days": days,
        "variants": metrics
    }


@router.get("/user-insights")
async def get_user_insights(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get personalized insights for the current user."""
    # Get user's activity count
    activity_count = db.query(func.count(models.Activity.id)).filter(
        models.Activity.user_id == current_user.id
    ).scalar()
    
    # Get favorite sport
    favorite_sport = db.query(
        models.Activity.sport,
        func.count(models.Activity.id).label('count')
    ).filter(
        models.Activity.user_id == current_user.id
    ).group_by(
        models.Activity.sport
    ).order_by(
        desc('count')
    ).first()
    
    # Get total distance
    total_distance = db.query(
        func.sum(models.Activity.distance_m)
    ).filter(
        models.Activity.user_id == current_user.id
    ).scalar() or 0
    
    # Get recommendation stats
    rec_stats = db.query(
        func.count(models.RecommendationLog.id).label('total_viewed'),
        func.sum(func.cast(models.RecommendationLog.clicked, Integer)).label('total_clicked'),
        func.sum(func.cast(models.RecommendationLog.completed, Integer)).label('total_completed')
    ).filter(
        models.RecommendationLog.user_id == current_user.id
    ).first()
    
    return {
        "user_id": current_user.id,
        "activities": {
            "total_count": activity_count,
            "total_distance_km": round(total_distance / 1000, 2),
            "favorite_sport": favorite_sport.sport if favorite_sport else None
        },
        "recommendations": {
            "total_viewed": rec_stats.total_viewed if rec_stats else 0,
            "total_clicked": rec_stats.total_clicked or 0 if rec_stats else 0,
            "total_completed": rec_stats.total_completed or 0 if rec_stats else 0,
            "click_rate": round((rec_stats.total_clicked or 0) / rec_stats.total_viewed * 100, 2) if rec_stats and rec_stats.total_viewed > 0 else 0
        },
        "ab_test_group": current_user.ab_test_group,
        "preferred_strategy": current_user.preferred_strategy
    }


"""
Redis Caching Layer for Performance Optimization
Caches expensive operations like collaborative filtering scores
"""
import json
import pickle
from typing import Optional, Any, Dict
import logging
from .config import settings

logger = logging.getLogger(__name__)

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis not available. Install with: pip install redis")

class CacheService:
    """Service for caching expensive computations."""
    
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        self.enabled = REDIS_AVAILABLE
        self.client = None
        
        if REDIS_AVAILABLE:
            try:
                self.client = redis.Redis(
                    host=host,
                    port=port,
                    db=db,
                    decode_responses=False  # We'll handle encoding
                )
                # Test connection
                self.client.ping()
                logger.info(f"✅ Redis cache connected: {host}:{port}")
            except Exception as e:
                logger.warning(f"⚠️  Redis connection failed: {e}. Caching disabled.")
                self.enabled = False
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.enabled or not self.client:
            return None
        
        try:
            value = self.client.get(key)
            if value is None:
                return None
            
            # Try to unpickle
            try:
                return pickle.loads(value)
            except:
                # Fall back to JSON
                return json.loads(value.decode('utf-8'))
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 3600):
        """
        Set value in cache with TTL (time to live in seconds).
        Default TTL: 1 hour
        """
        if not self.enabled or not self.client:
            return False
        
        try:
            # Try to pickle (works for numpy arrays, dicts, etc.)
            try:
                serialized = pickle.dumps(value)
            except:
                # Fall back to JSON
                serialized = json.dumps(value).encode('utf-8')
            
            self.client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    def delete(self, key: str):
        """Delete key from cache."""
        if not self.enabled or not self.client:
            return False
        
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    def clear_pattern(self, pattern: str):
        """Delete all keys matching pattern (e.g., 'collab:*')."""
        if not self.enabled or not self.client:
            return 0
        
        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Cache clear pattern error for {pattern}: {e}")
            return 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self.enabled or not self.client:
            return {"enabled": False}
        
        try:
            info = self.client.info()
            return {
                "enabled": True,
                "used_memory": info.get("used_memory_human"),
                "total_keys": info.get("db0", {}).get("keys", 0),
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
            }
        except Exception as e:
            logger.error(f"Cache stats error: {e}")
            return {"enabled": True, "error": str(e)}


# Global cache instance
cache = CacheService(
    host=settings.redis_host,
    port=settings.redis_port,
    db=settings.redis_db
)


# Cache key generators
def collab_cache_key(route_id: str) -> str:
    """Generate cache key for collaborative filtering scores."""
    return f"collab:{route_id}"


def recommendation_cache_key(
    activity_id: str, 
    strategy: str, 
    k: int, 
    lambda_div: float = None
) -> str:
    """Generate cache key for recommendations."""
    if lambda_div is not None:
        return f"rec:{activity_id}:{strategy}:{k}:{lambda_div:.2f}"
    return f"rec:{activity_id}:{strategy}:{k}"


def user_profile_cache_key(user_id: str) -> str:
    """Generate cache key for user profile."""
    return f"user:{user_id}"


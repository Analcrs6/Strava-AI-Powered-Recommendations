"""
Location Caching Service
Provides Redis-based caching for location data and map tiles.
Includes fallback to in-memory cache if Redis is unavailable.
"""
import json
import time
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
import hashlib


class InMemoryCache:
    """Simple in-memory cache as fallback"""
    
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 300):
        self.cache: Dict[str, tuple] = {}  # key -> (value, expiry_time)
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if key in self.cache:
            value, expiry = self.cache[key]
            if time.time() < expiry:
                return value
            else:
                del self.cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set value in cache"""
        if len(self.cache) >= self.max_size:
            # Simple LRU: remove oldest entries
            sorted_keys = sorted(self.cache.keys(), key=lambda k: self.cache[k][1])
            for old_key in sorted_keys[:self.max_size // 4]:
                del self.cache[old_key]
        
        expiry_time = time.time() + (ttl or self.ttl_seconds)
        self.cache[key] = (value, expiry_time)
    
    def delete(self, key: str):
        """Delete value from cache"""
        self.cache.pop(key, None)
    
    def clear(self):
        """Clear all cache"""
        self.cache.clear()
    
    def size(self) -> int:
        """Get cache size"""
        return len(self.cache)


class LocationCache:
    """
    Location caching service with Redis backend and in-memory fallback.
    Caches location queries, distance calculations, and nearby user searches.
    """
    
    def __init__(self, redis_client=None, enable_memory_cache: bool = True):
        """
        Initialize location cache.
        
        Args:
            redis_client: Optional Redis client. If None, uses in-memory cache.
            enable_memory_cache: Enable in-memory cache as fallback
        """
        self.redis = redis_client
        self.memory_cache = InMemoryCache() if enable_memory_cache else None
        self.stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'errors': 0
        }
    
    def _make_key(self, prefix: str, *args) -> str:
        """Create cache key from prefix and arguments"""
        key_parts = [str(arg) for arg in args]
        key_str = ':'.join([prefix] + key_parts)
        
        # Hash if key is too long
        if len(key_str) > 200:
            key_hash = hashlib.md5(key_str.encode()).hexdigest()
            return f"{prefix}:{key_hash}"
        
        return key_str
    
    def _get(self, key: str) -> Optional[Any]:
        """Get value from cache (Redis or memory)"""
        try:
            # Try Redis first
            if self.redis:
                value = self.redis.get(key)
                if value:
                    self.stats['hits'] += 1
                    return json.loads(value)
            
            # Fallback to memory cache
            if self.memory_cache:
                value = self.memory_cache.get(key)
                if value:
                    self.stats['hits'] += 1
                    return value
            
            self.stats['misses'] += 1
            return None
        except Exception as e:
            print(f"⚠️  Cache get error: {e}")
            self.stats['errors'] += 1
            return None
    
    def _set(self, key: str, value: Any, ttl: int = 300):
        """Set value in cache (Redis and memory)"""
        try:
            json_value = json.dumps(value)
            
            # Set in Redis
            if self.redis:
                self.redis.setex(key, ttl, json_value)
            
            # Set in memory cache as backup
            if self.memory_cache:
                self.memory_cache.set(key, value, ttl)
            
            self.stats['sets'] += 1
        except Exception as e:
            print(f"⚠️  Cache set error: {e}")
            self.stats['errors'] += 1
    
    def _delete(self, key: str):
        """Delete value from cache"""
        try:
            if self.redis:
                self.redis.delete(key)
            if self.memory_cache:
                self.memory_cache.delete(key)
        except Exception as e:
            print(f"⚠️  Cache delete error: {e}")
            self.stats['errors'] += 1
    
    def get_user_location(self, user_id: str) -> Optional[Dict]:
        """
        Get cached user location.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict with location data or None
        """
        key = self._make_key('user_location', user_id)
        return self._get(key)
    
    def set_user_location(
        self, 
        user_id: str, 
        latitude: float, 
        longitude: float,
        accuracy: Optional[float] = None,
        source: Optional[str] = None,
        ttl: int = 300
    ):
        """
        Cache user location.
        
        Args:
            user_id: User ID
            latitude: Latitude
            longitude: Longitude
            accuracy: Location accuracy in meters
            source: Location source ('gps', 'network', 'manual')
            ttl: Time to live in seconds
        """
        key = self._make_key('user_location', user_id)
        value = {
            'user_id': user_id,
            'latitude': latitude,
            'longitude': longitude,
            'accuracy': accuracy,
            'source': source,
            'timestamp': datetime.utcnow().isoformat()
        }
        self._set(key, value, ttl)
    
    def get_distance(
        self, 
        lat1: float, 
        lon1: float, 
        lat2: float, 
        lon2: float
    ) -> Optional[float]:
        """
        Get cached distance calculation.
        
        Args:
            lat1, lon1: First coordinate
            lat2, lon2: Second coordinate
            
        Returns:
            Distance in meters or None
        """
        # Round coordinates to reduce cache misses from minor differences
        lat1_r = round(lat1, 6)
        lon1_r = round(lon1, 6)
        lat2_r = round(lat2, 6)
        lon2_r = round(lon2, 6)
        
        key = self._make_key('distance', lat1_r, lon1_r, lat2_r, lon2_r)
        result = self._get(key)
        return result['distance'] if result else None
    
    def set_distance(
        self,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float,
        distance: float,
        ttl: int = 3600  # 1 hour (distances don't change)
    ):
        """
        Cache distance calculation.
        
        Args:
            lat1, lon1: First coordinate
            lat2, lon2: Second coordinate
            distance: Distance in meters
            ttl: Time to live in seconds
        """
        lat1_r = round(lat1, 6)
        lon1_r = round(lon1, 6)
        lat2_r = round(lat2, 6)
        lon2_r = round(lon2, 6)
        
        key = self._make_key('distance', lat1_r, lon1_r, lat2_r, lon2_r)
        value = {
            'distance': distance,
            'timestamp': datetime.utcnow().isoformat()
        }
        self._set(key, value, ttl)
    
    def get_nearby_users(
        self,
        user_id: str,
        max_distance_meters: float
    ) -> Optional[List[Dict]]:
        """
        Get cached nearby users result.
        
        Args:
            user_id: User ID
            max_distance_meters: Maximum distance
            
        Returns:
            List of nearby users or None
        """
        key = self._make_key('nearby_users', user_id, int(max_distance_meters))
        return self._get(key)
    
    def set_nearby_users(
        self,
        user_id: str,
        max_distance_meters: float,
        nearby_users: List[Dict],
        ttl: int = 30  # 30 seconds (locations change frequently)
    ):
        """
        Cache nearby users result.
        
        Args:
            user_id: User ID
            max_distance_meters: Maximum distance
            nearby_users: List of nearby users
            ttl: Time to live in seconds
        """
        key = self._make_key('nearby_users', user_id, int(max_distance_meters))
        value = {
            'users': nearby_users,
            'timestamp': datetime.utcnow().isoformat()
        }
        self._set(key, value, ttl)
    
    def invalidate_user(self, user_id: str):
        """
        Invalidate all cache entries for a user.
        Called when user location is updated.
        
        Args:
            user_id: User ID
        """
        # Delete user location
        self._delete(self._make_key('user_location', user_id))
        
        # Note: Can't easily invalidate nearby_users without scanning all keys
        # In production, use Redis SCAN or maintain a set of related keys
    
    def get_stats(self) -> Dict[str, int]:
        """Get cache statistics"""
        total_requests = self.stats['hits'] + self.stats['misses']
        hit_rate = (self.stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            **self.stats,
            'total_requests': total_requests,
            'hit_rate_percent': round(hit_rate, 2),
            'memory_cache_size': self.memory_cache.size() if self.memory_cache else 0
        }
    
    def clear_all(self):
        """Clear all cache"""
        try:
            if self.redis:
                # In production, be careful with FLUSHDB
                # Consider using key pattern scanning instead
                pass
            
            if self.memory_cache:
                self.memory_cache.clear()
        except Exception as e:
            print(f"⚠️  Cache clear error: {e}")


# Singleton instance
_cache_instance: Optional[LocationCache] = None


def get_location_cache(redis_client=None) -> LocationCache:
    """Get singleton location cache instance"""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = LocationCache(redis_client=redis_client)
    return _cache_instance


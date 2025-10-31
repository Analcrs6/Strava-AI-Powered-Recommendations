"""
High-Precision Distance Calculation Service
Uses Vincenty's formula for sub-meter accuracy in distance calculations.
Includes location validation, movement filtering, and caching.
"""
import math
from typing import Tuple, Optional, Dict, List
from datetime import datetime, timedelta
from decimal import Decimal
from dataclasses import dataclass
from functools import lru_cache


@dataclass
class Coordinate:
    """High-precision coordinate with validation"""
    latitude: Decimal
    longitude: Decimal
    accuracy: Optional[Decimal] = None
    timestamp: Optional[datetime] = None
    source: Optional[str] = None
    
    def __post_init__(self):
        """Validate coordinates"""
        self.latitude = Decimal(str(self.latitude))
        self.longitude = Decimal(str(self.longitude))
        
        if not (-90 <= self.latitude <= 90):
            raise ValueError(f"Latitude must be between -90 and 90, got {self.latitude}")
        if not (-180 <= self.longitude <= 180):
            raise ValueError(f"Longitude must be between -180 and 180, got {self.longitude}")
        
        if self.accuracy is not None:
            self.accuracy = Decimal(str(self.accuracy))
            if self.accuracy < 0:
                raise ValueError(f"Accuracy must be non-negative, got {self.accuracy}")
    
    def to_float(self) -> Tuple[float, float]:
        """Convert to float tuple for calculations"""
        return (float(self.latitude), float(self.longitude))
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            'latitude': float(self.latitude),
            'longitude': float(self.longitude),
            'accuracy': float(self.accuracy) if self.accuracy else None,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'source': self.source
        }


@dataclass
class MovementValidation:
    """Result of movement validation"""
    is_valid: bool
    distance_meters: float
    time_seconds: Optional[int] = None
    speed_mps: Optional[float] = None
    reason: Optional[str] = None


class PrecisionDistanceCalculator:
    """
    High-precision distance calculator using Vincenty's formula.
    Provides sub-meter accuracy for distances up to ~20,000 km.
    """
    
    # WGS-84 ellipsoid parameters
    SEMI_MAJOR_AXIS = 6378137.0  # meters (equatorial radius)
    SEMI_MINOR_AXIS = 6356752.314245  # meters (polar radius)
    FLATTENING = 1 / 298.257223563
    
    # Movement validation thresholds
    MAX_SPEED_MPS = 150.0  # ~540 km/h (faster than commercial plane)
    MIN_SIGNIFICANT_MOVEMENT = 1.0  # 1 meter minimum for meaningful movement
    
    def __init__(self, cache_enabled: bool = True):
        """
        Initialize the distance calculator.
        
        Args:
            cache_enabled: Enable caching for repeated calculations
        """
        self.cache_enabled = cache_enabled
        self._distance_cache: Dict[Tuple, float] = {}
    
    def calculate_distance(
        self,
        coord1: Coordinate,
        coord2: Coordinate,
        use_vincenty: bool = True
    ) -> float:
        """
        Calculate distance between two coordinates.
        
        Args:
            coord1: First coordinate
            coord2: Second coordinate
            use_vincenty: Use Vincenty's formula (True) or Haversine (False)
        
        Returns:
            Distance in meters
        """
        # Check cache if enabled
        if self.cache_enabled:
            cache_key = (
                float(coord1.latitude), float(coord1.longitude),
                float(coord2.latitude), float(coord2.longitude),
                use_vincenty
            )
            if cache_key in self._distance_cache:
                return self._distance_cache[cache_key]
        
        if use_vincenty:
            distance = self._vincenty_distance(coord1, coord2)
        else:
            distance = self._haversine_distance(coord1, coord2)
        
        # Cache result
        if self.cache_enabled:
            self._distance_cache[cache_key] = distance
        
        return distance
    
    def _vincenty_distance(self, coord1: Coordinate, coord2: Coordinate) -> float:
        """
        Calculate distance using Vincenty's inverse formula.
        Accurate to within 0.5mm for the WGS-84 ellipsoid.
        
        Reference: T. Vincenty, "Direct and Inverse Solutions of Geodesics on the 
        Ellipsoid with Application of Nested Equations", Survey Review, 1975
        """
        lat1, lon1 = coord1.to_float()
        lat2, lon2 = coord2.to_float()
        
        # Convert to radians
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        lon1_rad = math.radians(lon1)
        lon2_rad = math.radians(lon2)
        
        # Check for identical coordinates
        if lat1 == lat2 and lon1 == lon2:
            return 0.0
        
        # Difference in longitude
        L = lon2_rad - lon1_rad
        
        # Reduced latitude (latitude on the auxiliary sphere)
        U1 = math.atan((1 - self.FLATTENING) * math.tan(lat1_rad))
        U2 = math.atan((1 - self.FLATTENING) * math.tan(lat2_rad))
        
        sin_U1 = math.sin(U1)
        cos_U1 = math.cos(U1)
        sin_U2 = math.sin(U2)
        cos_U2 = math.cos(U2)
        
        # Iterative calculation
        lambda_val = L
        lambda_prev = 0
        iteration = 0
        max_iterations = 1000
        convergence_threshold = 1e-12
        
        while iteration < max_iterations:
            sin_lambda = math.sin(lambda_val)
            cos_lambda = math.cos(lambda_val)
            
            sin_sigma = math.sqrt(
                (cos_U2 * sin_lambda) ** 2 +
                (cos_U1 * sin_U2 - sin_U1 * cos_U2 * cos_lambda) ** 2
            )
            
            if sin_sigma == 0:
                return 0.0  # Co-incident points
            
            cos_sigma = sin_U1 * sin_U2 + cos_U1 * cos_U2 * cos_lambda
            sigma = math.atan2(sin_sigma, cos_sigma)
            
            sin_alpha = cos_U1 * cos_U2 * sin_lambda / sin_sigma
            cos_sq_alpha = 1 - sin_alpha ** 2
            
            if cos_sq_alpha != 0:
                cos_2sigma_m = cos_sigma - 2 * sin_U1 * sin_U2 / cos_sq_alpha
            else:
                cos_2sigma_m = 0
            
            C = self.FLATTENING / 16 * cos_sq_alpha * (4 + self.FLATTENING * (4 - 3 * cos_sq_alpha))
            
            lambda_prev = lambda_val
            lambda_val = L + (1 - C) * self.FLATTENING * sin_alpha * (
                sigma + C * sin_sigma * (
                    cos_2sigma_m + C * cos_sigma * (-1 + 2 * cos_2sigma_m ** 2)
                )
            )
            
            # Check for convergence
            if abs(lambda_val - lambda_prev) < convergence_threshold:
                break
            
            iteration += 1
        
        if iteration >= max_iterations:
            # Fallback to Haversine if Vincenty doesn't converge
            return self._haversine_distance(coord1, coord2)
        
        # Calculate distance
        u_sq = cos_sq_alpha * (self.SEMI_MAJOR_AXIS ** 2 - self.SEMI_MINOR_AXIS ** 2) / (self.SEMI_MINOR_AXIS ** 2)
        A = 1 + u_sq / 16384 * (4096 + u_sq * (-768 + u_sq * (320 - 175 * u_sq)))
        B = u_sq / 1024 * (256 + u_sq * (-128 + u_sq * (74 - 47 * u_sq)))
        
        delta_sigma = B * sin_sigma * (
            cos_2sigma_m + B / 4 * (
                cos_sigma * (-1 + 2 * cos_2sigma_m ** 2) -
                B / 6 * cos_2sigma_m * (-3 + 4 * sin_sigma ** 2) * (-3 + 4 * cos_2sigma_m ** 2)
            )
        )
        
        distance = self.SEMI_MINOR_AXIS * A * (sigma - delta_sigma)
        
        return distance
    
    def _haversine_distance(self, coord1: Coordinate, coord2: Coordinate) -> float:
        """
        Calculate distance using Haversine formula (spherical Earth).
        Faster but less accurate (~0.3% error) than Vincenty.
        """
        lat1, lon1 = coord1.to_float()
        lat2, lon2 = coord2.to_float()
        
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        distance = R * c
        return distance
    
    def validate_movement(
        self,
        previous: Coordinate,
        current: Coordinate,
        max_speed_override: Optional[float] = None
    ) -> MovementValidation:
        """
        Validate movement between two locations.
        
        Args:
            previous: Previous location
            current: Current location
            max_speed_override: Override maximum speed threshold (m/s)
        
        Returns:
            MovementValidation object with validation results
        """
        max_speed = max_speed_override or self.MAX_SPEED_MPS
        
        # Calculate distance
        distance = self.calculate_distance(previous, current)
        
        # If no timestamps, can only validate distance
        if not previous.timestamp or not current.timestamp:
            is_valid = distance >= 0  # Basic sanity check
            return MovementValidation(
                is_valid=is_valid,
                distance_meters=distance,
                reason=None if is_valid else "Invalid distance calculation"
            )
        
        # Calculate time difference
        time_delta = current.timestamp - previous.timestamp
        time_seconds = int(time_delta.total_seconds())
        
        # Must be forward in time
        if time_seconds <= 0:
            return MovementValidation(
                is_valid=False,
                distance_meters=distance,
                time_seconds=time_seconds,
                reason="Current timestamp is not after previous timestamp"
            )
        
        # Calculate speed
        speed_mps = distance / time_seconds if time_seconds > 0 else float('inf')
        
        # Check if speed is realistic
        if speed_mps > max_speed:
            return MovementValidation(
                is_valid=False,
                distance_meters=distance,
                time_seconds=time_seconds,
                speed_mps=speed_mps,
                reason=f"Speed {speed_mps:.1f} m/s exceeds maximum {max_speed:.1f} m/s"
            )
        
        # Check for significant movement (avoid GPS noise)
        if distance < self.MIN_SIGNIFICANT_MOVEMENT:
            return MovementValidation(
                is_valid=True,
                distance_meters=distance,
                time_seconds=time_seconds,
                speed_mps=speed_mps,
                reason="Movement too small to be significant (GPS noise)"
            )
        
        return MovementValidation(
            is_valid=True,
            distance_meters=distance,
            time_seconds=time_seconds,
            speed_mps=speed_mps
        )
    
    def is_within_radius(
        self,
        center: Coordinate,
        point: Coordinate,
        radius_meters: float,
        use_vincenty: bool = True
    ) -> Tuple[bool, float]:
        """
        Check if a point is within a radius of a center point.
        
        Args:
            center: Center coordinate
            point: Point to check
            radius_meters: Radius in meters
            use_vincenty: Use Vincenty's formula for accuracy
        
        Returns:
            Tuple of (is_within_radius, actual_distance)
        """
        distance = self.calculate_distance(center, point, use_vincenty=use_vincenty)
        return (distance <= radius_meters, distance)
    
    def find_nearest(
        self,
        center: Coordinate,
        points: List[Tuple[str, Coordinate]],
        max_results: int = 10
    ) -> List[Tuple[str, Coordinate, float]]:
        """
        Find nearest points to a center coordinate.
        
        Args:
            center: Center coordinate
            points: List of (id, coordinate) tuples
            max_results: Maximum number of results to return
        
        Returns:
            List of (id, coordinate, distance) tuples sorted by distance
        """
        distances = []
        for point_id, coord in points:
            distance = self.calculate_distance(center, coord)
            distances.append((point_id, coord, distance))
        
        # Sort by distance
        distances.sort(key=lambda x: x[2])
        
        return distances[:max_results]
    
    def clear_cache(self):
        """Clear the distance calculation cache"""
        self._distance_cache.clear()
    
    def get_cache_stats(self) -> Dict:
        """Get cache statistics"""
        return {
            'enabled': self.cache_enabled,
            'size': len(self._distance_cache),
            'memory_bytes': self._estimate_cache_memory()
        }
    
    def _estimate_cache_memory(self) -> int:
        """Estimate memory usage of cache"""
        # Rough estimate: each cache entry is ~100 bytes
        return len(self._distance_cache) * 100


class MovementFilter:
    """Filter and smooth location updates using movement validation"""
    
    def __init__(
        self,
        max_speed_mps: float = 150.0,
        min_movement_meters: float = 5.0,
        max_history_size: int = 100
    ):
        """
        Initialize movement filter.
        
        Args:
            max_speed_mps: Maximum realistic speed in m/s
            min_movement_meters: Minimum movement to be considered significant
            max_history_size: Maximum number of historical points to keep
        """
        self.max_speed_mps = max_speed_mps
        self.min_movement_meters = min_movement_meters
        self.max_history_size = max_history_size
        self.calculator = PrecisionDistanceCalculator()
        self._history: Dict[str, List[Coordinate]] = {}
    
    def should_accept_update(
        self,
        user_id: str,
        new_location: Coordinate
    ) -> Tuple[bool, Optional[str]]:
        """
        Determine if a location update should be accepted.
        
        Args:
            user_id: User identifier
            new_location: New location to validate
        
        Returns:
            Tuple of (should_accept, reason)
        """
        # Get user's location history
        if user_id not in self._history:
            self._history[user_id] = []
        
        history = self._history[user_id]
        
        # Always accept first location
        if not history:
            self._add_to_history(user_id, new_location)
            return (True, "First location update")
        
        # Get last valid location
        last_location = history[-1]
        
        # Validate movement
        validation = self.calculator.validate_movement(
            last_location,
            new_location,
            max_speed_override=self.max_speed_mps
        )
        
        if not validation.is_valid:
            return (False, validation.reason)
        
        # Check if movement is significant enough
        if validation.distance_meters < self.min_movement_meters:
            return (False, f"Movement {validation.distance_meters:.1f}m below threshold {self.min_movement_meters}m")
        
        # Accept and add to history
        self._add_to_history(user_id, new_location)
        return (True, f"Valid movement: {validation.distance_meters:.1f}m in {validation.time_seconds}s")
    
    def _add_to_history(self, user_id: str, location: Coordinate):
        """Add location to history and maintain size limit"""
        if user_id not in self._history:
            self._history[user_id] = []
        
        self._history[user_id].append(location)
        
        # Trim history if too large
        if len(self._history[user_id]) > self.max_history_size:
            self._history[user_id] = self._history[user_id][-self.max_history_size:]
    
    def get_history(self, user_id: str) -> List[Coordinate]:
        """Get location history for a user"""
        return self._history.get(user_id, []).copy()
    
    def clear_history(self, user_id: Optional[str] = None):
        """Clear location history for a user or all users"""
        if user_id:
            self._history.pop(user_id, None)
        else:
            self._history.clear()


# Singleton instances for application-wide use
_calculator_instance = None
_movement_filter_instance = None


def get_distance_calculator() -> PrecisionDistanceCalculator:
    """Get singleton distance calculator instance"""
    global _calculator_instance
    if _calculator_instance is None:
        _calculator_instance = PrecisionDistanceCalculator(cache_enabled=True)
    return _calculator_instance


def get_movement_filter() -> MovementFilter:
    """Get singleton movement filter instance"""
    global _movement_filter_instance
    if _movement_filter_instance is None:
        _movement_filter_instance = MovementFilter(
            max_speed_mps=150.0,  # ~540 km/h
            min_movement_meters=5.0,  # 5 meters minimum
            max_history_size=100
        )
    return _movement_filter_instance


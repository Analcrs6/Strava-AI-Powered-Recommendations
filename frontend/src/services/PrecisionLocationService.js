/**
 * High-Precision Location Service
 * Provides GPS-priority geolocation with accuracy validation, Kalman filtering,
 * and movement validation for smooth, reliable location tracking.
 */

class KalmanFilter {
  /**
   * Simple Kalman filter for smoothing GPS coordinates
   * Reduces GPS noise while maintaining responsiveness
   */
  constructor(processNoise = 0.008, measurementNoise = 25, estimationError = 1) {
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
    this.estimationError = estimationError;
    this.positionVariance = estimationError;
  }

  filter(measurement, previousEstimate) {
    // Prediction
    const predictedPosition = previousEstimate;
    const predictedVariance = this.positionVariance + this.processNoise;

    // Update
    const kalmanGain = predictedVariance / (predictedVariance + this.measurementNoise);
    const estimate = predictedPosition + kalmanGain * (measurement - predictedPosition);
    this.positionVariance = (1 - kalmanGain) * predictedVariance;

    return estimate;
  }

  reset() {
    this.positionVariance = this.estimationError;
  }
}

class PrecisionLocationService {
  constructor() {
    this.watchId = null;
    this.currentPosition = null;
    this.positionHistory = [];
    this.maxHistorySize = 50;
    this.listeners = new Set();
    this.errorListeners = new Set();
    
    // Kalman filters for latitude and longitude
    this.latFilter = new KalmanFilter();
    this.lonFilter = new KalmanFilter();
    
    // Movement validation
    this.lastValidPosition = null;
    this.lastUpdateTime = null;
    this.maxSpeed = 150; // m/s (~540 km/h)
    this.minSignificantMovement = 5; // meters
    
    // Accuracy tracking
    this.accuracyHistory = [];
    this.maxAccuracyHistorySize = 10;
    
    // Configuration
    this.config = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      minAccuracy: 50, // Accept positions within 50m accuracy
      maxAccuracy: 1000, // Reject positions worse than 1km accuracy
      updateThrottle: 1000, // Minimum ms between updates
    };
    
    // Status
    this.isTracking = false;
    this.locationSource = null; // 'gps', 'network', or null
    this.gpsAvailable = null;
  }

  /**
   * Check if geolocation is available
   */
  isGeolocationAvailable() {
    return 'geolocation' in navigator;
  }

  /**
   * Start high-accuracy location tracking
   */
  async startTracking(options = {}) {
    if (!this.isGeolocationAvailable()) {
      throw new Error('Geolocation is not supported by your browser');
    }

    // Merge custom options
    this.config = { ...this.config, ...options };

    // Request permission (if needed)
    try {
      const permissionStatus = await navigator.permissions?.query({ name: 'geolocation' });
      if (permissionStatus && permissionStatus.state === 'denied') {
        throw new Error('Location permission denied');
      }
    } catch (e) {
      // Permission API not available, continue anyway
      console.warn('Permissions API not available:', e.message);
    }

    // Get initial position with high accuracy
    try {
      const position = await this._getCurrentPositionAsync({
        enableHighAccuracy: true,
        timeout: this.config.timeout,
        maximumAge: 0
      });
      
      this._handlePosition(position);
      this.locationSource = this._determineLocationSource(position);
      this.gpsAvailable = position.coords.accuracy < 100;
    } catch (error) {
      console.warn('Initial high-accuracy position failed, trying standard accuracy:', error);
      
      // Fallback to network positioning
      try {
        const position = await this._getCurrentPositionAsync({
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 30000
        });
        
        this._handlePosition(position);
        this.locationSource = 'network';
        this.gpsAvailable = false;
      } catch (fallbackError) {
        this._notifyError(fallbackError);
        throw fallbackError;
      }
    }

    // Start watching position
    this._startWatching();
    this.isTracking = true;

    return this.currentPosition;
  }

  /**
   * Stop location tracking
   */
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    
    this.isTracking = false;
    this.locationSource = null;
  }

  /**
   * Get current position (async/await wrapper)
   */
  _getCurrentPositionAsync(options) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  /**
   * Start watching position changes
   */
  _startWatching() {
    // Try high accuracy first
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this._handlePosition(position),
      (error) => this._handlePositionError(error),
      {
        enableHighAccuracy: this.config.enableHighAccuracy,
        maximumAge: this.config.maximumAge,
        timeout: this.config.timeout
      }
    );
  }

  /**
   * Handle new position update
   */
  _handlePosition(position) {
    const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords;
    const timestamp = new Date(position.timestamp);

    // Validate accuracy
    if (accuracy > this.config.maxAccuracy) {
      console.warn(`Position accuracy ${accuracy}m exceeds maximum ${this.config.maxAccuracy}m, skipping`);
      return;
    }

    // Apply Kalman filtering for smoothing
    let filteredLat = latitude;
    let filteredLon = longitude;

    if (this.lastValidPosition) {
      filteredLat = this.latFilter.filter(latitude, this.lastValidPosition.latitude);
      filteredLon = this.lonFilter.filter(longitude, this.lastValidPosition.longitude);
    } else {
      // Reset filters on first valid position
      this.latFilter.reset();
      this.lonFilter.reset();
    }

    // Create position object
    const newPosition = {
      latitude: filteredLat,
      longitude: filteredLon,
      rawLatitude: latitude,
      rawLongitude: longitude,
      accuracy,
      altitude,
      heading,
      speed,
      timestamp,
      source: this._determineLocationSource(position)
    };

    // Validate movement if we have a previous position
    if (this.lastValidPosition && this.lastUpdateTime) {
      const validation = this._validateMovement(
        this.lastValidPosition,
        newPosition,
        timestamp
      );

      if (!validation.valid) {
        console.warn('Invalid movement detected:', validation.reason);
        
        // Still notify but mark as potentially invalid
        newPosition.validationWarning = validation.reason;
      }

      newPosition.distanceFromPrevious = validation.distance;
      newPosition.calculatedSpeed = validation.speed;
    }

    // Throttle updates
    if (this.lastUpdateTime) {
      const timeSinceLastUpdate = timestamp - this.lastUpdateTime;
      if (timeSinceLastUpdate < this.config.updateThrottle) {
        return;
      }
    }

    // Update state
    this.currentPosition = newPosition;
    this.lastValidPosition = { latitude: filteredLat, longitude: filteredLon };
    this.lastUpdateTime = timestamp;

    // Add to history
    this._addToHistory(newPosition);
    this._addToAccuracyHistory(accuracy);

    // Update location source
    this.locationSource = newPosition.source;
    this.gpsAvailable = accuracy < 100;

    // Notify listeners
    this._notifyListeners(newPosition);
  }

  /**
   * Handle position errors
   */
  _handlePositionError(error) {
    console.error('Geolocation error:', error.message);

    let errorMessage = 'Unknown location error';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied. Please enable location access.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable. Check your device settings.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out. Trying again...';
        
        // On timeout, try to continue with lower accuracy
        if (this.config.enableHighAccuracy) {
          console.log('Falling back to network positioning');
          this.stopTracking();
          this.config.enableHighAccuracy = false;
          this._startWatching();
        }
        break;
    }

    this._notifyError({ code: error.code, message: errorMessage, originalError: error });
  }

  /**
   * Validate movement between positions
   */
  _validateMovement(previousPosition, currentPosition, currentTime) {
    const distance = this._calculateDistance(
      previousPosition.latitude,
      previousPosition.longitude,
      currentPosition.latitude,
      currentPosition.longitude
    );

    const timeSeconds = (currentTime - this.lastUpdateTime) / 1000;
    const speed = timeSeconds > 0 ? distance / timeSeconds : 0;

    // Check for impossible speed
    if (speed > this.maxSpeed) {
      return {
        valid: false,
        distance,
        speed,
        reason: `Speed ${speed.toFixed(1)} m/s exceeds maximum ${this.maxSpeed} m/s`
      };
    }

    // Check for insignificant movement (GPS noise)
    if (distance < this.minSignificantMovement && timeSeconds < 60) {
      return {
        valid: true,
        distance,
        speed,
        reason: 'Movement below significance threshold (likely GPS noise)'
      };
    }

    return {
      valid: true,
      distance,
      speed
    };
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Note: Server will use Vincenty's formula for higher precision
   */
  _calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Determine location source from position
   */
  _determineLocationSource(position) {
    const { accuracy } = position.coords;
    
    // GPS typically has accuracy < 100m
    if (accuracy < 100) return 'gps';
    
    // Network/WiFi typically 100m - 1000m
    if (accuracy < 1000) return 'network';
    
    // Cell tower or very poor signal
    return 'cell';
  }

  /**
   * Add position to history
   */
  _addToHistory(position) {
    this.positionHistory.push(position);
    
    if (this.positionHistory.length > this.maxHistorySize) {
      this.positionHistory.shift();
    }
  }

  /**
   * Add accuracy to history for tracking GPS quality
   */
  _addToAccuracyHistory(accuracy) {
    this.accuracyHistory.push(accuracy);
    
    if (this.accuracyHistory.length > this.maxAccuracyHistorySize) {
      this.accuracyHistory.shift();
    }
  }

  /**
   * Get average accuracy from recent history
   */
  getAverageAccuracy() {
    if (this.accuracyHistory.length === 0) return null;
    
    const sum = this.accuracyHistory.reduce((a, b) => a + b, 0);
    return sum / this.accuracyHistory.length;
  }

  /**
   * Get GPS signal quality (0-100)
   */
  getGPSQuality() {
    const avgAccuracy = this.getAverageAccuracy();
    if (avgAccuracy === null) return null;
    
    // Map accuracy to quality score
    // <5m = 100, 5-20m = 80-100, 20-100m = 50-80, >100m = 0-50
    if (avgAccuracy < 5) return 100;
    if (avgAccuracy < 20) return 80 + (20 - avgAccuracy) / 15 * 20;
    if (avgAccuracy < 100) return 50 + (100 - avgAccuracy) / 80 * 30;
    return Math.max(0, 50 - (avgAccuracy - 100) / 20);
  }

  /**
   * Subscribe to position updates
   */
  subscribe(callback) {
    this.listeners.add(callback);
    
    // Immediately call with current position if available
    if (this.currentPosition) {
      callback(this.currentPosition);
    }
    
    return () => this.listeners.delete(callback);
  }

  /**
   * Subscribe to errors
   */
  subscribeToErrors(callback) {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  _notifyListeners(position) {
    this.listeners.forEach(callback => {
      try {
        callback(position);
      } catch (error) {
        console.error('Error in position listener:', error);
      }
    });
  }

  /**
   * Notify error listeners
   */
  _notifyError(error) {
    this.errorListeners.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }

  /**
   * Get current position synchronously (may be null)
   */
  getCurrentPosition() {
    return this.currentPosition;
  }

  /**
   * Get position history
   */
  getHistory() {
    return [...this.positionHistory];
  }

  /**
   * Get tracking status
   */
  getStatus() {
    return {
      isTracking: this.isTracking,
      locationSource: this.locationSource,
      gpsAvailable: this.gpsAvailable,
      currentPosition: this.currentPosition,
      averageAccuracy: this.getAverageAccuracy(),
      gpsQuality: this.getGPSQuality(),
      historySize: this.positionHistory.length
    };
  }

  /**
   * Clear history and reset filters
   */
  reset() {
    this.positionHistory = [];
    this.accuracyHistory = [];
    this.lastValidPosition = null;
    this.lastUpdateTime = null;
    this.latFilter.reset();
    this.lonFilter.reset();
  }
}

// Singleton instance
let instance = null;

export const getPrecisionLocationService = () => {
  if (!instance) {
    instance = new PrecisionLocationService();
  }
  return instance;
};

export default PrecisionLocationService;


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
   * This will trigger the browser's native location permission prompt
   */
  async startTracking(options = {}) {
    if (!this.isGeolocationAvailable()) {
      const error = new Error('Geolocation is not supported by your browser');
      error.code = 0;
      throw error;
    }

    // Merge custom options
    this.config = { ...this.config, ...options };

    // Check permission status (if supported)
    try {
      const permissionStatus = await navigator.permissions?.query({ name: 'geolocation' });
      if (permissionStatus && permissionStatus.state === 'denied') {
        const error = new Error('Location permission denied. Please enable location access in your browser settings.');
        error.code = 1;
        throw error;
      }
      
      console.log('📍 Permission status:', permissionStatus?.state || 'unknown');
    } catch (e) {
      // Permission API not available on all browsers, continue anyway
      if (e.code === 1) throw e; // Re-throw if it's a denied permission
      console.log('📍 Permissions API not available, will request on position fetch');
    }

    // Get initial position with high accuracy - this will trigger permission prompt
    console.log('🎯 Requesting high-accuracy GPS position (this will prompt for permission)...');
    
    try {
      const position = await this._getCurrentPositionAsync({
        enableHighAccuracy: true,
        timeout: this.config.timeout,
        maximumAge: 0
      });
      
      console.log('✅ Initial position acquired:', {
        accuracy: position.coords.accuracy,
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6)
      });
      
      this._handlePosition(position);
      this.locationSource = this._determineLocationSource(position);
      this.gpsAvailable = position.coords.accuracy < 100;
    } catch (error) {
      console.error('❌ Initial high-accuracy position failed:', error);
      
      // If permission denied, throw immediately
      if (error.code === 1) {
        const enhancedError = new Error('Location permission denied. Please enable location access in your browser settings.');
        enhancedError.code = 1;
        this._notifyError(enhancedError);
        throw enhancedError;
      }
      
      // For timeout or unavailable, try fallback to network positioning
      if (error.code === 2 || error.code === 3) {
        console.log('⚠️ Trying fallback to network positioning...');
        
        try {
          const position = await this._getCurrentPositionAsync({
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 10000
          });
          
          console.log('✅ Fallback position acquired (network-based)');
          this._handlePosition(position);
          this.locationSource = 'network';
          this.gpsAvailable = false;
        } catch (fallbackError) {
          console.error('❌ Fallback positioning also failed:', fallbackError);
          this._notifyError(fallbackError);
          throw fallbackError;
        }
      } else {
        this._notifyError(error);
        throw error;
      }
    }

    // Start watching position for continuous updates
    this._startWatching();
    this.isTracking = true;

    console.log('🎉 Location tracking started successfully');
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
    console.log('👀 Starting watchPosition with config:', {
      enableHighAccuracy: this.config.enableHighAccuracy,
      timeout: this.config.timeout,
      maximumAge: this.config.maximumAge
    });
    
    // Try high accuracy first
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        console.log('📍 watchPosition callback triggered');
        this._handlePosition(position);
      },
      (error) => {
        console.error('❌ watchPosition error callback triggered');
        this._handlePositionError(error);
      },
      {
        enableHighAccuracy: this.config.enableHighAccuracy,
        maximumAge: this.config.maximumAge,
        timeout: this.config.timeout
      }
    );
    
    console.log('✅ watchPosition started with watchId:', this.watchId);
  }

  /**
   * Handle new position update
   */
  _handlePosition(position) {
    const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords;
    const timestamp = new Date(position.timestamp);

    console.log('🌍 Raw position received:', {
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
      accuracy: accuracy.toFixed(1) + 'm',
      altitude: altitude ? altitude.toFixed(1) + 'm' : 'N/A',
      speed: speed ? speed.toFixed(1) + 'm/s' : 'N/A',
      timestamp: new Date(position.timestamp).toISOString()
    });

    // Validate accuracy
    if (accuracy > this.config.maxAccuracy) {
      console.warn(`⚠️ Position accuracy ${accuracy}m exceeds maximum ${this.config.maxAccuracy}m, skipping`);
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

    console.log('✅ Position processed and stored:', {
      filtered: `${filteredLat.toFixed(6)}, ${filteredLon.toFixed(6)}`,
      source: newPosition.source,
      gpsQuality: this.getGPSQuality() + '%',
      listeners: this.listeners.size
    });

    // Notify listeners
    console.log(`📢 Notifying ${this.listeners.size} listener(s)...`);
    this._notifyListeners(newPosition);
  }

  /**
   * Handle position errors during continuous tracking
   */
  _handlePositionError(error) {
    console.error('📍 Geolocation error during tracking:', {
      code: error.code,
      message: error.message
    });

    let errorMessage = 'Unknown location error';
    let shouldRetry = false;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied. Please enable location access in your browser settings and refresh the page.';
        // Stop tracking if permission is denied
        this.stopTracking();
        break;
        
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location signal lost. Move to an area with better GPS reception.';
        shouldRetry = true;
        break;
        
      case error.TIMEOUT:
        errorMessage = 'Location request timed out. Checking GPS signal...';
        shouldRetry = true;
        
        // On repeated timeouts, try to continue with lower accuracy
        if (this.config.enableHighAccuracy && this.positionHistory.length === 0) {
          console.log('⚠️ No GPS signal, falling back to network positioning');
          this.stopTracking();
          this.config.enableHighAccuracy = false;
          this._startWatching();
          errorMessage = 'GPS unavailable, using network positioning';
        }
        break;
        
      default:
        errorMessage = error.message || 'An unknown location error occurred';
        break;
    }

    const enhancedError = { 
      code: error.code, 
      message: errorMessage, 
      originalError: error,
      shouldRetry 
    };

    this._notifyError(enhancedError);
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


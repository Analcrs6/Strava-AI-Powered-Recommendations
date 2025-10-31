import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { locationAPI } from '../services/api';
import { getPrecisionLocationService } from '../services/PrecisionLocationService';
import EnhancedMapView from '../components/EnhancedMapView';
import { 
  ArrowLeft, MapPin, Users, Bell, ToggleLeft, ToggleRight, 
  Navigation, AlertCircle, Wifi, WifiOff, Settings, Activity, Signal
} from 'lucide-react';

function NearbyFollowersEnhanced() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [proximityAlerts, setProximityAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationService] = useState(() => getPrecisionLocationService());
  const [locationStatus, setLocationStatus] = useState(null);
  const [proximityThreshold, setProximityThreshold] = useState(500); // 500m default
  const [showSettings, setShowSettings] = useState(false);
  const updateIntervalRef = useRef(null);
  const notificationCooldownRef = useRef(new Set());

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Check if user has location sharing enabled from localStorage
    const savedSharingState = localStorage.getItem('location_sharing_enabled');
    const savedThreshold = localStorage.getItem('proximity_threshold');
    
    if (savedThreshold) {
      setProximityThreshold(parseInt(savedThreshold));
    }
    
    if (savedSharingState === 'true' || user.location_sharing_enabled) {
      setLocationEnabled(true);
      startLocationTracking();
    }

    return () => {
      stopLocationTracking();
    };
  }, [user]);

  const startLocationTracking = async () => {
    try {
      setError(null);
      setLoading(true);

      // Subscribe to location updates
      const unsubscribe = locationService.subscribe((position) => {
        const location = {
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
          source: position.source,
          altitude: position.altitude,
          speed: position.speed,
          heading: position.heading,
          timestamp: position.timestamp
        };
        
        setCurrentLocation(location);
        setLocationStatus(locationService.getStatus());
        
        // Update server with enhanced location data
        updateLocationOnServer(location);
      });

      // Subscribe to errors
      const unsubscribeErrors = locationService.subscribeToErrors((err) => {
        console.error('Location service error:', err);
        setError(err.message);
      });

      // Start high-accuracy tracking
      await locationService.startTracking({
        enableHighAccuracy: true,
        minAccuracy: 50,
        updateThrottle: 5000 // Update every 5 seconds
      });

      setLocationEnabled(true);
      setLoading(false);

      // Update server location every 30 seconds
      updateIntervalRef.current = setInterval(() => {
        if (locationEnabled) {
          loadNearbyFollowers();
          checkProximityAlerts();
        }
      }, 30000);

      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      return () => {
        unsubscribe();
        unsubscribeErrors();
      };
    } catch (err) {
      console.error('Error starting location tracking:', err);
      setError(err.message || 'Unable to access your location. Please enable location services.');
      setLoading(false);
    }
  };

  const stopLocationTracking = () => {
    locationService.stopTracking();
    
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    
    setLocationEnabled(false);
    setCurrentLocation(null);
    setLocationStatus(null);
  };

  const updateLocationOnServer = async (location) => {
    if (!user || !location) return;

    try {
      const response = await locationAPI.updateLocation(
        user.id,
        location.latitude,
        location.longitude,
        locationEnabled,
        location.accuracy,
        location.source,
        location.altitude,
        location.speed,
        location.heading
      );
      
      if (!response.data.success) {
        console.warn('Location update failed:', response.data.message);
        
        // If validation failed, show warning but don't disable tracking
        if (response.data.validation) {
          console.warn('Validation:', response.data.validation);
        }
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const loadNearbyFollowers = async () => {
    if (!user || !currentLocation) return;

    try {
      const response = await locationAPI.getMutualFollowersLocations(
        user.id,
        50000, // 50km search radius
        true // Use Vincenty's formula
      );
      setNearbyUsers(response.data || []);
    } catch (error) {
      console.error('Error loading nearby followers:', error);
    }
  };

  const checkProximityAlerts = async () => {
    if (!user || !currentLocation) return;

    try {
      const response = await locationAPI.checkProximityNotifications(
        user.id,
        proximityThreshold
      );
      const alerts = response.data || [];
      
      // Show new alerts with cooldown
      alerts.forEach(alert => {
        const cooldownKey = `${alert.user_id}-${alert.event_type}`;
        
        // Only show notification if not in cooldown
        if (!notificationCooldownRef.current.has(cooldownKey)) {
          showNotification(alert);
          
          // Add to cooldown for 5 minutes
          notificationCooldownRef.current.add(cooldownKey);
          setTimeout(() => {
            notificationCooldownRef.current.delete(cooldownKey);
          }, 300000);
        }
      });
      
      setProximityAlerts(alerts);
    } catch (error) {
      console.error('Error checking proximity:', error);
    }
  };

  const showNotification = (alert) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Nearby Friend!', {
        body: alert.message,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: alert.user_id, // Prevents duplicate notifications
        requireInteraction: false
      });
    }
  };

  const toggleLocationSharing = async () => {
    if (!user) return;

    const newEnabled = !locationEnabled;
    
    try {
      if (newEnabled) {
        await startLocationTracking();
      } else {
        stopLocationTracking();
      }

      // Save to localStorage for persistence
      localStorage.setItem('location_sharing_enabled', newEnabled.toString());
      
      await locationAPI.toggleLocationSharing(user.id, newEnabled);
      console.log(`📍 Location sharing ${newEnabled ? 'enabled' : 'disabled'} for ${user.id}`);
    } catch (error) {
      console.error('Error toggling location sharing:', error);
      setError('Failed to toggle location sharing');
    }
  };

  const handleThresholdChange = (newThreshold) => {
    setProximityThreshold(newThreshold);
    localStorage.setItem('proximity_threshold', newThreshold.toString());
    
    // Re-check proximity with new threshold
    if (locationEnabled) {
      checkProximityAlerts();
    }
  };

  const getGPSQualityColor = (quality) => {
    if (!quality) return 'text-slate-400';
    if (quality >= 80) return 'text-green-600';
    if (quality >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getGPSQualityLabel = (quality) => {
    if (!quality) return 'Unknown';
    if (quality >= 80) return 'Excellent';
    if (quality >= 50) return 'Good';
    return 'Poor';
  };

  // Convert users to map markers
  const mapMarkers = [
    ...(currentLocation ? [{
      id: `user-${user.id}`,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      label: 'You',
      color: '#FC4C02',
      type: 'user'
    }] : []),
    ...nearbyUsers.map(nearbyUser => ({
      id: nearbyUser.user_id,
      latitude: nearbyUser.latitude,
      longitude: nearbyUser.longitude,
      label: `${nearbyUser.name} (${nearbyUser.distance_meters < 1000 ? 
        `${Math.round(nearbyUser.distance_meters)}m` : 
        `${nearbyUser.distance_km}km`})`,
      color: '#10B981',
      type: 'nearby'
    }))
  ];

  const proximityCircle = currentLocation ? {
    center: [currentLocation.latitude, currentLocation.longitude],
    radius: proximityThreshold
  } : null;

  useEffect(() => {
    if (locationEnabled && currentLocation) {
      loadNearbyFollowers();
      checkProximityAlerts();
    }
  }, [locationEnabled, proximityThreshold]);

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-6 transition"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <MapPin className="h-8 w-8 text-orange-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Nearby Friends</h1>
              <p className="text-slate-600">High-precision location tracking</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition"
              title="Settings"
            >
              <Settings className="h-5 w-5 text-slate-700" />
            </button>
            
            <button
              onClick={toggleLocationSharing}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition ${
                locationEnabled
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {locationEnabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              <span>{locationEnabled ? 'Sharing On' : 'Sharing Off'}</span>
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="font-semibold text-slate-900 mb-4">Proximity Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notification Threshold: {proximityThreshold}m
                </label>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={proximityThreshold}
                  onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>100m</span>
                  <span>2km</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Location Status Bar */}
        {locationStatus && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {locationStatus.locationSource === 'gps' ? (
                    <Signal className={`h-5 w-5 ${getGPSQualityColor(locationStatus.gpsQuality)}`} />
                  ) : (
                    <Wifi className="h-5 w-5 text-blue-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {locationStatus.locationSource === 'gps' ? 'GPS' : 'Network'} Location
                    </p>
                    <p className="text-xs text-slate-500">
                      Quality: {getGPSQualityLabel(locationStatus.gpsQuality)}
                    </p>
                  </div>
                </div>
                
                {currentLocation && (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100 rounded-lg">
                    <Activity className="h-4 w-4 text-slate-600" />
                    <span className="text-xs font-medium text-slate-700">
                      ±{Math.round(currentLocation.accuracy)}m
                    </span>
                  </div>
                )}
              </div>
              
              <div className="text-right">
                <p className="text-xs text-slate-500">Coordinates</p>
                <p className="text-xs font-mono text-slate-700">
                  {currentLocation?.latitude.toFixed(8)}, {currentLocation?.longitude.toFixed(8)}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Proximity Alerts */}
        {proximityAlerts.length > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <Bell className="h-5 w-5 text-orange-600 animate-bounce" />
              <h3 className="font-bold text-orange-900">Friends Nearby!</h3>
            </div>
            <div className="space-y-2">
              {proximityAlerts.map((alert) => (
                <div key={alert.user_id} className="bg-white rounded-lg p-3 border border-orange-200">
                  <p className="text-sm text-orange-900 font-medium">{alert.message}</p>
                  {alert.event_type === 'entered' && (
                    <p className="text-xs text-orange-700 mt-1">🎉 Just entered your area</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Enhanced Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="h-[600px]">
                {currentLocation ? (
                  <EnhancedMapView
                    center={[currentLocation.latitude, currentLocation.longitude]}
                    zoom={15}
                    markers={mapMarkers}
                    proximityCircle={proximityCircle}
                    onMarkerClick={(marker) => {
                      if (marker.type === 'nearby') {
                        navigate(`/profile/${marker.id}`);
                      }
                    }}
                    showControls={true}
                    showStyleSelector={true}
                    animateToUser={true}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-slate-100">
                    <div className="text-center">
                      <Navigation className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 font-medium mb-2">Enable location sharing</p>
                      <p className="text-sm text-slate-500">to see nearby friends with high precision</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nearby Users List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="h-5 w-5 text-slate-700" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Nearby ({nearbyUsers.length})
                </h2>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
                </div>
              ) : nearbyUsers.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-600">
                    {locationEnabled
                      ? 'No mutual followers nearby'
                      : 'Enable location sharing to see nearby friends'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {nearbyUsers.map((nearbyUser) => (
                    <button
                      key={nearbyUser.user_id}
                      onClick={() => navigate(`/profile/${nearbyUser.user_id}`)}
                      className="w-full p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold text-sm">
                            {nearbyUser.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {nearbyUser.name}
                          </div>
                          <div className="text-sm text-slate-600">
                            {nearbyUser.distance_meters < 1000 ? (
                              <span>{Math.round(nearbyUser.distance_meters)}m away</span>
                            ) : (
                              <span>{nearbyUser.distance_km}km away</span>
                            )}
                          </div>
                          {nearbyUser.accuracy && (
                            <div className="text-xs text-slate-500">
                              ±{Math.round(nearbyUser.accuracy)}m • {nearbyUser.source}
                            </div>
                          )}
                        </div>
                        <Navigation className="h-4 w-4 text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-semibold mb-2">🎯 Enhanced Features:</p>
              <ul className="text-xs text-blue-800 space-y-1.5 leading-relaxed">
                <li>• Sub-meter precision with Vincenty's formula</li>
                <li>• GPS priority with network fallback</li>
                <li>• {proximityThreshold}m notification threshold</li>
                <li>• Kalman filtering for smooth tracking</li>
                <li>• Movement validation (max 540 km/h)</li>
                <li>• Only mutual followers can see you</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NearbyFollowersEnhanced;


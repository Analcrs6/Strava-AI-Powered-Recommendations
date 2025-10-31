import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { locationAPI } from '../services/api';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { ArrowLeft, MapPin, Users, Bell, ToggleLeft, ToggleRight, Navigation, AlertCircle, Activity } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Dummy data for nearby friends
const DUMMY_NEARBY_USERS = [
  {
    user_id: 'user_sarah_123',
    name: 'Sarah Johnson',
    profile_image_url: null,
    latitude: 37.7751,
    longitude: -122.4195,
    distance_meters: 250,
    last_updated: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
    activity: 'Running - 3.2km'
  },
  {
    user_id: 'user_mike_456',
    name: 'Mike Chen',
    profile_image_url: null,
    latitude: 37.7755,
    longitude: -122.4185,
    distance_meters: 680,
    last_updated: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    activity: 'Cycling - 12.5km'
  },
  {
    user_id: 'user_emma_789',
    name: 'Emma Davis',
    profile_image_url: null,
    latitude: 37.7742,
    longitude: -122.4205,
    distance_meters: 1200,
    last_updated: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
    activity: 'Walking'
  },
  {
    user_id: 'user_alex_321',
    name: 'Alex Martinez',
    profile_image_url: null,
    latitude: 37.7760,
    longitude: -122.4170,
    distance_meters: 320,
    last_updated: new Date(Date.now() - 1 * 60 * 1000).toISOString(), // 1 min ago
    activity: 'Running - 5.1km'
  }
];

const DUMMY_PROXIMITY_ALERTS = [
  {
    id: 'alert_1',
    user_name: 'Sarah Johnson',
    distance_meters: 250,
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString()
  }
];

function NearbyFollowers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({ latitude: 37.7749, longitude: -122.4194 });
  const [nearbyUsers, setNearbyUsers] = useState(DUMMY_NEARBY_USERS);
  const [proximityAlerts, setProximityAlerts] = useState(DUMMY_PROXIMITY_ALERTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const updateIntervalRef = useRef(null);

  useEffect(() => {
    // Don't redirect, just wait for user to load from AuthContext
    if (!user) {
      return;
    }

    // Check if user has location sharing enabled from localStorage
    const savedSharingState = localStorage.getItem('location_sharing_enabled');
    if (savedSharingState === 'true' || user.location_sharing_enabled) {
      setLocationEnabled(true);
      startLocationTracking();
    }

    return () => {
      stopLocationTracking();
    };
  }, [user]);

  const startLocationTracking = () => {
    if ('geolocation' in navigator) {
      setError(null);
      
      // Get initial position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setCurrentLocation(location);
          updateLocationOnServer(location);
        },
        (error) => {
          console.error('Error getting location:', error);
          setError('Unable to access your location. Please enable location services.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      // Watch position changes
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setCurrentLocation(location);
        },
        (error) => {
          console.error('Error watching location:', error);
        },
        { enableHighAccuracy: true, maximumAge: 30000 }
      );

      // Update server location every 30 seconds
      updateIntervalRef.current = setInterval(() => {
        if (currentLocation && locationEnabled) {
          updateLocationOnServer(currentLocation);
          loadNearbyFollowers();
          checkProximityAlerts();
        }
      }, 30000);

      setLocationEnabled(true);
    } else {
      setError('Geolocation is not supported by your browser');
    }
  };

  const stopLocationTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  };

  const updateLocationOnServer = async (location) => {
    if (!user || !location) return;

    try {
      await locationAPI.updateLocation(
        user.id,
        location.latitude,
        location.longitude,
        locationEnabled
      );
      console.log('📍 Location updated on server');
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const loadNearbyFollowers = async () => {
    if (!user || !currentLocation) return;

    setLoading(true);
    try {
      const response = await locationAPI.getMutualFollowersLocations(user.id, 50);
      setNearbyUsers(response.data || []);
    } catch (error) {
      console.error('Error loading nearby followers:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkProximityAlerts = async () => {
    if (!user || !currentLocation) return;

    try {
      const response = await locationAPI.checkProximityNotifications(user.id, 500);
      const alerts = response.data || [];
      
      // Show new alerts
      alerts.forEach(alert => {
        // Check if we've already shown this alert
        const existing = proximityAlerts.find(a => a.user_id === alert.user_id);
        if (!existing) {
          showNotification(alert);
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
        icon: '/logo.png'
      });
    }
  };

  const toggleLocationSharing = async () => {
    if (!user) return;

    const newEnabled = !locationEnabled;
    
    try {
      if (newEnabled) {
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
        
        startLocationTracking();
        setLocationEnabled(true);
      } else {
        stopLocationTracking();
        setLocationEnabled(false);
        // Don't clear the data, just stop tracking
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

  useEffect(() => {
    if (locationEnabled && currentLocation) {
      loadNearbyFollowers();
      checkProximityAlerts();
    }
  }, [locationEnabled]);

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
              <p className="text-slate-600">See mutual followers near you</p>
            </div>
          </div>

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

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="h-[600px]">
                {currentLocation ? (
                  <MapContainer
                    center={[currentLocation.latitude, currentLocation.longitude]}
                    zoom={16}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {/* Current user location */}
                    <Marker position={[currentLocation.latitude, currentLocation.longitude]}>
                      <Popup>
                        <strong>You are here</strong>
                      </Popup>
                    </Marker>
                    
                    {/* Proximity circle (500m) */}
                    <Circle
                      center={[currentLocation.latitude, currentLocation.longitude]}
                      radius={500}
                      pathOptions={{ color: 'orange', fillColor: 'orange', fillOpacity: 0.1 }}
                    />

                    {/* Nearby mutual followers */}
                    {nearbyUsers.map((nearbyUser) => (
                      <Marker
                        key={nearbyUser.user_id}
                        position={[nearbyUser.latitude, nearbyUser.longitude]}
                      >
                        <Popup>
                          <div>
                            <strong>{nearbyUser.name}</strong>
                            <p className="text-sm">{nearbyUser.distance_km}km away</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                ) : (
                  <div className="flex items-center justify-center h-full bg-slate-100">
                    <div className="text-center">
                      <Navigation className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600">Enable location sharing to see nearby friends</p>
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
                  {nearbyUsers.map((nearbyUser) => {
                    const distanceText = nearbyUser.distance_meters < 1000 
                      ? `${nearbyUser.distance_meters}m` 
                      : `${(nearbyUser.distance_meters / 1000).toFixed(1)}km`;
                    
                    const isVeryClose = nearbyUser.distance_meters < 500;
                    
                    // Calculate time ago
                    const lastUpdatedDate = new Date(nearbyUser.last_updated);
                    const minutesAgo = Math.floor((Date.now() - lastUpdatedDate.getTime()) / 60000);
                    const timeAgoText = minutesAgo < 1 ? 'Just now' :
                                       minutesAgo === 1 ? '1 min ago' :
                                       minutesAgo < 60 ? `${minutesAgo} mins ago` :
                                       `${Math.floor(minutesAgo / 60)}h ago`;
                    
                    return (
                      <div
                        key={nearbyUser.user_id}
                        className={`p-4 border-2 rounded-lg ${
                          isVeryClose 
                            ? 'border-orange-300 bg-orange-50' 
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start space-x-3 mb-3">
                          <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isVeryClose ? 'bg-orange-600' : 'bg-blue-600'
                          }`}>
                            <span className="text-white font-semibold">
                              {nearbyUser.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-semibold text-slate-900 truncate">
                                {nearbyUser.name}
                              </h3>
                              {isVeryClose && (
                                <span className="px-2 py-0.5 bg-orange-600 text-white text-xs font-bold rounded">
                                  NEARBY
                                </span>
                              )}
                            </div>
                            
                            {/* Distance */}
                            <div className="flex items-center space-x-1 text-sm text-slate-600 mb-1">
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="font-medium">{distanceText} away</span>
                            </div>
                            
                            {/* Activity */}
                            {nearbyUser.activity && (
                              <div className="flex items-center space-x-1 text-xs text-green-700 bg-green-50 rounded px-2 py-0.5 mb-1 inline-flex">
                                <Activity className="h-3 w-3" />
                                <span>{nearbyUser.activity}</span>
                              </div>
                            )}
                            
                            {/* Last updated */}
                            <div className="text-xs text-slate-500 mt-1">
                              Updated {timeAgoText}
                            </div>
                          </div>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex space-x-2">
                          <button
                            onClick={() => navigate(`/profile/${nearbyUser.user_id}`)}
                            className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded transition"
                          >
                            View Profile
                          </button>
                          <button
                            onClick={() => navigate('/messages')}
                            className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition"
                          >
                            Message
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-semibold mb-2">How it works:</p>
              <ul className="text-xs text-blue-800 space-y-1.5 leading-relaxed">
                <li>• Enable location sharing to see mutual followers</li>
                <li>• Only friends who follow you back can see your location</li>
                <li>• Get notified when friends are within 500 meters</li>
                <li>• Location updates every 30 seconds</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NearbyFollowers;


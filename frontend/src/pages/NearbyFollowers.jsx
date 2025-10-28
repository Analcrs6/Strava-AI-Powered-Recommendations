import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { locationAPI } from '../services/api';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { ArrowLeft, MapPin, Users, Bell, ToggleLeft, ToggleRight, Navigation, AlertCircle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function NearbyFollowers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [proximityAlerts, setProximityAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const updateIntervalRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Check if user has location sharing enabled
    if (user.location_sharing_enabled) {
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
      const response = await locationAPI.checkProximityNotifications(user.id, 5);
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
      } else {
        stopLocationTracking();
        setLocationEnabled(false);
      }

      await locationAPI.toggleLocationSharing(user.id, newEnabled);
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
                </div>
              ))}
            </div>
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
                    zoom={13}
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
                    
                    {/* Proximity circle (5km) */}
                    <Circle
                      center={[currentLocation.latitude, currentLocation.longitude]}
                      radius={5000}
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
                  {nearbyUsers.map((nearbyUser) => (
                    <button
                      key={nearbyUser.user_id}
                      onClick={() => navigate(`/profile/${nearbyUser.user_id}`)}
                      className="w-full p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold text-sm">
                            {nearbyUser.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {nearbyUser.name}
                          </div>
                          <div className="text-sm text-slate-600">
                            {nearbyUser.distance_km}km away
                          </div>
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
              <p className="text-sm text-blue-900 font-semibold mb-2">How it works:</p>
              <ul className="text-xs text-blue-800 space-y-1.5 leading-relaxed">
                <li>• Enable location sharing to see mutual followers</li>
                <li>• Only friends who follow you back can see your location</li>
                <li>• Get notified when friends are within 5km</li>
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


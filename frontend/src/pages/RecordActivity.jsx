import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import { Play, Pause, Square, Save, MapPin, Activity, Clock, Navigation, AlertCircle } from 'lucide-react';
import { activitiesAPI } from '../services/api';
import { getPrecisionLocationService } from '../services/PrecisionLocationService';
import 'leaflet/dist/leaflet.css';

/**
 * Activity Recording Page
 * Strava-like interface for recording activities with real GPS tracking
 */

// Component to center map on user's current location
function MapController({ center }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  
  return null;
}

function RecordActivity() {
  const navigate = useNavigate();
  const [sport, setSport] = useState('running');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [route, setRoute] = useState([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [elevation, setElevation] = useState(0);
  const [saving, setSaving] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsQuality, setGpsQuality] = useState(null);
  const [locationSource, setLocationSource] = useState(null);
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const locationServiceRef = useRef(null);

  // Default map center (will be updated with user's location)
  const [mapCenter, setMapCenter] = useState([37.7749, -122.4194]);

  // Initialize precision location service on mount
  useEffect(() => {
    const initLocationService = async () => {
      try {
        locationServiceRef.current = getPrecisionLocationService();
        
        if (!locationServiceRef.current.isGeolocationAvailable()) {
          setGpsError('GPS not supported by your browser');
          return;
        }

        // Start tracking with high accuracy settings
        const initialPosition = await locationServiceRef.current.startTracking({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
          minAccuracy: 30, // Accept positions within 30m accuracy
          maxAccuracy: 1000,
          updateThrottle: 500 // Update every 500ms for better tracking
        });

        if (initialPosition) {
          const location = [initialPosition.latitude, initialPosition.longitude];
          setCurrentLocation(location);
          setMapCenter(location);
          setGpsAccuracy(initialPosition.accuracy);
          setLocationSource(initialPosition.source);
          setGpsQuality(locationServiceRef.current.getGPSQuality());
        }

        // Subscribe to position updates
        const unsubscribe = locationServiceRef.current.subscribe((position) => {
          const location = [position.latitude, position.longitude];
          setCurrentLocation(location);
          setGpsAccuracy(position.accuracy);
          setLocationSource(position.source);
          setGpsQuality(locationServiceRef.current.getGPSQuality());
          setGpsError(null);
        });

        // Subscribe to errors
        const unsubscribeErrors = locationServiceRef.current.subscribeToErrors((error) => {
          console.error('Location service error:', error);
          setGpsError(error.message);
        });

        // Cleanup on unmount
        return () => {
          unsubscribe();
          unsubscribeErrors();
          if (locationServiceRef.current) {
            locationServiceRef.current.stopTracking();
          }
        };
      } catch (error) {
        console.error('Failed to initialize location service:', error);
        setGpsError(error.message || 'Unable to access GPS. Please enable location services.');
      }
    };

    initLocationService();
  }, []);

  // Timer effect
  useEffect(() => {
    if (isRecording && !isPaused) {
      startTimeRef.current = Date.now() - elapsedTime * 1000;
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  // GPS tracking effect for recording - adds points to route
  useEffect(() => {
    if (!isRecording || isPaused || !locationServiceRef.current) {
      return;
    }

    // Subscribe to location updates during recording
    const unsubscribe = locationServiceRef.current.subscribe((position) => {
      const newPoint = [position.latitude, position.longitude];
      const accuracy = position.accuracy;
      
      // Only add point to route if accuracy is reasonable (< 50m for better accuracy)
      // PrecisionLocationService already filters bad positions, but we add extra check
      if (accuracy < 50) {
        setRoute(prevRoute => {
          // Skip if we have validation warnings (erratic movement)
          if (position.validationWarning) {
            console.warn('Skipping point due to validation warning:', position.validationWarning);
            return prevRoute;
          }

          const newRoute = [...prevRoute, newPoint];
          
          // Calculate distance if we have a previous point
          if (prevRoute.length > 0) {
            const lastPoint = prevRoute[prevRoute.length - 1];
            const dist = calculateDistance(lastPoint, newPoint);
            // Only add distance if movement is reasonable (< 50m between points)
            // PrecisionLocationService already validates movement, but we check distance
            if (dist < 50 && dist > 1) { // Ignore very small movements (< 1m GPS noise)
              setDistance(prev => prev + dist);
            }
          }
          
          return newRoute;
        });
      }
      
      // Update elevation if available
      if (position.altitude !== null && position.altitude !== undefined) {
        setElevation(Math.max(0, position.altitude));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isRecording, isPaused]);

  const handleStart = () => {
    if (!currentLocation) {
      alert('Waiting for GPS signal. Please ensure location services are enabled.');
      return;
    }
    
    setIsRecording(true);
    setIsPaused(false);
    setRoute([currentLocation]); // Start route with current location
    setElapsedTime(0);
    setDistance(0);
    setElevation(0);
    setGpsError(null);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    setIsRecording(false);
    setIsPaused(false);
  };

  const calculateDistance = (point1, point2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = point1[0] * Math.PI / 180;
    const φ2 = point2[0] * Math.PI / 180;
    const Δφ = (point2[0] - point1[0]) * Math.PI / 180;
    const Δλ = (point2[1] - point1[1]) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  const handleSave = async () => {
    if (route.length < 2) {
      alert('Please record at least 2 points on the map!');
      return;
    }

    setSaving(true);
    try {
      const activityData = {
        id: `${Date.now()}_recorded`,
        user_id: 'recorded_user',
        sport: sport,
        duration_s: elapsedTime,
        distance_m: distance,
        elevation_gain_m: elevation,
        hr_avg: 0,
        started_at: new Date().toISOString(),
        features: {
          route: route,
          manual_recording: true
        }
      };

      await activitiesAPI.create(activityData);
      alert('Activity saved successfully!');
      navigate('/');
    } catch (error) {
      console.error('Error saving activity:', error);
      alert('Failed to save activity');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const pace = elapsedTime > 0 && distance > 0 
    ? (elapsedTime / 60) / (distance / 1000) 
    : 0;

  return (
    <div className="h-screen flex flex-col bg-gray-900 fixed inset-0 z-50">
      {/* Compact Header */}
      <div className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Navigation className="h-6 w-6 text-orange-500" />
            <h1 className="text-xl font-bold text-white">Record Activity</h1>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-gray-300 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition text-sm"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Main Content - Full Height */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Map - Takes full width */}
        <div className="flex-1 relative min-h-0">
          <MapContainer 
                  center={mapCenter} 
                  zoom={16} 
                  style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
                  className="z-0"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapController center={currentLocation} />
                  
                  {/* Current location marker */}
                  {currentLocation && (
                    <Marker position={currentLocation}>
                      <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
                    </Marker>
                  )}
                  
                  {/* Route polyline */}
                  {route.length > 1 && (
                    <>
                      <Polyline 
                        positions={route} 
                        color="#FF4500"
                        weight={4}
                        opacity={0.8}
                      />
                      <Marker position={route[0]} />
                    </>
                  )}
          </MapContainer>
        </div>

        {/* Right Sidebar - Controls & Stats */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* GPS Status */}
            <div className="space-y-2">
              {isRecording && !isPaused && (
                <div className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold flex items-center space-x-2 animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>RECORDING</span>
                </div>
              )}

              {isPaused && (
                <div className="bg-yellow-500 text-white px-4 py-2 rounded-lg font-bold">
                  PAUSED
                </div>
              )}
              
              {gpsAccuracy !== null && (
                <div>
                  <div className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                    gpsAccuracy < 10 ? 'bg-green-600 text-white' :
                    gpsAccuracy < 20 ? 'bg-green-500 text-white' :
                    gpsAccuracy < 30 ? 'bg-yellow-600 text-white' :
                    gpsAccuracy < 50 ? 'bg-orange-600 text-white' :
                    'bg-red-600 text-white'
                  }`}>
                    GPS Accuracy: ±{Math.round(gpsAccuracy)}m
                    {locationSource && (
                      <span className="ml-2 text-xs opacity-90">
                        ({locationSource.toUpperCase()})
                      </span>
                    )}
                  </div>
                  {gpsQuality !== null && (
                    <div className="mt-1 px-3 py-1 bg-gray-700 rounded text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Signal Quality:</span>
                        <span className={`font-semibold ${
                          gpsQuality >= 80 ? 'text-green-400' :
                          gpsQuality >= 60 ? 'text-yellow-400' :
                          gpsQuality >= 40 ? 'text-orange-400' :
                          'text-red-400'
                        }`}>
                          {Math.round(gpsQuality)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-1.5 mt-1">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            gpsQuality >= 80 ? 'bg-green-500' :
                            gpsQuality >= 60 ? 'bg-yellow-500' :
                            gpsQuality >= 40 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${gpsQuality}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {!currentLocation && !gpsError && (
                <div className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Acquiring GPS...</span>
                </div>
              )}

              {gpsError && (
                <div className="bg-red-600 text-white px-3 py-2 rounded-lg text-xs">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-semibold">{gpsError}</span>
                  </div>
                </div>
              )}
            </div>
            {/* Sport Selection */}
            <div className="bg-gray-700 rounded-lg p-4">
              <label className="block text-xs font-semibold text-gray-300 mb-2 uppercase">Activity Type</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                disabled={isRecording}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="running">🏃 Running</option>
                <option value="cycling">🚴 Cycling</option>
                <option value="walking">🚶 Walking</option>
                <option value="hiking">⛰️ Hiking</option>
              </select>
            </div>

            {/* Live Stats */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-gray-300 mb-3 uppercase flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span>Live Stats</span>
              </h3>
              
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3 bg-gray-800 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">TIME</div>
                    <div className="text-3xl font-bold text-white font-mono">{formatTime(elapsedTime)}</div>
                  </div>

                  <div className="col-span-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg p-3 text-center">
                    <div className="text-xs text-green-100 mb-1">DISTANCE</div>
                    <div className="text-2xl font-bold text-white">
                      {(distance / 1000).toFixed(2)} <span className="text-base">km</span>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">PACE</div>
                    <div className="text-sm font-bold text-white">
                      {pace > 0 ? pace.toFixed(1) : '--'}
                    </div>
                    <div className="text-xs text-gray-400">min/km</div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">ELEV</div>
                    <div className="text-sm font-bold text-white">
                      {Math.round(elevation)}
                    </div>
                    <div className="text-xs text-gray-400">m</div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">PTS</div>
                    <div className="text-sm font-bold text-white">{route.length}</div>
                    <div className="text-xs text-gray-400">gps</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-2">
              {!isRecording ? (
                <button
                  onClick={handleStart}
                  disabled={!currentLocation}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-lg rounded-xl hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center space-x-3 shadow-lg"
                >
                  <div className="bg-white rounded-full p-2">
                    <Play className="h-6 w-6 text-orange-500 fill-current" />
                  </div>
                  <span>Start Recording</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handlePause}
                    className="w-full py-3 bg-yellow-600 text-white font-semibold rounded-lg hover:bg-yellow-700 transition flex items-center justify-center space-x-2"
                  >
                    <Pause className="h-5 w-5" />
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>

                  <button
                    onClick={handleStop}
                    className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition flex items-center justify-center space-x-2"
                  >
                    <Square className="h-5 w-5" />
                    <span>Stop Recording</span>
                  </button>
                </>
              )}

              {!isRecording && route.length > 0 && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center space-x-2"
                >
                  <Save className="h-5 w-5" />
                  <span>{saving ? 'Saving...' : 'Save Activity'}</span>
                </button>
              )}
            </div>

            {/* Info */}
            {!isRecording && currentLocation && !gpsError && (
              <div className="bg-gray-700 rounded-lg p-3 text-xs text-gray-300">
                <MapPin className="h-4 w-4 text-green-500 inline mr-1" />
                High-precision GPS ready. Tracking with Kalman filtering for improved accuracy.
              </div>
            )}
            
            {!isRecording && gpsAccuracy && gpsAccuracy < 20 && (
              <div className="bg-green-900 bg-opacity-30 border border-green-600 rounded-lg p-3 text-xs text-green-300">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-semibold">Excellent GPS signal detected!</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecordActivity;


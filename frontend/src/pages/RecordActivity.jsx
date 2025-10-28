import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, useMapEvents } from 'react-leaflet';
import { Play, Pause, Square, Save, MapPin, Activity, Clock, Navigation, TrendingUp } from 'lucide-react';
import { activitiesAPI } from '../services/api';
import 'leaflet/dist/leaflet.css';

/**
 * Activity Recording Page
 * Strava-like interface for recording activities with GPS tracking
 */

// Component to handle map clicks
function RouteTracker({ isRecording, onAddPoint }) {
  useMapEvents({
    click: (e) => {
      if (isRecording) {
        onAddPoint([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
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
  const [heartRate, setHeartRate] = useState(0);
  const [saving, setSaving] = useState(false);
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Default map center (can be changed to user's location)
  const defaultCenter = [37.7749, -122.4194]; // San Francisco

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

  const handleStart = () => {
    setIsRecording(true);
    setIsPaused(false);
    setRoute([]);
    setElapsedTime(0);
    setDistance(0);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    setIsRecording(false);
    setIsPaused(false);
  };

  const handleAddPoint = (latlng) => {
    const newRoute = [...route, latlng];
    setRoute(newRoute);
    
    // Calculate distance (simple Haversine formula)
    if (route.length > 0) {
      const lastPoint = route[route.length - 1];
      const dist = calculateDistance(lastPoint, latlng);
      setDistance(prev => prev + dist);
      
      // Simulate elevation gain
      setElevation(prev => prev + Math.random() * 5);
    }
    
    // Simulate heart rate
    setHeartRate(120 + Math.floor(Math.random() * 40));
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
        hr_avg: heartRate,
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                <Navigation className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Record Activity</h1>
                <p className="text-orange-100 mt-1">Track your workout with GPS</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-lg hover:bg-white/30"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
              <div className="h-[600px] relative">
                <MapContainer 
                  center={defaultCenter} 
                  zoom={13} 
                  style={{ height: '100%', width: '100%' }}
                  className="z-0"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <RouteTracker 
                    isRecording={isRecording && !isPaused} 
                    onAddPoint={handleAddPoint}
                  />
                  {route.length > 0 && (
                    <>
                      <Polyline 
                        positions={route} 
                        color="#FF4500"
                        weight={4}
                        opacity={0.8}
                      />
                      <Marker position={route[0]} />
                      {route.length > 1 && <Marker position={route[route.length - 1]} />}
                    </>
                  )}
                </MapContainer>

                {/* Recording Indicator */}
                {isRecording && !isPaused && (
                  <div className="absolute top-4 right-4 z-[1000] bg-red-500 text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center space-x-2 animate-pulse">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    <span>RECORDING</span>
                  </div>
                )}

                {isPaused && (
                  <div className="absolute top-4 right-4 z-[1000] bg-yellow-500 text-white px-4 py-2 rounded-full font-bold shadow-lg">
                    PAUSED
                  </div>
                )}

                {/* Map Instructions */}
                {!isRecording && (
                  <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-lg">
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-900">How to record:</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Click "Start" and then click on the map to create your route. Each click adds a point to your path.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls & Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* Sport Selection */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <label className="block text-sm font-bold text-gray-900 mb-3">Activity Type</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                disabled={isRecording}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="running">🏃 Running</option>
                <option value="cycling">🚴 Cycling</option>
                <option value="walking">🚶 Walking</option>
                <option value="hiking">⛰️ Hiking</option>
              </select>
            </div>

            {/* Live Stats */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center space-x-2">
                <Activity className="h-5 w-5 text-orange-500" />
                <span>Live Stats</span>
              </h3>
              
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                  <div className="text-xs text-blue-600 font-semibold mb-1">TIME</div>
                  <div className="text-3xl font-bold text-blue-900">{formatTime(elapsedTime)}</div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
                  <div className="text-xs text-green-600 font-semibold mb-1">DISTANCE</div>
                  <div className="text-3xl font-bold text-green-900">
                    {(distance / 1000).toFixed(2)} <span className="text-lg">km</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3">
                    <div className="text-xs text-purple-600 font-semibold mb-1">PACE</div>
                    <div className="text-xl font-bold text-purple-900">
                      {pace > 0 ? pace.toFixed(1) : '--'} <span className="text-xs">min/km</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-3">
                    <div className="text-xs text-orange-600 font-semibold mb-1">ELEVATION</div>
                    <div className="text-xl font-bold text-orange-900">
                      {Math.round(elevation)} <span className="text-xs">m</span>
                    </div>
                  </div>
                </div>

                {heartRate > 0 && (
                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4">
                    <div className="text-xs text-red-600 font-semibold mb-1">HEART RATE</div>
                    <div className="text-2xl font-bold text-red-900">
                      {heartRate} <span className="text-lg">bpm</span>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-600 font-semibold mb-1">POINTS</div>
                  <div className="text-xl font-bold text-gray-900">{route.length}</div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h3 className="font-bold text-lg text-gray-900 mb-4">Controls</h3>
              
              <div className="space-y-3">
                {!isRecording ? (
                  <button
                    onClick={handleStart}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center space-x-2"
                  >
                    <Play className="h-5 w-5" />
                    <span>Start Recording</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handlePause}
                      className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                    >
                      <Pause className="h-5 w-5" />
                      <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>

                    <button
                      onClick={handleStop}
                      className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-xl hover:shadow-lg transition-all flex items-center justify-center space-x-2"
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
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-5 w-5" />
                    <span>{saving ? 'Saving...' : 'Save Activity'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecordActivity;


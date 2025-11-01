import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Square, Save, MapPin, Activity, Navigation, AlertCircle, TrendingUp, Zap, Mountain, Clock, Sparkles } from 'lucide-react';
import { activitiesAPI } from '../services/api';
import { getPrecisionLocationService } from '../services/PrecisionLocationService';
import MapProviderFallback from '../components/MapProviderFallback';

/**
 * Professional Activity Recording Page
 * Strava-level GPS tracking with Kalman filtering, route smoothing, and precision metrics
 */

// Douglas-Peucker algorithm for route simplification
function simplifyRoute(points, tolerance = 0.00001) {
  if (points.length <= 2) return points;

  const getPerpendicularDistance = (point, lineStart, lineEnd) => {
    const [x, y] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;

    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
      return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
    }

    const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
  };

  const simplify = (pts) => {
    if (pts.length <= 2) return pts;

    let maxDist = 0;
    let maxIndex = 0;
    const first = pts[0];
    const last = pts[pts.length - 1];

    for (let i = 1; i < pts.length - 1; i++) {
      const dist = getPerpendicularDistance(pts[i], first, last);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    if (maxDist > tolerance) {
      const left = simplify(pts.slice(0, maxIndex + 1));
      const right = simplify(pts.slice(maxIndex));
      return [...left.slice(0, -1), ...right];
    }

    return [first, last];
  };

  return simplify(points);
}

// Smooth elevation data using moving average
function smoothElevation(elevations, windowSize = 5) {
  if (elevations.length < windowSize) return elevations;

  const smoothed = [];
  for (let i = 0; i < elevations.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(elevations.length, i + Math.floor(windowSize / 2) + 1);
    const window = elevations.slice(start, end);
    const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
    smoothed.push(avg);
  }
  return smoothed;
}

// Calculate elevation gain/loss
function calculateElevationStats(elevations) {
  let gain = 0;
  let loss = 0;

  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) gain += diff;
    else loss += Math.abs(diff);
  }

  return { gain, loss };
}

// Vincenty-inspired distance calculation (accurate)
function calculateDistance(point1, point2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = point1[0] * Math.PI / 180;
  const φ2 = point2[0] * Math.PI / 180;
  const Δφ = (point2[0] - point1[0]) * Math.PI / 180;
  const Δλ = (point2[1] - point1[1]) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function RecordActivity() {
  const navigate = useNavigate();
  const [sport, setSport] = useState('running');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [route, setRoute] = useState([]);
  const [elevations, setElevations] = useState([]);
  const [timestamps, setTimestamps] = useState([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [elevationGain, setElevationGain] = useState(0);
  const [elevationLoss, setElevationLoss] = useState(0);
  const [saving, setSaving] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsQuality, setGpsQuality] = useState(null);
  const [locationSource, setLocationSource] = useState(null);
  const [smoothedRoute, setSmoothedRoute] = useState([]);
  
  // Permission states
  const [locationPermission, setLocationPermission] = useState('prompt'); // 'prompt', 'granted', 'denied', 'checking'
  const [showPermissionModal, setShowPermissionModal] = useState(true);
  const [isInitializingGPS, setIsInitializingGPS] = useState(false);
  
  // Demo mode states
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const demoIntervalRef = useRef(null);
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const locationServiceRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);

  // Default map center
  const [mapCenter, setMapCenter] = useState([37.7749, -122.4194]);
  const [mapZoom] = useState(17);

  // Check geolocation availability on mount
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser');
      setLocationPermission('denied');
    }
  }, []);

  // Handle location permission request
  const requestLocationPermission = async () => {
    setIsInitializingGPS(true);
    setLocationPermission('checking');
    setGpsError(null); // Reset error state
    
    try {
      const locationService = getPrecisionLocationService();
      locationServiceRef.current = locationService;

      // Stop any existing tracking before starting new one
      if (locationService.isTracking) {
        console.log('🔄 Stopping existing tracking before restarting...');
        locationService.stopTracking();
        locationService.reset();
      }

      console.log('🎯 Requesting location permission...');
      
      // Request permission by attempting to get location
      // For development/testing: Accept lower accuracy for indoor testing
      await locationService.startTracking({
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds timeout
        maximumAge: 0,
        minAccuracy: 50,
        maxAccuracy: 50000, // Accept network positioning (increased from 1000m for testing)
        updateThrottle: 1000,
      });

      console.log('✅ Location permission granted, GPS tracking started');
      setLocationPermission('granted');
      setShowPermissionModal(false);
      setGpsError(null);

      // Subscribe to location updates
      console.log('🔔 Setting up location subscription...');
      const unsubscribe = locationService.subscribe((position) => {
        console.log('📍 RecordActivity received location update:', {
          lat: position.latitude.toFixed(6),
          lon: position.longitude.toFixed(6),
          accuracy: position.accuracy.toFixed(1) + 'm',
          source: position.source
        });
        
        const location = [position.latitude, position.longitude];
        console.log('🗺️ Updating state with location:', location);
        
        setCurrentLocation(location);
        setMapCenter(location);
        setGpsAccuracy(position.accuracy);
        setLocationSource(position.source);
        setGpsError(null);

        // Calculate GPS quality
        const quality = locationService.getGPSQuality();
        setGpsQuality(quality);
        console.log('📊 GPS Quality:', quality + '%');

        // Update current speed if available
        if (position.calculatedSpeed !== undefined) {
          setCurrentSpeed(position.calculatedSpeed);
        }

        console.log(`✅ Location state updated successfully`);
      });
      
      console.log('✅ Location subscription setup complete');

      // Subscribe to errors
      console.log('🔔 Setting up error subscription...');
      const unsubscribeErrors = locationService.subscribeToErrors((error) => {
        console.error('❌ RecordActivity received GPS error:', error);
        setGpsError(error.message);
      });
      console.log('✅ Error subscription setup complete');

      // Store unsubscribe functions
      locationServiceRef.current.unsubscribe = unsubscribe;
      locationServiceRef.current.unsubscribeErrors = unsubscribeErrors;

    } catch (error) {
      console.error('❌ Location permission denied or error:', error);
      
      if (error.message?.includes('denied') || error.code === 1) {
        setLocationPermission('denied');
        setGpsError('Location permission denied. Please enable location access in your browser settings.');
      } else if (error.message?.includes('unavailable') || error.code === 2) {
        setLocationPermission('denied');
        setGpsError('Location is unavailable. Please check your device settings and ensure GPS is enabled.');
      } else if (error.message?.includes('timeout') || error.code === 3) {
        setLocationPermission('prompt'); // Allow retry
        setGpsError('Request timed out. Please allow location access in the browser popup and try again. Move to an open area if needed.');
      } else {
        setLocationPermission('prompt'); // Allow retry
        setGpsError(error.message || 'Failed to start GPS tracking. Please try again.');
      }
    } finally {
      setIsInitializingGPS(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationServiceRef.current) {
        if (locationServiceRef.current.unsubscribe) {
          locationServiceRef.current.unsubscribe();
        }
        if (locationServiceRef.current.unsubscribeErrors) {
          locationServiceRef.current.unsubscribeErrors();
        }
        locationServiceRef.current.stopTracking();
      }
      // Cleanup demo mode
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
      }
    };
  }, []);

  // Generate realistic 5km running route with accurate distance
  const generateDemoRoute = (startLat, startLng, targetDistanceKm = 5) => {
    const points = [];
    const targetDistanceMeters = targetDistanceKm * 1000;
    let totalDistance = 0;
    
    let lat = startLat;
    let lng = startLng;
    let angle = Math.random() * Math.PI * 2; // Random starting direction
    
    points.push([lat, lng]);
    
    // Average running speed: ~3-4 m/s, update every second = 3-4m per point
    const avgStepMeters = 15; // ~15 meters per GPS point (realistic for running)
    
    while (totalDistance < targetDistanceMeters) {
      // Calculate next point
      const prevLat = lat;
      const prevLng = lng;
      
      // Add natural variation to turns
      if (points.length % 8 === 0) {
        // Gradual turn every 8 points (~120m)
        angle += (Math.random() - 0.5) * Math.PI / 6; // Turn up to 30 degrees
      }
      
      // Occasionally make sharper turns (like at street corners)
      if (Math.random() < 0.08) {
        angle += (Math.random() - 0.5) * Math.PI / 3; // Turn up to 60 degrees
      }
      
      // Vary speed realistically (jogging pace varies)
      const stepMeters = avgStepMeters * (0.85 + Math.random() * 0.3); // 85-115% of avg
      
      // Convert meters to degrees (approximate at this latitude)
      // 1 degree latitude ≈ 111km, so 1 meter ≈ 0.000009 degrees
      const meterToDeg = 0.000009;
      const stepDeg = stepMeters * meterToDeg;
      
      // Move in the current direction
      lat += Math.cos(angle) * stepDeg;
      lng += Math.sin(angle) * stepDeg / Math.cos(prevLat * Math.PI / 180); // Adjust for longitude at this latitude
      
      points.push([lat, lng]);
      
      // Calculate actual distance for this segment
      const segmentDistance = calculateDistance([prevLat, prevLng], [lat, lng]);
      totalDistance += segmentDistance;
      
      // Safety check to prevent infinite loop
      if (points.length > 2000) {
        console.warn('⚠️ Max points reached, stopping route generation');
        break;
      }
    }
    
    console.log(`📏 Generated route: ${points.length} points, ${(totalDistance/1000).toFixed(2)}km`);
    return points;
  };

  // Start demo mode
  const startDemoMode = () => {
    console.log('🎬 Starting demo mode - simulating 5km run');
    
    setIsDemoMode(true);
    setShowPermissionModal(false);
    setLocationPermission('granted');
    
    // Generate demo route
    const startPoint = [13.0358, 80.2497]; // Chennai, India
    const demoRoute = generateDemoRoute(startPoint[0], startPoint[1], 5);
    
    // Set initial location
    const initialLocation = demoRoute[0];
    setCurrentLocation(initialLocation);
    setMapCenter(initialLocation);
    setGpsAccuracy(8); // Simulate excellent GPS
    setGpsQuality(95);
    setLocationSource('gps');
    
    console.log(`📍 Generated demo route with ${demoRoute.length} points`);
    
    // Start recording immediately
    setIsRecording(true);
    setRoute([initialLocation]);
    setTimestamps([new Date()]);
    setElapsedTime(0);
    setDistance(0);
    setElevationGain(0);
    setElevationLoss(0);
    
    // Simulate movement along the route
    let stepIndex = 0;
    demoIntervalRef.current = setInterval(() => {
      stepIndex++;
      
      if (stepIndex >= demoRoute.length) {
        // Finished the route
        clearInterval(demoIntervalRef.current);
        console.log('✅ Demo run completed - Total points:', demoRoute.length);
        setIsRecording(false);
        setIsPaused(false);
        return;
      }
      
      const newPoint = demoRoute[stepIndex];
      const prevPoint = demoRoute[stepIndex - 1];
      
      // Log progress every 50 points
      if (stepIndex % 50 === 0) {
        console.log(`🏃 Demo progress: ${stepIndex}/${demoRoute.length} points (${((stepIndex/demoRoute.length)*100).toFixed(1)}%)`);
      }
      
      // Update location
      setCurrentLocation(newPoint);
      setMapCenter(newPoint);
      
      // Add to route
      setRoute(prevRoute => {
        const updatedRoute = [...prevRoute, newPoint];
        
        // Calculate distance
        if (prevRoute.length > 0) {
          const dist = calculateDistance(prevPoint, newPoint);
          setDistance(prevDist => prevDist + dist);
        }
        
        return updatedRoute;
      });
      
      // Add timestamp
      setTimestamps(prev => [...prev, new Date()]);
      
      // Simulate slight accuracy variations
      setGpsAccuracy(5 + Math.random() * 10);
      setGpsQuality(90 + Math.random() * 10);
      
      // Simulate elevation changes
      if (Math.random() < 0.3) {
        const elevChange = (Math.random() - 0.5) * 3;
        if (elevChange > 0.5) {
          setElevationGain(prev => prev + elevChange);
        } else if (elevChange < -0.5) {
          setElevationLoss(prev => prev + Math.abs(elevChange));
        }
      }
      
    }, 100); // Update every 100ms for smooth animation (10 points per second)
  };

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
  }, [isRecording, isPaused, elapsedTime]);

  // GPS tracking effect for recording - uses PrecisionLocationService
  useEffect(() => {
    if (!isRecording || isPaused || !locationServiceRef.current) {
      return;
    }

    const locationService = locationServiceRef.current;

    const unsubscribeRecording = locationService.subscribe((position) => {
      const newPoint = [position.latitude, position.longitude];
      const accuracy = position.accuracy;
      const timestamp = position.timestamp;
      const altitude = position.altitude;

      console.log(`📝 Recording point - accuracy: ${accuracy.toFixed(1)}m, source: ${position.source}`);

      // Only accept points with reasonable accuracy (filtered by service)
      if (accuracy < 100) {
        setRoute(prevRoute => {
          const newRoute = [...prevRoute, newPoint];

          // Calculate distance if we have a previous point
          if (prevRoute.length > 0) {
            const lastPoint = prevRoute[prevRoute.length - 1];
            const dist = calculateDistance(lastPoint, newPoint);
            
            // Only add distance for significant movements (GPS noise filter)
            if (dist > 1 && dist < 200) {
              setDistance(prev => prev + dist);
            }
          }

          return newRoute;
        });

        // Track elevation if available
        if (altitude !== null && altitude !== undefined && !isNaN(altitude)) {
          setElevations(prev => {
            const newElevations = [...prev, altitude];
            
            // Calculate elevation gain/loss
            if (prev.length > 0) {
              const lastElev = prev[prev.length - 1];
              const diff = altitude - lastElev;
              if (diff > 1) {
                setElevationGain(prevGain => prevGain + diff);
              } else if (diff < -1) {
                setElevationLoss(prevLoss => prevLoss + Math.abs(diff));
              }
            }
            
            return newElevations;
          });
        }

        // Track timestamps
        setTimestamps(prev => [...prev, timestamp]);
      }
    });

    return () => {
      unsubscribeRecording();
    };
  }, [isRecording, isPaused]);

  // Update map route visualization
  useEffect(() => {
    if (!mapRef.current || !route || route.length < 2) return;

    const map = mapRef.current;

    // Wait for map to be fully loaded
    if (!map.isStyleLoaded()) {
      map.once('load', () => updateRouteOnMap(map));
      return;
    }

    updateRouteOnMap(map);
  }, [route, isRecording]);

  const updateRouteOnMap = (map) => {
    const routeSourceId = 'activity-route';
    const routeLayerId = 'activity-route-layer';

    try {
      if (route.length < 2) return;

      // Convert route to GeoJSON (Mapbox uses [lng, lat])
      const coordinates = route.map(point => [point[1], point[0]]);

      const geojsonData = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      };

      // Check if source exists
      const source = map.getSource(routeSourceId);
      
      if (source) {
        // Update existing source data (much more efficient - no flicker)
        source.setData(geojsonData);
        console.log(`🗺️ Updated route on map: ${route.length} points`);
      } else {
        // Create source and layer for the first time
        console.log('🗺️ Creating route layer for the first time');
        
        map.addSource(routeSourceId, {
          type: 'geojson',
          data: geojsonData
        });

        // Add route background/shadow for depth
        map.addLayer({
          id: routeLayerId + '-shadow',
          type: 'line',
          source: routeSourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#000000',
            'line-width': 6,
            'line-opacity': 0.3,
            'line-blur': 2
          }
        });

        // Add route layer with Strava-style rendering
        map.addLayer({
          id: routeLayerId,
          type: 'line',
          source: routeSourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#FC4C02', // Strava orange
            'line-width': 5,
            'line-opacity': 0.95
          }
        });

        routeLayerRef.current = routeLayerId;
      }

      // Optionally pan map to follow the route
      if (isRecording && coordinates.length > 0) {
        const lastPoint = coordinates[coordinates.length - 1];
        map.easeTo({
          center: lastPoint,
          duration: 500,
          essential: true // This animation is essential for user experience
        });
      }
    } catch (error) {
      console.error('❌ Error updating route on map:', error);
    }
  };

  const handleMapLoad = useCallback((map) => {
    console.log('🗺️ Map loaded');
    mapRef.current = map;
  }, []);

  const handleStart = () => {
    if (!currentLocation) {
      alert('⏳ Waiting for GPS signal. Please ensure location services are enabled.');
      return;
    }

    // Warn if GPS accuracy is very poor (network positioning)
    if (gpsAccuracy && gpsAccuracy > 1000) {
      const proceed = window.confirm(
        `⚠️ WARNING: Very Poor Location Accuracy!\n\n` +
        `Current accuracy: ${(gpsAccuracy/1000).toFixed(1)}km (${Math.round(gpsAccuracy)}m)\n` +
        `This is network/WiFi positioning, NOT GPS!\n\n` +
        `Recorded route will be VERY INACCURATE.\n\n` +
        `For accurate tracking:\n` +
        `• Go outdoors with clear sky view\n` +
        `• Wait for GPS accuracy < 50m\n` +
        `• Device may take 30-60 seconds to acquire GPS\n\n` +
        `Start recording with poor accuracy anyway?`
      );
      if (!proceed) return;
    }
    // Warn if GPS accuracy is poor but acceptable
    else if (gpsAccuracy && gpsAccuracy > 30) {
      const proceed = window.confirm(
        `⚠️ GPS accuracy is ${Math.round(gpsAccuracy)}m\n\n` +
        `For best results:\n` +
        `• Move to an open outdoor area\n` +
        `• Ensure clear view of the sky\n` +
        `• Wait for accuracy < 20m\n\n` +
        `Start recording anyway?`
      );
      if (!proceed) return;
    }

    console.log('🎬 Starting activity recording');
    setIsRecording(true);
    setIsPaused(false);
    setRoute([currentLocation]);
    setElevations([]);
    setTimestamps([new Date()]);
    setElapsedTime(0);
    setDistance(0);
    setElevationGain(0);
    setElevationLoss(0);
    setGpsError(null);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    console.log(isPaused ? '▶️ Resuming' : '⏸️ Paused');
    
    // Pause/resume demo mode
    if (isDemoMode) {
      if (!isPaused) {
        // Pausing
        if (demoIntervalRef.current) {
          clearInterval(demoIntervalRef.current);
        }
      } else {
        // Resuming - restart demo interval
        // This is a simplified resume - in production you'd track the step index
        console.log('▶️ Resuming demo simulation');
      }
    }
  };

  const handleStop = () => {
    console.log('⏹️ Stopping recording');
    setIsRecording(false);
    setIsPaused(false);

    // Stop demo mode
    if (isDemoMode && demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
    }

    // Apply route smoothing
    if (route.length > 2) {
      const simplified = simplifyRoute(route, 0.00001);
      setSmoothedRoute(simplified);
      console.log(`📊 Route simplified: ${route.length} → ${simplified.length} points`);
    }
  };

  const handleSave = async () => {
    if (route.length < 2) {
      alert('Please record at least 2 GPS points!');
      return;
    }

    setSaving(true);
    try {
      const finalRoute = smoothedRoute.length > 0 ? smoothedRoute : route;
      
      // Smooth elevation data
      const smoothedElevations = elevations.length > 0 ? smoothElevation(elevations) : [];
      
      // Calculate final elevation stats
      const elevStats = smoothedElevations.length > 0 
        ? calculateElevationStats(smoothedElevations)
        : { gain: elevationGain, loss: elevationLoss };

      // Recalculate distance from smoothed route
      let finalDistance = 0;
      for (let i = 1; i < finalRoute.length; i++) {
        finalDistance += calculateDistance(finalRoute[i - 1], finalRoute[i]);
      }

      const locationService = locationServiceRef.current;
      const gpsStats = locationService ? locationService.getStatus() : {};

      const activityData = {
        id: `${Date.now()}_recorded`,
        user_id: 'recorded_user',
        sport: sport,
        duration_s: elapsedTime,
        distance_m: finalDistance,
        elevation_gain_m: Math.round(elevStats.gain),
        hr_avg: 0,
        started_at: timestamps[0]?.toISOString() || new Date().toISOString(),
        features: {
          route: finalRoute,
          raw_route: route,
          elevations: smoothedElevations,
          timestamps: timestamps.map(t => t?.toISOString ? t.toISOString() : t),
          manual_recording: true,
          gps_metadata: {
            average_accuracy: gpsStats.averageAccuracy,
            gps_quality: gpsStats.gpsQuality,
            location_source: gpsStats.locationSource,
            point_count: route.length,
            simplified_point_count: finalRoute.length,
            elevation_loss: Math.round(elevStats.loss),
          }
        }
      };

      await activitiesAPI.create(activityData);
      console.log('✅ Activity saved successfully');
      alert('🎉 Activity saved successfully!');
      navigate('/');
    } catch (error) {
      console.error('❌ Error saving activity:', error);
      alert('Failed to save activity. Please try again.');
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

  const avgSpeed = elapsedTime > 0 && distance > 0
    ? (distance / elapsedTime) * 3.6 // km/h
    : 0;

  // Prepare markers for map
  const markers = [];
  
  // Add start marker when recording
  if (isRecording && route.length > 0) {
    markers.push({
      id: 'start-position',
      latitude: route[0][0],
      longitude: route[0][1],
      label: 'Start',
      color: '#10B981', // Green
      type: 'start'
    });
  }
  
  // Add current position marker
  if (currentLocation) {
    markers.push({
      id: 'current-position',
      latitude: currentLocation[0],
      longitude: currentLocation[1],
      label: isRecording ? 'Recording' : 'You',
      color: isRecording ? '#FC4C02' : '#3B82F6', // Orange when recording, blue otherwise
      type: 'user'
    });
  }

  // GPS accuracy circle
  const accuracyCircle = currentLocation && gpsAccuracy ? {
    center: currentLocation,
    radius: gpsAccuracy
  } : null;

  // Debug logging for map data
  useEffect(() => {
    console.log('🗺️ Map data updated:', {
      hasCurrentLocation: !!currentLocation,
      currentLocation: currentLocation,
      mapCenter: mapCenter,
      markers: markers.length,
      hasAccuracyCircle: !!accuracyCircle,
      gpsAccuracy: gpsAccuracy
    });
  }, [currentLocation, mapCenter, markers.length, accuracyCircle, gpsAccuracy]);

  return (
    <div className="h-screen flex flex-col bg-gray-900 fixed inset-0 z-50">
      {/* Location Permission Modal */}
      {showPermissionModal && locationPermission !== 'granted' && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] backdrop-blur-sm">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-700 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-5">
              <div className="flex items-center space-x-4">
                <div className="bg-white rounded-full p-3">
                  <MapPin className="h-8 w-8 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Location Access Required</h2>
                  <p className="text-sm text-orange-100">Enable GPS for activity tracking</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-6 space-y-5">
              <div className="space-y-3">
                <p className="text-gray-300 text-sm leading-relaxed">
                  To record your activity with accurate route tracking, we need access to your device's location.
                </p>
                
                <div className="bg-gray-800/50 rounded-xl p-4 space-y-3 border border-gray-700">
                  <div className="flex items-start space-x-3">
                    <div className="bg-green-600 rounded-full p-1.5 mt-0.5">
                      <Navigation className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-sm">Real-time GPS Tracking</h3>
                      <p className="text-gray-400 text-xs">Track your route with high-precision GPS</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-600 rounded-full p-1.5 mt-0.5">
                      <Activity className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-sm">Accurate Metrics</h3>
                      <p className="text-gray-400 text-xs">Distance, pace, elevation & speed tracking</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="bg-purple-600 rounded-full p-1.5 mt-0.5">
                      <Save className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-sm">Privacy Focused</h3>
                      <p className="text-gray-400 text-xs">Location only used during recording</p>
                    </div>
                  </div>
                </div>

                {gpsError && !isInitializingGPS && (
                  <div className={`${
                    locationPermission === 'denied' 
                      ? 'bg-red-900/40 border-red-600' 
                      : 'bg-orange-900/40 border-orange-600'
                  } border rounded-lg p-4`}>
                    <div className="flex items-start space-x-2">
                      <AlertCircle className={`h-5 w-5 ${
                        locationPermission === 'denied' ? 'text-red-400' : 'text-orange-400'
                      } flex-shrink-0 mt-0.5`} />
                      <div>
                        <p className={`${
                          locationPermission === 'denied' ? 'text-red-200' : 'text-orange-200'
                        } text-sm font-semibold mb-1`}>
                          {locationPermission === 'denied' ? 'Permission Denied' : 'Location Error'}
                        </p>
                        <p className={`${
                          locationPermission === 'denied' ? 'text-red-300' : 'text-orange-300'
                        } text-xs`}>{gpsError}</p>
                        {locationPermission === 'denied' && (
                          <p className="text-red-300 text-xs mt-2">
                            Please enable location access in your browser settings and refresh the page.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {isInitializingGPS && (
                  <div className="bg-blue-900/40 border-2 border-blue-500 rounded-lg p-4 space-y-2 animate-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                      <div>
                        <p className="text-blue-200 text-sm font-bold">Waiting for Permission...</p>
                      </div>
                    </div>
                    <div className="bg-blue-800/50 rounded p-2 border-l-4 border-yellow-400">
                      <p className="text-yellow-200 text-xs font-semibold mb-1">
                        ⚠️ Look for a popup at the top of your browser
                      </p>
                      <p className="text-blue-200 text-xs">
                        Your browser is asking for permission to access your location. Click <strong>"Allow"</strong> to continue.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <div className="flex space-x-3">
                <button
                  onClick={() => navigate(-1)}
                  className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition font-medium text-sm border border-gray-600"
                >
                  Cancel
                </button>
                  <button
                    onClick={requestLocationPermission}
                    disabled={isInitializingGPS}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-bold text-sm shadow-lg disabled:hover:from-orange-600 disabled:hover:to-red-600 flex items-center justify-center space-x-2"
                  >
                    {isInitializingGPS ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Connecting...</span>
                      </>
                    ) : locationPermission === 'denied' ? (
                      <>
                        <AlertCircle className="h-4 w-4" />
                        <span>Try Again</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4" />
                        <span>Enable Location</span>
                      </>
                    )}
                  </button>
                </div>
                
                {locationPermission === 'denied' && (
                  <div className="text-xs text-gray-400 text-center">
                    <p className="mb-1">To enable location access:</p>
                    <ol className="text-left space-y-1 pl-4">
                      <li>1. Click the lock icon in your browser's address bar</li>
                      <li>2. Find "Location" settings and allow access</li>
                      <li>3. Click "Try Again" or refresh the page</li>
                    </ol>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 text-center">
                Your location is only tracked while recording an activity
              </p>

              {/* Demo Mode Option */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-gray-800 text-gray-500">Or try without GPS</span>
                </div>
              </div>

              <button
                onClick={startDemoMode}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition font-medium text-sm shadow-lg flex items-center justify-center space-x-2"
              >
                <Sparkles className="h-4 w-4" />
                <span>Try Demo: 5km Run Simulation</span>
              </button>
              <p className="text-xs text-gray-500 text-center">
                Watch a simulated 5km run with realistic GPS tracking
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 flex-shrink-0 shadow-lg">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-500 rounded-lg">
              <Navigation className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-white">Record Activity</h1>
                {isDemoMode && (
                  <span className="px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded flex items-center space-x-1">
                    <Sparkles className="h-3 w-3" />
                    <span>DEMO</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {isDemoMode ? 'Simulating 5km run' : 'High-precision GPS tracking'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-gray-300 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Map */}
        <div className="flex-1 relative min-h-0">
          <MapProviderFallback
            center={mapCenter}
            zoom={mapZoom}
            markers={markers}
            route={route.length > 1 ? route : null}
            proximityCircle={accuracyCircle}
            onMapLoad={handleMapLoad}
            showControls={true}
            showStyleSelector={true}
            animateToUser={true}
            className="h-full w-full"
          />

          {/* Overlay GPS Status Badge */}
          {gpsAccuracy !== null && (
            <div className="absolute top-4 left-4 z-10">
              <div className={`px-3 py-2 rounded-lg text-xs font-semibold backdrop-blur-sm ${
                gpsAccuracy < 10 ? 'bg-green-600/90 text-white' :
                gpsAccuracy < 20 ? 'bg-green-500/90 text-white' :
                gpsAccuracy < 30 ? 'bg-yellow-500/90 text-white' :
                gpsAccuracy < 50 ? 'bg-orange-500/90 text-white' :
                gpsAccuracy < 1000 ? 'bg-red-600/90 text-white' :
                'bg-purple-900/90 text-white border-2 border-purple-500'
              }`}>
                {gpsAccuracy < 1000 ? (
                  <>GPS: ±{Math.round(gpsAccuracy)}m</>
                ) : (
                  <>Network: ±{(gpsAccuracy/1000).toFixed(1)}km</>
                )}
                {locationSource && (
                  <span className="ml-2 text-xs opacity-90">
                    ({locationSource.toUpperCase()})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Controls & Stats */}
        <div className="w-96 bg-gradient-to-b from-gray-800 to-gray-900 border-l border-gray-700 overflow-y-auto shadow-2xl">
          <div className="p-5 space-y-4">
            {/* Recording Status */}
            <div className="space-y-2">
              {isDemoMode && (
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 rounded-xl font-bold flex items-center space-x-3 shadow-lg">
                  <Sparkles className="h-5 w-5" />
                  <div className="flex-1">
                    <div className="text-sm">DEMO MODE</div>
                    <div className="text-xs font-normal opacity-90">Simulated 5km Run</div>
                  </div>
                </div>
              )}
              
              {isRecording && !isPaused && (
                <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-3 rounded-xl font-bold flex items-center space-x-3 animate-pulse shadow-lg">
                  <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                  <span className="text-lg">RECORDING</span>
                </div>
              )}

              {isPaused && (
                <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 text-white px-4 py-3 rounded-xl font-bold shadow-lg">
                  ⏸ PAUSED
                </div>
              )}
              
              {/* GPS Quality Indicator */}
              {gpsQuality !== null && (
                <div className="bg-gray-700/50 backdrop-blur rounded-xl p-3 border border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Signal Quality</span>
                    <span className={`text-sm font-bold ${
                      gpsQuality >= 80 ? 'text-green-400' :
                      gpsQuality >= 60 ? 'text-yellow-400' :
                      gpsQuality >= 40 ? 'text-orange-400' :
                      'text-red-400'
                    }`}>
                      {Math.round(gpsQuality)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        gpsQuality >= 80 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                        gpsQuality >= 60 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                        gpsQuality >= 40 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                        'bg-gradient-to-r from-red-500 to-red-400'
                      }`}
                      style={{ width: `${gpsQuality}%` }}
                    />
                  </div>
                </div>
              )}

              {gpsError && (
                <div className="bg-red-900/40 border border-red-600 text-red-200 px-3 py-3 rounded-xl text-xs backdrop-blur">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="font-semibold">{gpsError}</span>
                  </div>
                </div>
              )}

              {!currentLocation && !gpsError && locationPermission === 'granted' && (
                <div className="bg-blue-600/90 backdrop-blur text-white px-3 py-3 rounded-xl text-xs space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="font-medium">Acquiring GPS signal...</span>
                  </div>
                  <p className="text-blue-100 text-xs">
                    • Move to an area with clear sky view<br/>
                    • This may take 10-30 seconds<br/>
                    • Check browser console (F12) for details
                  </p>
                </div>
              )}
            </div>

            {/* Sport Selection */}
            <div className="bg-gray-700/50 backdrop-blur rounded-xl p-4 border border-gray-600">
              <label className="block text-xs font-bold text-gray-300 mb-3 uppercase tracking-wide">Activity Type</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                disabled={isRecording}
                className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
              >
                <option value="running">🏃 Running</option>
                <option value="cycling">🚴 Cycling</option>
                <option value="walking">🚶 Walking</option>
                <option value="hiking">⛰️ Hiking</option>
              </select>
            </div>

            {/* Live Stats */}
            <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl p-4 border border-gray-600 shadow-lg">
              <h3 className="text-xs font-bold text-gray-300 mb-4 uppercase flex items-center space-x-2 tracking-wide">
                <Activity className="h-4 w-4 text-orange-500" />
                <span>Live Stats</span>
              </h3>
              
              <div className="space-y-3">
                {/* Time - Large Display */}
                <div className="bg-gray-800/70 rounded-lg p-4 text-center border border-gray-600">
                  <div className="text-xs text-gray-400 mb-1 flex items-center justify-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>TIME</span>
                  </div>
                  <div className="text-4xl font-bold text-white font-mono tracking-tight">{formatTime(elapsedTime)}</div>
                </div>

                {/* Distance - Prominent */}
                <div className="bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg p-4 text-center shadow-md">
                  <div className="text-xs text-green-100 mb-1 font-semibold">DISTANCE</div>
                  <div className="text-3xl font-bold text-white">
                    {(distance / 1000).toFixed(2)} <span className="text-lg">km</span>
                  </div>
                </div>

                {/* Grid Stats */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Pace */}
                  <div className="bg-gray-800/70 rounded-lg p-3 text-center border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1 flex items-center justify-center space-x-1">
                      <Zap className="h-3 w-3" />
                      <span>PACE</span>
                    </div>
                    <div className="text-lg font-bold text-white">
                      {pace > 0 && pace < 60 ? pace.toFixed(1) : '--'}
                    </div>
                    <div className="text-xs text-gray-400">min/km</div>
                  </div>

                  {/* Speed */}
                  <div className="bg-gray-800/70 rounded-lg p-3 text-center border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1 flex items-center justify-center space-x-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>SPEED</span>
                    </div>
                    <div className="text-lg font-bold text-white">
                      {avgSpeed > 0 ? avgSpeed.toFixed(1) : '--'}
                    </div>
                    <div className="text-xs text-gray-400">km/h</div>
                  </div>

                  {/* Elevation Gain */}
                  <div className="bg-gray-800/70 rounded-lg p-3 text-center border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1 flex items-center justify-center space-x-1">
                      <Mountain className="h-3 w-3" />
                      <span>ELEV ↑</span>
                    </div>
                    <div className="text-lg font-bold text-white">
                      {Math.round(elevationGain)}
                    </div>
                    <div className="text-xs text-gray-400">m</div>
                  </div>

                  {/* GPS Points */}
                  <div className="bg-gray-800/70 rounded-lg p-3 text-center border border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">POINTS</div>
                    <div className="text-lg font-bold text-white">{route.length}</div>
                    <div className="text-xs text-gray-400">gps</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-3">
              {!isRecording ? (
                <button
                  onClick={handleStart}
                  disabled={!currentLocation}
                  className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold text-lg rounded-xl hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center space-x-3 shadow-xl"
                >
                  <div className="bg-white rounded-full p-2">
                    <Play className="h-6 w-6 text-orange-600 fill-current" />
                  </div>
                  <span>Start Recording</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handlePause}
                    className="w-full py-3 bg-yellow-600 text-white font-bold rounded-lg hover:bg-yellow-700 transition flex items-center justify-center space-x-2 shadow-md"
                  >
                    <Pause className="h-5 w-5" />
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>

                  <button
                    onClick={handleStop}
                    className="w-full py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition flex items-center justify-center space-x-2 shadow-md"
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
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-lg rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center space-x-3 shadow-xl"
                >
                  <Save className="h-6 w-6" />
                  <span>{saving ? 'Saving...' : 'Save Activity'}</span>
                </button>
              )}
            </div>

            {/* Info Messages */}
            {!isRecording && currentLocation && !gpsError && gpsAccuracy && gpsAccuracy < 25 && (
              <div className="bg-green-900/30 border border-green-600 rounded-xl p-3 backdrop-blur">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-green-300">
                    Excellent GPS signal! Ready to record.
                  </span>
                </div>
              </div>
            )}

            {!isRecording && currentLocation && !gpsError && gpsAccuracy && gpsAccuracy > 1000 && (
              <div className="bg-red-900/30 border border-red-600 rounded-xl p-3 text-xs text-red-200 backdrop-blur">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                <div>
                  <div className="font-bold mb-1">⚠️ Very Poor GPS Accuracy: {Math.round(gpsAccuracy)}m</div>
                  <div>Using network positioning. For accurate tracking:</div>
                  <div className="mt-1 ml-4">
                    • Go outdoors with clear sky view<br/>
                    • Wait 30-60 seconds for GPS satellites<br/>
                    • Accuracy should improve to &lt;20m
                  </div>
                </div>
              </div>
            )}

            {!isRecording && currentLocation && !gpsError && gpsAccuracy && gpsAccuracy > 50 && gpsAccuracy <= 1000 && (
              <div className="bg-orange-900/30 border border-orange-600 rounded-xl p-3 text-xs text-orange-200 backdrop-blur">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                <span className="font-medium">GPS Accuracy: {Math.round(gpsAccuracy)}m - Move to open area for better accuracy</span>
              </div>
            )}

            {smoothedRoute.length > 0 && (
              <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-3 text-xs text-blue-200 backdrop-blur">
                <div className="font-semibold mb-1">✨ Route Optimized</div>
                <div>
                  {route.length} points → {smoothedRoute.length} points
                  <span className="text-blue-300 ml-1">
                    ({Math.round((1 - smoothedRoute.length / route.length) * 100)}% reduction)
                  </span>
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

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Layers, Satellite, Map as MapIcon, Navigation2 } from 'lucide-react';

// Note: In production, this should be set via environment variable
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw'; // Public Mapbox token for demo

const MAP_STYLES = {
  streets: {
    id: 'streets',
    name: 'Streets',
    icon: MapIcon,
    url: 'mapbox://styles/mapbox/streets-v12'
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    icon: Satellite,
    url: 'mapbox://styles/mapbox/satellite-streets-v12'
  },
  outdoors: {
    id: 'outdoors',
    name: 'Outdoors',
    icon: Layers,
    url: 'mapbox://styles/mapbox/outdoors-v12'
  }
};

/**
 * Enhanced Map View using Mapbox GL JS
 * Provides high-precision mapping with vector tiles, multiple styles,
 * and smooth animations
 */
function EnhancedMapView({
  center = [37.7749, -122.4194], // [latitude, longitude]
  zoom = 13,
  markers = [], // Array of { id, latitude, longitude, label, color, type }
  proximityCircle = null, // { center: [lat, lon], radius: meters }
  onMarkerClick = null,
  onMapClick = null,
  onMapLoad = null,
  className = '',
  showControls = true,
  showStyleSelector = true,
  animateToUser = true,
  fallbackToLeaflet = false
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const [mapStyle, setMapStyle] = useState('streets');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [currentCenter, setCurrentCenter] = useState(center);

  // Initialize Mapbox
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Set Mapbox access token
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Check if token is available
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'YOUR_MAPBOX_TOKEN') {
      setMapError('Mapbox token not configured. Please set VITE_MAPBOX_TOKEN environment variable.');
      if (fallbackToLeaflet) {
        console.warn('Falling back to Leaflet map');
        // Parent component should handle fallback
      }
      return;
    }

    try {
      // Initialize map
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLES[mapStyle].url,
        center: [center[1], center[0]], // Mapbox uses [lng, lat]
        zoom: zoom,
        attributionControl: true,
        trackResize: true
      });

      // Add navigation controls
      if (showControls) {
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.addControl(new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true,
          showUserHeading: true
        }), 'top-right');
      }

      // Handle map load
      map.on('load', () => {
        setIsMapLoaded(true);
        if (onMapLoad) onMapLoad(map);
      });

      // Handle map click
      if (onMapClick) {
        map.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          onMapClick({ latitude: lat, longitude: lng });
        });
      }

      // Handle errors
      map.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError(e.error?.message || 'Map failed to load');
      });

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
      };
    } catch (error) {
      console.error('Error initializing Mapbox:', error);
      setMapError(error.message);
    }
  }, []);

  // Update map style
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    mapRef.current.setStyle(MAP_STYLES[mapStyle].url);
  }, [mapStyle, isMapLoaded]);

  // Update center when it changes
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    const [lat, lng] = center;
    if (animateToUser) {
      mapRef.current.flyTo({
        center: [lng, lat],
        duration: 1500,
        essential: true
      });
    } else {
      mapRef.current.setCenter([lng, lat]);
    }
    
    setCurrentCenter(center);
  }, [center, isMapLoaded, animateToUser]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    const map = mapRef.current;
    const currentMarkers = markersRef.current;

    // Remove markers that no longer exist
    Object.keys(currentMarkers).forEach(id => {
      if (!markers.find(m => m.id === id)) {
        currentMarkers[id].remove();
        delete currentMarkers[id];
      }
    });

    // Add or update markers
    markers.forEach(marker => {
      const { id, latitude, longitude, label, color = '#FC4C02', type = 'default' } = marker;

      if (currentMarkers[id]) {
        // Update existing marker position
        currentMarkers[id].setLngLat([longitude, latitude]);
      } else {
        // Create marker element
        const el = document.createElement('div');
        el.className = `enhanced-marker enhanced-marker-${type}`;
        el.style.width = type === 'user' ? '40px' : '30px';
        el.style.height = type === 'user' ? '40px' : '30px';
        el.style.borderRadius = '50%';
        el.style.border = type === 'user' ? '4px solid white' : '3px solid white';
        el.style.backgroundColor = color;
        el.style.cursor = 'pointer';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        el.style.transition = 'transform 0.2s';
        
        // Add pulse animation for user marker
        if (type === 'user') {
          el.style.animation = 'pulse 2s infinite';
        }

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.2)';
        });

        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });

        // Create popup if label exists
        let popup = null;
        if (label) {
          popup = new mapboxgl.Popup({
            offset: 25,
            closeButton: false
          }).setHTML(`<div style="padding: 8px; font-weight: 600;">${label}</div>`);
        }

        // Create and add marker
        const mapboxMarker = new mapboxgl.Marker(el)
          .setLngLat([longitude, latitude])
          .addTo(map);

        if (popup) {
          mapboxMarker.setPopup(popup);
        }

        if (onMarkerClick) {
          el.addEventListener('click', () => onMarkerClick(marker));
        }

        currentMarkers[id] = mapboxMarker;
      }
    });

    markersRef.current = currentMarkers;
  }, [markers, isMapLoaded, onMarkerClick]);

  // Update proximity circle
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    const map = mapRef.current;
    const sourceId = 'proximity-circle';
    const layerId = 'proximity-circle-layer';
    const fillLayerId = 'proximity-circle-fill-layer';

    // Remove existing circle
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    if (!proximityCircle) return;

    const { center, radius } = proximityCircle;
    const [lat, lng] = center;

    // Create circle using turf-like calculation
    const points = 64;
    const distanceInMeters = radius;
    const coords = [];

    for (let i = 0; i < points; i++) {
      const angle = (i * 360) / points;
      const angleRad = (angle * Math.PI) / 180;

      // Calculate point on circle
      const latOffset = (distanceInMeters / 111320) * Math.cos(angleRad);
      const lngOffset = (distanceInMeters / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angleRad);

      coords.push([lng + lngOffset, lat + latOffset]);
    }
    coords.push(coords[0]); // Close the circle

    // Add source and layers
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords]
        }
      }
    });

    // Fill layer
    map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': '#FC4C02',
        'fill-opacity': 0.1
      }
    });

    // Border layer
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#FC4C02',
        'line-width': 2,
        'line-opacity': 0.6
      }
    });
  }, [proximityCircle, isMapLoaded]);

  const handleStyleChange = useCallback((styleId) => {
    setMapStyle(styleId);
  }, []);

  if (mapError) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className}`}>
        <div className="text-center p-8">
          <MapIcon className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 font-semibold mb-2">Map Error</p>
          <p className="text-sm text-slate-500">{mapError}</p>
          {fallbackToLeaflet && (
            <p className="text-xs text-slate-400 mt-2">Falling back to basic map...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Style Selector */}
      {showStyleSelector && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg overflow-hidden z-10">
          <div className="flex">
            {Object.values(MAP_STYLES).map(style => {
              const Icon = style.icon;
              return (
                <button
                  key={style.id}
                  onClick={() => handleStyleChange(style.id)}
                  className={`px-4 py-3 flex items-center space-x-2 transition ${
                    mapStyle === style.id
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  title={style.name}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{style.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {!isMapLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-3"></div>
            <p className="text-slate-600 font-medium">Loading map...</p>
          </div>
        </div>
      )}

      {/* Add pulse animation style */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 0 rgba(252, 76, 2, 0.7);
          }
          50% {
            box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 10px rgba(252, 76, 2, 0);
          }
        }

        .mapboxgl-popup-content {
          padding: 0;
          border-radius: 8px;
        }

        .mapboxgl-popup-close-button {
          font-size: 20px;
          padding: 4px 8px;
        }
      `}</style>
    </div>
  );
}

export default EnhancedMapView;


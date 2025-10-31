import { useState, useEffect } from 'react';
import EnhancedMapView from './EnhancedMapView';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons for Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * Map Provider with Fallback System
 * Tries Mapbox first, falls back to Leaflet/OpenStreetMap on failure
 */
function MapProviderFallback({
  center,
  zoom = 13,
  markers = [],
  proximityCircle = null,
  onMarkerClick = null,
  onMapClick = null,
  onMapLoad = null,
  className = '',
  showControls = true,
  showStyleSelector = true,
  animateToUser = true
}) {
  const [useMapbox, setUseMapbox] = useState(true);
  const [mapboxError, setMapboxError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;

  // Check if Mapbox token is available
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const hasMapboxToken = mapboxToken && mapboxToken !== 'YOUR_MAPBOX_TOKEN';

  useEffect(() => {
    // Auto-fallback to Leaflet if no Mapbox token
    if (!hasMapboxToken) {
      setUseMapbox(false);
      setMapboxError('Mapbox token not configured');
    }
  }, [hasMapboxToken]);

  const handleMapboxError = (error) => {
    console.error('Mapbox error:', error);
    setMapboxError(error);
    
    // Retry up to MAX_RETRIES times
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying Mapbox (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      setRetryCount(prev => prev + 1);
      
      // Wait before retry
      setTimeout(() => {
        setMapboxError(null);
      }, 2000);
    } else {
      // Fall back to Leaflet
      console.log('Falling back to Leaflet/OpenStreetMap');
      setUseMapbox(false);
    }
  };

  const handleRetryMapbox = () => {
    setMapboxError(null);
    setRetryCount(0);
    setUseMapbox(true);
  };

  // Try Mapbox first
  if (useMapbox && hasMapboxToken && !mapboxError) {
    return (
      <div className="relative w-full h-full">
        <EnhancedMapView
          center={center}
          zoom={zoom}
          markers={markers}
          proximityCircle={proximityCircle}
          onMarkerClick={onMarkerClick}
          onMapClick={onMapClick}
          onMapLoad={onMapLoad}
          className={className}
          showControls={showControls}
          showStyleSelector={showStyleSelector}
          animateToUser={animateToUser}
          fallbackToLeaflet={false}
        />
        
        {/* Error overlay */}
        {mapboxError && retryCount < MAX_RETRIES && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
            <div className="text-center p-6">
              <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
              <p className="text-slate-700 font-medium mb-2">Map loading issue</p>
              <p className="text-sm text-slate-600 mb-4">Retrying...</p>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback to Leaflet
  return (
    <div className="relative w-full h-full">
      {/* Fallback notification */}
      {mapboxError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-50 border border-yellow-200 rounded-lg p-3 shadow-lg flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-900">Using basic map</p>
            <p className="text-xs text-yellow-700">Enhanced features unavailable</p>
          </div>
          <button
            onClick={handleRetryMapbox}
            className="p-2 hover:bg-yellow-100 rounded-lg transition"
            title="Retry enhanced map"
          >
            <RefreshCw className="h-4 w-4 text-yellow-700" />
          </button>
        </div>
      )}

      {/* Leaflet Map */}
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className={className}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Current user marker */}
        {markers.filter(m => m.type === 'user').map(marker => (
          <Marker
            key={marker.id}
            position={[marker.latitude, marker.longitude]}
            eventHandlers={{
              click: () => onMarkerClick?.(marker)
            }}
          >
            <Popup>
              <div className="font-semibold">{marker.label}</div>
            </Popup>
          </Marker>
        ))}

        {/* Other markers */}
        {markers.filter(m => m.type !== 'user').map(marker => (
          <Marker
            key={marker.id}
            position={[marker.latitude, marker.longitude]}
            eventHandlers={{
              click: () => onMarkerClick?.(marker)
            }}
          >
            <Popup>
              <div className="font-semibold">{marker.label}</div>
            </Popup>
          </Marker>
        ))}

        {/* Proximity circle */}
        {proximityCircle && (
          <Circle
            center={[proximityCircle.center[0], proximityCircle.center[1]]}
            radius={proximityCircle.radius}
            pathOptions={{ 
              color: '#FC4C02', 
              fillColor: '#FC4C02', 
              fillOpacity: 0.1,
              weight: 2
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}

export default MapProviderFallback;


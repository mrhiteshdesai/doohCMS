import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { Screen } from '../services/screen';
import { Monitor, Wifi, WifiOff } from 'lucide-react';
import { GOOGLE_MAPS_LIBRARIES } from '../constants/maps';

interface ScreenMapProps {
  screens: Screen[];
  onScreenClick: (id: string) => void;
  apiKey?: string;
  className?: string;
}

// Map container style
const containerStyle = {
  width: '100%',
  height: '100%'
};

// Default center (London)
const defaultCenter = {
  lat: 51.505,
  lng: -0.09
};

const ScreenMap: React.FC<ScreenMapProps> = ({ screens, onScreenClick, apiKey, className }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(null);

  const screensWithLocation = useMemo(() => {
    return screens
      .map(s => {
        let lat = s.latitude;
        let lng = s.longitude;
        let locationStr = '';

        // Handle location being an object or string
        if (s.location) {
          if (typeof s.location === 'object') {
            const loc = s.location as any;
            locationStr = loc.label || '';
            if ((lat === null || lat === undefined) && loc.lat !== undefined) lat = parseFloat(loc.lat);
            if ((lng === null || lng === undefined) && loc.lng !== undefined) lng = parseFloat(loc.lng);
          } else if (typeof s.location === 'string') {
             try {
                const loc = JSON.parse(s.location);
                locationStr = loc.label || '';
                if ((lat === null || lat === undefined) && loc.lat !== undefined) lat = parseFloat(loc.lat);
                if ((lng === null || lng === undefined) && loc.lng !== undefined) lng = parseFloat(loc.lng);
             } catch (e) {
                locationStr = s.location;
             }
          }
        }

        return { 
          ...s, 
          displayLocation: locationStr,
          lat, 
          lng 
        };
      })
      .filter(s => s.lat != null && s.lng != null && !isNaN(s.lat) && !isNaN(s.lng));
  }, [screens]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Fit bounds when screens change or map loads
  useEffect(() => {
    if (isLoaded && map && screensWithLocation.length > 0 && window.google && window.google.maps) {
      const bounds = new google.maps.LatLngBounds();
      screensWithLocation.forEach(screen => {
        if (screen.lat != null && screen.lng != null) {
          bounds.extend({ lat: screen.lat, lng: screen.lng });
        }
      });
      map.fitBounds(bounds);
      
      // If only one marker, zoom out a bit to avoid too close zoom
      if (screensWithLocation.length === 1) {
        const listener = google.maps.event.addListener(map, "idle", () => { 
          if (map.getZoom()! > 15) map.setZoom(15); 
          google.maps.event.removeListener(listener); 
        });
      }
    }
  }, [map, screensWithLocation, isLoaded]);

  if (loadError) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center p-4 text-red-500 ${className || 'h-[600px]'}`}>
        <div className="text-center">
          <p className="font-semibold">Map Error</p>
          <p className="text-sm">{loadError.message}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-[600px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative z-0 ${className || 'h-[600px]'}`}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        {screensWithLocation.map((screen) => (
          <MarkerF
            key={screen.id}
            position={{ lat: screen.lat!, lng: screen.lng! }}
            onClick={() => setSelectedScreen(screen)}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: screen.status === 'ONLINE' ? '#22c55e' : '#ef4444', // green-500 : red-500
              fillOpacity: 1,
              strokeColor: 'white',
              strokeWeight: 2,
            }}
          />
        ))}

        {selectedScreen && (
          <InfoWindowF
            position={{ 
              lat: (selectedScreen as any).lat || selectedScreen.latitude!, 
              lng: (selectedScreen as any).lng || selectedScreen.longitude! 
            }}
            onCloseClick={() => setSelectedScreen(null)}
          >
            <div className="min-w-[200px] p-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-800 text-base">{selectedScreen.name}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  selectedScreen.status === 'ONLINE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {selectedScreen.status === 'ONLINE' ? 'Online' : 'Offline'}
                </span>
              </div>
              
              <div className="space-y-1 text-sm text-gray-600 mb-3">
                <p>Orientation: {selectedScreen.orientation}</p>
                <p>Player: {selectedScreen.playerType || 'Browser'}</p>
                {(selectedScreen as any).displayLocation && (
                    <p className="truncate max-w-[200px]" title={(selectedScreen as any).displayLocation}>
                        Loc: {(selectedScreen as any).displayLocation}
                    </p>
                )}
              </div>

              <button 
                onClick={() => {
                  onScreenClick(selectedScreen.id);
                  setSelectedScreen(null);
                }}
                className="w-full py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
              >
                Manage Screen
              </button>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
      
      {screensWithLocation.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-[1000] pointer-events-none">
          <div className="text-center p-6 bg-white rounded-xl shadow-lg border border-gray-200">
            <p className="text-gray-500 font-medium">No screens have location data set.</p>
            <p className="text-sm text-gray-400 mt-1">Edit a screen to add latitude/longitude.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenMap;

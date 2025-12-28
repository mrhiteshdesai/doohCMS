import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, HeatmapLayerF } from '@react-google-maps/api';
import { Screen } from '../services/screen';
import { GOOGLE_MAPS_LIBRARIES } from '../constants/maps';

interface ScreenHeatmapProps {
  screens: Screen[];
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

const ScreenHeatmap: React.FC<ScreenHeatmapProps> = ({ screens, apiKey, className }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);

  const screensWithLocation = useMemo(() => {
    return screens
      .map(s => {
        let lat = s.latitude;
        let lng = s.longitude;
        
        // Handle location being an object or string (same logic as ScreenMap)
        if (s.location) {
          if (typeof s.location === 'object') {
            const loc = s.location as any;
            if ((lat === null || lat === undefined) && loc.lat !== undefined) lat = parseFloat(loc.lat);
            if ((lng === null || lng === undefined) && loc.lng !== undefined) lng = parseFloat(loc.lng);
          } else if (typeof s.location === 'string') {
             try {
                const loc = JSON.parse(s.location);
                if ((lat === null || lat === undefined) && loc.lat !== undefined) lat = parseFloat(loc.lat);
                if ((lng === null || lng === undefined) && loc.lng !== undefined) lng = parseFloat(loc.lng);
             } catch (e) {
                // Ignore parsing errors
             }
          }
        }

        return { lat, lng };
      })
      .filter(s => s.lat != null && s.lng != null && !isNaN(s.lat) && !isNaN(s.lng));
  }, [screens]);

  const [vizLibraryLoaded, setVizLibraryLoaded] = useState(false);

  // Check if visualization library is actually loaded
  useEffect(() => {
    if (isLoaded && window.google?.maps?.visualization) {
      setVizLibraryLoaded(true);
    } else if (isLoaded && !window.google?.maps?.visualization) {
        console.error('ScreenHeatmap: Google Maps loaded but visualization library is missing.');
    }
  }, [isLoaded]);

  const heatmapData = useMemo(() => {
    if (!isLoaded || !window.google || !window.google.maps || !window.google.maps.LatLng) return [];
    // Log data count for debugging
    // console.log('ScreenHeatmap: Generating heatmap data for', screensWithLocation.length, 'screens');
    return screensWithLocation.map(s => new google.maps.LatLng(s.lat!, s.lng!));
  }, [screensWithLocation, isLoaded]);

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
      
      // If only one marker, zoom out a bit
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
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center ${className || 'h-[600px]'}`}>
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
        {vizLibraryLoaded && heatmapData.length > 0 && (
            <HeatmapLayerF
            data={heatmapData}
            options={{
                radius: 30,
                opacity: 0.6
            }}
            />
        )}
        
        {screensWithLocation.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-[1000] pointer-events-none">
            <div className="text-center p-6 bg-white rounded-xl shadow-lg border border-gray-200">
              <p className="text-gray-500 font-medium">No location data available.</p>
            </div>
          </div>
        )}
      </GoogleMap>
    </div>
  );
};

export default ScreenHeatmap;

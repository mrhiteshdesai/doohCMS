import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { CircleF, GoogleMap, InfoWindowF, useJsApiLoader } from '@react-google-maps/api';
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

type DensityPoint = {
  key: string;
  lat: number;
  lng: number;
  count: number;
};

const bubbleStyles = [
  { threshold: 10, radius: 30000, fillColor: '#1d4ed8', fillOpacity: 0.45 },
  { threshold: 5, radius: 20000, fillColor: '#2563eb', fillOpacity: 0.35 },
  { threshold: 2, radius: 12000, fillColor: '#3b82f6', fillOpacity: 0.28 },
  { threshold: 1, radius: 7000, fillColor: '#60a5fa', fillOpacity: 0.2 },
];

const ScreenHeatmap: React.FC<ScreenHeatmapProps> = ({ screens, apiKey, className }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<DensityPoint | null>(null);

  const densityPoints = useMemo(() => {
    const buckets = new Map<string, DensityPoint>();

    screens.forEach((screen) => {
      let lat = screen.latitude;
      let lng = screen.longitude;

      if (screen.location) {
        if (typeof screen.location === 'object') {
          const loc = screen.location as any;
          if ((lat === null || lat === undefined) && loc.lat !== undefined) lat = parseFloat(loc.lat);
          if ((lng === null || lng === undefined) && loc.lng !== undefined) lng = parseFloat(loc.lng);
        } else if (typeof screen.location === 'string') {
          try {
            const loc = JSON.parse(screen.location);
            if ((lat === null || lat === undefined) && loc.lat !== undefined) lat = parseFloat(loc.lat);
            if ((lng === null || lng === undefined) && loc.lng !== undefined) lng = parseFloat(loc.lng);
          } catch (e) {
            // Ignore parsing errors for free-form location text.
          }
        }
      }

      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
        return;
      }

      // Bucket close devices together so the map still conveys density without HeatmapLayer.
      const bucketLat = Number(lat.toFixed(2));
      const bucketLng = Number(lng.toFixed(2));
      const key = `${bucketLat}:${bucketLng}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(key, {
          key,
          lat: bucketLat,
          lng: bucketLng,
          count: 1,
        });
      }
    });

    return [...buckets.values()].sort((a, b) => b.count - a.count);
  }, [screens]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Fit bounds when screens change or map loads
  useEffect(() => {
    if (isLoaded && map && densityPoints.length > 0 && window.google && window.google.maps) {
      const bounds = new google.maps.LatLngBounds();
      densityPoints.forEach(point => {
        bounds.extend({ lat: point.lat, lng: point.lng });
      });
      map.fitBounds(bounds);
      
      // If only one marker, zoom out a bit
      if (densityPoints.length === 1) {
        const listener = google.maps.event.addListener(map, "idle", () => { 
          if (map.getZoom()! > 15) map.setZoom(15); 
          google.maps.event.removeListener(listener); 
        });
      }
    }
  }, [map, densityPoints, isLoaded]);

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
        {densityPoints.map((point) => {
          const style =
            bubbleStyles.find((entry) => point.count >= entry.threshold) ??
            bubbleStyles[bubbleStyles.length - 1];

          return (
            <CircleF
              key={point.key}
              center={{ lat: point.lat, lng: point.lng }}
              radius={style.radius}
              onClick={() => setSelectedPoint(point)}
              options={{
                fillColor: style.fillColor,
                fillOpacity: style.fillOpacity,
                strokeColor: '#1e3a8a',
                strokeOpacity: 0.5,
                strokeWeight: 1,
                clickable: true,
              }}
            />
          );
        })}

        {selectedPoint && (
          <InfoWindowF
            position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
            onCloseClick={() => setSelectedPoint(null)}
          >
            <div className="min-w-[140px] p-1">
              <div className="text-sm font-semibold text-gray-800">Density Bubble</div>
              <div className="mt-1 text-sm text-gray-600">
                {selectedPoint.count} screen{selectedPoint.count === 1 ? '' : 's'} nearby
              </div>
            </div>
          </InfoWindowF>
        )}
        
        {densityPoints.length === 0 && (
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

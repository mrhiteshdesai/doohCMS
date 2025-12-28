import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { X, RotateCw, Tag, MapPin, Smartphone, Loader } from 'lucide-react';
import api from '../services/api';
import { getTenantSettings } from '../services/tenant';
import { GoogleMap, useJsApiLoader, MarkerF, Autocomplete } from '@react-google-maps/api';
import SearchableSelect from './SearchableSelect';
import { GOOGLE_MAPS_LIBRARIES } from '../constants/maps';

interface EditScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  screen: any;
}

interface EditScreenFormUIProps {
  formData: any;
  loading: boolean;
  error: string;
  onClose: () => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleOrientationChange: (val: any) => void;
  handlePlayerTypeChange: (val: string | number) => void;
  handleSubmit: (e: React.FormEvent) => void;
  renderLocationInput: () => ReactNode;
  renderMap: () => ReactNode;
}

const EditScreenFormUI = ({
  formData,
  loading,
  error,
  onClose,
  handleChange,
  handleOrientationChange,
  handlePlayerTypeChange,
  handleSubmit,
  renderLocationInput,
  renderMap
}: EditScreenFormUIProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Edit Screen</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
          {/* Left Column: Form */}
          <div className="p-6 overflow-y-auto border-r border-gray-100">
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            <form id="edit-screen-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Screen Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Lobby Display"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="h-px bg-gray-100 my-4" />

              {/* Orientation & Player Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orientation</label>
                  <SearchableSelect
                    icon={<RotateCw size={18} className="text-gray-400" />}
                    value={formData.orientation}
                    onChange={handleOrientationChange}
                    options={[
                      { value: "LANDSCAPE", label: "Landscape" },
                      { value: "PORTRAIT", label: "Portrait" }
                    ]}
                    triggerClassName="w-full pl-3 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Player Type</label>
                  <SearchableSelect
                    icon={<Smartphone size={18} className="text-gray-400" />}
                    value={formData.playerType}
                    onChange={handlePlayerTypeChange}
                    options={[
                      { value: "Browser", label: "Browser" },
                      { value: "Android App", label: "Android App" },
                      { value: "WebOS APP", label: "WebOS APP" },
                      { value: "Tizen App", label: "Tizen App" }
                    ]}
                    triggerClassName="w-full pl-3 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    name="tags"
                    placeholder="lobby, ground-floor"
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.tags}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location Search</label>
                <div className="relative mb-3">
                  <MapPin className="absolute left-3 top-3 text-gray-400 z-10" size={18} />
                  {renderLocationInput()}
                </div>
                
                {/* Auto-filled details */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                   <div>
                    <label className="text-xs text-gray-500 mb-1 block">City</label>
                    <input
                      type="text"
                      name="city"
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">State</label>
                    <input
                      type="text"
                      name="state"
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Zip/Pin</label>
                    <input
                      type="text"
                      name="zip"
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm"
                      value={formData.zip}
                      onChange={handleChange}
                      placeholder="Zip"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      name="lat"
                      placeholder="0.000000"
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm"
                      value={formData.lat}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      name="lng"
                      placeholder="0.000000"
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm"
                      value={formData.lng}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Right Column: Map */}
          <div className="bg-gray-100 relative h-full min-h-[400px]">
            {renderMap()}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-screen-form"
            disabled={loading}
            className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 font-medium shadow-sm"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MapEnabledEditForm = ({ 
  apiKey, 
  formData, 
  setFormData, 
  ...uiProps 
}: any) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
    preventGoogleFontsLoading: true,
  });

  const [authError, setAuthError] = useState(false);

  useEffect(() => {
      const handleAuthFailure = () => {
          console.error("Google Maps Authentication Failure");
          setAuthError(true);
      };

      (window as any).gm_authFailure = handleAuthFailure;

      return () => {
          (window as any).gm_authFailure = null;
      };
  }, []);

  if (loadError || authError) {
    const message = authError 
        ? "Google Maps Auth Error: Check API Key & Billing" 
        : `Google Maps Error: ${loadError?.message || 'Failed to load'}`;
        
    console.error("Google Maps Load/Auth Error:", loadError || "Auth Failure");
    
    return (
      <MapDisabledEditForm 
        formData={formData} 
        {...uiProps} 
        customMessage={message}
      />
    );
  }

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const defaultCenter = { lat: 19.1251922, lng: 72.8466434 };
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Update map center when lat/lng changes externally (e.g. from screen prop)
  useEffect(() => {
    if (formData.lat && formData.lng && isLoaded && map) {
       const lat = parseFloat(formData.lat);
       const lng = parseFloat(formData.lng);
       if (!isNaN(lat) && !isNaN(lng)) {
         setMapCenter({ lat, lng });
         // map.panTo({ lat, lng }); // Optional: auto pan
       }
    }
  }, [formData.lat, formData.lng, isLoaded, map]);

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (!place.geometry || !place.geometry.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      let city = '';
      let state = '';
      let zip = '';

      if (place.address_components) {
        for (const component of place.address_components) {
          const types = component.types;
          if (types.includes('locality')) city = component.long_name;
          if (types.includes('administrative_area_level_1')) state = component.short_name;
          if (types.includes('postal_code')) zip = component.long_name;
        }
      }

      setFormData((prev: any) => ({
        ...prev,
        locationLabel: place.formatted_address || '',
        lat: lat.toFixed(6),
        lng: lng.toFixed(6),
        city,
        state,
        zip
      }));

      setMapCenter({ lat, lng });
      map?.panTo({ lat, lng });
      map?.setZoom(15);
    }
  };

  const mapPosition = formData.lat && formData.lng 
    ? { lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) }
    : mapCenter;

  return (
    <EditScreenFormUI
      {...uiProps}
      formData={formData}
      renderLocationInput={() => isLoaded ? (
        <Autocomplete
          onLoad={ref => autocompleteRef.current = ref}
          onPlaceChanged={onPlaceChanged}
        >
          <input
            type="text"
            name="locationLabel"
            placeholder="Search for a location..."
            className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.locationLabel}
            onChange={uiProps.handleChange}
          />
        </Autocomplete>
      ) : (
        <input
          type="text"
          disabled
          placeholder="Loading Maps..."
          className="w-full pl-10 pr-3 py-2 border rounded-lg bg-gray-100 text-gray-500"
        />
      )}
      renderMap={() => isLoaded ? (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={mapPosition}
          zoom={13}
          onLoad={onMapLoad}
          onUnmount={onUnmount}
          options={{
              disableDefaultUI: false,
              streetViewControl: false,
              mapTypeControl: false
          }}
        >
          {formData.lat && formData.lng && (
              <MarkerF position={{ lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) }} />
          )}
        </GoogleMap>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Loader className="animate-spin mb-2" size={32} />
            <p>Loading Google Maps...</p>
        </div>
      )}
    />
  );
};

const MapDisabledEditForm = ({ formData, customMessage, ...uiProps }: any) => {
  return (
    <EditScreenFormUI
      {...uiProps}
      formData={formData}
      renderLocationInput={() => (
        <input
          type="text"
          name="locationLabel"
          placeholder="Location Label (Maps Key Missing)"
          className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          value={formData.locationLabel}
          onChange={uiProps.handleChange}
        />
      )}
      renderMap={() => (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <div className="text-center p-6">
              <MapPin size={48} className="mx-auto mb-2 opacity-20" />
              <p className="font-medium text-gray-600 mb-1">{customMessage || 'Google Maps API Key not configured'}</p>
              {!customMessage && <p className="text-xs mt-1">Go to Settings &gt; Integrations to configure it.</p>}
              {customMessage && <p className="text-xs mt-1 text-red-500 max-w-xs mx-auto">Please check your Google Cloud Console settings.</p>}
          </div>
        </div>
      )}
    />
  );
};

const EditScreenModal = ({ isOpen, onClose, onSuccess, screen }: EditScreenModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    tags: '',
    orientation: 'LANDSCAPE',
    playerType: 'Browser',
    locationLabel: '',
    lat: '',
    lng: '',
    city: '',
    state: '',
    zip: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
        const fetchSettings = async () => {
          try {
            const settings = await getTenantSettings();
            if (settings.config.googleMapsApiKey) {
              setGoogleMapsApiKey(settings.config.googleMapsApiKey);
            } else {
              setGoogleMapsApiKey(null);
            }
          } catch (err) {
            console.error('Failed to load tenant settings', err);
            setGoogleMapsApiKey(null);
          } finally {
            setSettingsLoaded(true);
          }
        };
        fetchSettings();
    } else {
        setSettingsLoaded(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (screen) {
      // Parse location/tags if they come as string from backend (SQLite JSON is stringified)
      let tags = screen.tags || [];
      if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch {}
      }
      
      let location = screen.location || {};
      if (typeof location === 'string') {
        try { location = JSON.parse(location); } catch {}
      }

      // Prioritize root latitude/longitude fields, fallback to location object
      const lat = screen.latitude ?? location.lat ?? '';
      const lng = screen.longitude ?? location.lng ?? '';

      setFormData({
        name: screen.name || '',
        tags: Array.isArray(tags) ? tags.join(', ') : '',
        orientation: screen.orientation || 'LANDSCAPE',
        playerType: screen.playerType || 'Browser',
        locationLabel: location.label || '',
        lat: String(lat),
        lng: String(lng),
        city: location.city || '',
        state: location.state || '',
        zip: location.zip || ''
      });
    }
  }, [screen]);

  if (!isOpen) return null;

  if (!settingsLoaded) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 flex flex-col items-center">
                <Loader className="animate-spin mb-2 text-blue-600" size={24} />
                <p className="text-gray-600 text-sm">Loading...</p>
            </div>
        </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
        orientation: formData.orientation,
        playerType: formData.playerType,
        location: {
          label: formData.locationLabel,
          lat: formData.lat ? parseFloat(formData.lat) : null,
          lng: formData.lng ? parseFloat(formData.lng) : null,
          city: formData.city,
          state: formData.state,
          zip: formData.zip
        }
      };

      await api.put(`/screens/${screen.id}`, payload);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Update failed:', err);
      const errorMessage = err.response?.data?.message 
        || err.message 
        || 'Failed to update screen';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const commonProps = {
    formData,
    loading,
    error,
    onClose,
    handleChange,
    handleOrientationChange: (val: any) => setFormData(prev => ({ ...prev, orientation: val })),
    handlePlayerTypeChange: (val: string | number) => setFormData(prev => ({ ...prev, playerType: String(val) })),
    handleSubmit,
  };

  if (googleMapsApiKey) {
    return <MapEnabledEditForm apiKey={googleMapsApiKey} setFormData={setFormData} {...commonProps} />;
  }

  return <MapDisabledEditForm {...commonProps} />;
};

export default EditScreenModal;

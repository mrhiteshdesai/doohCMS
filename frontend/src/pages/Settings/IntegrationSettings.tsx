import React from 'react';
import { TenantSettings } from '../../services/tenant';

interface Props {
  settings: TenantSettings;
  onChange: (key: string, value: any) => void;
}

const IntegrationSettings: React.FC<Props> = ({ settings, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Integrations</h3>
        <p className="mt-1 text-sm text-gray-500">
          Central place to manage external data sources for your widgets.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div className="sm:col-span-6">
          <label htmlFor="weatherApiKey" className="block text-sm font-medium text-gray-700">
            Weather API Key (OpenWeatherMap)
          </label>
          <div className="mt-1">
            <input
              type="password"
              name="weatherApiKey"
              id="weatherApiKey"
              value={settings.config.weatherApiKey || ''}
              onChange={(e) => onChange('weatherApiKey', e.target.value)}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Required for Weather widgets to function.
          </p>
        </div>

        <div className="sm:col-span-6">
          <label htmlFor="googleMapsApiKey" className="block text-sm font-medium text-gray-700">
            Google Maps API Key
          </label>
          <div className="mt-1">
            <input
              type="password"
              name="googleMapsApiKey"
              id="googleMapsApiKey"
              value={settings.config.googleMapsApiKey || ''}
              onChange={(e) => onChange('googleMapsApiKey', e.target.value)}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Required for Google Maps widgets to function.
          </p>
        </div>

        <div className="sm:col-span-6">
          <label className="block text-sm font-medium text-gray-700">News Feed URLs (RSS)</label>
          <div className="mt-1">
             <textarea
              rows={3}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"
              value={(settings.config.newsFeedUrls || []).join('\n')}
              onChange={(e) => onChange('newsFeedUrls', e.target.value.split('\n'))}
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            One URL per line. Used by the News Ticker widget.
          </p>
        </div>

        {/* AWS S3 Configuration Removed - Moved to Storage & Maintenance */}

      </div>
    </div>
  );
};

export default IntegrationSettings;

import React from 'react';
import { TenantSettings } from '../../services/tenant';
import SearchableSelect from '../../components/SearchableSelect';

interface Props {
  settings: TenantSettings;
  onChange: (key: string, value: any) => void;
}

const RegionalSettings: React.FC<Props> = ({ settings, onChange }) => {
  const timezones = [
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'Europe/London',
    'Europe/Paris',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney'
  ];

  const timezoneOptions = timezones.map(tz => ({ label: tz, value: tz }));
  const timeFormatOptions = [
    { value: "12h", label: "12-hour (AM/PM)" },
    { value: "24h", label: "24-hour" }
  ];
  const orientationOptions = [
    { value: "LANDSCAPE", label: "Landscape" },
    { value: "PORTRAIT", label: "Portrait" }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Regional & Defaults</h3>
        <p className="mt-1 text-sm text-gray-500">
          Set baseline behavior for new items to save time.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
            Global Timezone
          </label>
          <div className="mt-1">
            <SearchableSelect
              value={settings.config.timezone || 'UTC'}
              onChange={(val) => onChange('timezone', val)}
              options={timezoneOptions}
              triggerClassName="w-full border rounded px-3 py-2 bg-white"
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="timeFormat" className="block text-sm font-medium text-gray-700">
            Time Format
          </label>
          <div className="mt-1">
            <SearchableSelect
              value={settings.config.timeFormat || '24h'}
              onChange={(val) => onChange('timeFormat', val)}
              options={timeFormatOptions}
              triggerClassName="w-full border rounded px-3 py-2 bg-white"
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="defaultDuration" className="block text-sm font-medium text-gray-700">
            Default Slide Duration (seconds)
          </label>
          <div className="mt-1">
            <input
              type="number"
              name="defaultDuration"
              id="defaultDuration"
              min="1"
              value={settings.config.defaultDuration || 10}
              onChange={(e) => onChange('defaultDuration', parseInt(e.target.value))}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="defaultOrientation" className="block text-sm font-medium text-gray-700">
            Default Screen Orientation
          </label>
          <div className="mt-1">
            <SearchableSelect
              value={settings.config.defaultOrientation || 'LANDSCAPE'}
              onChange={(val) => onChange('defaultOrientation', val)}
              options={orientationOptions}
              triggerClassName="w-full border rounded px-3 py-2 bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionalSettings;

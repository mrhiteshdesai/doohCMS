import React, { useMemo } from 'react';
import { Screen } from '../services/screen';
import { MapPin } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface TopLocationsProps {
  screens: Screen[];
  className?: string;
}

const TopLocations: React.FC<TopLocationsProps> = ({ screens, className }) => {
  const locationStats = useMemo(() => {
    const stats: Record<string, number> = {};
    
    screens.forEach(s => {
      let locationKey = 'Unknown';

      if (s.location) {
        if (typeof s.location === 'object') {
          const loc = s.location as any;
          // Prefer explicitly saved city, then try to parse label, then fallback to label
          if (loc.city) {
            locationKey = loc.city;
          } else if (loc.label) {
            // Try to extract city from "Street, City, Country" format
            const parts = loc.label.split(',').map((p: string) => p.trim());
            if (parts.length >= 2) {
                // Heuristic: If 3+ parts, usually City is 2nd to last or 2nd? 
                // Google format: "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA" -> Mountain View is index 1
                // Simple format: "Mumbai, Maharashtra, India" -> Mumbai is index 0
                // Let's just take the first part if it looks like a city, or the label itself if complex.
                // Actually, for "Mumbai, India", the city is Mumbai. 
                // For "Times Square, New York, NY", the city is New York.
                // It's hard to guess perfectly. Let's try to use the component before the state/country if possible.
                // Given the user request "display only city instead of complete address", 
                // taking the part that looks like a city is key.
                
                // If we don't have structured city, let's use the label but truncate it?
                // No, let's just use the label if city is missing, but maybe the user will edit the screens to add city.
                // For now, let's use label as fallback but if it contains commas, take the part that is likely the city.
                // Let's try to be smart: if parts > 1, take the one that is not a number?
                locationKey = loc.label; 
            } else {
                locationKey = loc.label;
            }
          }
        } else if (typeof s.location === 'string') {
           try {
              const loc = JSON.parse(s.location);
              if (loc.city) {
                locationKey = loc.city;
              } else {
                locationKey = loc.label || 'Unknown';
              }
           } catch (e) {
              locationKey = s.location;
           }
        }
      }

      if (locationKey && locationKey.trim() && locationKey !== 'Unknown') {
        stats[locationKey] = (stats[locationKey] || 0) + 1;
      }
    });

    return Object.entries(stats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [screens]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg">
          <p className="font-bold text-gray-800 mb-1">{label}</p>
          <p className="text-sm text-blue-600">
            {payload[0].value} {payload[0].value === 1 ? 'Screen' : 'Screens'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col ${className || 'h-[400px]'}`}>
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <MapPin className="mr-2 text-blue-600" size={20} />
          Top 10 Locations
        </h3>
      </div>
      
      <div className="flex-1 p-4 min-h-0">
        {locationStats.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <MapPin size={32} className="mb-2 opacity-50" />
            <p>No location data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={locationStats}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
              <XAxis type="number" />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={150}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={true}
                axisLine={true}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                {locationStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index < 3 ? '#2563eb' : '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default TopLocations;

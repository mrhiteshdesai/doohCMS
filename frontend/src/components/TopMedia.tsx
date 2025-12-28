import React, { useMemo } from 'react';
import { PlayCircle } from 'lucide-react';
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

interface TopMediaProps {
  data: Array<{ name: string; plays: number }>;
  className?: string;
}

const TopMedia: React.FC<TopMediaProps> = ({ data, className }) => {
  // Sort by plays descending and take top 5
  const topMedia = useMemo(() => {
    return [...data]
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5);
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg">
          <p className="font-bold text-gray-800 mb-1">{label}</p>
          <p className="text-sm text-purple-600">
            {payload[0].value} {payload[0].value === 1 ? 'Play' : 'Plays'}
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
          <PlayCircle className="mr-2 text-purple-600" size={20} />
          Top 5 Played Media
        </h3>
      </div>
      
      <div className="flex-1 p-4 min-h-0">
        {topMedia.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <PlayCircle size={32} className="mb-2 opacity-50" />
            <p>No media play data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topMedia}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={150}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
              <Bar dataKey="plays" radius={[0, 4, 4, 0]} barSize={20}>
                {topMedia.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index < 3 ? '#9333ea' : '#c084fc'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default TopMedia;

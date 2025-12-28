import React from 'react';
import { Layout, LayoutZone } from '../../../types/layout';
import { Layers, Plus, Square } from 'lucide-react';

interface LeftSidebarProps {
  layout: Layout;
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
  onAddZone: () => void;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({
  layout,
  selectedZoneId,
  onSelectZone,
  onAddZone
}) => {
  // Sort zones by zIndex descending (top layers first)
  const sortedZones = [...layout.zones].sort((a, b) => b.zIndex - a.zIndex);

  // Zone colors palette (must match Canvas.tsx)
  const zoneColors = [
    '#e0f2fe', '#dbeafe', '#eff6ff', '#f0fdf4', '#ecfdf5',
    '#fef2f2', '#fff7ed', '#fffbeb', '#f5f3ff', '#f8fafc',
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b">
        <button
          onClick={onAddZone}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>Add Zone</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
            <Layers size={14} />
            Layers
          </h3>
          <div className="space-y-1">
            {sortedZones.map((zone) => {
              const originalIndex = layout.zones.findIndex(z => z.id === zone.id);
              // Fallback to 0 if not found
              const safeIndex = originalIndex >= 0 ? originalIndex : 0;
              const zoneColor = zoneColors[safeIndex % zoneColors.length];
              
              return (
                <button
                  key={zone.id}
                  onClick={() => onSelectZone(zone.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedZoneId === zone.id
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div 
                    className="w-4 h-4 rounded border border-gray-200 flex-shrink-0" 
                    style={{ backgroundColor: zoneColor }}
                  />
                  <span className="truncate">{zone.name}</span>
                  <span className="ml-auto text-xs text-gray-400">z-{zone.zIndex}</span>
                </button>
              );
            })}
            
            {sortedZones.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                No zones yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeftSidebar;

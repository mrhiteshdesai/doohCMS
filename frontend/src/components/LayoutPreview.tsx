import React from 'react';
import { Layout } from '../types/layout';

interface LayoutPreviewProps {
  layout: Layout;
  className?: string;
}

const LayoutPreview: React.FC<LayoutPreviewProps> = ({ layout, className = '' }) => {
  // Zone colors palette (matching Canvas.tsx and LeftSidebar.tsx)
  const zoneColors = [
    '#e0f2fe', '#dbeafe', '#eff6ff', '#f0fdf4', '#ecfdf5',
    '#fef2f2', '#fff7ed', '#fffbeb', '#f5f3ff', '#f8fafc',
  ];

  const zones = layout.zones || [];

  return (
    <div className={`relative bg-white overflow-hidden border border-gray-100 ${className}`}>
      {/* Container that maintains aspect ratio based on layout dimensions */}
      <div 
        className="w-full h-full relative"
        style={{
          // If the parent doesn't enforce size, we can use aspect-ratio here
          // But usually the parent container controls the size.
          // We'll rely on absolute positioning percentages.
        }}
      >
        {zones.map((zone, index) => {
          const zoneColor = zoneColors[index % zoneColors.length];
          
          return (
            <div
              key={zone.id}
              className="absolute border border-gray-300/50 flex items-center justify-center text-[10px] text-gray-400 overflow-hidden"
              style={{
                left: `${(zone.x / layout.canvasWidth) * 100}%`,
                top: `${(zone.y / layout.canvasHeight) * 100}%`,
                width: `${(zone.width / layout.canvasWidth) * 100}%`,
                height: `${(zone.height / layout.canvasHeight) * 100}%`,
                backgroundColor: zoneColor,
                zIndex: zone.zIndex
              }}
              title={`${zone.name} (${zone.width}x${zone.height})`}
            >
              {/* Only show text if the zone is large enough */}
              {(zone.width / layout.canvasWidth) > 0.2 && (zone.height / layout.canvasHeight) > 0.2 && (
                <span className="opacity-50 select-none">{index + 1}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LayoutPreview;

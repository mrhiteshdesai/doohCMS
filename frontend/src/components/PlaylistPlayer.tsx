import React, { useEffect, useState, useRef } from 'react';
import ZonePlayer from './ZonePlayer';

interface PlaylistPlayerProps {
  playlist: {
    canvasWidth: number;
    canvasHeight: number;
    zones: any[];
  };
}

const PlaylistPlayer: React.FC<PlaylistPlayerProps> = ({ playlist }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      
      const padding = 20;
      const availableWidth = Math.max(0, clientWidth - padding * 2);
      const availableHeight = Math.max(0, clientHeight - padding * 2);

      const scaleX = availableWidth / playlist.canvasWidth;
      const scaleY = availableHeight / playlist.canvasHeight;
      const newScale = Math.min(scaleX, scaleY, 1);
      
      setScale(isFinite(newScale) && newScale > 0 ? newScale : 0.1);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [playlist.canvasWidth, playlist.canvasHeight]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden bg-gray-900 relative">
      <div 
        className="relative shadow-2xl bg-white"
        style={{
          width: playlist.canvasWidth * scale,
          height: playlist.canvasHeight * scale,
        }}
      >
        <div 
          className="origin-top-left overflow-hidden"
          style={{
            width: playlist.canvasWidth,
            height: playlist.canvasHeight,
            transform: `scale(${scale})`,
          }}
        >
          {playlist.zones.map((zone) => (
            <div
              key={zone.id}
              className="absolute overflow-hidden"
              style={{
                left: zone.x,
                top: zone.y,
                width: zone.width,
                height: zone.height,
                zIndex: zone.zIndex,
                transform: `rotate(${zone.rotation || 0}deg)` 
              }}
            >
              <ZonePlayer items={zone.items || []} zoneWidth={zone.width} zoneHeight={zone.height} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlaylistPlayer;

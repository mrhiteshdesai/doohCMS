import React from 'react';
import { PlaySquare } from 'lucide-react';
import { getFullUrl } from '../utils/url';

// Define minimal types needed for the thumbnail
interface Media {
  id: string;
  type: string;
  url: string;
  mimeType: string;
}

interface PlaylistZoneItem {
  media?: Media;
}

interface PlaylistZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  items: PlaylistZoneItem[];
}

interface PlaylistData {
  id: string;
  name: string;
  canvasWidth?: number;
  canvasHeight?: number;
  zones?: PlaylistZone[];
  thumbnailUrl?: string;
}

interface PlaylistThumbnailProps {
  playlist: PlaylistData;
  className?: string;
}

const PlaylistThumbnail: React.FC<PlaylistThumbnailProps> = ({ playlist, className = '' }) => {
  // If we have a static thumbnail URL, use it (legacy or override)
  if (playlist.thumbnailUrl) {
    return (
      <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
        <img 
          src={getFullUrl(playlist.thumbnailUrl)} 
          alt={playlist.name} 
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const width = playlist.canvasWidth || 1920;
  const height = playlist.canvasHeight || 1080;
  const zones = playlist.zones || [];

  // If no zones or canvas info, show fallback
  if (zones.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-300 ${className}`}>
        <PlaySquare size={32} />
      </div>
    );
  }

  return (
    <div className={`relative bg-gray-900 overflow-hidden ${className}`}>
      {/* Container maintaining aspect ratio via absolute positioning percentages */}
      <div className="w-full h-full relative">
        {zones.map((zone) => {
          const item = zone.items && zone.items.length > 0 ? zone.items[0] : null;
          
          return (
            <div
              key={zone.id}
              className="absolute overflow-hidden flex items-center justify-center bg-gray-800"
              style={{
                left: `${(zone.x / width) * 100}%`,
                top: `${(zone.y / height) * 100}%`,
                width: `${(zone.width / width) * 100}%`,
                height: `${(zone.height / height) * 100}%`,
                zIndex: zone.zIndex,
              }}
            >
              {item && item.media ? (
                item.media.type === 'IMAGE' || item.media.mimeType.startsWith('image') ? (
                  <img
                    src={getFullUrl(item.media.url)}
                    alt=""
                    className="w-full h-full object-fill"
                    loading="lazy"
                  />
                ) : (
                  <video
                    src={getFullUrl(item.media.url)}
                    className="w-full h-full object-fill"
                    muted
                    preload="metadata"
                    // Optional: autoPlay on hover could be handled by parent or state, 
                    // but for a list of many playlists, best to keep static or minimal.
                  />
                )
              ) : (
                <div className="w-full h-full bg-gray-700/50 flex items-center justify-center">
                  {/* Empty zone placeholder */}
                  <div className="w-2 h-2 rounded-full bg-white/10"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlaylistThumbnail;

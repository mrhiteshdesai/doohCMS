import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';
import PlaylistPlayer from './PlaylistPlayer';

interface PlaylistPreviewModalProps {
  playlistId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const PlaylistPreviewModal = ({ playlistId, isOpen, onClose }: PlaylistPreviewModalProps) => {
  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && playlistId) {
      fetchPlaylist();
    } else {
      setPlaylist(null);
    }
  }, [isOpen, playlistId]);

  const fetchPlaylist = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/playlists/${playlistId}`);
      setPlaylist(res.data);
    } catch (error) {
      console.error('Failed to fetch playlist', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex-none p-4 flex justify-between items-center text-white bg-black/40 z-[10000]">
        <div>
          {loading ? (
             <h2 className="text-xl font-bold">Loading...</h2>
          ) : playlist ? (
            <div>
              <h2 className="text-xl font-bold">{playlist.name} <span className="text-sm font-normal opacity-70">(Preview)</span></h2>
              <p className="text-xs opacity-60">
                {playlist.canvasWidth || 1920}x{playlist.canvasHeight || 1080}
              </p>
            </div>
          ) : (
             <h2 className="text-xl font-bold text-red-400">Error Loading</h2>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
        {loading ? (
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        ) : playlist ? (
           <PlaylistPlayer 
             playlist={{
               ...playlist,
               canvasWidth: playlist.canvasWidth || 1920,
               canvasHeight: playlist.canvasHeight || 1080,
               zones: playlist.zones || []
             }} 
           />
        ) : (
           <div className="text-white/50">Playlist data not available</div>
        )}
      </div>
    </div>
  );
};

export default PlaylistPreviewModal;

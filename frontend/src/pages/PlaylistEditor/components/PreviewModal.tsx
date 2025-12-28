import React from 'react';
import { X } from 'lucide-react';
import { PlaylistEditorState } from '../../../types/playlist';
import PlaylistPlayer from '../../../components/PlaylistPlayer';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: PlaylistEditorState;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, playlist }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex-none p-4 flex justify-between items-center text-white bg-black/40 z-[10000]">
        <div>
          <h2 className="text-xl font-bold">{playlist.name} <span className="text-sm font-normal opacity-70">(Preview)</span></h2>
          <p className="text-xs opacity-60">{playlist.canvasWidth}x{playlist.canvasHeight}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Canvas Container Wrapper */}
      <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
        <PlaylistPlayer playlist={playlist} />
      </div>
    </div>
  );
};

export default PreviewModal;

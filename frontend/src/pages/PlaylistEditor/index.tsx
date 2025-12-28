import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlaylistEditorState, Zone, MediaFile } from '../../types/playlist';
import { Widget } from '../../types/widget';
import * as playlistService from '../../services/playlist';
import LeftSidebar from './components/LeftSidebar';
import Canvas from './components/Canvas';
import RightSidebar from './components/RightSidebar';
import PreviewModal from './components/PreviewModal';
import CustomCanvasModal from './components/CustomCanvasModal';
import PublishModal from './components/PublishModal';
import ChangeLayoutModal from './components/ChangeLayoutModal';
import { ArrowLeft, Save, Play, Share, LayoutTemplate } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Layout } from '../../types/layout';

const PlaylistEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showCustomCanvasModal, setShowCustomCanvasModal] = useState(false);
  const [showChangeLayoutModal, setShowChangeLayoutModal] = useState(false);
  const [playlist, setPlaylist] = useState<PlaylistEditorState | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  useEffect(() => {
    loadPlaylist();
  }, [id]);

  const loadPlaylist = async () => {
    if (!id) return;
    try {
      const data = await playlistService.getPlaylist(id);
      console.log('Loaded playlist data:', data); // Debug log
      
      // Map API response to Editor State (supports media and widget items)
      setPlaylist({
        id: data.id,
        name: data.name,
        resolution: data.resolution || "1920x1080",
        canvasWidth: data.canvasWidth || 1920,
        canvasHeight: data.canvasHeight || 1080,
        orientation: (data.orientation as 'LANDSCAPE' | 'PORTRAIT' | 'CUSTOM') || 'LANDSCAPE',
        zones: data.zones.map((z: any) => ({
          ...z,
          items: z.items.map((i: any) => {
            const base = {
              id: i.id,
              order: i.order,
              duration: i.duration
            } as any;
            if (i.media) {
              return {
                ...base,
                mediaId: i.mediaId,
                media: {
                  id: i.media.id,
                  filename: i.media.name,
                  originalName: i.media.name,
                  mimeType: i.media.mimeType,
                  size: i.media.size,
                  url: i.media.url,
                  type: i.media.mimeType.startsWith('image') ? 'IMAGE' : 'VIDEO',
                  duration: i.media.duration
                }
              };
            }
            if (i.widget) {
              const cfg = typeof i.widget.config === 'string' ? JSON.parse(i.widget.config) : i.widget.config;
              return {
                ...base,
                widget: {
                  id: i.widget.id,
                  name: i.widget.name,
                  type: i.widget.type,
                  config: cfg
                }
              };
            }
            return base;
          })
        }))
      });
      if (data.zones && data.zones.length > 0) {
        setSelectedZoneId(data.zones[0].id);
      }
    } catch (error) {
      console.error("Failed to load playlist", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!playlist || !id) return;
    setSaving(true);
    try {
      await playlistService.updatePlaylist(id, {
        name: playlist.name,
        resolution: playlist.resolution,
        canvasWidth: playlist.canvasWidth,
        canvasHeight: playlist.canvasHeight,
        orientation: playlist.orientation,
        zones: playlist.zones.map(z => ({
          name: z.name,
          x: Math.round(z.x),
          y: Math.round(z.y),
          width: Math.round(z.width),
          height: Math.round(z.height),
          zIndex: z.zIndex,
          rotation: Math.round(z.rotation),
          items: z.items.map((item, index) => {
            if ((item as any).widget) {
              return {
                widgetId: (item as any).widget.id,
                duration: item.duration,
                order: index,
                type: 'WIDGET'
              };
            }
            return {
              mediaId: item.mediaId!,
              duration: item.duration,
              order: index,
              type: 'MEDIA'
            };
          })
        }))
      });
      // Show success toast?
      setSaveMessage('Playlist saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error("Failed to save", error);
      setSaveMessage('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddZone = (media: MediaFile, x: number, y: number) => {
    if (!playlist) return;
    
    // Create a new zone with this media
    // Default size? Maybe 500x500 or based on media aspect ratio if known?
    // Let's default to 1/4 of canvas or fixed size
    const newZoneId = uuidv4();
    const newZone: Zone = {
      id: newZoneId,
      name: `Zone ${playlist.zones.length + 1}`,
      x,
      y,
      width: 400,
      height: 300,
      zIndex: playlist.zones.length + 1,
      rotation: 0,
      items: [{
        id: uuidv4(),
        mediaId: media.id,
        media,
        order: 0,
        duration: media.type === 'VIDEO' ? (media.duration || 10) : 10
      }]
    };

    setPlaylist({
      ...playlist,
      zones: [...playlist.zones, newZone]
    });
    setSelectedZoneId(newZoneId);
  };

  const handleAddWidgetZone = (widget: Widget, x: number, y: number) => {
    if (!playlist) return;
    const newZoneId = uuidv4();
    const newZone: Zone = {
      id: newZoneId,
      name: `${widget.name}`,
      x,
      y,
      width: 400,
      height: 300,
      zIndex: playlist.zones.length + 1,
      rotation: 0,
      items: [{
        id: uuidv4(),
        order: 0,
        duration: 10,
        widget: {
          id: widget.id,
          name: widget.name,
          type: widget.type,
          config: widget.config
        }
      }]
    };
    setPlaylist({
      ...playlist,
      zones: [...playlist.zones, newZone]
    });
    setSelectedZoneId(newZoneId);
  };

  const handleUpdateZone = (zoneId: string, updates: Partial<Zone>) => {
    if (!playlist) return;
    setPlaylist({
      ...playlist,
      zones: playlist.zones.map(z => z.id === zoneId ? { ...z, ...updates } : z)
    });
  };

  const handleUpdateZones = (updates: { id: string, changes: Partial<Zone> }[]) => {
    if (!playlist) return;
    const updatesMap = new Map(updates.map(u => [u.id, u.changes]));
    
    setPlaylist({
      ...playlist,
      zones: playlist.zones.map(z => {
        const changes = updatesMap.get(z.id);
        return changes ? { ...z, ...changes } : z;
      })
    });
  };

  const handleAddSlideToZone = (zoneId: string, media: MediaFile) => {
    if (!playlist) return;
    const zone = playlist.zones.find(z => z.id === zoneId);
    if (!zone) return;

    const newItem = {
      id: uuidv4(),
      mediaId: media.id,
      media,
      order: zone.items.length,
      duration: media.type === 'VIDEO' ? (media.duration || 10) : 10
    };

    handleUpdateZone(zoneId, {
      items: [...zone.items, newItem]
    });
  };

  const handleDeleteZone = (zoneId: string) => {
    if (!playlist) return;
    const newZones = playlist.zones.filter(z => z.id !== zoneId);
    setPlaylist({
      ...playlist,
      zones: newZones
    });
    if (selectedZoneId === zoneId) {
      setSelectedZoneId(newZones.length > 0 ? newZones[0].id : null);
    }
  };

  const handleLayoutChange = (layout: Layout) => {
    if (!playlist) return;
    
    // Create new zones from layout
    const newZones = (layout.zones || []).map(z => ({
      id: uuidv4(),
      name: z.name,
      x: z.x,
      y: z.y,
      width: z.width,
      height: z.height,
      zIndex: z.zIndex,
      rotation: z.rotation,
      items: [] // Empty items as per warning
    }));

    setPlaylist({
      ...playlist,
      resolution: layout.resolution,
      canvasWidth: layout.canvasWidth,
      canvasHeight: layout.canvasHeight,
      orientation: layout.orientation as any,
      zones: newZones
    });

    if (newZones.length > 0) {
      setSelectedZoneId(newZones[0].id);
    } else {
      setSelectedZoneId(null);
    }
    
    setShowChangeLayoutModal(false);
    setSaveMessage('Layout applied. Save to persist.');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-100">Loading Editor...</div>;
  if (!playlist) return <div className="flex items-center justify-center h-screen bg-gray-100">Playlist not found</div>;

  const selectedZone = playlist.zones.find(z => z.id === selectedZoneId) || null;

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 z-20 shadow-sm">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/playlists')} className="text-gray-500 hover:text-gray-700 flex items-center gap-2">
            <ArrowLeft size={20} />
            <span className="font-medium">Exit</span>
          </button>
          <div className="h-6 w-px bg-gray-300 mx-2" />
          <input 
            value={playlist.name}
            onChange={(e) => setPlaylist({...playlist, name: e.target.value})}
            className="text-lg font-semibold bg-transparent border-none focus:ring-0 p-0"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            type="button"
            className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded cursor-pointer mr-2"
            onClick={() => setShowChangeLayoutModal(true)}
            title="Change Layout (Reset)"
          >
            <LayoutTemplate size={18} />
            <span className="hidden lg:inline">Layout</span>
          </button>

          <div className="flex bg-gray-100 rounded p-1 mr-4">
            <button 
              className={`px-3 py-1 text-sm rounded ${playlist.orientation === 'LANDSCAPE' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
              onClick={() => setPlaylist({...playlist, orientation: 'LANDSCAPE', canvasWidth: 1920, canvasHeight: 1080})}
            >
              Landscape
            </button>
            <button 
              className={`px-3 py-1 text-sm rounded ${playlist.orientation === 'PORTRAIT' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
              onClick={() => setPlaylist({...playlist, orientation: 'PORTRAIT', canvasWidth: 1080, canvasHeight: 1920})}
            >
              Portrait
            </button>
            <button 
              className={`px-3 py-1 text-sm rounded ${playlist.orientation === 'CUSTOM' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
              onClick={() => setShowCustomCanvasModal(true)}
            >
              Custom
            </button>
          </div>

          <button 
            type="button"
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded cursor-pointer relative z-30"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Preview button clicked - forcing state update');
              setShowPreview(true);
            }}
          >
            <Play size={18} />
            Preview
          </button>
          
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 text-green-700 hover:bg-green-50 rounded cursor-pointer"
            onClick={() => setShowPublishModal(true)}
          >
            <Share size={18} />
            Publish
          </button>

          {saveMessage && (
            <span className={`text-sm ${saveMessage.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>
              {saveMessage}
            </span>
          )}
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Playlist'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar onDragStart={() => {
          // Store drag data if needed, but HTML5 DnD usually handles it via dataTransfer
        }} />
        
        <Canvas 
          playlist={playlist}
          selectedZoneId={selectedZoneId}
          onSelectZone={setSelectedZoneId}
          onUpdateZone={handleUpdateZone}
          onUpdateZones={handleUpdateZones}
          onAddZone={handleAddZone}
          onAddWidgetZone={handleAddWidgetZone}
        />
        
        <RightSidebar 
          selectedZone={selectedZone}
          onUpdateZone={handleUpdateZone}
          onAddSlide={handleAddSlideToZone}
          onDeleteZone={handleDeleteZone}
        />
      </div>

      {playlist && (
        <>
          <PreviewModal 
            isOpen={showPreview} 
            onClose={() => setShowPreview(false)} 
            playlist={playlist} 
          />
          {showPublishModal && (
            <PublishModal
              playlistId={id!}
              onClose={() => setShowPublishModal(false)}
            />
          )}
          <CustomCanvasModal
            isOpen={showCustomCanvasModal}
            onClose={() => setShowCustomCanvasModal(false)}
            onConfirm={(width, height) => {
              setPlaylist({
                ...playlist,
                canvasWidth: width,
                canvasHeight: height,
                orientation: 'CUSTOM',
                resolution: `${width}x${height}`
              });
              setShowCustomCanvasModal(false);
            }}
            initialWidth={playlist.canvasWidth}
            initialHeight={playlist.canvasHeight}
          />
          <ChangeLayoutModal
            isOpen={showChangeLayoutModal}
            onClose={() => setShowChangeLayoutModal(false)}
            onConfirm={handleLayoutChange}
          />
        </>
      )}
    </div>
  );
};

export default PlaylistEditor;

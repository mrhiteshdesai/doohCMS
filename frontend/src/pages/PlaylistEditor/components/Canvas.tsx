import React, { useRef, useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { PlaylistEditorState, Zone, MediaFile } from '../../../types/playlist';
import { Widget } from '../../../types/widget';
import TimeDateWidget from '../../../components/widgets/TimeDateWidget';
import AnalogClockWidget from '../../../components/widgets/AnalogClockWidget';
import CountDownWidget from '../../../components/widgets/CountDownWidget';
import QRCodeWidget from '../../../components/widgets/QRCodeWidget';
import YoutubeWidget from '../../../components/widgets/YoutubeWidget';
import { 
  Grid, Layers, ChevronUp, ChevronDown, ArrowUp, ArrowDown,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, 
  AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal,
  Maximize
} from 'lucide-react';
import { getFullUrl } from '../../../utils/url';
import { calculateSnap, calculateResizeSnap, Guideline, Rect } from '../utils/snapHelpers';

interface CanvasProps {
  playlist: PlaylistEditorState;
  selectedZoneId: string | null;
  onSelectZone: (id: string | null) => void;
  onUpdateZone: (id: string, updates: Partial<Zone>) => void;
  onUpdateZones?: (updates: { id: string, changes: Partial<Zone> }[]) => void;
  onAddZone: (media: MediaFile, x: number, y: number) => void;
  onAddWidgetZone?: (widget: Widget, x: number, y: number) => void;
}

const Canvas: React.FC<CanvasProps> = ({
  playlist,
  selectedZoneId,
  onSelectZone,
  onUpdateZone,
  onUpdateZones,
  onAddZone,
  onAddWidgetZone
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  
  // Snapping state
  const [guides, setGuides] = useState<Guideline[]>([]);
  const [draggingZoneId, setDraggingZoneId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{x: number, y: number} | null>(null);
  const [resizingZoneId, setResizingZoneId] = useState<string | null>(null);
  const [resizeState, setResizeState] = useState<{x: number, y: number, width: number, height: number} | null>(null);

  // Auto-fit logic
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const padding = 40;
        const availableWidth = clientWidth - padding * 2;
        const availableHeight = clientHeight - padding * 2;
        
        const scaleX = availableWidth / playlist.canvasWidth;
        const scaleY = availableHeight / playlist.canvasHeight;
        
        setScale(Math.min(scaleX, scaleY, 1));
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [playlist.canvasWidth, playlist.canvasHeight]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const parsed = JSON.parse(data);
      if (parsed.__kind === 'WIDGET' && onAddWidgetZone) {
        const widget: Widget = {
          id: parsed.id,
          name: parsed.name,
          type: parsed.type,
          config: parsed.config
        };
        const artboard = document.getElementById('canvas-artboard');
        if (!artboard) return;
        const rect = artboard.getBoundingClientRect();
        const clientX = e.clientX;
        const clientY = e.clientY;
        const relativeX = (clientX - rect.left) / scale;
        const relativeY = (clientY - rect.top) / scale;
        onAddWidgetZone(widget, relativeX, relativeY);
        return;
      }
      const media = parsed as MediaFile;
      
      const artboard = document.getElementById('canvas-artboard');
      if (!artboard) return;
      
      const rect = artboard.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;
      
      const relativeX = (clientX - rect.left) / scale;
      const relativeY = (clientY - rect.top) / scale;
      
      onAddZone(media, relativeX, relativeY);
    } catch (err) {
      console.error("Drop error", err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Helper to get other zones in screen coordinates
  const getOtherRects = (excludeId: string): Rect[] => {
    return playlist.zones
      .filter(z => z.id !== excludeId)
      .map(z => ({
        id: z.id,
        x: z.x * scale,
        y: z.y * scale,
        width: z.width * scale,
        height: z.height * scale
      }));
  };

  // Z-Index Management
  const getSortedZones = () => {
    return [...playlist.zones].sort((a, b) => {
      if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
      // Stable sort for same z-index
      return a.id.localeCompare(b.id);
    });
  };

  const reassignZIndices = (orderedZones: Zone[]) => {
    if (!onUpdateZones) return;
    const updates = orderedZones.map((z, index) => ({
      id: z.id,
      changes: { zIndex: index + 1 }
    }));
    onUpdateZones(updates);
  };

  const handleBringToFront = () => {
    if (!selectedZoneId) return;
    const sorted = getSortedZones();
    const current = sorted.find(z => z.id === selectedZoneId);
    if (!current) return;

    // Move to end
    const others = sorted.filter(z => z.id !== selectedZoneId);
    reassignZIndices([...others, current]);
  };

  const handleSendToBack = () => {
    if (!selectedZoneId) return;
    const sorted = getSortedZones();
    const current = sorted.find(z => z.id === selectedZoneId);
    if (!current) return;

    // Move to start
    const others = sorted.filter(z => z.id !== selectedZoneId);
    reassignZIndices([current, ...others]);
  };

  const handleBringForward = () => {
    if (!selectedZoneId) return;
    const sorted = getSortedZones();
    const index = sorted.findIndex(z => z.id === selectedZoneId);
    
    if (index < sorted.length - 1) {
      // Swap with next
      const temp = sorted[index];
      sorted[index] = sorted[index + 1];
      sorted[index + 1] = temp;
      reassignZIndices(sorted);
    }
  };

  const handleSendBackward = () => {
    if (!selectedZoneId) return;
    const sorted = getSortedZones();
    const index = sorted.findIndex(z => z.id === selectedZoneId);
    
    if (index > 0) {
      // Swap with prev
      const temp = sorted[index];
      sorted[index] = sorted[index - 1];
      sorted[index - 1] = temp;
      reassignZIndices(sorted);
    }
  };

  // Alignment Controls
  const handleAlign = (type: 'center' | 'middle' | 'top' | 'bottom' | 'left' | 'right' | 'fit') => {
    if (!selectedZoneId) return;
    const zone = playlist.zones.find(z => z.id === selectedZoneId);
    if (!zone) return;

    const updates: Partial<Zone> = {};

    switch (type) {
      case 'center':
        updates.x = (playlist.canvasWidth - zone.width) / 2;
        break;
      case 'middle':
        updates.y = (playlist.canvasHeight - zone.height) / 2;
        break;
      case 'top':
        updates.y = 0;
        break;
      case 'bottom':
        updates.y = playlist.canvasHeight - zone.height;
        break;
      case 'left':
        updates.x = 0;
        break;
      case 'right':
        updates.x = playlist.canvasWidth - zone.width;
        break;
      case 'fit':
        updates.x = 0;
        updates.y = 0;
        updates.width = playlist.canvasWidth;
        updates.height = playlist.canvasHeight;
        break;
    }

    onUpdateZone(selectedZoneId, updates);
  };

  return (
    <div 
      ref={containerRef} 
      className="flex-1 bg-gray-100 flex items-center justify-center relative overflow-hidden select-none"
      onClick={() => onSelectZone(null)}
    >
      {/* Controls Overlay */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <div className="flex bg-white p-1 rounded shadow-sm gap-1">
          <button 
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded hover:bg-gray-100 ${showGrid ? 'text-blue-600' : 'text-gray-600'}`}
            title="Toggle Grid"
          >
            <Grid size={20} />
          </button>
          <div className="flex items-center px-2 text-sm text-gray-500 border-l ml-1">
            {Math.round(scale * 100)}%
          </div>
        </div>

        {/* Layer Controls */}
        <div className="flex bg-white p-1 rounded shadow-sm gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); handleBringToFront(); }}
            disabled={!selectedZoneId}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Bring to Front"
          >
            <Layers size={20} className="transform rotate-180" />
            <ArrowUp size={12} className="absolute top-1 right-1" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleBringForward(); }}
            disabled={!selectedZoneId}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Bring Forward"
          >
            <ChevronUp size={20} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleSendBackward(); }}
            disabled={!selectedZoneId}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Send Backward"
          >
            <ChevronDown size={20} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleSendToBack(); }}
            disabled={!selectedZoneId}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Send to Back"
          >
            <Layers size={20} />
            <ArrowDown size={12} className="absolute bottom-1 right-1" />
          </button>
        </div>

        {/* Alignment Controls */}
        <div className="flex bg-white p-1 rounded shadow-sm gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); handleAlign('left'); }}
            disabled={!selectedZoneId}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Align Left"
          >
            <AlignStartVertical size={20} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleAlign('center'); }}
            disabled={!selectedZoneId}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Align Horizontal Center"
          >
            <AlignHorizontalJustifyCenter size={20} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleAlign('right'); }}
            disabled={!selectedZoneId}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Align Right"
          >
            <AlignEndVertical size={20} />
          </button>
          <div className="w-px bg-gray-200 mx-1" />
          <button 
            onClick={(e) => { e.stopPropagation(); handleAlign('top'); }}
            disabled={!selectedZoneId}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Align Top"
          >
            <AlignStartHorizontal size={20} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleAlign('middle'); }}
            disabled={!selectedZoneId}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Align Vertical Center"
          >
            <AlignVerticalJustifyCenter size={20} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleAlign('bottom'); }}
            disabled={!selectedZoneId}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Align Bottom"
          >
            <AlignEndHorizontal size={20} />
          </button>
          <div className="w-px bg-gray-200 mx-1" />
          <button 
            onClick={(e) => { e.stopPropagation(); handleAlign('fit'); }}
            disabled={!selectedZoneId}
            className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Fit to Canvas"
          >
            <Maximize size={20} />
          </button>
        </div>
      </div>

      {/* Artboard */}
      <div
        id="canvas-artboard"
        style={{
          width: playlist.canvasWidth * scale,
          height: playlist.canvasHeight * scale,
          backgroundColor: 'white',
          boxShadow: '0 0 20px rgba(0,0,0,0.1)',
          position: 'relative',
          backgroundImage: showGrid ? 
            `linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)` : undefined,
          backgroundSize: `${50 * scale}px ${50 * scale}px`
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Guidelines */}
        {guides.map((g, i) => (
          <div
            key={i}
            className="absolute bg-red-500 z-[1000] pointer-events-none"
            style={{
              left: g.type === 'vertical' ? g.pos : 0,
              top: g.type === 'horizontal' ? g.pos : 0,
              width: g.type === 'vertical' ? 1 : '100%',
              height: g.type === 'horizontal' ? 1 : '100%',
            }}
          />
        ))}

        {playlist.zones.map((zone) => {
          const isSelected = zone.id === selectedZoneId;
          const firstItem = zone.items[0];
          const isDragging = draggingZoneId === zone.id;
          const isResizing = resizingZoneId === zone.id;

          // Determine current visual properties
          let x = zone.x * scale;
          let y = zone.y * scale;
          let width = zone.width * scale;
          let height = zone.height * scale;

          if (isDragging && dragPosition) {
            x = dragPosition.x;
            y = dragPosition.y;
          }
          if (isResizing && resizeState) {
            x = resizeState.x;
            y = resizeState.y;
            width = resizeState.width;
            height = resizeState.height;
          }

          return (
            <Rnd
              key={zone.id}
              size={{ width, height }}
              position={{ x, y }}
              onDragStart={() => setDraggingZoneId(zone.id)}
              onDrag={(_e, d) => {
                const currentRect = {
                  x: d.x,
                  y: d.y,
                  width: zone.width * scale,
                  height: zone.height * scale
                };
                const others = getOtherRects(zone.id);
                const { x: snappedX, y: snappedY, guides: newGuides } = calculateSnap(
                  currentRect,
                  others,
                  playlist.canvasWidth * scale,
                  playlist.canvasHeight * scale
                );
                
                setDragPosition({ x: snappedX, y: snappedY });
                setGuides(newGuides);
              }}
              onDragStop={(_e, d) => {
                // Use the last dragPosition if available (which is snapped), otherwise d.x/d.y
                const finalX = dragPosition ? dragPosition.x : d.x;
                const finalY = dragPosition ? dragPosition.y : d.y;
                
                onUpdateZone(zone.id, { x: finalX / scale, y: finalY / scale });
                setDraggingZoneId(null);
                setDragPosition(null);
                setGuides([]);
              }}
              onResizeStart={() => setResizingZoneId(zone.id)}
              onResize={(_e, direction, ref, _delta, position) => {
                const currentRect = {
                  x: position.x,
                  y: position.y,
                  width: parseFloat(ref.style.width),
                  height: parseFloat(ref.style.height)
                };
                
                const others = getOtherRects(zone.id);
                const { 
                  x: snappedX, 
                  y: snappedY, 
                  width: snappedWidth, 
                  height: snappedHeight, 
                  guides: newGuides 
                } = calculateResizeSnap(
                  currentRect,
                  direction,
                  others,
                  playlist.canvasWidth * scale,
                  playlist.canvasHeight * scale
                );
                
                setResizeState({
                  x: snappedX,
                  y: snappedY,
                  width: snappedWidth,
                  height: snappedHeight
                });
                setGuides(newGuides);
              }}
              onResizeStop={(_e, _direction, _ref, _delta, _position) => {
                // Use resizeState if available (snapped values)
                if (resizeState) {
                  onUpdateZone(zone.id, {
                    width: resizeState.width / scale,
                    height: resizeState.height / scale,
                    x: resizeState.x / scale,
                    y: resizeState.y / scale
                  });
                }
                
                setResizingZoneId(null);
                setResizeState(null);
                setGuides([]);
              }}
              onMouseDown={() => onSelectZone(zone.id)}
              bounds="parent"
              className="group"
              style={{ zIndex: zone.zIndex }}
            >
              <div 
                className={`w-full h-full relative overflow-hidden ${isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-blue-300'}`}
                style={{ backgroundColor: '#f3f4f6' }}
              >
                {/* Content Preview (First Item) */}
                {firstItem && firstItem.media ? (
                  firstItem.media.type === 'IMAGE' ? (
                    <img 
                      src={getFullUrl(firstItem.media.url)} 
                      alt={firstItem.media.originalName}
                      className="w-full h-full object-fill pointer-events-none"
                    />
                  ) : (
                    <video 
                      src={getFullUrl(firstItem.media.url)} 
                      className="w-full h-full object-fill pointer-events-none"
                      muted
                    />
                  )
                ) : firstItem && firstItem.widget ? (
                  (() => {
                    const adjustedConfig = {
                      ...firstItem.widget!.config,
                      aspectRatioWidth: zone.width,
                      aspectRatioHeight: zone.height
                    };
                    if (firstItem.widget!.type === 'TIME_DATE') {
                      return <TimeDateWidget config={adjustedConfig} className="w-full h-full" />;
                    } else if (firstItem.widget!.type === 'ANALOG_CLOCK') {
                      return <AnalogClockWidget config={adjustedConfig} className="w-full h-full" />;
                    } else if (firstItem.widget!.type === 'COUNT_DOWN') {
                      return <CountDownWidget config={adjustedConfig} className="w-full h-full" />;
                    } else if (firstItem.widget!.type === 'QR_CODE') {
                      return <QRCodeWidget config={adjustedConfig} className="w-full h-full" />;
                    } else if (firstItem.widget!.type === 'YOUTUBE') {
                      return <YoutubeWidget config={adjustedConfig} className="w-full h-full" />;
                    } else {
                      return (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          Preview Unavailable
                        </div>
                      );
                    }
                  })()
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    Empty Zone
                  </div>
                )}
                
                {/* Zone Label/Overlay */}
                <div className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {zone.name}
                </div>
                
                {/* Multi-slide Indicator */}
                {zone.items.length > 1 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-10">
                    <span className="text-white font-bold text-4xl drop-shadow-md select-none">
                      +{zone.items.length - 1}
                    </span>
                  </div>
                )}
                
                {isSelected && (
                  <div className="absolute inset-0 pointer-events-none border-2 border-blue-500" />
                )}
              </div>
            </Rnd>
          );
        })}
      </div>
    </div>
  );
};

export default Canvas;

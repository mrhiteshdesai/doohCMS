import React from 'react';
import { Zone, MediaFile, ZoneItem } from '../../../types/playlist';
import { Trash2, Move, Clock, Film, Image as ImageIcon, Puzzle } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface RightSidebarProps {
  selectedZone: Zone | null;
  onUpdateZone: (id: string, updates: Partial<Zone>) => void;
  onAddSlide: (zoneId: string, media: MediaFile) => void;
  onDeleteZone: (id: string) => void;
}

const SortableSlideItem = ({ item, onDelete, onDurationChange }: { item: ZoneItem, onDelete: () => void, onDurationChange: (val: number) => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getFullUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    return `http://localhost:5000${url}`;
  };

  const isWidget = !!item.widget && !item.media;
  return (
    <div ref={setNodeRef} style={style} className="bg-white p-3 rounded border shadow-sm mb-2 group">
      <div className="flex gap-3">
        <div {...attributes} {...listeners} className="flex items-center text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-600">
          <Move size={16} />
        </div>
        {isWidget ? (
          <>
            <div className="w-16 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
              <Puzzle size={16} className="text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-gray-700" title={item.widget?.name || ''}>
                {item.widget?.name || 'Widget'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">{item.widget?.type}</span>
              </div>
            </div>
            <button onClick={onDelete} className="text-gray-400 hover:text-red-500 self-start">
              <Trash2 size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
              {item.media && item.media.type === 'IMAGE' ? (
                <img src={getFullUrl(item.media.url)} className="w-full h-full object-cover" alt="" />
              ) : (
                <video src={item.media ? getFullUrl(item.media.url) : ''} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-gray-700" title={item.media?.originalName || ''}>
                {item.media?.originalName || ''}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {item.media && item.media.type === 'IMAGE' ? <ImageIcon size={12} className="text-blue-500" /> : <Film size={12} className="text-purple-500" />}
                <span className="text-xs text-gray-500">{item.media?.type || ''}</span>
              </div>
            </div>
            <button onClick={onDelete} className="text-gray-400 hover:text-red-500 self-start">
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm border-t pt-2">
        <Clock size={14} className="text-gray-400" />
        <span className="text-gray-600 text-xs">Duration:</span>
        {!isWidget && item.media && item.media.type === 'VIDEO' ? (
          <span className="text-gray-500 text-xs italic">{item.duration}s (Auto)</span>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={item.duration}
              onChange={(e) => onDurationChange(parseInt(e.target.value) || 5)}
              className="w-16 px-1 py-0.5 border rounded text-xs"
              min={1}
            />
            <span className="text-xs text-gray-500">sec</span>
          </div>
        )}
      </div>
    </div>
  );
};

const RightSidebar: React.FC<RightSidebarProps> = ({
  selectedZone,
  onUpdateZone,
  onAddSlide,
  onDeleteZone
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!selectedZone || !over) return;

    if (active.id !== over.id) {
      const oldIndex = selectedZone.items.findIndex((item) => item.id === active.id);
      const newIndex = selectedZone.items.findIndex((item) => item.id === over.id);
      
      const newItems = arrayMove(selectedZone.items, oldIndex, newIndex).map((item, index) => ({
        ...item,
        order: index
      }));
      
      onUpdateZone(selectedZone.id, { items: newItems });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!selectedZone) return;
    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const parsed = JSON.parse(data);
      if (parsed && parsed.__kind === 'WIDGET') {
        const newItem: ZoneItem = {
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
          order: selectedZone.items.length,
          duration: 10,
          widget: {
            id: parsed.id,
            name: parsed.name,
            type: parsed.type,
            config: parsed.config
          }
        } as any;
        const newItems = [...selectedZone.items, newItem];
        onUpdateZone(selectedZone.id, { items: newItems as any });
        return;
      }
      const media = parsed as MediaFile;
      onAddSlide(selectedZone.id, media);
    } catch (err) {
      console.error(err);
    }
  };

  if (!selectedZone) {
    return (
      <div className="w-80 bg-white border-l p-6 flex flex-col items-center justify-center text-gray-400 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Move size={24} />
        </div>
        <p>Select a zone to edit slides or properties</p>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-50 border-l flex flex-col h-full z-10 overflow-hidden">
      {/* Zone Properties */}
      <div className="p-4 bg-white border-b">
        <div className="flex items-center justify-between mb-4">
          <input 
            type="text" 
            value={selectedZone.name}
            onChange={(e) => onUpdateZone(selectedZone.id, { name: e.target.value })}
            className="font-semibold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none w-40"
          />
          <button 
            onClick={() => onDeleteZone(selectedZone.id)}
            className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
            title="Delete Zone"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-gray-500 block mb-1">X Position</label>
            <input 
              type="number" 
              value={Math.round(selectedZone.x)} 
              onChange={(e) => onUpdateZone(selectedZone.id, { x: parseInt(e.target.value) })}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="text-gray-500 block mb-1">Y Position</label>
            <input 
              type="number" 
              value={Math.round(selectedZone.y)} 
              onChange={(e) => onUpdateZone(selectedZone.id, { y: parseInt(e.target.value) })}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="text-gray-500 block mb-1">Width</label>
            <input 
              type="number" 
              value={Math.round(selectedZone.width)} 
              onChange={(e) => onUpdateZone(selectedZone.id, { width: parseInt(e.target.value) })}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="text-gray-500 block mb-1">Height</label>
            <input 
              type="number" 
              value={Math.round(selectedZone.height)} 
              onChange={(e) => onUpdateZone(selectedZone.id, { height: parseInt(e.target.value) })}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="text-gray-500 block mb-1">Rotation</label>
            <input 
              type="number" 
              value={Math.round(selectedZone.rotation)} 
              onChange={(e) => onUpdateZone(selectedZone.id, { rotation: parseInt(e.target.value) })}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="text-gray-500 block mb-1">Z-Index</label>
            <input 
              type="number" 
              value={selectedZone.zIndex} 
              onChange={(e) => onUpdateZone(selectedZone.id, { zIndex: parseInt(e.target.value) })}
              className="w-full border rounded px-2 py-1"
            />
          </div>
        </div>
      </div>

      {/* Slides List */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-3 border-b bg-gray-100 flex items-center justify-between">
          <h3 className="font-medium text-gray-700 text-sm">Slides ({selectedZone.items.length})</h3>
          <span className="text-xs text-gray-500">Drag items here to add</span>
        </div>

        <div 
          className="flex-1 overflow-y-auto p-3"
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        >
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={selectedZone.items.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {selectedZone.items.map((item) => (
                <SortableSlideItem 
                  key={item.id} 
                  item={item} 
                  onDelete={() => {
                    const newItems = selectedZone.items.filter(i => i.id !== item.id);
                    onUpdateZone(selectedZone.id, { items: newItems });
                  }}
                  onDurationChange={(val) => {
                    const newItems = selectedZone.items.map(i => i.id === item.id ? { ...i, duration: val } : i);
                    onUpdateZone(selectedZone.id, { items: newItems });
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
          
          {selectedZone.items.length === 0 && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400 text-sm">
              Drop media here to add slides
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;

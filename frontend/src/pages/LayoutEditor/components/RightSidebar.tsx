import React from 'react';
import { Layout, LayoutZone } from '../../../types/layout';
import { 
  Settings, 
  Layers, 
  Move, 
  Trash2,
  Monitor,
  Smartphone,
  Maximize
} from 'lucide-react';

interface RightSidebarProps {
  layout: Layout;
  selectedZoneId: string | null;
  onUpdateLayout: (updates: Partial<Layout>) => void;
  onUpdateZone: (id: string, updates: Partial<LayoutZone>) => void;
  onDeleteZone: (id: string) => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  layout,
  selectedZoneId,
  onUpdateLayout,
  onUpdateZone,
  onDeleteZone
}) => {
  const selectedZone = selectedZoneId ? layout.zones.find(z => z.id === selectedZoneId) : null;

  const handleDimensionChange = (dimension: 'width' | 'height', value: number) => {
    if (value <= 0) return;
    
    onUpdateLayout({
      [dimension === 'width' ? 'canvasWidth' : 'canvasHeight']: value,
      orientation: 'CUSTOM'
    });
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto">
      {selectedZone ? (
        <div className="p-4 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Layers size={18} />
              Zone Settings
            </h3>
            <button 
              onClick={() => onDeleteZone(selectedZone.id)}
              className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
              title="Delete Zone"
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={selectedZone.name}
                onChange={(e) => onUpdateZone(selectedZone.id, { name: e.target.value })}
                className="w-full text-sm border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Move size={12} />
                Position & Size
              </h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">X Position</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={Math.round(selectedZone.x)}
                      onChange={(e) => onUpdateZone(selectedZone.id, { x: Number(e.target.value) })}
                      className="w-full text-sm border rounded pl-2 pr-6 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-gray-400">px</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Y Position</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={Math.round(selectedZone.y)}
                      onChange={(e) => onUpdateZone(selectedZone.id, { y: Number(e.target.value) })}
                      className="w-full text-sm border rounded pl-2 pr-6 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-gray-400">px</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Width</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={Math.round(selectedZone.width)}
                      onChange={(e) => onUpdateZone(selectedZone.id, { width: Number(e.target.value) })}
                      className="w-full text-sm border rounded pl-2 pr-6 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-gray-400">px</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Height</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={Math.round(selectedZone.height)}
                      onChange={(e) => onUpdateZone(selectedZone.id, { height: Number(e.target.value) })}
                      className="w-full text-sm border rounded pl-2 pr-6 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-gray-400">px</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Z-Index</label>
                <input
                  type="number"
                  value={selectedZone.zIndex}
                  onChange={(e) => onUpdateZone(selectedZone.id, { zIndex: Number(e.target.value) })}
                  className="w-full text-sm border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Settings size={18} />
              Layout Settings
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Layout Name</label>
              <input
                type="text"
                value={layout.name}
                onChange={(e) => onUpdateLayout({ name: e.target.value })}
                className="w-full text-sm border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea
                value={layout.description || ''}
                onChange={(e) => onUpdateLayout({ description: e.target.value })}
                rows={3}
                className="w-full text-sm border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Canvas Size</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Width</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={layout.canvasWidth}
                      onChange={(e) => handleDimensionChange('width', Number(e.target.value))}
                      className="w-full text-sm border rounded pl-2 pr-6 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-gray-400">px</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Height</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={layout.canvasHeight}
                      onChange={(e) => handleDimensionChange('height', Number(e.target.value))}
                      className="w-full text-sm border rounded pl-2 pr-6 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-gray-400">px</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Orientation</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onUpdateLayout({ 
                      orientation: 'LANDSCAPE',
                      canvasWidth: 1920,
                      canvasHeight: 1080
                    })}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                      layout.orientation === 'LANDSCAPE' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <Monitor size={20} className="mb-1" />
                    <span className="text-[10px] font-medium">Landscape</span>
                    <span className="text-[9px] opacity-75">1920x1080</span>
                  </button>

                  <button
                    onClick={() => onUpdateLayout({ 
                      orientation: 'PORTRAIT',
                      canvasWidth: 1080,
                      canvasHeight: 1920
                    })}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                      layout.orientation === 'PORTRAIT' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <Smartphone size={20} className="mb-1" />
                    <span className="text-[10px] font-medium">Portrait</span>
                    <span className="text-[9px] opacity-75">1080x1920</span>
                  </button>

                  <button
                    onClick={() => onUpdateLayout({ orientation: 'CUSTOM' })}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                      layout.orientation === 'CUSTOM' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <Maximize size={20} className="mb-1" />
                    <span className="text-[10px] font-medium">Custom</span>
                    <span className="text-[9px] opacity-75">Variable</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RightSidebar;

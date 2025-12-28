import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Search, LayoutTemplate } from 'lucide-react';
import { Layout } from '../../../types/layout';
import * as layoutService from '../../../services/layout';
import LayoutPreview from '../../../components/LayoutPreview';

interface ChangeLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (layout: Layout) => void;
}

const ChangeLayoutModal: React.FC<ChangeLayoutModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchLayouts();
      setSelectedLayoutId(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  const fetchLayouts = async () => {
    setLoading(true);
    try {
      const data = await layoutService.getLayouts();
      setLayouts(data);
    } catch (error) {
      console.error('Failed to fetch layouts', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const layout = layouts.find(l => l.id === selectedLayoutId);
    if (layout) {
      onConfirm(layout);
    }
  };

  if (!isOpen) return null;

  const filteredLayouts = layouts.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header with Warning */}
        <div className="p-6 border-b shrink-0">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <LayoutTemplate className="text-blue-600" />
              Change Layout
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertTriangle className="text-red-600 shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-red-900">Warning: Destructive Action</h3>
              <p className="text-sm text-red-700 mt-1">
                Changing the layout will <strong>permanently remove all current zones, content, and progress</strong>. 
                The playlist will be reset to a blank state with the selected layout's configuration.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search layouts..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Layout Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filteredLayouts.map((layout) => (
                <div 
                  key={layout.id}
                  onClick={() => setSelectedLayoutId(layout.id)}
                  className={`cursor-pointer group relative rounded-lg border-2 transition-all overflow-hidden ${
                    selectedLayoutId === layout.id 
                      ? 'border-blue-500 ring-2 ring-blue-500 ring-offset-2' 
                      : 'border-transparent hover:border-blue-300 shadow-sm'
                  }`}
                >
                  <div className="aspect-video bg-gray-100 relative">
                    <LayoutPreview layout={layout} className="w-full h-full pointer-events-none" />
                  </div>
                  <div className="p-2 bg-white border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-900 truncate" title={layout.name}>
                      {layout.name}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {layout.canvasWidth}x{layout.canvasHeight}
                    </div>
                  </div>
                  {selectedLayoutId === layout.id && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white z-10"></div>
                  )}
                </div>
              ))}
              {filteredLayouts.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No layouts found matching "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedLayoutId}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
          >
            Confirm & Override
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangeLayoutModal;

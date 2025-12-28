import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface CustomCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (width: number, height: number) => void;
  initialWidth: number;
  initialHeight: number;
}

const CustomCanvasModal: React.FC<CustomCanvasModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialWidth,
  initialHeight
}) => {
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);

  useEffect(() => {
    if (isOpen) {
      setWidth(initialWidth);
      setHeight(initialHeight);
    }
  }, [isOpen, initialWidth, initialHeight]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(width, height);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Custom Canvas Size</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Width (px)
            </label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              min="100"
              max="10000"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Height (px)
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              min="100"
              max="10000"
              required
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomCanvasModal;

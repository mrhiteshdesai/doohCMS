import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, LayoutZone } from '../../types/layout';
import * as layoutService from '../../services/layout';
import LeftSidebar from './components/LeftSidebar';
import Canvas from './components/Canvas';
import RightSidebar from './components/RightSidebar';
import { ArrowLeft, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import ErrorBoundary from '../../components/ErrorBoundary';

const LayoutEditorContent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  useEffect(() => {
    loadLayout();
  }, [id]);

  const loadLayout = async () => {
    if (!id) return;
    try {
      const data = await layoutService.getLayoutById(id);
      if (!data.zones) data.zones = [];
      setLayout(data);
      if (data.zones && data.zones.length > 0) {
        setSelectedZoneId(data.zones[0].id);
      }
    } catch (error) {
      console.error("Failed to load layout", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!layout || !id) return;
    setSaving(true);
    try {
      await layoutService.updateLayout(id, {
        name: layout.name,
        description: layout.description,
        canvasWidth: layout.canvasWidth,
        canvasHeight: layout.canvasHeight,
        orientation: layout.orientation,
        // Send zones to update
        zones: layout.zones.map(z => ({
          name: z.name,
          x: Math.round(z.x),
          y: Math.round(z.y),
          width: Math.round(z.width),
          height: Math.round(z.height),
          zIndex: z.zIndex,
          rotation: Math.round(z.rotation)
        })) as any
      });
      alert('Layout saved successfully');
    } catch (error) {
      console.error("Failed to save layout", error);
      alert('Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  const handleAddZone = () => {
    if (!layout) return;
    
    // Calculate next Z-Index
    const maxZ = layout.zones.reduce((max, z) => Math.max(max, z.zIndex), 0);
    
    const newZone: LayoutZone = {
      id: uuidv4(), // Temp ID
      name: `Zone ${layout.zones.length + 1}`,
      x: 50,
      y: 50,
      width: 400,
      height: 300,
      zIndex: maxZ + 1,
      rotation: 0
    };
    
    setLayout({
      ...layout,
      zones: [...layout.zones, newZone]
    });
    setSelectedZoneId(newZone.id);
  };

  const handleUpdateZone = (zoneId: string, updates: Partial<LayoutZone>) => {
    if (!layout) return;
    setLayout({
      ...layout,
      zones: layout.zones.map(z => z.id === zoneId ? { ...z, ...updates } : z)
    });
  };

  const handleUpdateZones = (updates: { id: string, changes: Partial<LayoutZone> }[]) => {
    if (!layout) return;
    setLayout({
      ...layout,
      zones: layout.zones.map(z => {
        const update = updates.find(u => u.id === z.id);
        return update ? { ...z, ...update.changes } : z;
      })
    });
  };

  const handleDeleteZone = (zoneId: string) => {
    if (!layout) return;
    if (!window.confirm('Delete this zone?')) return;
    
    setLayout({
      ...layout,
      zones: layout.zones.filter(z => z.id !== zoneId)
    });
    if (selectedZoneId === zoneId) {
      setSelectedZoneId(null);
    }
  };

  const handleUpdateLayout = (updates: Partial<Layout>) => {
    if (!layout) return;
    setLayout({ ...layout, ...updates });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!layout) return <div>Layout not found</div>;

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center z-30 shadow-sm h-16">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/layouts')}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              {layout.name}
              <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                {layout.canvasWidth}x{layout.canvasHeight}
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm font-medium"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
            ) : (
              <Save size={18} />
            )}
            <span>Save Layout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar 
          layout={layout}
          selectedZoneId={selectedZoneId}
          onSelectZone={setSelectedZoneId}
          onAddZone={handleAddZone}
        />
        
        <Canvas 
          layout={layout}
          selectedZoneId={selectedZoneId}
          onSelectZone={setSelectedZoneId}
          onUpdateZone={handleUpdateZone}
          onUpdateZones={handleUpdateZones}
        />
        
        <RightSidebar 
          layout={layout}
          selectedZoneId={selectedZoneId}
          onUpdateLayout={handleUpdateLayout}
          onUpdateZone={handleUpdateZone}
          onDeleteZone={handleDeleteZone}
        />
      </div>
    </div>
  );
};

const LayoutEditor: React.FC = () => {
  return (
    <ErrorBoundary>
      <LayoutEditorContent />
    </ErrorBoundary>
  );
};

export default LayoutEditor;

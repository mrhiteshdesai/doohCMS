import React, { useState, useEffect } from 'react';
import { Search, Filter, Clock, Globe, CloudSun, Newspaper, QrCode, Calendar, Plus, Edit2, Trash2, ArrowLeft, Timer, Youtube, Lock } from 'lucide-react';
import { Widget } from '../types/widget';
import * as widgetService from '../services/widget';
import SearchableSelect from '../components/SearchableSelect';
import WidgetEditorModal from '../components/WidgetEditorModal';
import PermissionGuard from '../components/PermissionGuard';
import TimeDateWidget from '../components/widgets/TimeDateWidget';
import AnalogClockWidget from '../components/widgets/AnalogClockWidget';
import CountDownWidget from '../components/widgets/CountDownWidget';
import QRCodeWidget from '../components/widgets/QRCodeWidget';
import YoutubeWidget from '../components/widgets/YoutubeWidget';
import { useAuth } from '../context/AuthContext';

interface PredefinedWidget {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'Clock' | 'Information' | 'Utility';
  type: 'TIME_DATE' | 'ANALOG_CLOCK' | 'WEATHER' | 'NEWS' | 'QR_CODE' | 'COUNT_DOWN' | 'YOUTUBE';
}

const PREDEFINED_WIDGETS: PredefinedWidget[] = [
  {
    id: 'date-time',
    name: 'Time and Date',
    description: 'Display current date and time with customizable formats.',
    icon: <Calendar size={32} className="text-blue-500" />,
    category: 'Clock',
    type: 'TIME_DATE',
  },
  {
    id: 'analog-clock',
    name: 'Analog Clock',
    description: 'A classic analog clock face.',
    icon: <Clock size={32} className="text-blue-500" />,
    category: 'Clock',
    type: 'ANALOG_CLOCK',
  },
  {
    id: 'countdown-timer',
    name: 'Count Up/Down Timer',
    description: 'A simple timer counts up from an event or down to the deadline.',
    icon: <Timer size={32} className="text-red-500" />,
    category: 'Clock',
    type: 'COUNT_DOWN',
  },
  {
    id: 'weather',
    name: 'Weather Widget',
    description: 'Current weather conditions and forecast.',
    icon: <CloudSun size={32} className="text-orange-500" />,
    category: 'Information',
    type: 'WEATHER',
  },
  {
    id: 'news-ticker',
    name: 'News Ticker',
    description: 'Scrolling news headlines from RSS feeds.',
    icon: <Newspaper size={32} className="text-green-500" />,
    category: 'Information',
    type: 'NEWS',
  },
  {
    id: 'qr-code',
    name: 'QR Code',
    description: 'Generate QR codes for URLs or text.',
    icon: <QrCode size={32} className="text-purple-500" />,
    category: 'Utility',
    type: 'QR_CODE',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Embed a YouTube video with loop and control options.',
    icon: <Youtube size={32} className="text-red-600" />,
    category: 'Information',
    type: 'YOUTUBE',
  },
];

const Widgets = () => {
  const { checkPermission } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | PredefinedWidget['category']>('ALL');
  const [myWidgets, setMyWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [selectedType, setSelectedType] = useState<'TIME_DATE' | 'ANALOG_CLOCK' | 'WEATHER' | 'NEWS' | 'QR_CODE' | 'COUNT_DOWN' | 'YOUTUBE'>('TIME_DATE');

  const [viewState, setViewState] = useState<'CATALOG' | 'MANAGER'>('CATALOG');
  const [selectedWidgetType, setSelectedWidgetType] = useState<string | null>(null);
  const [selectedWidgetTypeName, setSelectedWidgetTypeName] = useState<string>('');

  const fetchWidgets = async () => {
    if (!checkPermission('widget', 'read')) {
      setLoading(false);
      return;
    }
    try {
      const data = await widgetService.getWidgets();
      setMyWidgets(data);
    } catch (error) {
      console.error('Failed to fetch widgets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWidgets();
  }, []);

  const handleManageWidgets = (type: string, name: string) => {
    setSelectedWidgetType(type);
    setSelectedWidgetTypeName(name);
    setViewState('MANAGER');
  };

  const handleBackToCatalog = () => {
    setViewState('CATALOG');
    setSelectedWidgetType(null);
    setSelectedWidgetTypeName('');
  };

  const handleCreateWidget = () => {
    if (!selectedWidgetType) return;
    setEditingWidget(null);
    setSelectedType(selectedWidgetType as any);
    setIsEditorOpen(true);
  };

  const handleEditWidget = (widget: Widget) => {
    setEditingWidget(widget);
    setSelectedType(widget.type);
    setIsEditorOpen(true);
  };

  const handleDeleteWidget = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this widget?')) {
      try {
        await widgetService.deleteWidget(id);
        fetchWidgets();
      } catch (error) {
        console.error('Failed to delete widget:', error);
      }
    }
  };

  const handleEditorSuccess = () => {
    fetchWidgets();
  };

  const filteredPredefinedWidgets = PREDEFINED_WIDGETS.filter(widget => {
    const matchesSearch = widget.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          widget.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || widget.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const currentTypeWidgets = myWidgets.filter(w => w.type === selectedWidgetType);

  if (!checkPermission('widget', 'read')) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 min-h-[400px]">
        <Lock size={48} className="mb-4 text-gray-400" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p>You do not have permission to view widgets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {viewState === 'CATALOG' ? (
        <>
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Widget Library</h1>
              <p className="text-gray-500">Browse and manage widgets for your playlists</p>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <Search size={18} className="text-gray-500 mr-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search widgets..."
                  className="bg-transparent outline-none flex-1 text-sm"
                />
              </div>

              <div className="w-48">
            <SearchableSelect
              icon={<Filter size={18} className="text-gray-500" />}
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val as any)}
              options={[
                { value: 'ALL', label: 'All Categories' },
                { value: 'Clock', label: 'Clock' },
                { value: 'Information', label: 'Information' },
                { value: 'Utility', label: 'Utility' }
              ]}
              triggerClassName="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
            </div>
          </div>

          {/* Widget Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPredefinedWidgets.map((widget) => (
                <div key={widget.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      {widget.icon}
                    </div>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {widget.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{widget.name}</h3>
                  <p className="text-gray-500 text-sm mb-6 flex-1">{widget.description}</p>
                  <PermissionGuard module="widget" action="read">
                    <button 
                      className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium flex items-center justify-center"
                      onClick={() => handleManageWidgets(widget.type, widget.name)}
                    >
                      Manage Widgets
                    </button>
                  </PermissionGuard>
                </div>
              ))}

              {filteredPredefinedWidgets.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No widgets found matching your search.
                </div>
              )}
            </div>
        </>
      ) : (
        <>
          {/* Manager View */}
          <div className="flex justify-between items-center">
             <div className="flex items-center space-x-4">
              <button 
                 onClick={handleBackToCatalog}
                 className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
               aria-label="Back to catalog"
               >
                 <ArrowLeft size={20} />
               </button>
               <div>
                 <h1 className="text-2xl font-bold text-gray-800">{selectedWidgetTypeName} Widgets</h1>
                 <p className="text-gray-500">Manage your {selectedWidgetTypeName.toLowerCase()} widgets</p>
               </div>
             </div>
             <PermissionGuard module="widget" action="write">
               <button
                  onClick={handleCreateWidget}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
               >
                  <Plus size={18} className="mr-2" />
                  Create New
               </button>
             </PermissionGuard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentTypeWidgets.map((widget) => (
              <div key={widget.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className="h-40 bg-gray-50 relative border-b border-gray-100">
                  {/* Preview Area */}
                  <div className="absolute inset-0 p-4">
                    <div className="w-full h-full transform scale-75 origin-center">
                       {/* --- FROZEN PREVIEWS START --- */}
                       {widget.type === 'TIME_DATE' ? (
                         <TimeDateWidget config={widget.config} />
                       ) : widget.type === 'ANALOG_CLOCK' ? (
                         <AnalogClockWidget config={widget.config} />
                       ) : widget.type === 'COUNT_DOWN' ? (
                         <CountDownWidget config={widget.config} />
                       ) : widget.type === 'QR_CODE' ? (
                         <QRCodeWidget config={widget.config} />
                       ) : widget.type === 'YOUTUBE' ? (
                         <YoutubeWidget config={widget.config} />
                       ) : (
                       /* --- FROZEN PREVIEWS END --- */
                         <div className="w-full h-full flex items-center justify-center text-gray-400">Preview Unavailable</div>
                       )}
                    </div>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-800 truncate" title={widget.name}>{widget.name}</h3>
                  </div>
                  <div className="mt-auto flex space-x-2">
                    <PermissionGuard module="widget" action="write">
                      <button 
                        onClick={() => handleEditWidget(widget)}
                        className="flex-1 py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium flex items-center justify-center"
                      >
                        <Edit2 size={14} className="mr-2" /> Edit
                      </button>
                    </PermissionGuard>
                    <PermissionGuard module="widget" action="write">
                      <button 
                        onClick={() => handleDeleteWidget(widget.id)}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </PermissionGuard>
                  </div>
                </div>
              </div>
            ))}
            
            {currentTypeWidgets.length === 0 && (
              <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-gray-500 mb-2">No widgets created yet.</p>
                <PermissionGuard module="widget" action="write">
                  <button 
                    onClick={handleCreateWidget}
                    className="text-blue-600 font-medium hover:underline"
                  >
                    Create your first {selectedWidgetTypeName} widget
                  </button>
                </PermissionGuard>
              </div>
            )}
          </div>
        </>
      )}

      <WidgetEditorModal 
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSuccess={handleEditorSuccess}
        initialWidget={editingWidget}
        initialType={selectedType}
      />
    </div>
  );
};

export default Widgets;

import React, { useEffect, useState } from 'react';
import { Search, Video, Grid, List, Folder, ArrowLeft, Puzzle } from 'lucide-react';
import { MediaFile, MediaFolder } from '../../../types/playlist';
import api from '../../../services/api';
import { getWidgets } from '../../../services/widget';
import { Widget } from '../../../types/widget';
import SearchableSelect from '../../../components/SearchableSelect';

interface LeftSidebarProps {
  onDragStart: (media: MediaFile) => void;
}

interface Breadcrumb {
  id: string;
  name: string;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({ onDragStart }) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'MEDIA' | 'WIDGETS'>('MEDIA');
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [widgetSearch, setWidgetSearch] = useState('');
  const [widgetTypeFilter, setWidgetTypeFilter] = useState<Widget['type'] | 'ALL'>('ALL');
  
  // Navigation & Filtering
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'IMAGE' | 'VIDEO'>('ALL');

  const currentFolderId = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].id : null;

  const widgetTypeOptions = [
    { value: "ALL", label: "All Types" },
    { value: "TIME_DATE", label: "Time/Date" },
    { value: "ANALOG_CLOCK", label: "Analog Clock" },
    { value: "WEATHER", label: "Weather" },
    { value: "NEWS", label: "News" },
    { value: "QR_CODE", label: "QR Code" },
    { value: "COUNT_DOWN", label: "Count Down" },
    { value: "YOUTUBE", label: "YouTube" }
  ];

  useEffect(() => {
    if (activeTab === 'MEDIA') {
      fetchMedia();
    }
  }, [search, currentFolderId, activeTab]);

  useEffect(() => {
    if (activeTab === 'WIDGETS') {
      fetchWidgets();
    }
  }, [activeTab, widgetSearch, widgetTypeFilter]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const response = await api.get('/library', { 
        params: { 
          search,
          folderId: currentFolderId
        } 
      });
      
      const files = response.data.files || [];
      const fetchedFolders = response.data.folders || [];

      const formattedFiles: MediaFile[] = files.map((f: any) => ({
        id: f.id,
        filename: f.name,
        originalName: f.name,
        mimeType: f.mimeType,
        size: f.size,
        url: f.url,
        type: f.mimeType.startsWith('image') ? 'IMAGE' : 'VIDEO',
        duration: f.duration
      }));
      
      setMediaFiles(formattedFiles);
      setFolders(fetchedFolders);
    } catch (error) {
      console.error("Failed to fetch media", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWidgets = async () => {
    setLoading(true);
    try {
      const data = await getWidgets();
      let rows: Widget[] = data || [];
      if (widgetSearch) {
        rows = rows.filter(w => w.name.toLowerCase().includes(widgetSearch.toLowerCase()));
      }
      if (widgetTypeFilter !== 'ALL') {
        rows = rows.filter(w => w.type === widgetTypeFilter);
      }
      setWidgets(rows);
    } catch (error) {
      console.error('Failed to fetch widgets', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, media: MediaFile) => {
    e.dataTransfer.setData('application/json', JSON.stringify(media));
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(media);
  };

  const handleWidgetDragStart = (e: React.DragEvent, widget: Widget) => {
    const payload = {
      __kind: 'WIDGET',
      id: widget.id,
      name: widget.name,
      type: widget.type,
      config: widget.config
    };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const getFullUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    const base = import.meta.env.VITE_API_URL || '';
    return `${base}${url}`;
  };

  const handleFolderClick = (folder: MediaFolder) => {
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
  };

  const handleBackClick = () => {
    setBreadcrumbs(breadcrumbs.slice(0, -1));
  };

  // Filter Logic
  const filteredFiles = mediaFiles.filter(file => {
    if (filterType === 'ALL') return true;
    return file.type === filterType;
  });

  return (
    <div className="w-80 bg-white border-r flex flex-col h-full z-10">
      <div className="p-4 border-b">
        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          <button
            className={`px-3 py-1.5 text-sm rounded ${activeTab === 'MEDIA' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => setActiveTab('MEDIA')}
          >
            Media
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded ${activeTab === 'WIDGETS' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => setActiveTab('WIDGETS')}
          >
            Widgets
          </button>
        </div>

        {activeTab === 'MEDIA' ? (
          <>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-gray-700">Media Library</h2>
              <div className="flex bg-gray-100 rounded p-0.5">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}
                >
                  <Grid size={14} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-1 rounded ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}
                >
                  <List size={14} />
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search media..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            </div>
            
            {/* Filter Buttons */}
            <div className="flex gap-2 mt-3">
              <button 
                onClick={() => setFilterType('ALL')}
                className={`flex-1 py-1.5 text-xs rounded font-medium transition-colors ${
                  filterType === 'ALL' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                All
              </button>
              <button 
                onClick={() => setFilterType('IMAGE')}
                className={`flex-1 py-1.5 text-xs rounded font-medium transition-colors ${
                  filterType === 'IMAGE' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                Images
              </button>
              <button 
                onClick={() => setFilterType('VIDEO')}
                className={`flex-1 py-1.5 text-xs rounded font-medium transition-colors ${
                  filterType === 'VIDEO' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                Videos
              </button>
            </div>

            {/* Breadcrumbs / Back Navigation */}
            {breadcrumbs.length > 0 && (
              <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                <button 
                  onClick={handleBackClick}
                  className="flex items-center hover:text-blue-600 transition-colors"
                >
                  <ArrowLeft size={14} className="mr-1" />
                  Back
                </button>
                <span className="text-gray-400">/</span>
                <span className="font-medium truncate max-w-[150px]">
                  {breadcrumbs[breadcrumbs.length - 1].name}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">Widgets</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search widgets..."
                  value={widgetSearch}
                  onChange={(e) => setWidgetSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              </div>
              <div className="w-32">
                <SearchableSelect
                  value={widgetTypeFilter}
                  onChange={(val) => setWidgetTypeFilter(val as any)}
                  options={widgetTypeOptions}
                  triggerClassName="w-full border rounded-md px-2 py-2 bg-white text-sm"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="text-center text-gray-400 py-10">Loading...</div>
        ) : activeTab === 'MEDIA' ? (
          <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "space-y-2"}>
            
            {/* Folders */}
            {folders.map(folder => (
              <div
                key={folder.id}
                onClick={() => handleFolderClick(folder)}
                className={`group cursor-pointer bg-amber-50 border border-amber-100 rounded-md hover:border-amber-300 hover:shadow-sm transition-all ${
                  viewMode === 'grid' ? 'aspect-square flex flex-col items-center justify-center' : 'flex items-center p-2'
                }`}
              >
                <Folder size={viewMode === 'grid' ? 32 : 20} className="text-amber-400 mb-1" />
                <span className={`text-gray-700 font-medium truncate px-2 text-center ${viewMode === 'list' ? 'ml-2 text-sm' : 'text-xs w-full'}`}>
                  {folder.name}
                </span>
              </div>
            ))}

            {/* Files */}
            {filteredFiles.map((media) => (
              <div
                key={media.id}
                draggable
                onDragStart={(e) => handleDragStart(e, media)}
                className={`group relative bg-gray-50 border rounded-md cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-sm transition-all ${
                  viewMode === 'grid' ? 'aspect-square flex flex-col' : 'flex items-center p-2'
                }`}
              >
                {media.type === 'IMAGE' ? (
                  <img 
                    src={getFullUrl(media.url)} 
                    alt={media.originalName} 
                    className={`object-cover w-full h-full rounded-md ${viewMode === 'list' ? 'w-10 h-10 mr-3' : ''}`} 
                  />
                ) : (
                  <div className={`relative overflow-hidden rounded-md bg-gray-100 ${viewMode === 'list' ? 'w-10 h-10 mr-3' : 'w-full h-full'}`}>
                    <video 
                      src={`${getFullUrl(media.url)}#t=0.1`} 
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                      onMouseOver={(e) => e.currentTarget.play()}
                      onMouseOut={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                    <div className={`absolute pointer-events-none bg-black/50 rounded-full flex items-center justify-center ${viewMode === 'list' ? 'inset-0 bg-transparent' : 'top-1 right-1 p-1'}`}>
                      <Video size={viewMode === 'list' ? 16 : 12} className="text-white drop-shadow-md" />
                    </div>
                  </div>
                )}
                
                {viewMode === 'grid' && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                    <span className="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded">Drag to Canvas</span>
                  </div>
                )}
                
                {viewMode === 'list' && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{media.originalName}</p>
                    <p className="text-xs text-gray-500">{media.type}</p>
                  </div>
                )}
              </div>
            ))}
            
            {folders.length === 0 && filteredFiles.length === 0 && (
              <div className="col-span-full text-center text-gray-400 py-8 text-sm">
                No media found
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {widgets.map((w) => (
              <div
                key={w.id}
                draggable
                onDragStart={(e) => handleWidgetDragStart(e, w)}
                className="group bg-gray-50 border rounded-md p-2 cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-sm transition-all flex items-center gap-3"
                title="Drag to Canvas to create a new zone"
              >
                <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-500">
                  <Puzzle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{w.name}</p>
                  <p className="text-xs text-gray-500">{w.type}</p>
                </div>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100">
                  Drag to Canvas
                </span>
              </div>
            ))}

            {widgets.length === 0 && (
              <div className="text-center text-gray-400 py-8 text-sm">
                No widgets found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeftSidebar;

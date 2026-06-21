import { useState, useEffect } from 'react';
import api from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { Monitor, Wifi, WifiOff, Plus, Camera, Pencil, Trash2, Settings as SettingsIcon, Search, Filter, PlayCircle, LayoutList, Map as MapIcon, Smartphone, Shield, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import AddScreenModal from '../components/AddScreenModal';
import EditScreenModal from '../components/EditScreenModal';
import PlaylistPreviewModal from '../components/PlaylistPreviewModal';
import ScreenMap from '../components/ScreenMap';
import PermissionGuard from '../components/PermissionGuard';
import { Screen } from '../services/screen';
import { getTenantSettings } from '../services/tenant';

type ScreenSummary = {
  total: number;
  online: number;
  offline: number;
  native: number;
  deviceOwner: number;
  downloading: number;
};

const Screens = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string | undefined>(undefined);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState<any>(null);

  // Playlist Preview State
  const [previewPlaylistId, setPreviewPlaylistId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<ScreenSummary>({
    total: 0,
    online: 0,
    offline: 0,
    native: 0,
    deviceOwner: 0,
    downloading: 0,
  });

  const filteredScreens = screens;

  const fetchScreens = async () => {
    try {
      setError(null);
      const res = await api.get('/screens', {
        params: {
          deleted: showDeleted,
          page,
          pageSize,
          search: searchQuery || undefined,
          status: showDeleted
            ? 'DELETED'
            : statusFilter === 'all'
              ? undefined
              : statusFilter === 'online'
                ? 'ONLINE'
                : 'OFFLINE'
        }
      });
      const payload = res.data;
      if (payload.items && payload.pagination) {
        setScreens(payload.items);
        setTotalPages(payload.pagination.totalPages || 1);
        if (payload.summary) {
          setStats(payload.summary);
        }
      } else {
        setScreens(payload);
        setTotalPages(1);
        setStats({
          total: payload.length,
          online: payload.filter((s: Screen) => s.status === 'ONLINE').length,
          offline: payload.filter((s: Screen) => s.status !== 'ONLINE').length,
          native: payload.filter((s: Screen) => s.nativeDiagnostics?.isNativePlayer || s.playerType === 'Android').length,
          deviceOwner: payload.filter((s: Screen) => s.nativeDiagnostics?.deviceOwnerState === 'DEVICE_OWNER').length,
          downloading: payload.filter((s: Screen) => s.nativeDiagnostics?.downloadState === 'DOWNLOADING').length
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch screens', err);
      setError(err.response?.data?.message || 'Failed to load screens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScreens();
  }, [showDeleted, token, page, pageSize, searchQuery, statusFilter]); // Re-fetch when query changes

  useEffect(() => {
    // Refresh list every 30s to update status (only if not showing deleted)
    if (showDeleted) return;

    const interval = setInterval(fetchScreens, 30000);
    return () => clearInterval(interval);
  }, [token, showDeleted, page, pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [showDeleted, searchQuery, statusFilter]);

  useEffect(() => {
    // Fetch tenant settings for API key
    const fetchSettings = async () => {
      try {
        const settings = await getTenantSettings();
        if (settings.config.googleMapsApiKey) {
          setGoogleMapsApiKey(settings.config.googleMapsApiKey);
        }
      } catch (e) {
        console.error('Failed to load settings', e);
      } finally {
        setSettingsLoaded(true);
      }
    };
    fetchSettings();
  }, [token]);

  const handleEdit = (screen: any) => {
    setSelectedScreen(screen);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (screenId: string) => {
    if (!window.confirm('Are you sure you want to delete this screen? This action cannot be undone.')) {
      return;
    }
    
    try {
      await api.delete(`/screens/${screenId}`);
      fetchScreens();
    } catch (err) {
      console.error('Failed to delete screen', err);
      alert('Failed to delete screen');
    }
  };

  const handleSnapshot = async (screenId: string) => {
    try {
      await api.post(`/screens/${screenId}/snapshot`);
      alert('Snapshot requested successfully. It will appear in logs/snapshots shortly.');
    } catch (err) {
      console.error('Failed to request snapshot', err);
      alert('Failed to request snapshot');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Screen Management</h1>
          <p className="text-gray-500">Manage your digital signage screens</p>
        </div>
        <div className="flex space-x-3">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'list' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="List View"
            >
              <LayoutList size={20} />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'map' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Map View"
            >
              <MapIcon size={20} />
            </button>
          </div>
          <PermissionGuard module="screen" action="create">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={20} className="mr-2" />
              Add Screen
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg mr-4">
            <Monitor size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Screens</p>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg mr-4">
            <Wifi size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Online Screens</p>
            <p className="text-2xl font-bold text-gray-800">{stats.online}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg mr-4">
            <WifiOff size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Offline Screens</p>
            <p className="text-2xl font-bold text-gray-800">{stats.offline}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg mr-4">
            <Smartphone size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Native Players</p>
            <p className="text-2xl font-bold text-gray-800">{stats.native}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg mr-4">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Device Owner</p>
            <p className="text-2xl font-bold text-gray-800">{stats.deviceOwner}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg mr-4">
            <Download size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Downloads</p>
            <p className="text-2xl font-bold text-gray-800">{stats.downloading}</p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={18} className="text-gray-500 mr-2" />
            <input
              type="text"
              placeholder="Search screens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none flex-1 text-sm"
            />
          </div>
          <div className="w-48">
            <SearchableSelect
              icon={<Filter size={18} className="text-gray-500" />}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'online', label: 'Online' },
                { value: 'offline', label: 'Offline' }
              ]}
              triggerClassName="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              disabled={showDeleted}
            />
          </div>
          <button
            onClick={() => setShowDeleted(!showDeleted)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors border ${
              showDeleted 
                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Trash2 size={18} />
            {showDeleted ? 'Show Active' : 'Show Deleted'}
          </button>
        </div>
      </div>

      {/* Screen Content */}
      {viewMode === 'map' ? (
        !settingsLoaded ? (
            <div className="flex items-center justify-center h-[600px] bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        ) : (
            <ScreenMap 
            screens={filteredScreens} 
            onScreenClick={(id) => {
                const screen = screens.find(s => s.id === id);
                if (screen) handleEdit(screen);
            }}
            apiKey={googleMapsApiKey}
            />
        )
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm">
                  <th className="px-6 py-4 font-medium">Screen Name</th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Playlist</th>
                  <th className="px-6 py-4 font-medium">Orientation</th>
                  <th className="px-6 py-4 font-medium">Last Response</th>
                  <th className="px-6 py-4 font-medium">Created At</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      Loading screens...
                    </td>
                  </tr>
                ) : filteredScreens.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      {showDeleted ? 'No deleted screens found' : (screens.length === 0 
                        ? 'No screens found. Click "Add Screen" to pair a device.' 
                        : 'No screens match your search.')}
                    </td>
                  </tr>
                ) : (
                  filteredScreens.map((screen) => (
                    <tr key={screen.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/screens/${screen.id}`} className="flex items-center group">
                          <Monitor size={18} className="text-gray-400 mr-3 group-hover:text-blue-600" />
                          <div>
                            <p className="font-medium text-gray-800 group-hover:text-blue-600">{screen.name}</p>
                            <p className="text-xs text-gray-400">ID: {screen.id.substring(0, 8)}...</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        {screen.location?.city || screen.location?.label || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {showDeleted ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                DELETED
                            </span>
                        ) : (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            screen.status === 'ONLINE' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                            {screen.status === 'ONLINE' ? (
                            <><Wifi size={12} className="mr-1" /> Online</>
                            ) : (
                            <><WifiOff size={12} className="mr-1" /> Offline</>
                            )}
                        </span>
                        )}
                      {screen.config?.telemetry && !showDeleted && (
                        <div className="mt-1 text-xs text-gray-500">
                          CPU: {screen.config.telemetry.cpuUsage || 0}%
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      <div>{screen.playerType || 'Browser'}</div>
                      {screen.nativeDiagnostics?.isNativePlayer && (
                        <div className="mt-1 text-xs text-gray-500">
                          {screen.nativeDiagnostics.platform || 'native'} {screen.nativeDiagnostics.deviceOwnerState === 'DEVICE_OWNER' ? '• DO' : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {screen.activePlaylist ? (
                        <button
                          onClick={() => {
                            setPreviewPlaylistId(screen.activePlaylist!.id);
                            setIsPreviewOpen(true);
                          }}
                          className="flex items-center text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <PlayCircle size={14} className="mr-1" />
                          {screen.activePlaylist.name}
                        </button>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {screen.orientation}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {screen.lastSeenAt ? new Date(screen.lastSeenAt).toLocaleString('en-GB') : 'Never'}
                      {screen.nativeDiagnostics?.isNativePlayer && !showDeleted && (
                        <div className="mt-1 text-xs text-gray-500">
                          {screen.nativeDiagnostics.playbackState || 'UNKNOWN'} / {screen.nativeDiagnostics.downloadState || 'UNKNOWN'}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {new Date(screen.createdAt).toLocaleString('en-GB')}
                    </td>
                      <td className="px-6 py-4 text-right">
                        {!showDeleted && (
                            <div className="flex items-center justify-end space-x-2">
                            <Link 
                                to={`/screens/${screen.id}`}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                                title="Manage Screen"
                            >
                                <SettingsIcon size={18} />
                            </Link>
                            <PermissionGuard module="screen" action="write">
                                <button 
                                onClick={() => handleEdit(screen)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                                title="Edit Screen"
                                >
                                <Pencil size={18} />
                                </button>
                            </PermissionGuard>
                            <PermissionGuard module="screen" action="write">
                                <button 
                                onClick={() => handleSnapshot(screen.id)}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                                title="Snapshot"
                                >
                                <Camera size={18} />
                                </button>
                            </PermissionGuard>
                            <PermissionGuard module="screen" action="delete">
                                <button 
                                onClick={() => handleDelete(screen.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                                title="Delete"
                                >
                                <Trash2 size={18} />
                                </button>
                            </PermissionGuard>
                            </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <div className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <AddScreenModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={fetchScreens}
        />
      )}

      <EditScreenModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchScreens}
        screen={selectedScreen}
      />

      <PlaylistPreviewModal
        isOpen={isPreviewOpen}
        playlistId={previewPlaylistId}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
};

export default Screens;

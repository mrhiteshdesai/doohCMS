import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getPlaylists, Playlist } from '../services/playlist';
import PlaylistThumbnail from '../components/PlaylistThumbnail';
import PermissionGuard from '../components/PermissionGuard';
import { 
  Monitor, Activity, Terminal, Camera, RefreshCw, Power, ArrowLeft, 
  Clock, Save, FileText, Database, PlaySquare, Settings, Download, 
  Smartphone, Maximize, HardDrive, RotateCw, Thermometer, Cpu, Search, CheckCircle, Share, Calendar, Trash2, X, Info,
  Shield, AlertTriangle, PackageSearch
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getFullUrl } from '../utils/url';

const ScreenDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [commandLoading, setCommandLoading] = useState(false);
  const [browserSettings, setBrowserSettings] = useState<any>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);
  const [androidRemote, setAndroidRemote] = useState<any>({
    apiBase: '',
    kioskEnabled: false,
    startOnBoot: true
  });
  const [nativeManifest, setNativeManifest] = useState<any>(null);
  const [manifestLoading, setManifestLoading] = useState(false);

  const fetchScreen = async () => {
    try {
      const res = await api.get(`/screens/${id}`);
      setScreen(res.data);
      if (res.data.config?.browserSettings) {
        setBrowserSettings(res.data.config.browserSettings);
      }
      const telemetry = res.data.config?.telemetry || {};
      setAndroidRemote((prev: any) => ({
        ...prev,
        apiBase: res.data.nativeDiagnostics?.apiBase || telemetry.apiBase || prev.apiBase || '',
        kioskEnabled: res.data.nativeDiagnostics?.kioskEnabled !== undefined ? !!res.data.nativeDiagnostics.kioskEnabled : (telemetry.kioskEnabled !== undefined ? !!telemetry.kioskEnabled : prev.kioskEnabled),
        startOnBoot: res.data.nativeDiagnostics?.startOnBoot !== undefined ? !!res.data.nativeDiagnostics.startOnBoot : (telemetry.startOnBoot !== undefined ? !!telemetry.startOnBoot : prev.startOnBoot)
      }));
      if (res.data.nativeDiagnostics?.isNativePlayer || res.data.playerType === 'Android') {
        fetchNativeManifest();
      } else {
        setNativeManifest(null);
      }
    } catch (error) {
      console.error('Failed to fetch screen details:', error);
      toast.error('Failed to load screen details');
      navigate('/screens');
    } finally {
      setLoading(false);
    }
  };

  const fetchNativeManifest = async () => {
    try {
      setManifestLoading(true);
      const res = await api.get(`/screens/${id}/native-manifest`);
      setNativeManifest(res.data);
    } catch (error) {
      console.error('Failed to fetch native manifest:', error);
    } finally {
      setManifestLoading(false);
    }
  };

  useEffect(() => {
    fetchScreen();
    const interval = setInterval(fetchScreen, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [id]);

  const handleCommand = async (command: string, payload?: any) => {
    if (!confirm(`Are you sure you want to send command: ${command}?`)) return;
    
    setCommandLoading(true);
    try {
      await api.post(`/screens/${id}/command`, { command, payload });
      toast.success(`Command '${command}' sent successfully`);
      fetchScreen();
    } catch (error) {
      console.error('Failed to send command:', error);
      toast.error('Failed to send command');
    } finally {
      setCommandLoading(false);
    }
  };

  const handleSnapshot = async () => {
    try {
      await api.post(`/screens/${id}/snapshot`);
      toast.success('Snapshot requested');
      // Ideally wait/poll for it, but for now just notify
    } catch (error) {
      toast.error('Failed to request snapshot');
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear ALL commands? This will remove pending, processing, and completed commands.')) return;
    
    setCommandLoading(true);
    try {
      await api.post(`/screens/${id}/commands/clear`);
      toast.success('Command queue cleared');
      fetchScreen();
    } catch (error) {
      console.error('Failed to clear queue:', error);
      toast.error('Failed to clear queue');
    } finally {
      setCommandLoading(false);
    }
  };

  const handleResetContent = async () => {
    if (!confirm('Are you sure you want to DELETE ALL CONTENT from this screen? This will stop playback, clear the cache, and return the screen to the "Waiting for Content" state.')) return;
    
    setCommandLoading(true);
    try {
        await api.post(`/screens/${id}/reset`);
        toast.success('Screen content reset successfully');
        fetchScreen();
    } catch (error: any) {
        console.error('Reset failed:', error);
        toast.error(error.message || 'Failed to reset screen');
    } finally {
        setCommandLoading(false);
    }
  };

  const handlePublishPlaylist = async (playlistId: string) => {
    if (!confirm('Are you sure you want to publish this playlist to the screen?')) return;
    
    try {
      await api.post(`/screens/${id}/publish`, { playlistId });
      toast.success('Playlist published successfully');
      fetchScreen(); // Refresh to show new active playlist
    } catch (error) {
      console.error('Failed to publish playlist:', error);
      toast.error('Failed to publish playlist');
    }
  };

  const handleExportLogs = async () => {
    try {
      const response = await api.get(`/screens/${id}/logs/export`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `screen-${id}-logs-${new Date().toISOString().split('T')[0]}.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export logs:', error);
      toast.error('Failed to export logs');
    }
  };

  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
        const updatedConfig = {
            ...screen.config,
            browserSettings: browserSettings
        };
        await api.put(`/screens/${id}`, { config: updatedConfig });
        toast.success('Settings saved successfully');
        fetchScreen();
    } catch (error) {
        console.error('Failed to save settings:', error);
        toast.error('Failed to save settings');
    } finally {
        setSettingsLoading(false);
    }
  };

  const sendAndroidCommand = async (command: string, payload?: any) => {
    setCommandLoading(true);
    try {
      await api.post(`/screens/${id}/command`, { command, payload });
      toast.success(`Command '${command}' sent successfully`);
      fetchScreen();
    } catch (error) {
      console.error('Failed to send command:', error);
      toast.error('Failed to send command');
    } finally {
      setCommandLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!screen) return <div className="p-8 text-center">Screen not found</div>;

  const telemetry = screen.config?.telemetry || {};
  const pendingCommands = screen.config?.pendingCommands || [];
  const displayQueue = screen.config?.commandHistory || [];
  const nativeDiagnostics = screen.nativeDiagnostics || {};
  const isNativePlayer = !!nativeDiagnostics.isNativePlayer || screen.playerType === 'Android';
  
  // Phase 3: Telemetry Data
  const deviceHealth = {
    cpuTemp: screen.cpuTemp ? `${screen.cpuTemp.toFixed(1)}°C` : 'N/A',
    freeDisk: screen.freeDiskSpace ? `${(Number(screen.freeDiskSpace) / 1024 / 1024 / 1024).toFixed(2)} GB` : 'N/A',
    totalDisk: screen.totalDiskSpace ? `${(Number(screen.totalDiskSpace) / 1024 / 1024 / 1024).toFixed(2)} GB` : 'N/A',
    memory: screen.usedMemory && screen.totalMemory ? `${(Number(screen.usedMemory) / 1024 / 1024).toFixed(0)} / ${(Number(screen.totalMemory) / 1024 / 1024).toFixed(0)} MB` : 'N/A',
    version: screen.appVersion || 'Unknown',
    lastUpdate: screen.lastTelemetryAt ? new Date(screen.lastTelemetryAt).toLocaleString() : 'Never'
  };
  const nativeHealth = {
    freeStorage: formatBytes(nativeDiagnostics.freeStorageBytes),
    totalStorage: formatBytes(nativeDiagnostics.totalStorageBytes),
    memory: nativeDiagnostics.memoryUsedBytes && nativeDiagnostics.memoryTotalBytes
      ? `${formatBytes(nativeDiagnostics.memoryUsedBytes)} / ${formatBytes(nativeDiagnostics.memoryTotalBytes)}`
      : deviceHealth.memory,
    lastSuccessfulPlayback: nativeDiagnostics.lastSuccessfulPlaybackAt
      ? new Date(nativeDiagnostics.lastSuccessfulPlaybackAt).toLocaleString()
      : 'N/A'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/screens')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <Monitor className="mr-2 text-blue-600" />
              {screen.name || 'Unnamed Screen'}
            </h1>
            <p className="text-gray-500 text-sm flex items-center mt-1">
              <span className={`w-2 h-2 rounded-full mr-2 ${screen.status === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {screen.status} • Last seen: {new Date(screen.lastSeenAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
            {/* Remote Commands Dropdown or Buttons */}
            <div className="flex gap-2">
                {isNativePlayer ? (
                  <>
                    <button 
                        onClick={() => handleCommand('REBOOT_APP')}
                        disabled={commandLoading}
                        className="flex items-center px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
                        title="Restart Native App"
                    >
                        <Power size={18} className="mr-1" />
                        Reboot App
                    </button>
                    <button 
                        onClick={() => handleCommand('REBOOT_DEVICE')}
                        disabled={commandLoading}
                        className="flex items-center px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 disabled:opacity-50"
                        title="Reboot Device"
                    >
                        <Power size={18} className="mr-1" />
                        Reboot Device
                    </button>
                  </>
                ) : (
                  <button 
                      onClick={() => handleCommand('REBOOT')}
                      disabled={commandLoading}
                      className="flex items-center px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
                      title="Reboot Device"
                  >
                      <Power size={18} className="mr-1" />
                      Reboot
                  </button>
                )}
                <button 
                    onClick={() => handleCommand('RELOAD')}
                    disabled={commandLoading}
                    className="flex items-center px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                    title="Reload Content"
                >
                    <RefreshCw size={18} className="mr-1" />
                    Reload
                </button>
                <button 
                    onClick={() => handleCommand('SNAPSHOT')}
                    disabled={commandLoading}
                    className="flex items-center px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50"
                    title="Request Snapshot"
                >
                    <Camera size={18} className="mr-1" />
                    Snapshot
                </button>
                {isNativePlayer && (
                  <button 
                      onClick={() => handleCommand('EXPORT_SUPPORT_BUNDLE')}
                      disabled={commandLoading}
                      className="flex items-center px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
                      title="Export Support Bundle"
                  >
                      <Database size={18} className="mr-1" />
                      Support Bundle
                  </button>
                )}
                 <button 
                    onClick={() => handleCommand('CLEAR_CACHE')}
                    disabled={commandLoading}
                    className="flex items-center px-3 py-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 disabled:opacity-50"
                    title="Clear Cache"
                >
                    <Trash2 size={18} className="mr-1" />
                    Clear Cache
                </button>
            </div>

          <button 
            onClick={fetchScreen}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Refresh Data"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 justify-end">
        <button 
          onClick={() => handleCommand(isNativePlayer ? 'REBOOT_APP' : 'REBOOT')}
          disabled={commandLoading}
          className="flex items-center px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
        >
          <Power size={18} className="mr-2" /> {isNativePlayer ? 'Reboot App' : 'Reboot Player'}
        </button>
        {isNativePlayer && (
          <button 
            onClick={() => handleCommand('REBOOT_DEVICE')}
            disabled={commandLoading}
            className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            <Power size={18} className="mr-2" /> Reboot Device
          </button>
        )}
        <button 
          onClick={() => handleCommand('RELOAD')}
          disabled={commandLoading}
          className="flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <RefreshCw size={18} className="mr-2" /> Reload Content
        </button>
        <button 
          onClick={() => handleCommand('CLEAR_CACHE')}
          disabled={commandLoading}
          className="flex items-center px-4 py-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors"
        >
          <Database size={18} className="mr-2" /> Clear Cache
        </button>
        <button 
          onClick={handleResetContent}
          disabled={commandLoading}
          className="flex items-center px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
        >
          <Trash2 size={18} className="mr-2" /> Delete Content
        </button>
        <button 
          onClick={handleSnapshot}
          className="flex items-center px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
        >
          <Camera size={18} className="mr-2" /> Take Snapshot
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'playlists', label: 'Playlists' },
            { id: 'settings', label: isNativePlayer ? 'Native Controls' : 'Screen Configuration' },
            ...(isNativePlayer ? [{ id: 'manifest', label: 'Native Manifest' }] : []),
            { id: 'downloads', label: 'Downloads' },
            { id: 'snapshots', label: 'Snapshots' },
            { id: 'logs', label: 'Logs' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize
                ${activeTab === tab.id 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               <StatCard 
                 icon={PlaySquare} 
                 label="Live Playlist" 
                 value={screen.activePlaylist?.name || 'No Playlist'} 
                 subValue={screen.activePlaylist ? 'Playing Now' : 'Idle'}
                 color="text-blue-600 bg-blue-50"
               />
               <StatCard 
                 icon={Monitor} 
                 label="Player Type" 
                 value={screen.playerType || 'Browser'} 
                 subValue="Platform"
                 color="text-teal-600 bg-teal-50"
               />
               <StatCard 
                 icon={Smartphone} 
                 label="Operating System" 
                 value={telemetry.os || 'Linux'} 
                 subValue="Platform"
                 color="text-purple-600 bg-purple-50"
               />
               <StatCard 
                 icon={Info} 
                 label="App Version" 
                 value={nativeDiagnostics.appVersion || screen.appVersion || telemetry.appVersion || 'Unknown'} 
                 subValue="Player Version"
                 color="text-cyan-600 bg-cyan-50"
               />
               <StatCard 
                 icon={RotateCw} 
                 label="Orientation" 
                 value={screen.orientation || 'Landscape'} 
                 subValue="0°"
                 color="text-orange-600 bg-orange-50"
               />
               <StatCard 
                 icon={Maximize} 
                 label="Resolution" 
                 value={telemetry.resolution || '1920x1080'} 
                 subValue="16:9 Aspect Ratio"
                 color="text-green-600 bg-green-50"
               />
               <StatCard 
                 icon={HardDrive} 
                 label="Storage" 
                 value={isNativePlayer ? nativeHealth.freeStorage : deviceHealth.freeDisk} 
                 subValue={`Total: ${isNativePlayer ? nativeHealth.totalStorage : deviceHealth.totalDisk}`}
                 color="text-indigo-600 bg-indigo-50"
               />
               <StatCard 
                 icon={Cpu} 
                 label="CPU Usage" 
                 value={telemetry.cpuUsage ? `${telemetry.cpuUsage}%` : 'N/A'} 
                 subValue="Load"
                 color="text-red-600 bg-red-50"
               />
               <StatCard 
                 icon={Activity} 
                 label="Memory" 
                 value={isNativePlayer ? nativeHealth.memory : deviceHealth.memory} 
                 subValue={telemetry.memoryUsage ? `${telemetry.memoryUsage}% Used` : 'Usage'}
                 color="text-pink-600 bg-pink-50"
               />
               <StatCard 
                 icon={Thermometer} 
                 label="Temperature" 
                 value={telemetry.temperature ? `${telemetry.temperature}°C` : 'N/A'} 
                 subValue="Core Temp"
                 color="text-yellow-600 bg-yellow-50"
               />
               {isNativePlayer && (
                 <>
                   <StatCard
                     icon={Shield}
                     label="Device Owner"
                     value={nativeDiagnostics.deviceOwnerState || 'UNKNOWN'}
                     subValue={nativeDiagnostics.kioskEnabled ? 'Kiosk On' : 'Kiosk Off'}
                     color="text-emerald-600 bg-emerald-50"
                   />
                   <StatCard
                     icon={PlaySquare}
                     label="Playback State"
                     value={nativeDiagnostics.playbackState || 'UNKNOWN'}
                     subValue={nativeDiagnostics.currentAssetId ? `Asset: ${String(nativeDiagnostics.currentAssetId).slice(0, 8)}...` : 'No active asset'}
                     color="text-violet-600 bg-violet-50"
                   />
                   <StatCard
                     icon={Download}
                     label="Download State"
                     value={nativeDiagnostics.downloadState || 'UNKNOWN'}
                     subValue={nativeDiagnostics.cachedAssetCount != null ? `${nativeDiagnostics.cachedAssetCount} cached assets` : 'No cache report'}
                     color="text-amber-600 bg-amber-50"
                   />
                   <StatCard
                     icon={Clock}
                     label="Last Good Playback"
                     value={nativeHealth.lastSuccessfulPlayback}
                     subValue={nativeDiagnostics.lastTelemetryAt ? `Telemetry: ${new Date(nativeDiagnostics.lastTelemetryAt).toLocaleString()}` : 'No telemetry'}
                     color="text-sky-600 bg-sky-50"
                   />
                 </>
               )}
            </div>

            {isNativePlayer && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center mb-4">
                    <Smartphone size={20} className="mr-2 text-gray-500" /> Native Diagnostics
                  </h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div>Platform: {nativeDiagnostics.platform || screen.playerType || 'Unknown'}</div>
                    <div>Device: {nativeDiagnostics.device || 'Unknown'}</div>
                    <div>Android: {nativeDiagnostics.androidVersion || 'Unknown'}</div>
                    <div>Current Playlist: {nativeDiagnostics.currentPlaylistId || 'N/A'}</div>
                    <div>Current Asset: {nativeDiagnostics.currentAssetId || 'N/A'}</div>
                    <div>Queue Depth: {nativeDiagnostics.commandQueueDepth ?? pendingCommands.length}</div>
                    <div>API Base: {nativeDiagnostics.apiBase || 'N/A'}</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center mb-4">
                    <AlertTriangle size={20} className="mr-2 text-gray-500" /> Error Signals
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="font-medium text-gray-700">Playback Error</div>
                      <div className="mt-1 text-gray-500">{nativeDiagnostics.playbackError || 'None reported'}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="font-medium text-gray-700">Decoder Error</div>
                      <div className="mt-1 text-gray-500">{nativeDiagnostics.decoderError || 'None reported'}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="font-medium text-gray-700">Download Error</div>
                      <div className="mt-1 text-gray-500">{nativeDiagnostics.lastDownloadError || 'None reported'}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="font-medium text-gray-700">Support Bundle</div>
                      <div className="mt-1 text-gray-500">
                        {nativeDiagnostics.supportBundle?.uploadedAt
                          ? `Latest: ${new Date(nativeDiagnostics.supportBundle.uploadedAt).toLocaleString()}`
                          : 'No support bundle uploaded yet'}
                      </div>
                      {nativeDiagnostics.supportBundle?.url && (
                        <a
                          href={nativeDiagnostics.supportBundle.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex text-sm text-blue-600 hover:text-blue-800"
                        >
                          Download {nativeDiagnostics.supportBundle.fileName || 'support bundle'}
                        </a>
                      )}
                    </div>
                    {nativeDiagnostics.lastCommand && (
                      <div className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="font-medium text-gray-700">Last Command</div>
                        <div className="mt-1 text-gray-500">
                          {nativeDiagnostics.lastCommand.type || 'Unknown'} / {nativeDiagnostics.lastCommand.status || 'Unknown'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Command Queue & Download Progress */}
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Terminal size={20} className="mr-2 text-gray-500" /> Command Queue
                </div>
                <button
                  onClick={handleClearHistory}
                  className="px-4 py-2 rounded-lg border text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium"
                >
                  Clear Command Queue
                </button>
              </h3>
              
              {displayQueue.length === 0 ? (
                <p className="text-gray-500 italic mb-4">No recent commands.</p>
              ) : (
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {displayQueue.map((cmd: any, idx: number) => (
                    <div key={idx} className="bg-white p-3 rounded border border-gray-200 flex flex-col shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-sm text-gray-800 font-bold">{cmd.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                            cmd.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            cmd.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                            cmd.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                            {cmd.status || 'PENDING'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-500">{cmd.message || (cmd.status === 'PENDING' ? 'Waiting for player...' : '')}</span>
                        <span className="text-xs text-gray-400">{new Date(cmd.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Download Progress Section */}
              {(nativeDiagnostics.downloadProgress || telemetry.downloadProgress) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  {(() => {
                    const progress = nativeDiagnostics.downloadProgress || telemetry.downloadProgress;
                    if (!progress) return null;
                    return (
                      <>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <Download size={16} className="mr-2 text-blue-500" /> 
                    File Sync Progress
                    {progress.status && (
                       <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                         progress.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                         progress.status === 'ERROR' ? 'bg-red-100 text-red-700' :
                         'bg-blue-100 text-blue-700'
                       }`}>
                         {progress.status}
                       </span>
                    )}
                  </h4>
                  
                  {progress.status === 'DOWNLOADING' && (
                    <>
                      <div className="bg-gray-200 rounded-full h-2.5 mb-2 overflow-hidden">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                          style={{ width: `${((progress.completed || 0) / Math.max(progress.total || 1, 1)) * 100}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span className="truncate max-w-[200px]">
                          {progress.currentFile ? `Downloading: ${progress.currentFile}` : 'Preparing...'}
                        </span>
                        <span>{progress.completed || 0} / {progress.total || 0}</span>
                      </div>
                    </>
                  )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'playlists' && (
          <PlaylistSelector 
            currentPlaylistId={screen.activePlaylist?.id}
            onPublish={handlePublishPlaylist} 
          />
        )}

        {activeTab === 'downloads' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center justify-between">
              <div className="flex items-center">
              <Download size={20} className="mr-2 text-gray-500" /> Cached Media Files
              </div>
              {isNativePlayer && (
                <span className="text-sm font-normal text-gray-500">
                  State: {nativeDiagnostics.downloadState || 'UNKNOWN'}
                </span>
              )}
            </h3>
            
            {telemetry.cachedFiles && telemetry.cachedFiles.length > 0 ? (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Name / ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cached At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {telemetry.cachedFiles.map((file: any) => (
                      <tr key={file.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {file.filename && file.filename !== 'unknown' ? file.filename : <span className="font-mono text-gray-500">{file.id.substring(0, 8)}...</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{file.mimeType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(file.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
                <HardDrive size={32} className="mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">No cached files reported by the player.</p>
                <p className="text-xs text-gray-400 mt-1">Files will appear here once downloaded by the screen.</p>
              </div>
            )}
          </div>
        )}



        {activeTab === 'health' && (
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-500">CPU Temperature</h3>
                            <Thermometer className="text-orange-500" size={20} />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{deviceHealth.cpuTemp}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-500">Free Disk Space</h3>
                            <HardDrive className="text-blue-500" size={20} />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{deviceHealth.freeDisk}</p>
                        <p className="text-xs text-gray-500 mt-1">Total: {deviceHealth.totalDisk}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-500">Memory Usage</h3>
                            <Activity className="text-purple-500" size={20} />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{deviceHealth.memory}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                         <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-500">App Version</h3>
                            <Info className="text-gray-500" size={20} />
                        </div>
                        <p className="text-lg font-bold text-gray-900">{deviceHealth.version}</p>
                         <p className="text-xs text-gray-500 mt-1">Last Update: {deviceHealth.lastUpdate}</p>
                    </div>
                </div>

                 {/* Command History specific to Health/Maintenance could go here */}
            </div>
        )}

        {/* Screen Settings */}
        {activeTab === 'settings' && (
          <div className="p-6 space-y-8">
             {!isNativePlayer ? (
                <div className="space-y-8">
                    {/* Display & Appearance */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <Monitor className="mr-2" size={20} /> Display & Appearance
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Software Rotation</label>
                                <select 
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={browserSettings.rotation || 0}
                                    onChange={(e) => setBrowserSettings({...browserSettings, rotation: parseInt(e.target.value)})}
                                >
                                    <option value={0}>0° (Landscape)</option>
                                    <option value={90}>90° (Portrait)</option>
                                    <option value={180}>180° (Inverted)</option>
                                    <option value={270}>270° (Portrait Inverted)</option>
                                </select>
                                <p className="mt-1 text-xs text-gray-500">For screens that don't support native rotation.</p>
                            </div>
                            <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-1">Overscan / Zoom ({browserSettings.zoom || 100}%)</label>
                                 <input 
                                    type="range" 
                                    min="80" 
                                    max="120" 
                                    value={browserSettings.zoom || 100}
                                    onChange={(e) => setBrowserSettings({...browserSettings, zoom: parseInt(e.target.value)})}
                                    className="w-full"
                                 />
                                 <p className="mt-1 text-xs text-gray-500">Adjust content scaling to fit TV bezels.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                                <div className="flex items-center space-x-2">
                                    <input 
                                        type="color"
                                        value={browserSettings.backgroundColor || '#000000'}
                                        onChange={(e) => setBrowserSettings({...browserSettings, backgroundColor: e.target.value})}
                                        className="h-9 w-16 rounded border border-gray-300"
                                    />
                                    <span className="text-sm text-gray-500">{browserSettings.backgroundColor || '#000000'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Audio Control */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <PlaySquare className="mr-2" size={20} /> Audio Control
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-1">Master Volume ({browserSettings.volume ?? 100}%)</label>
                                 <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={browserSettings.volume ?? 100}
                                    onChange={(e) => setBrowserSettings({...browserSettings, volume: parseInt(e.target.value)})}
                                    className="w-full"
                                 />
                            </div>
                        </div>
                    </div>

                    {/* Power & Maintenance */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <Power className="mr-2" size={20} /> Power & Maintenance
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sleep Schedule (Blackout)</label>
                                <div className="flex items-center space-x-2">
                                    <input 
                                        type="time"
                                        value={browserSettings.sleepStart || ''}
                                        onChange={(e) => setBrowserSettings({...browserSettings, sleepStart: e.target.value})}
                                        className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <span className="text-gray-500">to</span>
                                    <input 
                                        type="time"
                                        value={browserSettings.sleepEnd || ''}
                                        onChange={(e) => setBrowserSettings({...browserSettings, sleepEnd: e.target.value})}
                                        className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Renders black screen during these hours.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Auto-Reload Policy</label>
                                <select 
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={browserSettings.reloadPolicy || 'DISABLED'}
                                    onChange={(e) => setBrowserSettings({...browserSettings, reloadPolicy: e.target.value})}
                                >
                                    <option value="DISABLED">Disabled</option>
                                    <option value="DAILY">Daily (at specific time)</option>
                                    <option value="INTERVAL">Interval (every X hours)</option>
                                </select>
                                
                                {browserSettings.reloadPolicy === 'DAILY' && (
                                     <input 
                                        type="time"
                                        value={browserSettings.reloadTime || '03:00'}
                                        onChange={(e) => setBrowserSettings({...browserSettings, reloadTime: e.target.value})}
                                        className="mt-2 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                )}
                                {browserSettings.reloadPolicy === 'INTERVAL' && (
                                     <div className="mt-2 flex items-center space-x-2">
                                        <input 
                                            type="number"
                                            min="1"
                                            max="24"
                                            value={browserSettings.reloadInterval || 4}
                                            onChange={(e) => setBrowserSettings({...browserSettings, reloadInterval: parseInt(e.target.value)})}
                                            className="w-20 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        <span className="text-sm text-gray-500">hours</span>
                                     </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Connectivity & Diagnostics */}
                     <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <Activity className="mr-2" size={20} /> Connectivity & Diagnostics
                        </h3>
                        <div className="flex items-center space-x-4">
                             <div className="flex items-center">
                                <input
                                    id="debug-mode"
                                    type="checkbox"
                                    checked={browserSettings.debugMode || false}
                                    onChange={(e) => setBrowserSettings({...browserSettings, debugMode: e.target.checked})}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="debug-mode" className="ml-2 block text-sm text-gray-900">
                                    Enable Debug Mode (Verbose Logging)
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSaveSettings}
                            disabled={settingsLoading}
                            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            <Save className="mr-2" size={16} />
                            {settingsLoading ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
             ) : (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <Smartphone className="mr-2" size={20} /> Android Player Controls
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Start on Boot</label>
                                <select
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={androidRemote.startOnBoot ? 'true' : 'false'}
                                    onChange={(e) => {
                                        const enabled = e.target.value === 'true';
                                        setAndroidRemote((prev: any) => ({ ...prev, startOnBoot: enabled }));
                                        sendAndroidCommand('SET_START_ON_BOOT', { enabled });
                                    }}
                                    disabled={commandLoading}
                                >
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kiosk Mode</label>
                                <select
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={androidRemote.kioskEnabled ? 'true' : 'false'}
                                    onChange={(e) => {
                                        const enabled = e.target.value === 'true';
                                        setAndroidRemote((prev: any) => ({ ...prev, kioskEnabled: enabled }));
                                        sendAndroidCommand('SET_KIOSK', { enabled });
                                    }}
                                    disabled={commandLoading}
                                >
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={androidRemote.apiBase || ''}
                                        onChange={(e) => setAndroidRemote((prev: any) => ({ ...prev, apiBase: e.target.value }))}
                                        placeholder="https://dooh.brandeagles.com/api"
                                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <button
                                        onClick={() => sendAndroidCommand('SET_API_BASE', { apiBase: androidRemote.apiBase })}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                                        disabled={commandLoading || !androidRemote.apiBase}
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 text-sm text-gray-600">
                            <div>Device Owner: {nativeDiagnostics.deviceOwnerState || 'Unknown'}</div>
                            <div>Platform: {nativeDiagnostics.platform || screen.playerType}</div>
                            <div>Android: {nativeDiagnostics.androidVersion || 'Unknown'}</div>
                            <div>Device: {nativeDiagnostics.device || 'Unknown'}</div>
                            <div>Playback: {nativeDiagnostics.playbackState || 'Unknown'}</div>
                            <div>Download State: {nativeDiagnostics.downloadState || 'Unknown'}</div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <Settings className="mr-2" size={20} /> Recovery & Diagnostics
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            <button
                                onClick={() => sendAndroidCommand('ENTER_RECOVERY_MODE', { minutes: 15 })}
                                disabled={commandLoading}
                                className="px-4 py-2 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
                            >
                                Enter Recovery Mode
                            </button>
                            <button
                                onClick={() => sendAndroidCommand('CLEAR_RECOVERY_MODE')}
                                disabled={commandLoading}
                                className="px-4 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                            >
                                Clear Recovery Mode
                            </button>
                            <button
                                onClick={() => sendAndroidCommand('RESET_TECH_UNLOCK')}
                                disabled={commandLoading}
                                className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            >
                                Reset Tech Unlock
                            </button>
                            <button
                                onClick={() => sendAndroidCommand('CLEAR_HOME_LOCK')}
                                disabled={commandLoading}
                                className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                            >
                                Clear HOME Lock
                            </button>
                            <button
                                onClick={() => sendAndroidCommand('REBOOT_APP')}
                                disabled={commandLoading}
                                className="px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                                Reboot App
                            </button>
                            <button
                                onClick={() => sendAndroidCommand('REBOOT_DEVICE')}
                                disabled={commandLoading}
                                className="px-4 py-2 rounded-lg bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
                            >
                                Reboot Device
                            </button>
                        </div>
                    </div>
                </div>
             )}
          </div>
        )}

        {activeTab === 'manifest' && isNativePlayer && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <PackageSearch size={20} className="mr-2 text-gray-500" /> Native Playback Manifest
              </h3>
              <button
                onClick={fetchNativeManifest}
                disabled={manifestLoading}
                className="flex items-center px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
              >
                <RefreshCw size={16} className="mr-2" /> Refresh Manifest
              </button>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-900 text-gray-100 overflow-hidden">
              <pre className="p-4 text-xs overflow-x-auto whitespace-pre-wrap">
                {manifestLoading ? 'Loading native manifest...' : JSON.stringify(nativeManifest || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="p-6">
             <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center justify-between">
                <div className="flex items-center">
                  <FileText size={20} className="mr-2 text-gray-500" /> Recent Logs
                </div>
                <button
                  onClick={handleExportLogs}
                  className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  <Download size={16} className="mr-2" />
                  Export to TXT
                </button>
              </h3>
            <div className="bg-gray-900 text-gray-200 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
              {screen.logs && screen.logs.length > 0 ? (
                screen.logs.map((log: any) => (
                  <div key={log.id} className="mb-1 border-b border-gray-800 pb-1">
                    <span className="text-gray-500">[{new Date(log.createdAt).toLocaleTimeString()}]</span>{' '}
                    <span className={log.level === 'ERROR' ? 'text-red-400' : 'text-green-400'}>{log.level}</span>:{' '}
                    {log.message}
                  </div>
                ))
              ) : (
                <div className="text-gray-500 italic">No logs available.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'snapshots' && (
          <div className="p-6">
             <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Camera size={20} className="mr-2 text-gray-500" /> Recent Snapshots
              </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {screen.snapshots && screen.snapshots.length > 0 ? (
                screen.snapshots.map((snap: any) => (
                  <div 
                    key={snap.id} 
                    className="group relative rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
                    onClick={() => setSelectedSnapshot(snap)}
                  >
                    <img src={getFullUrl(snap.imageUrl)} alt="Snapshot" className="w-full h-auto object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2">
                      {new Date(snap.createdAt).toLocaleString()}
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                         <Maximize className="text-white drop-shadow-md" size={32} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-4 text-center text-gray-500 py-12">No snapshots available.</div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Snapshot Preview Modal */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-90 p-4" onClick={() => setSelectedSnapshot(null)}>
           <div className="relative max-w-7xl w-full max-h-screen flex flex-col items-center" onClick={e => e.stopPropagation()}>
              <div className="absolute top-4 right-4 z-10 flex gap-4">
                  <a 
                    href={getFullUrl(selectedSnapshot.imageUrl)} 
                    download={`snapshot-${selectedSnapshot.id}.png`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-white transition-all backdrop-blur-sm"
                    title="Download Original"
                  >
                      <Download size={24} />
                  </a>
                  <button 
                    onClick={() => setSelectedSnapshot(null)}
                    className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-white transition-all backdrop-blur-sm"
                  >
                      <X size={24} />
                  </button>
              </div>
              
              <img 
                src={getFullUrl(selectedSnapshot.imageUrl)} 
                alt="Snapshot Preview" 
                className="max-h-[90vh] w-auto object-contain rounded shadow-2xl" 
              />
              
              <div className="mt-4 text-white text-center space-y-1">
                  <h3 className="text-xl font-bold">{screen.name}</h3>
                  <p className="text-sm opacity-70 font-mono">ID: {screen.id}</p>
                  <p className="text-lg">
                    {new Date(selectedSnapshot.createdAt).toLocaleString()} 
                    {screen.location?.city ? ` • ${screen.location.city}` : (screen.location?.label ? ` • ${screen.location.label}` : '')}
                  </p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

// Helper Component for Stats
interface StatCardProps {
  icon: any;
  label: string;
  value: string;
  subValue: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, subValue, color }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start space-x-4 hover:shadow-md transition-shadow">
    <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-lg font-bold text-gray-800 mt-1">{value}</p>
      {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
    </div>
  </div>
);

const formatBytes = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A';
  }
  const bytes = Number(value);
  if (bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / 1024 ** exponent;
  return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

interface PlaylistSelectorProps {
  currentPlaylistId?: string;
  onPublish: (id: string) => void;
}

const PlaylistSelector: React.FC<PlaylistSelectorProps> = ({ currentPlaylistId, onPublish }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      setLoading(true);
      const data = await getPlaylists();
      setPlaylists(data);
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
      toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const filteredPlaylists = playlists
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Sort active playlist to top
      if (a.id === currentPlaylistId) return -1;
      if (b.id === currentPlaylistId) return 1;
      // Then by date desc
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div>
           <h3 className="text-lg font-semibold text-gray-800">Select Playlist to Publish</h3>
           <p className="text-sm text-gray-500">Choose a playlist to instantly display on this screen</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search playlists..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading playlists...</p>
        </div>
      ) : filteredPlaylists.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <PlaySquare className="mx-auto h-12 w-12 text-gray-300 mb-2" />
          <p className="text-gray-500">No playlists found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlaylists.map((playlist) => {
            const isCurrent = playlist.id === currentPlaylistId;
            return (
              <div 
                key={playlist.id} 
                className={`group bg-white rounded-lg border shadow-sm hover:shadow-md transition-all relative ${
                  isCurrent ? 'ring-2 ring-green-500 border-green-500 bg-green-50' : 'border-gray-200'
                }`}
              >
                {/* Thumbnail Area */}
                <div className="aspect-video bg-gray-100 rounded-t-lg relative overflow-hidden flex items-center justify-center">
                  <PlaylistThumbnail playlist={playlist} className="w-full h-full pointer-events-none" />
                  
                  {/* Hover Overlay Actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px] z-20">
                    <button 
                      onClick={() => onPublish(playlist.id)}
                      disabled={isCurrent}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm ${
                        isCurrent 
                          ? 'bg-green-100 text-green-700 cursor-not-allowed opacity-90'
                          : 'bg-white text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      {isCurrent ? (
                        <>
                          <CheckCircle size={18} />
                          Active
                        </>
                      ) : (
                        <>
                          <Share size={18} />
                          Publish
                        </>
                      )}
                    </button>
                  </div>

                  {/* Active Badge (Always visible if active) */}
                  {isCurrent && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1 z-10">
                      <CheckCircle size={12} />
                      ACTIVE
                    </div>
                  )}
                </div>

                {/* Info Area */}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900 truncate pr-2" title={playlist.name}>
                      {playlist.name}
                    </h3>
                    {playlist.description && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        Desc
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                    <div className="flex items-center gap-1" title="Screens Published">
                      <Monitor size={14} />
                      <span>{playlist.screenCount || 0} screens</span>
                    </div>
                    <div className="flex items-center gap-1" title="Created Date">
                      <Calendar size={14} />
                      <span>{new Date(playlist.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScreenDetails;

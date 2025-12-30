import React, { useEffect, useState } from 'react';
import { 
  Monitor, 
  Wifi, 
  WifiOff, 
  HardDrive, 
  ListVideo, 
  Activity,
  FileVideo,
  FileImage,
  PlayCircle,
  PauseCircle,
  Trash2
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Legend 
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getScreens, Screen } from '../services/screen';
import { getTenantSettings } from '../services/tenant';
import ScreenMap from '../components/ScreenMap';
import ScreenHeatmap from '../components/ScreenHeatmap';
import TopLocations from '../components/TopLocations';
import TopMedia from '../components/TopMedia';
import { format } from 'date-fns';
import ErrorBoundary from '../components/ErrorBoundary';

interface DashboardStats {
  screens: {
    total: number;
    online: number;
    offline: number;
    deleted?: number;
  };
  content: {
    playlists: number;
    mediaCount: number;
    storageUsed: number;
  };
  activity: Array<{
    id: string;
    action: string;
    details: string | null;
    createdAt: string;
    user: {
      name: string | null;
      email: string;
    } | null;
  }>;
  mediaDistribution: Array<{
    type: string;
    count: number;
  }>;
  topMedia: Array<{
    name: string;
    plays: number;
  }>;
}

const DashboardContent = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, screensData, settingsRes] = await Promise.all([
          api.get('/dashboard/stats'),
          getScreens(),
          getTenantSettings()
        ]);
        console.log('Dashboard data:', { stats: statsRes.data, screens: screensData });
        setStats(statsRes.data);
        setScreens(Array.isArray(screensData) ? screensData : []);
        if (settingsRes.config && settingsRes.config.googleMapsApiKey) {
          setGoogleMapsApiKey(settingsRes.config.googleMapsApiKey);
        }
        setError(null);
      } catch (error: any) {
        console.error('Failed to fetch dashboard data:', error);
        setError(error.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-500 bg-red-50 rounded-lg border border-red-200">
        <h3 className="font-bold text-lg mb-2">Error Loading Dashboard</h3>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return <div className="p-6 text-red-500">No dashboard data available.</div>;
  }

  // Format bytes to readable string
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Data for Charts
  const screenData = [
    { name: 'Online', value: stats.screens.online },
    { name: 'Offline', value: stats.screens.offline },
  ];
  const SCREEN_COLORS = ['#10B981', '#EF4444'];

  const mediaData = stats.mediaDistribution.map(m => ({
    name: m.type.split('/')[1]?.toUpperCase() || m.type, // simplify mime type
    count: m.count
  }));

  // Calculate idle and occupied screens
  const idleScreens = screens.filter(s => !s.activePlaylist).length;
  const occupiedScreens = screens.filter(s => s.activePlaylist).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500">Overview of your digital signage network</p>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {format(new Date(), 'HH:mm')}
        </div>
      </div>

      {/* Summary Cards Row 1: Screen Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-50 rounded-lg mr-4">
            <Monitor className="text-blue-600" size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Screens</p>
            <p className="text-2xl font-bold text-gray-800">{stats.screens.total}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-green-50 rounded-lg mr-4">
            <Wifi className="text-green-600" size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Online Screens</p>
            <p className="text-2xl font-bold text-gray-800">{stats.screens.online}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-red-50 rounded-lg mr-4">
            <WifiOff className="text-red-600" size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Offline Screens</p>
            <p className="text-2xl font-bold text-gray-800">{stats.screens.offline}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-gray-100 rounded-lg mr-4">
            <Trash2 className="text-gray-600" size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Deleted Screens</p>
            <p className="text-2xl font-bold text-gray-800">{stats.screens.deleted || 0}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards Row 2: Content & Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-indigo-50 rounded-lg mr-4">
            <PlayCircle className="text-indigo-600" size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Occupied Screens</p>
            <p className="text-2xl font-bold text-gray-800">{occupiedScreens}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-gray-100 rounded-lg mr-4">
            <PauseCircle className="text-gray-600" size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Idle Screens</p>
            <p className="text-2xl font-bold text-gray-800">{idleScreens}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-purple-50 rounded-lg mr-4">
            <ListVideo className="text-purple-600" size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Active Playlists</p>
            <p className="text-2xl font-bold text-gray-800">{stats.content.playlists}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-orange-50 rounded-lg mr-4">
            <HardDrive className="text-orange-600" size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Storage Used</p>
            <p className="text-2xl font-bold text-gray-800">{formatBytes(stats.content.storageUsed)}</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Screen Status Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Screen Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={screenData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {screenData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SCREEN_COLORS[index % SCREEN_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center mt-4 space-x-8">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span className="text-sm text-gray-600">Online ({stats.screens.online})</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
              <span className="text-sm text-gray-600">Offline ({stats.screens.offline})</span>
            </div>
          </div>
        </div>

        {/* Media Distribution Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Media Distribution</h3>
          <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={mediaData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center text-sm text-gray-500">
            Total Media Assets: {stats.content.mediaCount}
          </div>
        </div>
      </div>

      {/* Screen Locations Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Device Locations</h3>
          <div className="h-[400px]">
             <ScreenMap 
               screens={screens} 
               onScreenClick={() => navigate('/screens')} 
               apiKey={googleMapsApiKey}
               className="h-full"
             />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Density Heatmap</h3>
          <div className="h-[400px]">
             <ScreenHeatmap 
               screens={screens} 
               apiKey={googleMapsApiKey}
               className="h-full"
             />
          </div>
        </div>
      </div>

      {/* Top Locations & Media */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopLocations 
          screens={screens}
          className="h-[400px]" 
        />
        
        {/* Top Content (Moved from bottom) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[400px] flex flex-col">
           <h3 className="text-lg font-bold text-gray-800 mb-4">Top 5 Played Media</h3>
           <div className="flex-1 min-h-0">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart
                 layout="vertical"
                 data={stats.topMedia}
                 margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
               >
                 <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                 <XAxis type="number" />
                 <YAxis type="category" dataKey="name" width={100} />
                 <Tooltip />
                 <Bar dataKey="plays" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Bottom Section: Activity */}
      <div className="grid grid-cols-1 gap-6">
        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center mb-6">
            <Activity className="text-gray-400 mr-2" size={20} />
            <h3 className="text-lg font-bold text-gray-800">Recent Activity</h3>
          </div>
          
          <div className="space-y-4">
            {stats.activity.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent activity found.</p>
            ) : (
              stats.activity.map((log) => (
                <div key={log.id} className="flex items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className="bg-gray-100 p-2 rounded-full mr-4 mt-1">
                    <Activity size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {log.action}
                      <span className="text-gray-500 font-normal ml-1">
                        by {log.user?.name || log.user?.email || 'System'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {log.details || 'No details provided'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
};

export default Dashboard;

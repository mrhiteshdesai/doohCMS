import React, { useState, useEffect } from 'react';
import { Activity, Wifi, WifiOff, RefreshCw, Download, Lock } from 'lucide-react';
import api from '../../services/api';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { downloadCSV } from '../../utils/downloadCSV';
import { useAuth } from '../../context/AuthContext';

interface HeartbeatData {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  lastSeenAt: string | null;
  ipAddress?: string;
  version?: string;
}

const HeartbeatReport = () => {
  const { checkPermission } = useAuth();
  const [screens, setScreens] = useState<HeartbeatData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScreens = async () => {
    if (!checkPermission('report', 'read')) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/screens');
      setScreens(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScreens();
    // Auto refresh every minute
    const interval = setInterval(fetchScreens, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = () => {
    if (screens.length === 0) return;
    
    const headers = ['Screen Name', 'ID', 'Status', 'Last Heartbeat', 'IP Address', 'Version'];
    const rows = screens.map(screen => [
      `"${screen.name}"`,
      `"${screen.id}"`,
      `"${screen.status}"`,
      `"${screen.lastSeenAt ? format(parseISO(screen.lastSeenAt), 'yyyy-MM-dd HH:mm:ss') : 'Never'}"`,
      `"${screen.ipAddress || ''}"`,
      `"${screen.version || ''}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    downloadCSV(csvContent, `heartbeat_report_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`);
  };

  if (!checkPermission('report', 'read')) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 min-h-[400px]">
        <Lock size={48} className="mb-4 text-gray-400" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p>You do not have permission to view reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Last Seen / Heartbeat Report</h1>
          <p className="text-gray-500">Identify dead or unstable screens</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={handleExport}
            disabled={screens.length === 0}
            className={`flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg transition-colors ${screens.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100'}`}
          >
            <Download size={20} className="mr-2" />
            Export CSV
          </button>
          <button 
            onClick={fetchScreens}
            className="flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <RefreshCw size={20} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Now
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium border-b">
            <tr>
              <th className="px-6 py-3">Screen Name</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Last Heartbeat</th>
              <th className="px-6 py-3">Time Since Online</th>
              <th className="px-6 py-3">System Info</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && screens.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
            ) : screens.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8">No screens found</td></tr>
            ) : (
              screens.map((screen) => {
                const isOnline = screen.status === 'ONLINE';
                const lastSeenDate = screen.lastSeenAt ? parseISO(screen.lastSeenAt) : null;
                
                return (
                  <tr key={screen.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {screen.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {isOnline ? <Wifi size={12} className="mr-1" /> : <WifiOff size={12} className="mr-1" />}
                        {screen.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {lastSeenDate ? format(lastSeenDate, 'MMM d, yyyy HH:mm:ss') : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      {isOnline ? (
                        <span className="text-green-600 font-medium">Currently Online</span>
                      ) : lastSeenDate ? (
                        <span className="text-red-600 font-medium">
                          Offline for {formatDistanceToNow(lastSeenDate)}
                        </span>
                      ) : (
                        <span className="text-gray-400">Unknown</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 space-y-1">
                      <div>IP: {screen.ipAddress || 'N/A'}</div>
                      <div>Ver: {screen.version || '1.0.0'}</div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HeartbeatReport;

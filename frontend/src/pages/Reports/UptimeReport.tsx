import React, { useState, useEffect } from 'react';
import { Calendar, Download, RefreshCw, Filter, Lock } from 'lucide-react';
import SearchableSelect from '../../components/SearchableSelect';
import api from '../../services/api';
import { format, subDays, differenceInMinutes } from 'date-fns';
import { downloadCSV } from '../../utils/downloadCSV';
import { useAuth } from '../../context/AuthContext';

interface UptimeData {
  screenId: string;
  screenName: string;
  onlineDuration: string;
  offlineDuration: string;
  uptimePercentage: number;
  downtimeIncidents: { timestamp: string; duration: string }[];
}

const UptimeReport = () => {
  const { checkPermission } = useAuth();
  const [screens, setScreens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedScreen, setSelectedScreen] = useState<string>('');
  const [reportData, setReportData] = useState<UptimeData[]>([]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params: any = {
        startDate,
        endDate
      };
      if (selectedScreen) params.screenId = selectedScreen;

      const res = await api.get('/reports/uptime', { params });
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to fetch uptime report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (reportData.length === 0) return;
    
    const headers = ['Screen Name', 'Screen ID', 'Online Duration', 'Offline Duration', 'Uptime %', 'Downtime Incidents'];
    const rows = reportData.map(row => [
      `"${row.screenName}"`,
      `"${row.screenId}"`,
      `"${row.onlineDuration}"`,
      `"${row.offlineDuration}"`,
      `"${row.uptimePercentage}%"`,
      `"${row.downtimeIncidents.map(i => `${format(new Date(i.timestamp), 'yyyy-MM-dd HH:mm')} (${i.duration})`).join('; ')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    downloadCSV(csvContent, `uptime_report_${startDate}_to_${endDate}.csv`);
  };

  useEffect(() => {
    if (!checkPermission('report', 'read')) {
      setLoading(false);
      return;
    }

    const fetchScreens = async () => {
      try {
        const res = await api.get('/screens');
        setScreens(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchScreens();
    fetchReport();
  }, []);

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
          <h1 className="text-2xl font-bold text-gray-800">Screen Uptime / Downtime Report</h1>
          <p className="text-gray-500">SLA monitoring and operations reliability</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={reportData.length === 0}
          className={`flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg transition-colors ${reportData.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100'}`}
        >
          <Download size={20} className="mr-2" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Range Start</label>
          <input 
            type="date" 
            className="w-full px-3 py-2 border rounded-lg"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Range End</label>
          <input 
            type="date" 
            className="w-full px-3 py-2 border rounded-lg"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Screen</label>
          <SearchableSelect
            options={[{ label: 'All Screens', value: '' }, ...screens.map(s => ({ label: s.name, value: s.id }))]}
            value={selectedScreen}
            onChange={(val) => setSelectedScreen(val as string)}
            placeholder="Select Screen"
            className="w-full"
          />
        </div>
        <div>
          <button 
            onClick={fetchReport}
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw size={18} className="mr-2" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium border-b">
            <tr>
              <th className="px-6 py-3">Screen Name / ID</th>
              <th className="px-6 py-3">Online Duration</th>
              <th className="px-6 py-3">Offline Duration</th>
              <th className="px-6 py-3">Uptime %</th>
              <th className="px-6 py-3">Downtime Incidents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
            ) : reportData.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8">No data found</td></tr>
            ) : (
              reportData.map((row) => (
                <tr key={row.screenId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{row.screenName}</div>
                    <div className="text-xs text-gray-500 font-mono">{row.screenId.substring(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4 text-green-600">{row.onlineDuration}</td>
                  <td className="px-6 py-4 text-red-600">{row.offlineDuration}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <span className={`font-bold ${row.uptimePercentage > 99 ? 'text-green-600' : row.uptimePercentage > 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {row.uptimePercentage}%
                      </span>
                      <div className="ml-2 w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${row.uptimePercentage > 99 ? 'bg-green-500' : row.uptimePercentage > 95 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${row.uptimePercentage}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {row.downtimeIncidents.length > 0 ? (
                      <div className="space-y-1">
                        {row.downtimeIncidents.slice(0, 2).map((inc, i) => (
                          <div key={i} className="text-xs text-gray-600">
                            {format(new Date(inc.timestamp), 'MMM d, HH:mm')} ({inc.duration})
                          </div>
                        ))}
                        {row.downtimeIncidents.length > 2 && (
                          <div className="text-xs text-blue-500 cursor-pointer">
                            +{row.downtimeIncidents.length - 2} more...
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">No incidents</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UptimeReport;

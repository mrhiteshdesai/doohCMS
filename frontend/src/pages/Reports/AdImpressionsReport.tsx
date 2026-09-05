import React, { useState, useEffect } from 'react';
import { Download, Search, FileText, Lock, Megaphone } from 'lucide-react';
import SearchableSelect from '../../components/SearchableSelect';
import api from '../../services/api';
import { format, subDays } from 'date-fns';
import { downloadCSV } from '../../utils/downloadCSV';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getTenantSettings } from '../../services/tenant';
import { useAuth } from '../../context/AuthContext';

interface AdImpressionRow {
  id: string;
  screenName: string;
  screenId: string;
  playlistId: string | null;
  playlistItemId: string | null;
  vastAdId: string | null;
  creativeId: string | null;
  mediaFileUrl: string | null;
  fallbackMedia: string | null;
  filled: boolean;
  completed: boolean;
  durationSec: number;
  error: string | null;
  startedAt: string;
}

const AdImpressionsReport = () => {
  const { checkPermission } = useAuth();
  const [data, setData] = useState<AdImpressionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedScreen, setSelectedScreen] = useState('');
  const [screens, setScreens] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!checkPermission('report', 'read')) return;
    api.get('/screens')
      .then((res) => setScreens(Array.isArray(res.data) ? res.data : []))
      .catch(console.error);
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

  const fetchReport = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const params: Record<string, string> = { startDate, endDate };
      if (selectedScreen) params.screenId = selectedScreen;
      const res = await api.get('/reports/ad-impressions', { params });
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = (row: AdImpressionRow) => {
    if (row.error) return `Error: ${row.error}`;
    if (row.filled && row.completed) return 'Filled + Completed';
    if (row.filled) return 'Filled';
    return 'Unfilled';
  };

  const handleExport = () => {
    if (data.length === 0) return;
    const headers = [
      'Screen', 'Started At', 'VAST Ad ID', 'Creative ID', 'Filled', 'Completed',
      'Duration (s)', 'Fallback Media', 'Error', 'Media URL'
    ];
    const rows = data.map((item) => [
      `"${item.screenName || ''}"`,
      `"${format(new Date(item.startedAt), 'yyyy-MM-dd HH:mm:ss')}"`,
      `"${item.vastAdId || ''}"`,
      `"${item.creativeId || ''}"`,
      item.filled ? 'Yes' : 'No',
      item.completed ? 'Yes' : 'No',
      item.durationSec ?? 0,
      `"${item.fallbackMedia || ''}"`,
      `"${(item.error || '').replace(/"/g, '""')}"`,
      `"${item.mediaFileUrl || ''}"`
    ]);
    downloadCSV(
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n'),
      `ad_impressions_${startDate}_to_${endDate}.csv`
    );
  };

  const handleExportPDF = async () => {
    if (data.length === 0) return;
    try {
      const settings = await getTenantSettings();
      const orgName = settings.name || 'Organization Name';
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.width;

      doc.setFontSize(10);
      doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm:ss')}`, 14, 15);
      doc.setFontSize(16);
      doc.text('Ad Impressions Report', 14, 28);
      doc.setFontSize(10);
      doc.text(`Period: ${startDate} to ${endDate}`, 14, 35);

      autoTable(doc, {
        startY: 42,
        head: [['Screen', 'Started', 'Ad ID', 'Creative', 'Fill', 'Done', 'Dur', 'Fallback', 'Error']],
        body: data.map((item) => [
          item.screenName,
          format(new Date(item.startedAt), 'MMM d, HH:mm'),
          item.vastAdId || '-',
          item.creativeId || '-',
          item.filled ? 'Y' : 'N',
          item.completed ? 'Y' : 'N',
          `${item.durationSec ?? 0}s`,
          item.fallbackMedia || '-',
          item.error || '-'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8 },
        didDrawPage: (hook) => {
          const pageHeight = doc.internal.pageSize.height;
          doc.setFontSize(8);
          doc.text(orgName, 14, pageHeight - 10);
          doc.text(`Page ${hook.pageNumber}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
        }
      });

      doc.save(`ad_impressions_${startDate}_to_${endDate}.pdf`);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const filledCount = data.filter((d) => d.filled).length;
  const completedCount = data.filter((d) => d.completed).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Megaphone className="text-indigo-600" size={28} />
            Ad Impressions
          </h1>
          <p className="text-gray-500">VAST / programmatic fills from native and web players</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleExport}
            disabled={data.length === 0}
            className={`flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg transition-colors ${data.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100'}`}
          >
            <Download size={20} className="mr-2" />
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={data.length === 0}
            className={`flex items-center px-4 py-2 bg-red-50 text-red-600 rounded-lg transition-colors ${data.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100'}`}
          >
            <FileText size={20} className="mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Range Start</label>
          <input
            type="date"
            className="w-full px-3 py-2 border rounded-lg"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Range End</label>
          <input
            type="date"
            className="w-full px-3 py-2 border rounded-lg"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Screen</label>
          <SearchableSelect
            options={[
              { value: '', label: 'All Screens' },
              ...screens.map((s) => ({ value: s.id, label: s.name || s.id }))
            ]}
            value={selectedScreen}
            onChange={(val) => setSelectedScreen(val as string)}
            placeholder="Select Screen"
          />
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <Search size={18} className="mr-2" />
          {loading ? 'Loading…' : 'Apply Filters'}
        </button>
      </div>

      {hasSearched && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="text-sm text-gray-500">Total rows</div>
            <div className="text-2xl font-semibold text-gray-800">{data.length}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="text-sm text-gray-500">Filled</div>
            <div className="text-2xl font-semibold text-green-700">{filledCount}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="text-sm text-gray-500">Completed</div>
            <div className="text-2xl font-semibold text-indigo-700">{completedCount}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Screen</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Started</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">VAST Ad</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Creative</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Duration</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Fallback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!hasSearched && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    Choose filters and click Apply Filters to load ad impressions.
                  </td>
                </tr>
              )}
              {hasSearched && !loading && data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    No ad impressions found for this range.
                  </td>
                </tr>
              )}
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{row.screenName}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {format(new Date(row.startedAt), 'yyyy-MM-dd HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.vastAdId || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.creativeId || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.error
                          ? 'bg-red-50 text-red-700'
                          : row.filled && row.completed
                            ? 'bg-green-50 text-green-700'
                            : row.filled
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {statusLabel(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.durationSec ?? 0}s</td>
                  <td className="px-4 py-3 text-gray-600">{row.fallbackMedia || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdImpressionsReport;

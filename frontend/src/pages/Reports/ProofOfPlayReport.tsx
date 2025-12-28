import React, { useState, useEffect } from 'react';
import { Download, Filter, PlayCircle, Search, FileText, Lock } from 'lucide-react';
import SearchableSelect from '../../components/SearchableSelect';
import api from '../../services/api';
import { format, subDays } from 'date-fns';
import { downloadCSV } from '../../utils/downloadCSV';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getTenantSettings } from '../../services/tenant';
import { useAuth } from '../../context/AuthContext';

interface ProofOfPlayData {
  id: string;
  mediaName: string;
  playlistName: string;
  screenName: string;
  screenId: string;
  startedAt: string;
  endedAt: string;
  duration: number;
  status: string;
}

const ProofOfPlayReport = () => {
  const { checkPermission } = useAuth();
  const [data, setData] = useState<ProofOfPlayData[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedScreen, setSelectedScreen] = useState<string>('');
  const [screens, setScreens] = useState<any[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<string>('');
  const [mediaItems, setMediaItems] = useState<any[]>([]);

  const [hasSearched, setHasSearched] = useState(false);

  // Fetch Screens and Media for Filter
  useEffect(() => {
    if (!checkPermission('report', 'read')) {
      return;
    }

    const fetchData = async () => {
      try {
        const [screenRes, mediaRes] = await Promise.all([
          api.get('/screens'),
          api.get('/library')
        ]);
        setScreens(screenRes.data);
        // Handle library response structure { folders: [], files: [] }
        if (mediaRes.data && Array.isArray(mediaRes.data.files)) {
            setMediaItems(mediaRes.data.files);
        } else if (Array.isArray(mediaRes.data)) {
            setMediaItems(mediaRes.data);
        } else {
            setMediaItems([]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
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

  // Fetch Report Data
  const fetchReport = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const params: any = {
        startDate,
        endDate
      };
      if (selectedScreen) params.screenId = selectedScreen;
      if (selectedMedia) params.mediaId = selectedMedia;
      
      const res = await api.get('/reports/proof-of-play', { params });
      if (Array.isArray(res.data)) {
        setData(res.data);
      } else {
        console.error('Invalid data format received:', res.data);
        setData([]);
      }
    } catch (err) {
      console.error(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (data.length === 0) return;
    
    const headers = ['Media Name', 'Playlist', 'Screen', 'Played At', 'Ended At', 'Duration (s)', 'Status'];
    const rows = data.map(item => [
      `"${item.mediaName}"`,
      `"${item.playlistName}"`,
      `"${item.screenName}"`,
      `"${format(new Date(item.startedAt), 'yyyy-MM-dd HH:mm:ss')}"`,
      `"${format(new Date(item.endedAt), 'yyyy-MM-dd HH:mm:ss')}"`,
      item.duration.toFixed(1),
      `"${item.status}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    downloadCSV(csvContent, `proof_of_play_${startDate}_to_${endDate}.csv`);
  };

  const handleExportPDF = async () => {
    if (data.length === 0) return;

    try {
        const settings = await getTenantSettings();
        const orgName = settings.name || 'Organization Name';
        const logoUrl = settings.config.logoUrl || '';

        const doc = new jsPDF();

        // --- Header ---
        const pageWidth = doc.internal.pageSize.width;
        
        // Logo (Right Side)
        if (logoUrl) {
            try {
                // We need to fetch the image and convert to base64 or add directly if supported
                // Ideally, we load it into an Image object first
                const img = new Image();
                img.src = logoUrl;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
                
                // Calculate aspect ratio to fit within a box (e.g., 40x20)
                const maxW = 40;
                const maxH = 20;
                let w = img.width;
                let h = img.height;
                
                if (w > maxW) {
                    h = h * (maxW / w);
                    w = maxW;
                }
                if (h > maxH) {
                    w = w * (maxH / h);
                    h = maxH;
                }

                doc.addImage(img, 'PNG', pageWidth - w - 14, 10, w, h);
            } catch (e) {
                console.warn('Could not load logo for PDF', e);
                // Fallback text if logo fails
                doc.setFontSize(10);
                doc.text('CMS Logo', pageWidth - 14, 20, { align: 'right' });
            }
        } else {
             doc.setFontSize(10);
             doc.text('CMS Logo', pageWidth - 14, 20, { align: 'right' });
        }

        // Left Side Header Info
        doc.setFontSize(10);
        doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm:ss')}`, 14, 15);
        if (selectedMedia) {
             const media = mediaItems.find(m => m.id === selectedMedia);
             doc.text(`Media: ${media ? media.name : 'All Media'}`, 14, 22);
        } else {
             doc.text(`Media: All Media`, 14, 22);
        }
        
        // Title
        doc.setFontSize(16);
        doc.text('Proof of Play Report', 14, 35);
        doc.setFontSize(10);
        doc.text(`Period: ${startDate} to ${endDate}`, 14, 42);

        // --- Table ---
        const tableColumn = ["Media Name", "Playlist", "Screen", "Played At", "Duration", "Status"];
        const tableRows: any[] = [];

        data.forEach(item => {
            const rowData = [
                item.mediaName,
                item.playlistName,
                item.screenName,
                format(new Date(item.startedAt), 'MMM d, HH:mm:ss'),
                item.duration.toFixed(1) + 's',
                item.status
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            startY: 50,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [66, 139, 202] }, // Blue-ish
            didDrawPage: (data) => {
                // Footer
                const pageCount = (doc.internal as any).getNumberOfPages();
                const pageSize = doc.internal.pageSize;
                const pageHeight = pageSize.height;
                
                doc.setFontSize(8);
                
                // Left Side Footer
                doc.text(orgName, 14, pageHeight - 10);
                
                // Right Side Footer
                doc.text(`Page ${data.pageNumber}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
            }
        });

        doc.save(`proof_of_play_${startDate}_to_${endDate}.pdf`);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        alert('Failed to generate PDF. Please try again.');
    }
  };

  useEffect(() => {
    // Initial load - do nothing, wait for user to apply filters
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
          <h1 className="text-2xl font-bold text-gray-800">Proof of Play Summary</h1>
          <p className="text-gray-500">Billing, compliance, and advertiser trust</p>
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

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
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
            options={[
              { value: '', label: 'All Screens' },
              ...screens.map(s => ({ value: s.id, label: s.name }))
            ]}
            value={selectedScreen}
            onChange={(val) => setSelectedScreen(val as string)}
            placeholder="Select Screen"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Media</label>
          <SearchableSelect
            options={[
              { value: '', label: 'All Media' },
              ...mediaItems.map(m => ({ value: m.id, label: m.name }))
            ]}
            value={selectedMedia}
            onChange={(val) => setSelectedMedia(val as string)}
            placeholder="Select Media"
          />
        </div>
        <div className="flex">
            <button 
                onClick={fetchReport}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
                <Filter size={18} className="mr-2" />
                Apply Filters
            </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b">
              <tr>
                <th className="px-6 py-3">Media Name</th>
                <th className="px-6 py-3">Playlist / Ad ID</th>
                <th className="px-6 py-3">Screen</th>
                <th className="px-6 py-3">Played At</th>
                <th className="px-6 py-3">Duration</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8">Loading data...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8">No records found for this period.</td></tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center">
                        <PlayCircle size={16} className="mr-2 text-blue-500" />
                        {item.mediaName}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{item.playlistName}</td>
                    <td className="px-6 py-4 text-gray-600">{item.screenName}</td>
                    <td className="px-6 py-4 text-gray-600">
                        {format(new Date(item.startedAt), 'MMM d, yyyy HH:mm:ss')}
                        <div className="text-xs text-gray-400">
                            to {format(new Date(item.endedAt), 'HH:mm:ss')}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{item.duration.toFixed(1)}s</td>
                    <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === 'Success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                            {item.status}
                        </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProofOfPlayReport;

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  PlaySquare,
  LayoutGrid,
  List as ListIcon,
  Calendar,
  Monitor,
  LayoutTemplate,
  Share,
  ArrowUpDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as playlistService from '../services/playlist';
import * as layoutService from '../services/layout';
import SearchableSelect from '../components/SearchableSelect';
import { format } from 'date-fns';
import PublishModal from './PlaylistEditor/components/PublishModal';
import LayoutPreview from '../components/LayoutPreview';
import PlaylistThumbnail from '../components/PlaylistThumbnail';
import PermissionGuard from '../components/PermissionGuard';
import { Layout } from '../types/layout';

interface Playlist {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  zones?: any[];
  _count?: {
    items: number;
  };
  screenCount?: number;
}

export default function Playlists() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'createdAt' | 'name' | 'screenCount'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [publishModalPlaylistId, setPublishModalPlaylistId] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Editing
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

  // Layout Selection
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [loadingLayouts, setLoadingLayouts] = useState(false);
  const [layoutSearchQuery, setLayoutSearchQuery] = useState('');

  useEffect(() => {
    fetchPlaylists();
  }, [searchQuery, sortField, sortDir]);

  const fetchLayouts = async () => {
    if (layouts.length > 0) return; // Don't refetch if already loaded
    setLoadingLayouts(true);
    try {
      const data = await layoutService.getLayouts();
      setLayouts(data);
    } catch (error) {
      console.error('Failed to fetch layouts', error);
    } finally {
      setLoadingLayouts(false);
    }
  };

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const data = await playlistService.getPlaylists({
        search: searchQuery,
        sortField,
        sortDir
      });
      setPlaylists(data);
    } catch (error) {
      console.error('Failed to fetch playlists', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    setCreating(true);
    try {
      if (editingPlaylist) {
        await playlistService.updatePlaylist(editingPlaylist.id, {
          name: newPlaylistName,
          description: newPlaylistDesc
        });
        setShowCreateModal(false);
        setNewPlaylistName('');
        setNewPlaylistDesc('');
        setEditingPlaylist(null);
        fetchPlaylists();
      } else {
        const newPlaylist = await playlistService.createPlaylist({
          name: newPlaylistName,
          description: newPlaylistDesc,
          layoutId: selectedLayoutId || undefined
        });
        setShowCreateModal(false);
        setNewPlaylistName('');
        setNewPlaylistDesc('');
        setSelectedLayoutId(null);
        // Navigate to editor for new playlist
        navigate(`/playlists/${newPlaylist.id}/editor`);
      }
    } catch (error) {
      console.error('Failed to save playlist', error);
    } finally {
      setCreating(false);
    }
  };

  const openCreateModal = () => {
    setEditingPlaylist(null);
    setNewPlaylistName('');
    setNewPlaylistDesc('');
    setSelectedLayoutId(null);
    setLayoutSearchQuery('');
    setShowCreateModal(true);
    fetchLayouts();
  };

  const openPublishModal = (playlistId: string) => {
    setPublishModalPlaylistId(playlistId);
  };

  const openEditModal = (playlist: Playlist) => {
    setEditingPlaylist(playlist);
    setNewPlaylistName(playlist.name);
    setNewPlaylistDesc(playlist.description || '');
    setShowCreateModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this playlist?')) return;
    try {
      await playlistService.deletePlaylist(id);
      fetchPlaylists();
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
    } catch (error) {
      console.error('Failed to delete playlist', error);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} playlists?`)) return;
    try {
      await playlistService.bulkDeletePlaylists(Array.from(selectedIds));
      setSelectedIds(new Set());
      fetchPlaylists();
    } catch (error) {
      console.error('Failed to bulk delete', error);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === playlists.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(playlists.map(p => p.id)));
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Playlists</h1>
          <p className="text-sm text-gray-500">Create and manage your content playlists</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <PermissionGuard module="playlist" action="delete">
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 size={20} />
                <span>Delete ({selectedIds.size})</span>
              </button>
            </PermissionGuard>
          )}
          <PermissionGuard module="playlist" action="create">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={20} />
              <span>Add Playlist</span>
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={18} className="text-gray-500 mr-2" />
            <input
              type="text"
              placeholder="Search playlists..."
              className="bg-transparent outline-none flex-1 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="w-48">
            <SearchableSelect
              icon={<ArrowUpDown size={18} className="text-gray-500" />}
              value={`${sortField}-${sortDir}`}
              onChange={(val) => {
                const [field, dir] = (val as string).split('-');
                setSortField(field as any);
                setSortDir(dir as any);
              }}
              options={[
                { value: "createdAt-desc", label: "Newest First" },
                { value: "createdAt-asc", label: "Oldest First" },
                { value: "name-asc", label: "Name (A-Z)" },
                { value: "name-desc", label: "Name (Z-A)" },
                { value: "screenCount-desc", label: "Most Screens" },
                { value: "screenCount-asc", label: "Fewest Screens" }
              ]}
              triggerClassName="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center border rounded-lg bg-gray-50 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <ListIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading playlists...</p>
        </div>
      ) : playlists.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <PlaySquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No playlists found</h3>
          <p className="mt-2 text-gray-500">Get started by creating your first playlist</p>
          <PermissionGuard module="playlist" action="create">
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Create Playlist
            </button>
          </PermissionGuard>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {playlists.map((playlist) => (
            <div 
              key={playlist.id}
              className={`group bg-white rounded-lg border shadow-sm hover:shadow-md transition-all relative ${
                selectedIds.has(playlist.id) ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
              }`}
            >
              {/* Selection Checkbox */}
              <div className="absolute top-3 left-3 z-10">
                <input
                  type="checkbox"
                  checked={selectedIds.has(playlist.id)}
                  onChange={() => toggleSelection(playlist.id)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
                />
              </div>

              {/* Thumbnail Area */}
              <div className="aspect-video bg-gray-100 rounded-t-lg relative overflow-hidden flex items-center justify-center">
                <PlaylistThumbnail playlist={playlist} className="w-full h-full pointer-events-none" />
                
                {/* Hover Overlay Actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px] z-20">
                  <PermissionGuard module="playlist" action="write">
                    <button 
                      onClick={() => navigate(`/playlists/${playlist.id}/editor`)}
                      className="p-2 bg-white/90 rounded-full hover:bg-white text-gray-700 hover:text-blue-600 transition-colors"
                      title="Open Editor"
                    >
                      <LayoutTemplate size={18} />
                    </button>
                  </PermissionGuard>
                  <PermissionGuard module="screen" action="publish">
                    <button 
                      onClick={() => openPublishModal(playlist.id)}
                      className="p-2 bg-white/90 rounded-full hover:bg-white text-gray-700 hover:text-green-600 transition-colors"
                      title="Publish"
                    >
                      <Share size={18} />
                    </button>
                  </PermissionGuard>
                  <PermissionGuard module="playlist" action="write">
                    <button 
                      onClick={() => openEditModal(playlist)}
                      className="p-2 bg-white/90 rounded-full hover:bg-white text-gray-700 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                  </PermissionGuard>
                  <PermissionGuard module="playlist" action="delete">
                    <button 
                      onClick={() => handleDelete(playlist.id)}
                      className="p-2 bg-white/90 rounded-full hover:bg-white text-gray-700 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </PermissionGuard>
                </div>
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
                    <span>{format(new Date(playlist.createdAt), 'dd/MM/yyyy')}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === playlists.length && playlists.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3">Playlist Name</th>
                <th className="px-4 py-3">Screens</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {playlists.map((playlist) => (
                <tr key={playlist.id} className="hover:bg-gray-50 group">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(playlist.id)}
                      onChange={() => toggleSelection(playlist.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-9 bg-gray-100 rounded overflow-hidden flex items-center justify-center shrink-0 border border-gray-200">
                        <PlaylistThumbnail playlist={playlist} className="w-full h-full pointer-events-none" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{playlist.name}</div>
                        {playlist.description && (
                          <div className="text-xs text-gray-500 truncate max-w-[200px]">{playlist.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="flex items-center gap-1">
                      <Monitor size={14} />
                      {playlist.screenCount || 0}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {format(new Date(playlist.createdAt), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <PermissionGuard module="playlist" action="write">
                        <button 
                          onClick={() => navigate(`/playlists/${playlist.id}/editor`)}
                          className="p-1 hover:bg-gray-200 rounded text-gray-600"
                          title="Open Editor"
                        >
                          <LayoutTemplate size={16} />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard module="screen" action="publish">
                        <button 
                          onClick={() => openPublishModal(playlist.id)}
                          className="p-1 hover:bg-green-50 rounded text-green-600"
                          title="Publish"
                        >
                          <Share size={16} />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard module="playlist" action="write">
                        <button 
                          onClick={() => openEditModal(playlist)}
                          className="p-1 hover:bg-blue-50 rounded text-blue-600"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard module="playlist" action="delete">
                        <button 
                          onClick={() => handleDelete(playlist.id)}
                          className="p-1 hover:bg-red-50 rounded text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </PermissionGuard>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b shrink-0">
              <h2 className="text-xl font-bold">
                {editingPlaylist ? 'Edit Playlist' : 'New Playlist'}
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <form id="create-playlist-form" onSubmit={handleCreatePlaylist} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Details */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Basic Details</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Playlist Name</label>
                      <input
                        type="text"
                        required
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Summer Promotion"
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Brief description..."
                        rows={3}
                        value={newPlaylistDesc}
                        onChange={(e) => setNewPlaylistDesc(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Right Column: Layout Selection (Only for new playlists) */}
                  {!editingPlaylist && (
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Select Initial Layout</h3>
                          <span className="text-xs text-gray-500">
                            {selectedLayoutId ? 'Layout selected' : 'Blank layout selected'}
                          </span>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            placeholder="Search layouts..."
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={layoutSearchQuery}
                            onChange={(e) => setLayoutSearchQuery(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      {loadingLayouts ? (
                        <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2">
                          {/* Blank Layout Option */}
                          <div 
                            onClick={() => setSelectedLayoutId(null)}
                            className={`cursor-pointer group relative rounded-lg border-2 transition-all p-4 flex flex-col items-center justify-center gap-2 aspect-video ${
                              selectedLayoutId === null 
                                ? 'border-blue-500 bg-blue-50/50' 
                                : 'border-dashed border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                            }`}
                          >
                            <LayoutTemplate size={32} className={selectedLayoutId === null ? 'text-blue-500' : 'text-gray-400'} />
                            <span className={`text-sm font-medium ${selectedLayoutId === null ? 'text-blue-700' : 'text-gray-600'}`}>
                              Blank Layout
                            </span>
                            {selectedLayoutId === null && (
                              <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
                            )}
                          </div>

                          {/* Available Layouts */}
                          {layouts
                            .filter(layout => layout.name.toLowerCase().includes(layoutSearchQuery.toLowerCase()))
                            .map((layout) => (
                            <div 
                              key={layout.id}
                              onClick={() => setSelectedLayoutId(layout.id)}
                              className={`cursor-pointer group relative rounded-lg border-2 transition-all overflow-hidden ${
                                selectedLayoutId === layout.id 
                                  ? 'border-blue-500 ring-2 ring-blue-500 ring-offset-2' 
                                  : 'border-transparent hover:border-blue-300 shadow-sm'
                              }`}
                            >
                              <div className="aspect-video bg-gray-100 relative">
                                <LayoutPreview layout={layout} className="w-full h-full pointer-events-none" />
                              </div>
                              <div className="p-2 bg-white border-t border-gray-100">
                                <div className="text-xs font-medium text-gray-900 truncate" title={layout.name}>
                                  {layout.name}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  {layout.canvasWidth}x{layout.canvasHeight}
                                </div>
                              </div>
                              {selectedLayoutId === layout.id && (
                                <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white z-10"></div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="p-6 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-playlist-form"
                disabled={creating}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
              >
                {creating && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>}
                {editingPlaylist ? 'Save Changes' : 'Create Playlist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {publishModalPlaylistId && (
        <PublishModal
          playlistId={publishModalPlaylistId}
          onClose={() => setPublishModalPlaylistId(null)}
        />
      )}
    </div>
  );
}

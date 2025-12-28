import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Layout as LayoutIcon,
  LayoutGrid,
  List as ListIcon,
  Calendar,
  LayoutTemplate,
  ArrowUpDown,
  Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as layoutService from '../services/layout';
import SearchableSelect from '../components/SearchableSelect';
import { format } from 'date-fns';
import { Layout } from '../types/layout';
import LayoutPreview from '../components/LayoutPreview';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';

export default function Layouts() {
  const { checkPermission } = useAuth();
  const navigate = useNavigate();
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'createdAt' | 'name'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [newLayoutDesc, setNewLayoutDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Editing
  const [editingLayout, setEditingLayout] = useState<Layout | null>(null);

  useEffect(() => {
    if (checkPermission('layout', 'read')) {
      fetchLayouts();
    } else {
      setLoading(false);
    }
  }, [searchQuery, sortField, sortDir]);

  const fetchLayouts = async () => {
    setLoading(true);
    try {
      const data = await layoutService.getLayouts({
        search: searchQuery,
        sortField,
        sortDir
      });
      setLayouts(data);
    } catch (error) {
      console.error('Failed to fetch layouts', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLayoutName.trim()) return;

    setCreating(true);
    try {
      if (editingLayout) {
        await layoutService.updateLayout(editingLayout.id, {
          name: newLayoutName,
          description: newLayoutDesc
        });
        setShowCreateModal(false);
        setNewLayoutName('');
        setNewLayoutDesc('');
        setEditingLayout(null);
        fetchLayouts();
      } else {
        const newLayout = await layoutService.createLayout({
          name: newLayoutName,
          description: newLayoutDesc
        });
        setShowCreateModal(false);
        setNewLayoutName('');
        setNewLayoutDesc('');
        // Navigate to editor for new layout
        navigate(`/layouts/${newLayout.id}/editor`);
      }
    } catch (error) {
      console.error('Failed to save layout', error);
    } finally {
      setCreating(false);
    }
  };

  const openCreateModal = () => {
    setEditingLayout(null);
    setNewLayoutName('');
    setNewLayoutDesc('');
    setShowCreateModal(true);
  };

  const openEditModal = (layout: Layout) => {
    setEditingLayout(layout);
    setNewLayoutName(layout.name);
    setNewLayoutDesc(layout.description || '');
    setShowCreateModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this layout?')) return;
    try {
      await layoutService.deleteLayout(id);
      fetchLayouts();
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
    } catch (error) {
      console.error('Failed to delete layout', error);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} layouts?`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map(id => layoutService.deleteLayout(id)));
      setSelectedIds(new Set());
      fetchLayouts();
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
    if (selectedIds.size === layouts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(layouts.map(p => p.id)));
    }
  };

  if (!checkPermission('layout', 'read')) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 min-h-[400px]">
        <Lock size={48} className="mb-4 text-gray-400" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p>You do not have permission to view layouts.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Layouts</h1>
          <p className="text-sm text-gray-500">Create and manage your screen layouts</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <PermissionGuard module="layout" action="delete">
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 size={20} />
                <span>Delete ({selectedIds.size})</span>
              </button>
            </PermissionGuard>
          )}
          <PermissionGuard module="layout" action="create">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={20} />
              <span>Add Layout</span>
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
              placeholder="Search layouts..."
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
                { value: "name-desc", label: "Name (Z-A)" }
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
          <p className="mt-4 text-gray-500">Loading layouts...</p>
        </div>
      ) : layouts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <LayoutIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No layouts found</h3>
          <p className="mt-2 text-gray-500">Get started by creating your first layout</p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Create Layout
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {layouts.map((layout) => (
            <div 
              key={layout.id}
              className={`group bg-white rounded-lg border shadow-sm hover:shadow-md transition-all relative ${
                selectedIds.has(layout.id) ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
              }`}
            >
              {/* Selection Checkbox */}
              <div className="absolute top-3 left-3 z-10">
                <input
                  type="checkbox"
                  checked={selectedIds.has(layout.id)}
                  onChange={() => toggleSelection(layout.id)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
                />
              </div>

              {/* Thumbnail Area */}
              <div className="aspect-video bg-gray-50 rounded-t-lg relative overflow-hidden flex items-center justify-center">
                {layout.zones && layout.zones.length > 0 ? (
                  <LayoutPreview layout={layout} className="w-full h-full" />
                ) : (
                  <LayoutTemplate className="w-12 h-12 text-gray-300" />
                )}
                
                {/* Hover Overlay Actions - Removed redundant buttons */}
                <div className="absolute inset-0 bg-black/0 hover:bg-black/5 transition-colors cursor-pointer" onClick={() => navigate(`/layouts/${layout.id}/editor`)} />
              </div>

              {/* Info Area */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900 truncate pr-2" title={layout.name}>
                    {layout.name}
                  </h3>
                  {layout.description && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      Desc
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                  <div className="flex items-center gap-1" title="Created Date">
                    <Calendar size={14} />
                    <span>{layout.createdAt ? format(new Date(layout.createdAt), 'MMM d, yyyy') : '-'}</span>
                  </div>
                  <div className="flex items-center gap-1" title="Resolution">
                    <span>{layout.canvasWidth}x{layout.canvasHeight}</span>
                  </div>
                </div>

                {/* Always Visible Actions */}
                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button 
                    onClick={() => navigate(`/layouts/${layout.id}/editor`)}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                    title="Open Editor"
                  >
                    <LayoutTemplate size={16} />
                  </button>
                  <PermissionGuard module="layout" action="write">
                    <button 
                      onClick={() => openEditModal(layout)}
                      className="p-1.5 hover:bg-blue-50 rounded text-blue-600 transition-colors"
                      title="Edit Properties"
                    >
                      <Edit2 size={16} />
                    </button>
                  </PermissionGuard>
                  <PermissionGuard module="layout" action="delete">
                    <button 
                      onClick={() => handleDelete(layout.id)}
                      className="p-1.5 hover:bg-red-50 rounded text-red-600 transition-colors"
                      title="Delete Layout"
                    >
                      <Trash2 size={16} />
                    </button>
                  </PermissionGuard>
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
                    checked={selectedIds.size === layouts.length && layouts.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3">Layout Name</th>
                <th className="px-4 py-3">Resolution</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {layouts.map((layout) => (
                <tr key={layout.id} className="hover:bg-gray-50 group">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(layout.id)}
                      onChange={() => toggleSelection(layout.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-50 rounded flex items-center justify-center shrink-0 overflow-hidden border border-gray-200">
                        {layout.zones && layout.zones.length > 0 ? (
                          <LayoutPreview layout={layout} className="w-full h-full" />
                        ) : (
                          <LayoutTemplate size={20} className="text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{layout.name}</div>
                        {layout.description && (
                          <div className="text-xs text-gray-500 truncate max-w-[200px]">{layout.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {layout.canvasWidth}x{layout.canvasHeight}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {layout.createdAt ? format(new Date(layout.createdAt), 'MMM d, yyyy') : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => navigate(`/layouts/${layout.id}/editor`)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-600"
                        title="Open Editor"
                      >
                        <LayoutTemplate size={16} />
                      </button>
                      <PermissionGuard module="layout" action="write">
                        <button 
                          onClick={() => openEditModal(layout)}
                          className="p-1 hover:bg-blue-50 rounded text-blue-600"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard module="layout" action="delete">
                        <button 
                          onClick={() => handleDelete(layout.id)}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold mb-4">
              {editingLayout ? 'Edit Layout' : 'New Layout'}
            </h2>
            <form onSubmit={handleCreateLayout}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Layout Name</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 3-Zone Landscape"
                    value={newLayoutName}
                    onChange={(e) => setNewLayoutName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Brief description..."
                    rows={3}
                    value={newLayoutDesc}
                    onChange={(e) => setNewLayoutDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {creating && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>}
                  {editingLayout ? 'Save Changes' : 'Create Layout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

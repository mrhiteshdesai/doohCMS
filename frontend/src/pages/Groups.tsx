import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings, Trash2, Edit2, Layers, Search } from 'lucide-react';
import * as screenGroupService from '../services/screenGroup';

interface Group {
  id: string;
  name: string;
  description: string;
  tags: string[];
  screenCount: number;
  createdAt: string;
}

const Groups = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', tags: '' });

  const fetchGroups = async () => {
    try {
      const data = await screenGroupService.getGroups();
      setGroups(data);
    } catch (err) {
      console.error('Failed to fetch groups', err);
    } finally {
      // setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleOpenModal = (group?: Group) => {
    if (group) {
      setEditingGroup(group);
      setFormData({
        name: group.name,
        description: group.description || '',
        tags: group.tags.join(', ')
      });
    } else {
      setEditingGroup(null);
      setFormData({ name: '', description: '', tags: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
      const data = {
        name: formData.name,
        description: formData.description,
        tags: tagsArray
      };

      if (editingGroup) {
        await screenGroupService.updateGroup(editingGroup.id, data);
      } else {
        await screenGroupService.createGroup(data);
      }
      setIsModalOpen(false);
      fetchGroups();
    } catch (err) {
      console.error('Failed to save group', err);
      alert('Failed to save group');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;
    try {
      await screenGroupService.deleteGroup(id);
      fetchGroups();
    } catch (err) {
      console.error('Failed to delete group', err);
      alert('Failed to delete group');
    }
  };

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Screen Groups</h1>
          <p className="text-gray-500">Organize your screens into groups for easier management</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={20} className="mr-2" />
          Create Group
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={18} className="text-gray-500 mr-2" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent outline-none flex-1 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 text-gray-500 text-sm">
            <tr>
              <th className="px-6 py-4 text-left font-medium">Group Name</th>
              <th className="px-6 py-4 text-left font-medium">Description</th>
              <th className="px-6 py-4 text-center font-medium">Total Screens</th>
              <th className="px-6 py-4 text-left font-medium">Created</th>
              <th className="px-6 py-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredGroups.map(group => (
              <tr key={group.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded mr-3">
                      <Layers size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{group.name}</p>
                      <div className="flex gap-1 mt-1">
                        {group.tags.map(tag => (
                          <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{group.description || '-'}</td>
                <td className="px-6 py-4 text-center">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    {group.screenCount}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 text-sm">
                  {new Date(group.createdAt).toLocaleDateString('en-GB')}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end space-x-2">
                    <button 
                      onClick={() => handleOpenModal(group)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600"
                      title="Edit Metadata"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => navigate(`/groups/${group.id}`)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600"
                      title="Settings (Assign Screens)"
                    >
                      <Settings size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(group.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600"
                      title="Delete Group"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredGroups.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No groups found. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">{editingGroup ? 'Edit Group' : 'Create Group'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={e => setFormData({...formData, tags: e.target.value})}
                  placeholder="e.g. Lobby, First Floor, Retail"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingGroup ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;

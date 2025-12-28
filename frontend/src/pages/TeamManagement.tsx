import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, User as UserIcon, Shield, Search } from 'lucide-react';
import { getUsers, deleteUser, updateUser, User } from '../services/user';
import AddMemberModal from '../components/AddMemberModal';
import PermissionGuard from '../components/PermissionGuard';
import Switch from '../components/Switch';

const TeamManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this team member?')) {
      try {
        await deleteUser(id);
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    fetchUsers();
  };

  const handleStatusToggle = async (user: User) => {
    // Optimistic update
    const previousStatus = user.isActive;
    const newStatus = !previousStatus;
    
    setUsers(prevUsers => prevUsers.map(u => 
      u.id === user.id ? { ...u, isActive: newStatus } : u
    ));

    try {
      await updateUser(user.id, { isActive: newStatus });
    } catch (error) {
      console.error('Error updating user status:', error);
      // Revert on error
      setUsers(prevUsers => prevUsers.map(u => 
        u.id === user.id ? { ...u, isActive: previousStatus } : u
      ));
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full">Loading...</div>;
  }

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-500">Manage team members and their permissions</p>
        </div>
        <PermissionGuard module="Team Management" action="create">
          <button
            onClick={handleAdd}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} className="mr-2" />
            Add Team
          </button>
        </PermissionGuard>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={18} className="text-gray-500 mr-2" />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none flex-1 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                      <UserIcon size={20} />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900">
                    <Shield size={16} className="mr-2 text-gray-400" />
                    {user.userRoles?.[0]?.role?.name || 'No Role'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <PermissionGuard 
                    module="Team Management" 
                    action="update"
                    fallback={
                      <div className="flex items-center">
                        <Switch
                          checked={!!user.isActive}
                          onChange={() => {}}
                          disabled={true}
                        />
                        <span className="ml-2 text-sm text-gray-500">
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    }
                  >
                    <div className="flex items-center">
                      <Switch
                        checked={!!user.isActive}
                        onChange={() => handleStatusToggle(user)}
                      />
                      <span className={`ml-2 text-sm ${user.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </PermissionGuard>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleString('en-GB')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <PermissionGuard module="Team Management" action="update">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      <Edit2 size={18} />
                    </button>
                  </PermissionGuard>
                  <PermissionGuard module="Team Management" action="delete">
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={18} />
                    </button>
                  </PermissionGuard>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <AddMemberModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          user={selectedUser}
        />
      )}
    </div>
  );
};

export default TeamManagement;

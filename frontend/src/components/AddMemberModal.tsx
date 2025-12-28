import React, { useState, useEffect } from 'react';
import { X, Check, Search } from 'lucide-react';
import { User, Role, getRoles, createUser, updateUser } from '../services/user';
import SearchableSelect from './SearchableSelect';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
}

const MODULES = [
  'Dashboard',
  'Screen',
  'Playlist',
  'Media',
  'Team',
];

const PERMISSIONS = ['View', 'Edit', 'Delete', 'Publish']; // Added Publish

// Helper to normalize module name for keys
const getModuleKey = (name: string) => name.toLowerCase();

const AddMemberModal: React.FC<AddMemberModalProps> = ({ isOpen, onClose, user }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    roleId: '',
  });
  
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRoles();
    initializePermissions();
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        password: '', // Don't show password
        roleId: user.userRoles?.[0]?.role?.id || '',
      });
      
      // Parse CSV permissions back to object
      if (user.permissions) {
        try {
          // Check if it's JSON or CSV
          if (user.permissions.startsWith('{')) {
             // Old format, ignore or try to parse
          } else {
             const permList = user.permissions.split(',');
             const newPerms: any = {};
             MODULES.forEach(m => {
                 newPerms[getModuleKey(m)] = {};
             });
             
             permList.forEach(p => {
                 const [res, act] = p.split(':');
                 if (res && act) {
                     if (!newPerms[res]) newPerms[res] = {};
                     // Map act back to UI keys
                     let uiKey = '';
                     if (act === 'read') uiKey = 'view';
                     else if (act === 'write') uiKey = 'edit';
                     else if (act === 'delete') uiKey = 'delete';
                     else if (act === 'publish') uiKey = 'publish';
                     
                     if (uiKey) newPerms[res][uiKey] = true;
                 }
             });
             setPermissions(prev => ({...prev, ...newPerms}));
          }
        } catch (e) {
          console.error('Failed to parse permissions', e);
        }
      }
    }
  }, [user]);

  const fetchRoles = async () => {
    try {
      const data = await getRoles();
      setRoles(data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const initializePermissions = () => {
    const initial: Record<string, Record<string, boolean>> = {};
    MODULES.forEach(module => {
      const key = getModuleKey(module);
      initial[key] = {
        view: false,
        edit: false,
        delete: false,
        publish: false
      };
    });
    setPermissions(initial);
  };

  const handlePermissionChange = (module: string, type: string) => {
    const key = getModuleKey(module);
    const typeKey = type.toLowerCase();
    
    setPermissions(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [typeKey]: !prev[key]?.[typeKey]
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
        // Convert permissions object to CSV string
        const permArray: string[] = [];
        Object.entries(permissions).forEach(([module, actions]) => {
            if (actions.view) permArray.push(`${module}:read`);
            if (actions.edit) permArray.push(`${module}:write`);
            if (actions.delete) permArray.push(`${module}:delete`);
            if (actions.publish) permArray.push(`${module}:publish`);
        });
        
        const permissionString = permArray.join(',');

        const data = {
            ...formData,
            permissions: permissionString
        };

        if (user) {
            await updateUser(user.id, data);
        } else {
            await createUser(data);
        }
        onClose();
    } catch (error) {
        console.error('Error saving user', error);
    } finally {
        setLoading(false);
    }
  };

  const handleSelectAll = (module: string) => {
    const key = getModuleKey(module);
    const current = permissions[key] || {};
    // Check if all available actions are true
    const allSelected = ['view', 'edit', 'delete', 'publish'].every(k => current[k]);
    
    setPermissions(prev => ({
      ...prev,
      [key]: {
        view: !allSelected,
        edit: !allSelected,
        delete: !allSelected,
        publish: !allSelected
      }
    }));
  };

  const handleRoleChange = (roleId: string) => {
    setFormData(prev => ({ ...prev, roleId }));
    
    // Auto-fill permissions based on role
    const role = roles.find(r => r.id === roleId);
    if (role) {
      if (role.permissions === '*') {
        // Super Admin or similar (full access)
        const all: Record<string, Record<string, boolean>> = {};
        MODULES.forEach(module => {
          all[getModuleKey(module)] = {
            view: true,
            edit: true,
            delete: true,
            publish: true
          };
        });
        setPermissions(all);
      } else {
         // TODO: Handle granular role permissions if they exist
         // For now, we assume Roles are mostly buckets, but we can reset to default if needed
      }
    }
  };



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            {user ? 'Edit Team Member' : 'Add New Team Member'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* User Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Member Name<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter Team Member Name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Member Email ID<span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter Email ID"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Member Role<span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={formData.roleId}
                onChange={(val) => handleRoleChange(val as string)}
                options={[
                  { value: "", label: "Select Team Member Role" },
                  ...roles.map(role => ({ value: role.id, label: role.name }))
                ]}
                triggerClassName="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Login Password{user ? '' : <span className="text-red-500">*</span>}
              </label>
              <input
                type="password"
                required={!user}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={user ? "Leave blank to keep current" : "Enter Password"}
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {/* Permissions Table */}
            <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Permissions</h3>
                <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select All</th>
                                {PERMISSIONS.map(perm => (
                                    <th key={perm} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {perm}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {MODULES.map(module => {
                                const key = getModuleKey(module);
                                const perms = permissions[key] || {};
                                return (
                                    <tr key={module}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{module}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <input 
                                                type="checkbox" 
                                                checked={['view', 'edit', 'delete', 'publish'].every(k => perms[k])}
                                                onChange={() => handleSelectAll(module)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        {PERMISSIONS.map(perm => {
                                            const permKey = perm.toLowerCase();
                                            // Ensure we use the correct state key
                                            let stateKey = permKey;
                                            if (permKey === 'view') stateKey = 'view';
                                            else if (permKey === 'edit') stateKey = 'edit';
                                            else if (permKey === 'delete') stateKey = 'delete';
                                            else if (permKey === 'publish') stateKey = 'publish';
                                            
                                            return (
                                                <td key={perm} className="px-6 py-4 whitespace-nowrap">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={!!perms[stateKey]}
                                                        onChange={() => handlePermissionChange(module, stateKey)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium mt-8"
            >
              {loading ? 'Saving...' : (user ? 'Update Member' : '+ Add Member')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMemberModal;

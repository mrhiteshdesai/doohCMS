import React, { useState, useEffect } from 'react';
import { getProfile, updateProfile } from '../services/user';
import { useAuth } from '../context/AuthContext';
import { Save, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';

const Profile = () => {
  const { user: authUser, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const userData = await getProfile();
      setFormData(prev => ({ ...prev, name: userData.name }));
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear messages on edit
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password && formData.password !== formData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updateData: any = { name: formData.name };
      if (formData.password) {
        updateData.password = formData.password;
      }

      await updateProfile(updateData);
      
      // Update local context to reflect name change immediately in header
      if (formData.name) {
          updateUser({ name: formData.name });
      }

      setSuccess('Profile updated successfully');
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Profile</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
              <AlertCircle size={20} className="mr-2" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg flex items-center">
              <CheckCircle size={20} className="mr-2" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-md font-medium text-gray-800 mb-4 flex items-center">
                <Lock size={18} className="mr-2 text-gray-500" />
                Change Password
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password (leave blank to keep current)
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} className="mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;

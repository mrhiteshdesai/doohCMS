import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Globe, Layers, Cast, Database, Save, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import GeneralSettings from './GeneralSettings';
import RegionalSettings from './RegionalSettings';
import IntegrationSettings from './IntegrationSettings';
import StorageSettings from './StorageSettings';
import PlayerSettings from './PlayerSettings';
import { getTenantSettings, updateTenantSettings, TenantSettings } from '../../services/tenant';
import { getSystemSettings, updateSystemSettings, SystemSettings } from '../../services/systemSettings';
import PermissionGuard from '../../components/PermissionGuard';
import { useAuth } from '../../context/AuthContext';

const SettingsPage = () => {
  const { checkPermission, user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const [settings, setSettings] = useState<TenantSettings>({
    name: '',
    config: {}
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings | undefined>(undefined);

  useEffect(() => {
    if (checkPermission('settings', 'read')) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (saveStatus !== 'idle') {
      const timer = setTimeout(() => setSaveStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const fetchSettings = async () => {
    try {
      const tenantData = await getTenantSettings();
      // Ensure config object exists
      if (!tenantData.config) tenantData.config = {};
      setSettings(tenantData);

      // Only attempt to fetch system settings if user is admin or Organization Admin
      // We'll rely on backend enforcement, but good to avoid 403s in console if possible
      const isSystemAdmin = user?.role === 'admin' || 
                            (Array.isArray(user?.roles) && user.roles.some((r: any) => 
                                (typeof r === 'string' && (r === 'admin' || r === 'Organization Admin')) ||
                                (typeof r === 'object' && r.name && (r.name === 'admin' || r.name === 'Organization Admin'))
                            )) ||
                            (user?.permissions && user.permissions.includes('*'));

      if (isSystemAdmin) {
        try {
            const systemData = await getSystemSettings();
            setSystemSettings(systemData);
        } catch (e) {
            console.log("Could not fetch system settings (likely not authorized)");
        }
      }

    } catch (error: any) {
      console.error('Failed to fetch settings:', error);
      const message = error.response?.data?.message || error.message || 'Failed to load settings';
      toast.error(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      // Always save tenant settings
      await updateTenantSettings(settings);

      // Save system settings if they exist and were modified
      // (For simplicity we just save if the object exists)
      if (systemSettings) {
        await updateSystemSettings(systemSettings);
      }

      setSaveStatus('success');
      toast.success('Settings saved successfully');
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      const message = error.response?.data?.message || error.message || 'Failed to save settings';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };


  const handleChange = (key: string, value: any) => {
    if (key === 'name') {
      setSettings(prev => ({ ...prev, name: value }));
    } else {
      setSettings(prev => ({
        ...prev,
        config: {
          ...prev.config,
          [key]: value
        }
      }));
    }
  };

  const handleSystemChange = (key: string, value: any) => {
    setSystemSettings(prev => {
        if (!prev) return prev;
        return {
            ...prev,
            storage: {
                ...prev.storage,
                [key]: value
            }
        };
    });
  };

  const tabs = [
    { id: 'general', label: 'General & Branding', icon: SettingsIcon },
    { id: 'regional', label: 'Regional & Defaults', icon: Globe },
    { id: 'player', label: 'Player Management', icon: Cast },
    { id: 'integrations', label: 'Integrations', icon: Layers },
    { id: 'storage', label: 'Storage & Maintenance', icon: Database },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!checkPermission('settings', 'read')) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <Lock size={48} className="mb-4 text-gray-400" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p>You do not have permission to view settings.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
          <p className="text-gray-500">Manage your organization preferences</p>
        </div>
        <PermissionGuard module="settings" action="write">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`
              inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
              focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors
              ${saveStatus === 'success' ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' : 
                saveStatus === 'error' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 
                'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}
            `}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Failed!' : 'Save Changes'}
          </button>
        </PermissionGuard>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-200 bg-gray-50 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                    ${activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                  `}
                >
                  <Icon className={`mr-3 h-5 w-5 ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl">
            {activeTab === 'general' && <GeneralSettings settings={settings} onChange={handleChange} />}
            {activeTab === 'regional' && <RegionalSettings settings={settings} onChange={handleChange} />}
            {activeTab === 'player' && <PlayerSettings settings={settings} onChange={handleChange} />}
            {activeTab === 'integrations' && <IntegrationSettings settings={settings} onChange={handleChange} />}
            {activeTab === 'storage' && (
                <StorageSettings 
                    settings={settings} 
                    systemSettings={systemSettings}
                    onChange={handleChange} 
                    onSystemChange={handleSystemChange}
                />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

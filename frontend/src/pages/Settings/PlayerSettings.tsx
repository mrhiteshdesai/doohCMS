import React, { useEffect, useState } from 'react';
import { TenantSettings } from '../../services/tenant';
import ColorPicker from '../../components/ColorPicker';
import api from '../../services/api';

interface Props {
  settings: TenantSettings;
  onChange: (key: string, value: any) => void;
}

const PlayerSettings: React.FC<Props> = ({ settings, onChange }) => {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  useEffect(() => {
    fetchPlaylists();

    // Ensure defaults are populated in state if missing
    // This ensures that saving without changes still persists the default structure
    if (!settings.config.player) {
      onChange('player', {
        backgroundColor: '#f9fafb',
        codeBlock: {
          backgroundColor: '#ffffff',
          borderColor: '#f3f4f6',
          borderWidth: 1
        },
        systemInfo: {
          backgroundColor: '#ffffff',
          textColor: '#374151'
        },
        rightSide: {
          title: 'Smart Digital Signage',
          titleColor: '#ffffff',
          subtitle: 'Deliver engaging content to your audience in seconds. Powering displays worldwide.',
          subtitleColor: '#dbeafe'
        }
      });
    }
  }, []);

  const fetchPlaylists = async () => {
    setLoadingPlaylists(true);
    try {
      const response = await api.get('/playlists');
      setPlaylists(response.data);
    } catch (error) {
      console.error('Failed to fetch playlists', error);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  // Helper to update nested player config
  const updatePlayerConfig = (section: string, key: string, value: any) => {
    const currentConfig = settings.config.player || {};
    const sectionConfig = (currentConfig as any)[section] || {};
    
    onChange('player', {
      ...currentConfig,
      [section]: {
        ...sectionConfig,
        [key]: value
      }
    });
  };

  // Helper for root level player config
  const updatePlayerRoot = (key: string, value: any) => {
    const currentConfig = settings.config.player || {};
    onChange('player', {
      ...currentConfig,
      [key]: value
    });
  };

  const playerConfig = settings.config.player || {};

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Player Management</h3>
        <p className="mt-1 text-sm text-gray-500">
          Configure default behavior and look & feel for your players.
        </p>
      </div>

      {/* Default Content */}
      <div className="border-b border-gray-200 pb-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Default Content (Priority 0)</h4>
        <p className="text-sm text-gray-500 mb-4">
            This playlist will be displayed when no other playlist is scheduled or manually published to a screen.
        </p>
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Default Playlist</label>
                <select
                    value={settings.config.defaultPlaylistId || ''}
                    onChange={(e) => onChange('defaultPlaylistId', e.target.value || undefined)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    disabled={loadingPlaylists}
                >
                    <option value="">None (Show Default Logo)</option>
                    {playlists.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>
                            {playlist.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
      </div>

      {/* Main Background */}
      <div className="border-b border-gray-200 pb-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Screen Background</h4>
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Background Color</label>
                <div className="mt-1">
                    <ColorPicker
                        value={playerConfig.backgroundColor || '#f9fafb'}
                        onChange={(val) => updatePlayerRoot('backgroundColor', val)}
                    />
                </div>
            </div>
        </div>
      </div>

      {/* Pairing Code Block */}
      <div className="border-b border-gray-200 pb-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Pairing Code Block</h4>
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Background Color</label>
                <div className="mt-1">
                    <ColorPicker
                        value={playerConfig.codeBlock?.backgroundColor || '#ffffff'}
                        onChange={(val) => updatePlayerConfig('codeBlock', 'backgroundColor', val)}
                    />
                </div>
            </div>
            <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Border Color</label>
                <div className="mt-1">
                    <ColorPicker
                        value={playerConfig.codeBlock?.borderColor || '#f3f4f6'}
                        onChange={(val) => updatePlayerConfig('codeBlock', 'borderColor', val)}
                    />
                </div>
            </div>
            <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Border Width (px)</label>
                <input
                    type="number"
                    min="0"
                    max="10"
                    value={playerConfig.codeBlock?.borderWidth ?? 1}
                    onChange={(e) => updatePlayerConfig('codeBlock', 'borderWidth', parseInt(e.target.value))}
                    className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
            </div>
        </div>
      </div>

      {/* System Info */}
      <div className="border-b border-gray-200 pb-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">System Info Footer</h4>
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Background Color</label>
                <div className="mt-1">
                    <ColorPicker
                        value={playerConfig.systemInfo?.backgroundColor || '#ffffff'}
                        onChange={(val) => updatePlayerConfig('systemInfo', 'backgroundColor', val)}
                    />
                </div>
            </div>
            <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Text Color</label>
                <div className="mt-1">
                    <ColorPicker
                        value={playerConfig.systemInfo?.textColor || '#374151'}
                        onChange={(val) => updatePlayerConfig('systemInfo', 'textColor', val)}
                    />
                </div>
            </div>
        </div>
      </div>

      {/* Right Side Content */}
      <div className="pb-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Right Side Content</h4>
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-gray-700">Title Text</label>
                <input
                    type="text"
                    value={playerConfig.rightSide?.title ?? 'Smart Digital Signage'}
                    onChange={(e) => updatePlayerConfig('rightSide', 'title', e.target.value)}
                    className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
            </div>
            <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Title Color</label>
                <div className="mt-1">
                    <ColorPicker
                        value={playerConfig.rightSide?.titleColor || '#ffffff'}
                        onChange={(val) => updatePlayerConfig('rightSide', 'titleColor', val)}
                    />
                </div>
            </div>

            <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-gray-700">Subtitle Text</label>
                <textarea
                    rows={3}
                    value={playerConfig.rightSide?.subtitle ?? 'Deliver engaging content to your audience in seconds. Powering displays worldwide.'}
                    onChange={(e) => updatePlayerConfig('rightSide', 'subtitle', e.target.value)}
                    className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
            </div>
            <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Subtitle Color</label>
                <div className="mt-1">
                    <ColorPicker
                        value={playerConfig.rightSide?.subtitleColor || '#dbeafe'}
                        onChange={(val) => updatePlayerConfig('rightSide', 'subtitleColor', val)}
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerSettings;

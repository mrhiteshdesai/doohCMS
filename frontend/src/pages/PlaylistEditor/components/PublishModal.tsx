import { useState, useEffect } from 'react';
import { X, Monitor, Layers, Check } from 'lucide-react';
import { getScreens, publishToScreen } from '../../../services/screen';
import { getGroups, publishToGroup } from '../../../services/screenGroup';

interface PublishModalProps {
  playlistId: string;
  onClose: () => void;
}

const PublishModal = ({ playlistId, onClose }: PublishModalProps) => {
  const [activeTab, setActiveTab] = useState<'screens' | 'groups'>('screens');
  const [screens, setScreens] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [screensData, groupsData] = await Promise.all([
          getScreens(),
          getGroups()
        ]);
        setScreens(screensData);
        setGroups(groupsData);
      } catch (err) {
        console.error('Failed to fetch data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleScreen = (id: string) => {
    const newSet = new Set(selectedScreenIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedScreenIds(newSet);
  };

  const toggleGroup = (id: string) => {
    const newSet = new Set(selectedGroupIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedGroupIds(newSet);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setResultMessage(null);
    let successCount = 0;
    let failCount = 0;

    try {
      // Publish to Screens
      for (const screenId of selectedScreenIds) {
        try {
          await publishToScreen(screenId, playlistId);
          successCount++;
        } catch (e) {
          console.error(`Failed to publish to screen ${screenId}`, e);
          failCount++;
        }
      }

      // Publish to Groups
      for (const groupId of selectedGroupIds) {
        try {
          await publishToGroup(groupId, playlistId);
          successCount++;
        } catch (e) {
          console.error(`Failed to publish to group ${groupId}`, e);
          failCount++;
        }
      }

      setResultMessage(`Successfully published to ${successCount} targets. ${failCount > 0 ? `Failed: ${failCount}` : ''}`);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setResultMessage('An error occurred during publishing.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Publish Playlist</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b">
          <button
            className={`flex-1 py-3 font-medium text-sm flex items-center justify-center ${activeTab === 'screens' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('screens')}
          >
            <Monitor size={16} className="mr-2" />
            Screens ({screens.length})
          </button>
          <button
            className={`flex-1 py-3 font-medium text-sm flex items-center justify-center ${activeTab === 'groups' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('groups')}
          >
            <Layers size={16} className="mr-2" />
            Screen Groups ({groups.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading targets...</div>
          ) : activeTab === 'screens' ? (
            <div className="space-y-2">
              {screens.length === 0 && <p className="text-center text-gray-500 py-4">No screens found.</p>}
              {screens.map(screen => (
                <div
                  key={screen.id}
                  onClick={() => toggleScreen(screen.id)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-colors ${selectedScreenIds.has(screen.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center">
                    <Monitor size={20} className={`mr-3 ${screen.status === 'ONLINE' ? 'text-green-500' : 'text-gray-400'}`} />
                    <div>
                      <p className="font-medium text-gray-800">{screen.name || 'Unnamed Screen'}</p>
                      <p className="text-xs text-gray-500">{screen.orientation} • {screen.status}</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedScreenIds.has(screen.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {selectedScreenIds.has(screen.id) && <Check size={14} className="text-white" />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {groups.length === 0 && <p className="text-center text-gray-500 py-4">No groups found.</p>}
              {groups.map(group => (
                <div
                  key={group.id}
                  onClick={() => toggleGroup(group.id)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-colors ${selectedGroupIds.has(group.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center">
                    <Layers size={20} className="mr-3 text-purple-500" />
                    <div>
                      <p className="font-medium text-gray-800">{group.name}</p>
                      <p className="text-xs text-gray-500">{group.screenCount} Screens</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedGroupIds.has(group.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {selectedGroupIds.has(group.id) && <Check size={14} className="text-white" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Selected: {selectedScreenIds.size} Screens, {selectedGroupIds.size} Groups
          </div>
          <div className="space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
              disabled={publishing}
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || (selectedScreenIds.size === 0 && selectedGroupIds.size === 0)}
              className={`px-6 py-2 bg-blue-600 text-white rounded-lg font-medium shadow-sm ${publishing || (selectedScreenIds.size === 0 && selectedGroupIds.size === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
        {resultMessage && (
          <div className={`p-2 text-center text-sm font-medium ${resultMessage.includes('Failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {resultMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublishModal;

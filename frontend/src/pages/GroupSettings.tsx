import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Search, Trash2, ArrowLeft } from 'lucide-react';
import * as screenGroupService from '../services/screenGroup';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';

interface Screen {
  id: string;
  name: string;
  status: string;
  location: any;
  tags: string[];
  playerType?: string;
}

const GroupSettings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [allScreens, setAllScreens] = useState<Screen[]>([]);
  const [selectedScreens, setSelectedScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states for Left Panel
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [limit, setLimit] = useState('All');
  const [checkedScreens, setCheckedScreens] = useState<Set<string>>(new Set()); // For bulk selection in left panel

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const [groupData, screensRes] = await Promise.all([
          screenGroupService.getGroupById(id),
          api.get('/screens')
        ]);
        
        setGroup(groupData);
        setAllScreens(screensRes.data);
        
        // Initialize selected screens from group members
        if (groupData.screens) {
            setSelectedScreens(groupData.screens);
        }
      } catch (err) {
        console.error('Failed to fetch data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Derived state for filtered screens (Left Panel)
  // Exclude screens that are already in the Right Panel (Selected Screens)?
  // Or just show them? Usually in this UI pattern, you filter for what you want to ADD.
  // If I add a screen, it appears on right. It should probably disappear from left or be marked.
  // The prompt says: "The selected screens gets added to the right section".
  // I will hide screens that are already in selectedScreens from the left list to avoid duplicates.
  
  const availableScreens = allScreens.filter(s => 
    !selectedScreens.find(sel => sel.id === s.id)
  );

  const filteredScreens = availableScreens.filter(s => {
    const matchesSearch = s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = selectedTag ? (s.tags && Array.isArray(s.tags) && s.tags.includes(selectedTag)) : true;
    const matchesLocation = selectedLocation ? (s.location?.label === selectedLocation) : true;
    return matchesSearch && matchesTag && matchesLocation;
  });

  const allTags = Array.from(new Set(allScreens.flatMap(s => (s.tags && Array.isArray(s.tags)) ? s.tags : [])));
  const allLocations = Array.from(new Set(allScreens.map(s => s.location?.label).filter(Boolean)));

  const handleCheckScreen = (screenId: string) => {
    const newChecked = new Set(checkedScreens);
    if (newChecked.has(screenId)) {
      newChecked.delete(screenId);
    } else {
      newChecked.add(screenId);
    }
    setCheckedScreens(newChecked);
  };

  const handleSelectAllFiltered = () => {
    const newChecked = new Set(checkedScreens);
    filteredScreens.forEach(s => newChecked.add(s.id));
    setCheckedScreens(newChecked);
  };

  const handleAddSelected = () => {
    const screensToAdd = allScreens.filter(s => checkedScreens.has(s.id));
    setSelectedScreens([...selectedScreens, ...screensToAdd]);
    setCheckedScreens(new Set()); // Clear selection
  };

  const handleRemoveScreen = (screenId: string) => {
    setSelectedScreens(selectedScreens.filter(s => s.id !== screenId));
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      await screenGroupService.assignScreens(id, selectedScreens.map(s => s.id));
      alert('Group updated successfully');
      navigate('/groups');
    } catch (err) {
      console.error('Failed to save group', err);
      alert('Failed to save group');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!group) return <div className="p-8 text-center">Group not found</div>;

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/groups')} className="p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft size={20} />
            </button>
            <div>
                <h1 className="text-xl font-bold text-gray-800">GROUP - {group.name}</h1>
                <p className="text-sm text-gray-500">{group.description}</p>
            </div>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center px-6 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors shadow-sm"
        >
          <Save size={20} className="mr-2" />
          Save Group
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        
        {/* LEFT PANEL: All Screens */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-blue-800 mb-4">All Screens ({availableScreens.length})</h2>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">Show Screens</label>
                        <SearchableSelect
                            value={limit}
                            onChange={(val) => setLimit(val as string)}
                            options={[
                                { value: "All", label: "All" },
                                { value: "50", label: "50" }
                            ]}
                            triggerClassName="w-full mt-1 border rounded p-2 text-sm bg-white"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">Location</label>
                        <SearchableSelect
                            value={selectedLocation}
                            onChange={(val) => setSelectedLocation(val as string)}
                            options={[
                                { value: "", label: "All Locations" },
                                ...allLocations.map(loc => ({ value: loc, label: loc }))
                            ]}
                            triggerClassName="w-full mt-1 border rounded p-2 text-sm bg-white"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">Select Tags</label>
                        <SearchableSelect
                            value={selectedTag}
                            onChange={(val) => setSelectedTag(val as string)}
                            options={[
                                { value: "", label: "All Tags" },
                                ...allTags.map(tag => ({ value: tag, label: tag }))
                            ]}
                            triggerClassName="w-full mt-1 border rounded p-2 text-sm bg-white"
                        />
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search By Screen Name/ID/Tag"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                {checkedScreens.size > 0 && (
                    <button 
                        onClick={handleAddSelected}
                        className="mt-4 w-full py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-colors"
                    >
                        Add {checkedScreens.size} Selected Screens →
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-auto p-4">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="px-4 py-3 text-left w-10">
                                <input 
                                    type="checkbox" 
                                    onChange={(e) => e.target.checked ? handleSelectAllFiltered() : setCheckedScreens(new Set())}
                                    checked={filteredScreens.length > 0 && filteredScreens.every(s => checkedScreens.has(s.id))}
                                />
                            </th>
                            <th className="px-4 py-3 text-left">SCREEN NAME</th>
                            <th className="px-4 py-3 text-left">TAGS</th>
                            <th className="px-4 py-3 text-left">LOCATION</th>
                            <th className="px-4 py-3 text-left">STATUS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredScreens.map(screen => (
                            <tr key={screen.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <input 
                                        type="checkbox" 
                                        checked={checkedScreens.has(screen.id)}
                                        onChange={() => handleCheckScreen(screen.id)}
                                    />
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-800">{screen.name || screen.id}</td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                        {screen.tags && screen.tags.map((tag: string) => (
                                            <span key={tag} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{screen.location?.label || '-'}</td>
                                <td className="px-4 py-3">
                                    {screen.status === 'ONLINE' ? (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                            Online
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                            Offline
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* RIGHT PANEL: Selected Screens */}
        <div className="flex-1 bg-gray-50 rounded-xl shadow-inner border border-gray-200 flex flex-col overflow-hidden">
             <div className="p-4 border-b border-gray-200 bg-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Selected Screens ({selectedScreens.length})</h2>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-medium">
                            <tr>
                                <th className="px-4 py-3 text-left">SCREEN NAME</th>
                                <th className="px-4 py-3 text-left">TAGS</th>
                                <th className="px-4 py-3 text-left">LOCATION</th>
                                <th className="px-4 py-3 text-left">STATUS</th>
                                <th className="px-4 py-3 text-center">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {selectedScreens.map(screen => (
                                <tr key={screen.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-800">{screen.name || screen.id}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                        {Array.isArray(screen.tags) && screen.tags.map((tag: string) => (
                                            <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{screen.location?.label || '-'}</td>
                                    <td className="px-4 py-3">
                                        {screen.status === 'ONLINE' ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                Online
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                Offline
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button 
                                            onClick={() => handleRemoveScreen(screen.id)}
                                            className="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                                            title="Remove from group"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {selectedScreens.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                        No screens selected. Add screens from the left panel.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default GroupSettings;

import { useEffect, useState } from 'react';
import { Search, Filter, Plus, Trash2, Calendar, Monitor, Layers, Edit2, Lock } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { getPlaylists } from '../services/playlist';
import { getScreens } from '../services/screen';
import { getGroups } from '../services/screenGroup';
import * as scheduleService from '../services/schedule';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';

const format12h = (val?: string) => {
  if (!val) return '';
  const [hhStr, mmStr] = val.split(':');
  const hh = parseInt(hhStr || '0', 10);
  const mm = mmStr || '00';
  const ap = hh >= 12 ? 'PM' : 'AM';
  const h12 = String(hh % 12 === 0 ? 12 : hh % 12).padStart(2, '0');
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
};

export default function Schedules() {
  const { checkPermission } = useAuth();
  const [schedules, setSchedules] = useState<scheduleService.Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [targetFilter, setTargetFilter] = useState<'ALL' | 'SCREEN' | 'GROUP'>('ALL');
  const [recurrenceFilter, setRecurrenceFilter] = useState<'ALL' | scheduleService.Recurrence>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<scheduleService.Schedule | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!checkPermission('schedule', 'read')) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      if (targetFilter !== 'ALL') params.targetType = targetFilter;
      if (recurrenceFilter !== 'ALL') params.recurrence = recurrenceFilter;
      const data = await scheduleService.getSchedules(params);
      setSchedules(data);
      setLoading(false);
    };
    fetch();
  }, [searchQuery, targetFilter, recurrenceFilter]);

  if (!checkPermission('schedule', 'read')) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 min-h-[400px]">
        <Lock size={48} className="mb-4 text-gray-400" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p>You do not have permission to view schedules.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Schedule Manager</h1>
          <p className="text-gray-500">Create and manage playlist schedules</p>
        </div>
        <PermissionGuard module="schedule" action="write">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Add Schedule
          </button>
        </PermissionGuard>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={18} className="text-gray-500 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search schedules..."
              className="bg-transparent outline-none flex-1 text-sm"
            />
          </div>

          <div className="w-48">
            <SearchableSelect
              icon={<Filter size={18} className="text-gray-500" />}
              value={targetFilter}
              onChange={(val) => setTargetFilter(val as any)}
              options={[
                { value: 'ALL', label: 'All Targets' },
                { value: 'SCREEN', label: 'Screens' },
                { value: 'GROUP', label: 'Screen Groups' }
              ]}
              triggerClassName="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="w-48">
            <SearchableSelect
              icon={<Calendar size={18} className="text-gray-500" />}
              value={recurrenceFilter}
              onChange={(val) => setRecurrenceFilter(val as any)}
              options={[
                { value: 'ALL', label: 'All Recurrence' },
                { value: 'NONE', label: 'Do Not Repeat' },
                { value: 'ONE_TIME', label: 'One Time' },
                { value: 'DAILY', label: 'Daily' },
                { value: 'WEEKDAY', label: 'Week Day' },
                { value: 'WEEKEND', label: 'Weekend' },
                { value: 'SPECIFIC_DAYS', label: 'Specific Days' }
              ]}
              triggerClassName="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm">
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Playlist</th>
                <th className="px-6 py-4 font-medium">Target</th>
                <th className="px-6 py-4 font-medium">Window</th>
                <th className="px-6 py-4 font-medium">Recurrence</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-6 py-6 text-center text-gray-500" colSpan={6}>Loading schedules...</td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-center text-gray-500" colSpan={6}>No schedules found</td>
                </tr>
              ) : (
                schedules.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-800">{s.playlist?.name || s.playlistId}</div>
                    </td>
                    <td className="px-6 py-4">
                      {s.screen ? (
                        <span className="inline-flex items-center text-sm text-gray-700"><Monitor size={16} className="mr-2 text-blue-600" />{s.screen.name || s.screen.id}</span>
                      ) : s.group ? (
                        <span className="inline-flex items-center text-sm text-gray-700"><Layers size={16} className="mr-2 text-purple-600" />{s.group.name || s.group.id}</span>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {new Date(s.startDate).toLocaleDateString('en-GB')} {format12h(s.startTime)}
                      {s.endDate ? ` → ${new Date(s.endDate).toLocaleDateString('en-GB')} ${format12h(s.endTime)}` : ''}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {s.recurrence}
                      {s.recurrence === 'SPECIFIC_DAYS' && s.daysOfWeek && (
                        <span className="text-xs text-gray-500 ml-2">[{s.daysOfWeek.join(', ')}]</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <PermissionGuard module="schedule" action="write">
                        <button
                          onClick={() => setEditingSchedule(s)}
                          className="text-blue-600 hover:text-blue-700 inline-flex items-center px-2 py-1 rounded mr-2"
                        >
                          <Edit2 size={16} className="mr-1" /> Edit
                        </button>
                      </PermissionGuard>
                      <PermissionGuard module="schedule" action="write">
                        <button
                          onClick={async () => { 
                            try { 
                              await scheduleService.deleteSchedule(s.id); 
                              setSchedules(prev => prev.filter(x => x.id !== s.id)); 
                            } catch (e) { 
                              // noop simple feedback path 
                            } 
                          }}
                          className="text-red-600 hover:text-red-700 inline-flex items-center px-2 py-1 rounded"
                        >
                          <Trash2 size={16} className="mr-1" /> Delete
                        </button>
                      </PermissionGuard>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AddScheduleModal 
          onClose={() => setShowModal(false)} 
          onCreated={(s) => { setSchedules(prev => [s, ...prev]); setShowModal(false); }} 
        />
      )}
      {editingSchedule && (
        <AddScheduleModal 
          initial={editingSchedule}
          onClose={() => setEditingSchedule(null)} 
          onUpdated={(updated) => { 
            setSchedules(prev => prev.map(p => p.id === updated.id ? updated : p)); 
            setEditingSchedule(null); 
          }} 
        />
      )}
    </div>
  );
}

const AddScheduleModal = ({ onClose, onCreated, onUpdated, initial }: { onClose: () => void; onCreated?: (s: scheduleService.Schedule) => void; onUpdated?: (s: scheduleService.Schedule) => void; initial?: scheduleService.Schedule }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [playlistId, setPlaylistId] = useState<string>('');
  const [targetType, setTargetType] = useState<'SCREEN' | 'GROUP'>('SCREEN');
  const [screenId, setScreenId] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [noEndDate, setNoEndDate] = useState<boolean>(false);
  const [startHour12, setStartHour12] = useState<string>('12');
  const [startMinute, setStartMinute] = useState<string>('00');
  const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>('AM');
  const [endHour12, setEndHour12] = useState<string>('12');
  const [endMinute, setEndMinute] = useState<string>('00');
  const [endAmPm, setEndAmPm] = useState<'AM' | 'PM'>('AM');
  const [recurrence, setRecurrence] = useState<scheduleService.Recurrence>('NONE');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [screens, setScreens] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const toDateInput = (val?: string) => {
    if (!val) return '';
    const d = new Date(val);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    const load = async () => {
      const [pl, sc, gr] = await Promise.all([
        getPlaylists(),
        getScreens(),
        getGroups()
      ]);
      setPlaylists(pl);
      setScreens(sc);
      setGroups(gr);
    };
    load();
  }, []);

  const to12From24 = (val?: string) => {
    if (!val) return { h: '12', m: '00', ap: 'AM' as 'AM' | 'PM' };
    const [hhStr, mmStr] = val.split(':');
    const hh = parseInt(hhStr || '0', 10);
    const mm = mmStr || '00';
    const ap = (hh >= 12 ? 'PM' : 'AM') as 'AM' | 'PM';
    const h12 = String(hh % 12 === 0 ? 12 : hh % 12);
    return { h: h12.padStart(2, '0'), m: mm.padStart(2, '0'), ap };
  };

  const to24From12 = (h12: string, m: string, ap: 'AM' | 'PM') => {
    let h = parseInt(h12 || '12', 10);
    if (ap === 'AM') h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
    return `${String(h).padStart(2, '0')}:${String(m || '00').padStart(2, '0')}`;
  };

  useEffect(() => {
    if (initial) {
      setName(initial.name || '');
      setDescription(initial.description || '');
      setPlaylistId(initial.playlistId || '');
      if (initial.screenId) {
        setTargetType('SCREEN');
        setScreenId(initial.screenId);
        setGroupId('');
      } else if (initial.groupId) {
        setTargetType('GROUP');
        setGroupId(initial.groupId);
        setScreenId('');
      } else {
        setTargetType('SCREEN');
      }
      setStartDate(toDateInput(initial.startDate));
      if (initial.endDate) {
        setEndDate(toDateInput(initial.endDate));
        setNoEndDate(false);
      } else {
        setEndDate('');
        setNoEndDate(true);
      }
      const s12 = to12From24(initial.startTime || '');
      setStartHour12(s12.h);
      setStartMinute(s12.m);
      setStartAmPm(s12.ap);
      const e12 = to12From24(initial.endTime || '');
      setEndHour12(e12.h);
      setEndMinute(e12.m);
      setEndAmPm(e12.ap);
      setRecurrence(initial.recurrence || 'NONE');
      // Backend may return daysOfWeek as array or string; handle both
      const dows: any = (initial.daysOfWeek as any);
      if (Array.isArray(dows)) setDaysOfWeek(dows as number[]);
      else if (typeof dows === 'string' && dows) {
        try { setDaysOfWeek(JSON.parse(dows)); } catch { setDaysOfWeek([]); }
      } else setDaysOfWeek([]);
    }
  }, [initial]);

  const toggleDay = (d: number) => {
    setDaysOfWeek((prev) => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const hasTarget = (targetType === 'SCREEN' && screenId) || (targetType === 'GROUP' && groupId);
    const computedStartTime = to24From12(startHour12, startMinute, startAmPm);
    const computedEndTime = to24From12(endHour12, endMinute, endAmPm);
    if (!name || !playlistId || !startDate || !computedStartTime || !hasTarget) {
      setError('Please fill required fields: name, playlist, target, start date and start time.');
      setSaving(false);
      return;
    }
    if (!noEndDate && !endDate) {
      setError('Please select an end date or check "No End Date".');
      setSaving(false);
      return;
    }
    const payload: any = {
      name,
      description,
      playlistId,
      startDate,
      endDate: noEndDate ? null : endDate,
      startTime: computedStartTime,
      endTime: computedEndTime,
      recurrence,
      daysOfWeek: recurrence === 'SPECIFIC_DAYS' ? daysOfWeek : undefined,
      timezone: localStorage.getItem('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    if (targetType === 'SCREEN') payload.screenId = screenId;
    else payload.groupId = groupId;
    try {
      if (initial && onUpdated) {
        const s = await scheduleService.updateSchedule(initial.id, payload);
        onUpdated(s);
        setError('');
      } else if (onCreated) {
        const s = await scheduleService.createSchedule(payload);
        onCreated(s);
        setError('');
      }
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Failed to save schedule';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-[800px] rounded-lg shadow-xl">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">{initial ? 'Edit Schedule' : 'Add Schedule'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Close</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Playlist</label>
            <SearchableSelect
              value={playlistId}
              onChange={(val) => setPlaylistId(val as string)}
              options={[
                { value: "", label: "Select playlist" },
                ...playlists.map(p => ({ value: p.id, label: p.name }))
              ]}
              triggerClassName="w-full border rounded px-3 py-2 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Target Type</label>
            <SearchableSelect
              value={targetType}
              onChange={(val) => setTargetType(val as any)}
              options={[
                { value: "SCREEN", label: "Screen" },
                { value: "GROUP", label: "Screen Group" }
              ]}
              triggerClassName="w-full border rounded px-3 py-2 bg-white"
            />
          </div>
          {targetType === 'SCREEN' ? (
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Screen</label>
              <SearchableSelect
                value={screenId}
                onChange={(val) => setScreenId(val as string)}
                options={[
                  { value: "", label: "Select screen" },
                  ...screens.map(s => ({ value: s.id, label: s.name || s.id }))
                ]}
                triggerClassName="w-full border rounded px-3 py-2 bg-white"
              />
            </div>
          ) : (
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Screen Group</label>
              <SearchableSelect
                value={groupId}
                onChange={(val) => setGroupId(val as string)}
                options={[
                  { value: "", label: "Select group" },
                  ...groups.map(g => ({ value: g.id, label: g.name }))
                ]}
                triggerClassName="w-full border rounded px-3 py-2 bg-white"
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">End Date</label>
            <div className="flex items-center space-x-2">
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                disabled={noEndDate}
                className={`flex-1 border rounded px-3 py-2 ${noEndDate ? 'bg-gray-100 text-gray-400' : ''}`} 
              />
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="noEndDate" 
                  checked={noEndDate} 
                  onChange={(e) => {
                    setNoEndDate(e.target.checked);
                    if (e.target.checked) setEndDate('');
                  }}
                  className="mr-2"
                />
                <label htmlFor="noEndDate" className="text-sm text-gray-600 whitespace-nowrap">No End Date</label>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Start Time</label>
            <div className="flex items-center space-x-2">
              <SearchableSelect
                value={startHour12}
                onChange={(val) => setStartHour12(val as string)}
                options={Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => ({ value: h, label: h }))}
                triggerClassName="border rounded px-2 py-2 w-24 bg-white"
              />
              <span className="text-gray-700">:</span>
              <SearchableSelect
                value={startMinute}
                onChange={(val) => setStartMinute(val as string)}
                options={Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => ({ value: m, label: m }))}
                triggerClassName="border rounded px-2 py-2 w-24 bg-white"
              />
              <SearchableSelect
                value={startAmPm}
                onChange={(val) => setStartAmPm(val as 'AM' | 'PM')}
                options={[
                  { value: "AM", label: "AM" },
                  { value: "PM", label: "PM" }
                ]}
                triggerClassName="border rounded px-2 py-2 w-24 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">End Time</label>
            <div className="flex items-center space-x-2">
              <SearchableSelect
                value={endHour12}
                onChange={(val) => setEndHour12(val as string)}
                options={Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => ({ value: h, label: h }))}
                triggerClassName="border rounded px-2 py-2 w-24 bg-white"
              />
              <span className="text-gray-700">:</span>
              <SearchableSelect
                value={endMinute}
                onChange={(val) => setEndMinute(val as string)}
                options={Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => ({ value: m, label: m }))}
                triggerClassName="border rounded px-2 py-2 w-24 bg-white"
              />
              <SearchableSelect
                value={endAmPm}
                onChange={(val) => setEndAmPm(val as 'AM' | 'PM')}
                options={[
                  { value: "AM", label: "AM" },
                  { value: "PM", label: "PM" }
                ]}
                triggerClassName="border rounded px-2 py-2 w-24 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Recurrence</label>
            <SearchableSelect
              value={recurrence}
              onChange={(val) => setRecurrence(val as any)}
              options={[
                { value: "NONE", label: "Do Not Repeat" },
                { value: "ONE_TIME", label: "One Time" },
                { value: "DAILY", label: "Daily" },
                { value: "WEEKDAY", label: "Week Day" },
                { value: "WEEKEND", label: "Weekend" },
                { value: "SPECIFIC_DAYS", label: "Specific Days of Week" }
              ]}
              triggerClassName="w-full border rounded px-3 py-2 bg-white"
            />
          </div>
          {recurrence === 'SPECIFIC_DAYS' && (
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-2">Days of Week</label>
              <div className="flex space-x-2">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`px-3 py-1 rounded border ${daysOfWeek.includes(idx) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {error && (
          <div className="px-6 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <div className="px-6 py-4 border-t flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 rounded border border-gray-300 text-gray-700">Cancel</button>
          <button
            disabled={saving}
            onClick={save}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {saving ? 'Saving...' : (initial ? 'Update Schedule' : 'Save Schedule')}
          </button>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, RefreshCw, Rocket, Trash2, Upload } from 'lucide-react';
import {
  AppRelease,
  RolloutStatus,
  createAppReleaseFromUrl,
  deleteAppRelease,
  getRolloutStatus,
  listAppReleases,
  rolloutAppRelease,
  uploadAppRelease,
} from '../services/appReleases';
import { getScreens, Screen } from '../services/screen';

const AppReleasesPage = () => {
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [status, setStatus] = useState<RolloutStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string>('');
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [percent, setPercent] = useState<number>(100);
  const [force, setForce] = useState(false);

  const [versionName, setVersionName] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [notes, setNotes] = useState('');
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [apkUrl, setApkUrl] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [r, s, st] = await Promise.all([
        listAppReleases(),
        getScreens(),
        getRolloutStatus(selectedReleaseId || undefined),
      ]);
      setReleases(r);
      setScreens(Array.isArray(s) ? s : []);
      setStatus(st);
      if (!selectedReleaseId && r[0]) setSelectedReleaseId(r[0].id);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Failed to load releases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedReleaseId) return;
    getRolloutStatus(selectedReleaseId)
      .then(setStatus)
      .catch(() => undefined);
  }, [selectedReleaseId]);

  const handleUpload = async () => {
    if (!versionName.trim() || !versionCode.trim()) {
      toast.error('versionName and versionCode are required');
      return;
    }
    setUploading(true);
    try {
      let release: AppRelease;
      if (apkFile) {
        const form = new FormData();
        form.append('apk', apkFile);
        form.append('versionName', versionName.trim());
        form.append('versionCode', versionCode.trim());
        if (notes.trim()) form.append('notes', notes.trim());
        release = await uploadAppRelease(form);
      } else if (apkUrl.trim()) {
        release = await createAppReleaseFromUrl({
          apkUrl: apkUrl.trim(),
          versionName: versionName.trim(),
          versionCode: Number(versionCode),
          notes: notes.trim() || undefined,
        });
      } else {
        toast.error('Upload an APK or paste a CDN URL');
        setUploading(false);
        return;
      }
      toast.success(`Release ${release.versionName} saved (sha256 autofilled)`);
      setApkFile(null);
      setApkUrl('');
      setNotes('');
      setSelectedReleaseId(release.id);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRollout = async () => {
    if (!selectedReleaseId) {
      toast.error('Select a release');
      return;
    }
    try {
      const payload: any = { force, percent };
      if (selectedScreenIds.length > 0) payload.screenIds = selectedScreenIds;
      const result = await rolloutAppRelease(selectedReleaseId, payload);
      toast.success(`Queued UPDATE_APP on ${result.targeted} screen(s)`);
      const st = await getRolloutStatus(selectedReleaseId);
      setStatus(st);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Rollout failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this release record?')) return;
    try {
      await deleteAppRelease(id);
      toast.success('Release deleted');
      if (selectedReleaseId === id) setSelectedReleaseId('');
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Delete failed');
    }
  };

  const toggleScreen = (id: string) => {
    setSelectedScreenIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">App Releases (OTA)</h1>
          <p className="text-gray-500">
            Upload signed APKs, roll out to Device Owner screens, track success/fail. sha256 is computed automatically.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-800">
            <Upload className="mr-2 h-5 w-5 text-blue-600" /> Register release
          </h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-gray-600">Version name</span>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="1.4.0"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-600">Version code</span>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={versionCode}
                  onChange={(e) => setVersionCode(e.target.value)}
                  placeholder="140"
                  type="number"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">APK file (sha256 autofilled)</span>
              <input
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                onChange={(e) => setApkFile(e.target.files?.[0] || null)}
              />
            </label>
            <div className="text-center text-xs text-gray-400">— or —</div>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">CDN / APK URL</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                value={apkUrl}
                onChange={(e) => setApkUrl(e.target.value)}
                placeholder="https://cdn.example.com/smartags-1.4.0.apk"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Notes</span>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <button
              disabled={uploading}
              onClick={handleUpload}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="mr-2 h-4 w-4" />
              {uploading ? 'Saving…' : 'Save release'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-800">
            <Rocket className="mr-2 h-5 w-5 text-blue-600" /> Roll out
          </h2>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-gray-600">Release</span>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={selectedReleaseId}
              onChange={(e) => setSelectedReleaseId(e.target.value)}
            >
              <option value="">Select…</option>
              {releases.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.versionName} (code {r.versionCode})
                </option>
              ))}
            </select>
          </label>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-gray-600">Staged percent (all screens if no selection)</span>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value) || 100)}
            />
          </label>
          <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Force reinstall even if versionCode is not higher
          </label>
          <div className="mb-3 max-h-40 overflow-y-auto rounded-md border border-gray-200 p-2">
            <p className="mb-2 text-xs font-medium text-gray-500">Optional screen filter</p>
            {screens.length === 0 && <p className="text-sm text-gray-400">No screens</p>}
            {screens.map((s) => (
              <label key={s.id} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={selectedScreenIds.includes(s.id)}
                  onChange={() => toggleScreen(s.id)}
                />
                <span>
                  {s.name || s.id.slice(0, 8)} · v{s.appVersion || '?'} · {s.status}
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={handleRollout}
            className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Rocket className="mr-2 h-4 w-4" /> Queue UPDATE_APP
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Releases</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="py-2 pr-4">Version</th>
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">SHA256</th>
                <th className="py-2 pr-4">URL</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-medium">{r.versionName}</td>
                  <td className="py-2 pr-4">{r.versionCode}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{r.sha256.slice(0, 16)}…</td>
                  <td className="py-2 pr-4 max-w-xs truncate text-xs text-blue-600">{r.apkUrl}</td>
                  <td className="py-2">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="inline-flex items-center text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {releases.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    No releases yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-gray-800">Rollout status</h2>
        {status && (
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-gray-100 px-3 py-1">Total {status.counts.total}</span>
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-yellow-800">
              Queued {status.counts.queued}
            </span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">
              Downloading {status.counts.downloading}
            </span>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-800">
              Installing {status.counts.installing}
            </span>
            <span className="rounded-full bg-green-100 px-3 py-1 text-green-800">
              Completed {status.counts.completed}
            </span>
            <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">
              Failed {status.counts.failed}
            </span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="py-2 pr-4">Screen</th>
                <th className="py-2 pr-4">Target</th>
                <th className="py-2 pr-4">Reported</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {(status?.events || []).map((e) => (
                <tr key={e.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-4">{e.screenName}</td>
                  <td className="py-2 pr-4">
                    {e.targetVersion} ({e.targetCode})
                  </td>
                  <td className="py-2 pr-4">{e.reportedAppVersion || '—'}</td>
                  <td className="py-2 pr-4 font-medium">{e.status}</td>
                  <td className="py-2 text-xs text-gray-600">{e.message}</td>
                </tr>
              ))}
              {(!status || status.events.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    No rollout events yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AppReleasesPage;

import api from './api';

export interface AppRelease {
  id: string;
  tenantId?: string | null;
  versionName: string;
  versionCode: number;
  apkUrl: string;
  sha256: string;
  fileSize?: string | number | null;
  minSdk?: number | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RolloutStatus {
  counts: {
    total: number;
    queued: number;
    sent: number;
    downloading: number;
    installing: number;
    completed: number;
    failed: number;
    other: number;
  };
  events: Array<{
    id: string;
    screenId: string;
    screenName?: string;
    releaseId?: string | null;
    commandId?: string | null;
    targetVersion?: string | null;
    targetCode?: number | null;
    fromVersion?: string | null;
    status: string;
    message?: string | null;
    reportedAppVersion?: string | null;
    screenStatus?: string | null;
    versionMatch?: boolean | null;
    createdAt: string;
    updatedAt: string;
    release?: { id: string; versionName: string; versionCode: number } | null;
  }>;
}

export const listAppReleases = async () => {
  const res = await api.get('/app-releases');
  return res.data as AppRelease[];
};

export const uploadAppRelease = async (form: FormData) => {
  const res = await api.post('/app-releases/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as AppRelease;
};

export const createAppReleaseFromUrl = async (payload: {
  apkUrl: string;
  versionName: string;
  versionCode: number;
  sha256?: string;
  notes?: string;
}) => {
  const res = await api.post('/app-releases/from-url', payload);
  return res.data as AppRelease;
};

export const rolloutAppRelease = async (
  id: string,
  payload: { screenIds?: string[]; groupId?: string; percent?: number; force?: boolean }
) => {
  const res = await api.post(`/app-releases/${id}/rollout`, payload);
  return res.data;
};

export const getRolloutStatus = async (releaseId?: string) => {
  const res = await api.get('/app-releases/rollout/status', {
    params: releaseId ? { releaseId } : undefined,
  });
  return res.data as RolloutStatus;
};

export const deleteAppRelease = async (id: string) => {
  const res = await api.delete(`/app-releases/${id}`);
  return res.data;
};

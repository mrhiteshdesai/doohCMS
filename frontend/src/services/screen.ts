import api from './api';

export interface Screen {
  id: string;
  name: string;
  status: string;
  location?: any;
  latitude?: number;
  longitude?: number;
  orientation: string;
  playerType?: string;
  config?: {
    telemetry?: {
      cpuUsage?: number;
      memoryUsage?: number;
      temperature?: number;
      uptime?: number;
    };
    [key: string]: any;
  };
  nativeDiagnostics?: {
    isNativePlayer?: boolean;
    supportedCommands?: string[];
    platform?: string | null;
    deviceOwnerState?: string | null;
    playbackState?: string | null;
    downloadState?: string | null;
    currentAssetId?: string | null;
    currentAssetIds?: string[];
    currentPlaylistId?: string | null;
    lastSuccessfulPlaybackAt?: string | null;
    lastSuccessfulAssetId?: string | null;
    playbackError?: string | null;
    decoderError?: string | null;
    lastDownloadError?: string | null;
    freeStorageBytes?: number | null;
    totalStorageBytes?: number | null;
    memoryUsedBytes?: number | null;
    memoryTotalBytes?: number | null;
    cachedAssetCount?: number | null;
    downloadProgress?: {
      status?: string;
      completed?: number;
      total?: number;
      currentFile?: string;
    } | null;
    kioskEnabled?: boolean | null;
    startOnBoot?: boolean | null;
    apiBase?: string | null;
    device?: string | null;
    androidVersion?: string | null;
    appVersion?: string | null;
    lastTelemetryAt?: string | null;
    commandQueueDepth?: number;
    supportBundle?: {
      fileName?: string | null;
      url?: string | null;
      contentType?: string | null;
      sizeBytes?: number | null;
      uploadedAt?: string | null;
    } | null;
    lastCommand?: {
      id?: string | null;
      type?: string | null;
      status?: string | null;
      message?: string | null;
      updatedAt?: string | null;
    } | null;
  };
  activePlaylist?: {
    id: string;
    name: string;
  };
  lastSeenAt?: string;
  createdAt: string;
  tags?: string;
}

export const getScreens = async () => {
  const response = await api.get('/screens');
  return response.data;
};

export const pairScreen = async (code: string, name: string) => {
  const response = await api.post('/screens', { code, name });
  return response.data;
};

export const publishToScreen = async (screenId: string, playlistId: string) => {
  const response = await api.post(`/screens/${screenId}/publish`, { playlistId });
  return response.data;
};

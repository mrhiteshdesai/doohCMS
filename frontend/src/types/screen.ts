export interface Screen {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'UNPAIRED';
  orientation: 'LANDSCAPE' | 'PORTRAIT';
  playerType: string;
  tags?: string[] | string;
  location?: {
    label?: string;
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    zip?: string;
  };
  lastSeenAt?: string;
  config?: any;
  nativeDiagnostics?: {
    isNativePlayer?: boolean;
    deviceOwnerState?: string | null;
    playbackState?: string | null;
    downloadState?: string | null;
    currentAssetId?: string | null;
    lastSuccessfulPlaybackAt?: string | null;
    lastSuccessfulAssetId?: string | null;
    playbackError?: string | null;
    decoderError?: string | null;
    lastDownloadError?: string | null;
    freeStorageBytes?: number | null;
    totalStorageBytes?: number | null;
    cachedAssetCount?: number | null;
    kioskEnabled?: boolean | null;
    startOnBoot?: boolean | null;
    apiBase?: string | null;
    platform?: string | null;
    device?: string | null;
    androidVersion?: string | null;
    commandQueueDepth?: number;
    supportBundle?: {
      fileName?: string | null;
      url?: string | null;
      contentType?: string | null;
      sizeBytes?: number | null;
      uploadedAt?: string | null;
    } | null;
  };
  createdAt: string;
  updatedAt: string;
}

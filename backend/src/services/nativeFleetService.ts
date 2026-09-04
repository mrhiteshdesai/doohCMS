const SUPPORTED_NATIVE_COMMANDS = [
  'RELOAD',
  'PLAY_PLAYLIST',
  'SNAPSHOT',
  'EXPORT_SUPPORT_BUNDLE',
  'CLEAR_CACHE',
  'REBOOT',
  'REBOOT_APP',
  'REBOOT_DEVICE',
  'UPDATE_APP',
  'SET_API_BASE',
  'SET_KIOSK',
  'SET_START_ON_BOOT',
  'ENTER_RECOVERY_MODE',
  'CLEAR_RECOVERY_MODE',
  'RESET_TECH_UNLOCK',
  'CLEAR_HOME_LOCK'
] as const;

const COMMAND_ALIASES: Record<string, string> = {
  CHANGE_API_BASE: 'SET_API_BASE',
  TOGGLE_KIOSK: 'SET_KIOSK',
  TOGGLE_START_ON_BOOT: 'SET_START_ON_BOOT',
  REBOOT_PLAYER: 'REBOOT_APP'
};

const asObject = (value: any) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const normalizeBoolean = (value: any) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return null;
};

const normalizeApiBase = (raw: any) => {
  if (typeof raw !== 'string') {
    throw new Error('SET_API_BASE requires payload.apiBase');
  }

  const input = raw.trim();
  if (!input) {
    throw new Error('SET_API_BASE requires payload.apiBase');
  }

  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error('Invalid API base URL');
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  parsed.pathname = normalizedPath.endsWith('/api') ? normalizedPath : `${normalizedPath || ''}/api`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
};

export const getSupportedNativeCommands = () => [...SUPPORTED_NATIVE_COMMANDS];

export const normalizeNativeCommand = (command: string, payload?: any) => {
  const rawType = `${command || ''}`.trim().toUpperCase();
  const type = (COMMAND_ALIASES[rawType] || rawType) as (typeof SUPPORTED_NATIVE_COMMANDS)[number] | string;
  const data = asObject(payload);

  if (!SUPPORTED_NATIVE_COMMANDS.includes(type as any)) {
    throw new Error(`Unsupported command: ${command}`);
  }

  switch (type) {
    case 'SET_API_BASE':
      return { type, payload: { apiBase: normalizeApiBase(data.apiBase) } };
    case 'SET_KIOSK': {
      const enabled = normalizeBoolean(data.enabled);
      if (enabled === null) {
        throw new Error('SET_KIOSK requires payload.enabled');
      }
      return { type, payload: { enabled } };
    }
    case 'SET_START_ON_BOOT': {
      const enabled = normalizeBoolean(data.enabled);
      if (enabled === null) {
        throw new Error('SET_START_ON_BOOT requires payload.enabled');
      }
      return { type, payload: { enabled } };
    }
    case 'ENTER_RECOVERY_MODE': {
      const minutes = Number(data.minutes ?? 15);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60) {
        throw new Error('ENTER_RECOVERY_MODE requires payload.minutes between 1 and 60');
      }
      return { type, payload: { minutes: Math.round(minutes) } };
    }
    case 'PLAY_PLAYLIST':
      if (typeof data.playlistId !== 'string' || !data.playlistId.trim()) {
        throw new Error('PLAY_PLAYLIST requires payload.playlistId');
      }
      return { type, payload: { playlistId: data.playlistId.trim() } };
    case 'UPDATE_APP': {
      const apkUrl = typeof data.apkUrl === 'string' ? data.apkUrl.trim() : '';
      const sha256 = typeof data.sha256 === 'string' ? data.sha256.trim().toLowerCase() : '';
      const versionCode = Number(data.versionCode);
      const versionName = typeof data.versionName === 'string' ? data.versionName.trim() : '';
      if (!apkUrl) throw new Error('UPDATE_APP requires payload.apkUrl');
      if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) {
        throw new Error('UPDATE_APP requires payload.sha256 (64-char hex)');
      }
      if (!Number.isFinite(versionCode) || versionCode < 1) {
        throw new Error('UPDATE_APP requires payload.versionCode');
      }
      return {
        type,
        payload: {
          apkUrl,
          sha256,
          versionCode: Math.trunc(versionCode),
          versionName: versionName || String(Math.trunc(versionCode)),
          force: !!data.force,
          releaseId: typeof data.releaseId === 'string' ? data.releaseId : undefined,
        },
      };
    }
    default:
      return { type, payload: Object.keys(data).length > 0 ? data : undefined };
  }
};

export const normalizeHeartbeatTelemetry = (metadata?: any) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const normalized = { ...metadata };
  const downloadProgress = asObject(normalized.downloadProgress);

  if (normalized.deviceOwnerState === undefined && normalized.deviceOwner !== undefined) {
    normalized.deviceOwnerState = normalized.deviceOwner ? 'DEVICE_OWNER' : 'NOT_DEVICE_OWNER';
  }
  if (normalized.freeStorageBytes === undefined && normalized.freeDiskSpace !== undefined) {
    normalized.freeStorageBytes = normalized.freeDiskSpace;
  }
  if (normalized.totalStorageBytes === undefined && normalized.totalDiskSpace !== undefined) {
    normalized.totalStorageBytes = normalized.totalDiskSpace;
  }
  if (normalized.memoryUsedBytes === undefined && normalized.usedMemory !== undefined) {
    normalized.memoryUsedBytes = normalized.usedMemory;
  }
  if (normalized.memoryTotalBytes === undefined && normalized.totalMemory !== undefined) {
    normalized.memoryTotalBytes = normalized.totalMemory;
  }
  if (normalized.downloadState === undefined && downloadProgress.status) {
    normalized.downloadState = downloadProgress.status;
  }
  if (normalized.currentAssetId === undefined && normalized.currentMediaId !== undefined) {
    normalized.currentAssetId = normalized.currentMediaId;
  }
  if (normalized.currentAssetIds === undefined && Array.isArray(normalized.currentMediaIds)) {
    normalized.currentAssetIds = normalized.currentMediaIds;
  }
  if (normalized.playbackState === undefined) {
    normalized.playbackState = normalized.currentAssetId || normalized.currentMediaId ? 'PLAYING' : 'IDLE';
  }
  if (normalized.playbackError === undefined && normalized.lastPlaybackError !== undefined) {
    normalized.playbackError = normalized.lastPlaybackError;
  }
  if (normalized.decoderError === undefined && normalized.lastDecoderError !== undefined) {
    normalized.decoderError = normalized.lastDecoderError;
  }

  return normalized;
};

export const buildNativeDiagnostics = (screen: any) => {
  const config = asObject(screen?.config);
  const telemetry = normalizeHeartbeatTelemetry(config.telemetry);
  const commandHistory = Array.isArray(config.commandHistory) ? config.commandHistory : [];
  const pendingCommands = Array.isArray(config.pendingCommands) ? config.pendingCommands : [];
  const supportBundle = config.supportBundle && typeof config.supportBundle === 'object' ? config.supportBundle : null;
  const lastCommand = commandHistory[0] || null;
  const freeStorageBytes = telemetry.freeStorageBytes ?? screen?.freeDiskSpace ?? null;
  const totalStorageBytes = telemetry.totalStorageBytes ?? screen?.totalDiskSpace ?? null;
  const memoryUsedBytes = telemetry.memoryUsedBytes ?? screen?.usedMemory ?? null;
  const memoryTotalBytes = telemetry.memoryTotalBytes ?? screen?.totalMemory ?? null;

  return {
    isNativePlayer: !!telemetry.platform?.toString().includes('native') || screen?.playerType === 'Android',
    supportedCommands: getSupportedNativeCommands(),
    platform: telemetry.platform ?? screen?.playerType ?? null,
    deviceOwnerState: telemetry.deviceOwnerState ?? 'UNKNOWN',
    playbackState: telemetry.playbackState ?? 'UNKNOWN',
    downloadState: telemetry.downloadState ?? 'UNKNOWN',
    currentAssetId: telemetry.currentAssetId ?? null,
    currentAssetIds: Array.isArray(telemetry.currentAssetIds) ? telemetry.currentAssetIds : [],
    currentPlaylistId: telemetry.currentPlaylistId ?? screen?.activePlaylistId ?? null,
    lastSuccessfulPlaybackAt: telemetry.lastSuccessfulPlaybackAt ?? null,
    lastSuccessfulAssetId: telemetry.lastSuccessfulAssetId ?? null,
    playbackError: telemetry.playbackError ?? null,
    decoderError: telemetry.decoderError ?? null,
    lastDownloadError: telemetry.lastDownloadError ?? telemetry.downloadProgress?.lastError ?? null,
    freeStorageBytes,
    totalStorageBytes,
    memoryUsedBytes,
    memoryTotalBytes,
    cachedAssetCount: Array.isArray(telemetry.cachedFiles) ? telemetry.cachedFiles.length : null,
    downloadProgress: telemetry.downloadProgress ?? null,
    kioskEnabled: telemetry.kioskEnabled ?? null,
    startOnBoot: telemetry.startOnBoot ?? null,
    apiBase: telemetry.apiBase ?? null,
    device: telemetry.device ?? null,
    androidVersion: telemetry.androidVersion ?? null,
    appVersion: screen?.appVersion ?? telemetry.appVersion ?? null,
    lastTelemetryAt: screen?.lastTelemetryAt ?? telemetry.lastTelemetryAt ?? null,
    commandQueueDepth: pendingCommands.length,
    supportBundle: supportBundle
      ? {
          fileName: supportBundle.fileName ?? null,
          url: supportBundle.url ?? null,
          contentType: supportBundle.contentType ?? null,
          sizeBytes: supportBundle.sizeBytes ?? null,
          uploadedAt: supportBundle.uploadedAt ?? null
        }
      : null,
    lastCommand: lastCommand
      ? {
          id: lastCommand.id ?? null,
          type: lastCommand.type ?? null,
          status: lastCommand.status ?? null,
          message: lastCommand.message ?? null,
          updatedAt: lastCommand.updatedAt ?? lastCommand.createdAt ?? null
        }
      : null
  };
};

export const buildNativePlaybackManifest = (screen: any, content: any) => {
  const diagnostics = buildNativeDiagnostics(screen);
  const playlist = content?.playlist || null;
  const zones = Array.isArray(playlist?.zones) ? playlist.zones : [];
  const assets = zones
    .flatMap((zone: any) => Array.isArray(zone.items) ? zone.items : [])
    .map((item: any) => item.media)
    .filter((media: any) => media && typeof media.id === 'string');

  const assetMap = new Map<string, any>();
  assets.forEach((media: any) => {
    if (assetMap.has(media.id)) return;
    assetMap.set(media.id, {
      id: media.id,
      name: media.name ?? media.filename ?? null,
      filename: media.filename ?? media.name ?? null,
      mimeType: media.mimeType ?? null,
      sizeBytes: media.sizeBytes ?? null,
      sha256: media.sha256 ?? null,
      url: media.url ?? null,
      updatedAt: media.updatedAt ?? null
    });
  });

  return {
    version: 'native-playback-manifest-v1',
    generatedAt: new Date().toISOString(),
    screen: {
      id: screen.id,
      name: screen.name,
      orientation: screen.orientation,
      playerType: screen.playerType,
      location: content?.location ?? null,
      latitude: content?.latitude ?? null,
      longitude: content?.longitude ?? null
    },
    playback: {
      playlist,
      currentPlaylistId: diagnostics.currentPlaylistId,
      currentAssetId: diagnostics.currentAssetId,
      currentAssetIds: diagnostics.currentAssetIds,
      state: diagnostics.playbackState
    },
    policy: {
      kioskEnabled: diagnostics.kioskEnabled,
      startOnBoot: diagnostics.startOnBoot,
      deviceOwnerState: diagnostics.deviceOwnerState,
      apiBase: diagnostics.apiBase
    },
    widgets: {
      weatherApiKey: content?.weatherApiKey ?? null,
      newsFeedUrls: Array.isArray(content?.newsFeedUrls) ? content.newsFeedUrls : []
    },
    assets: [...assetMap.values()],
    diagnostics,
    commands: {
      supported: getSupportedNativeCommands()
    }
  };
};

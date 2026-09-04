export interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  duration?: number; // for videos
  type: 'IMAGE' | 'VIDEO';
}

export interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ZoneItem {
  id: string;
  mediaId?: string;
  media?: MediaFile;
  order: number;
  duration: number;
  type?: 'MEDIA' | 'WIDGET' | 'AD_SLOT';
  vastUrl?: string;
  vastTimeoutMs?: number;
  startDate?: Date;
  endDate?: Date;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: string;
  widget?: {
    widgetId?: string;
    id: string;
    name: string;
    type: 'TIME_DATE' | 'ANALOG_CLOCK' | 'WEATHER' | 'NEWS' | 'QR_CODE' | 'COUNT_DOWN' | 'YOUTUBE';
    config: import('./widget').WidgetConfig;
  };
}

export interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rotation: number;
  items: ZoneItem[];
}

export interface PlaylistEditorState {
  id: string;
  name: string;
  resolution: string;
  canvasWidth: number;
  canvasHeight: number;
  orientation: 'LANDSCAPE' | 'PORTRAIT' | 'CUSTOM';
  zones: Zone[];
}

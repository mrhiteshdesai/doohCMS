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

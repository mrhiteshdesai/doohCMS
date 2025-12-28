import api from './api';

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
  _count?: {
    items: number;
  };
  // We might want to compute screenCount on the frontend if backend doesn't provide it directly,
  // or the backend will provide it in a different property.
  // For now let's assume backend returns it or we treat it as 0 if missing.
  screenCount?: number; 
}

export const getPlaylists = async (params?: { search?: string; sortField?: string; sortDir?: string }) => {
  const response = await api.get<Playlist[]>('/playlists', { params });
  return response.data;
};

export const createPlaylist = async (data: { name: string; description?: string; layoutId?: string }) => {
  const response = await api.post<Playlist>('/playlists', data);
  return response.data;
};

export const getPlaylist = async (id: string) => {
  const response = await api.get<any>(`/playlists/${id}`);
  return response.data;
};

export const updatePlaylist = async (id: string, data: any) => {
  const response = await api.put(`/playlists/${id}`, data);
  return response.data;
};

export const deletePlaylist = async (id: string) => {
  const response = await api.delete(`/playlists/${id}`);
  return response.data;
};

export const bulkDeletePlaylists = async (ids: string[]) => {
  const response = await api.post('/playlists/bulk-delete', { ids });
  return response.data;
};

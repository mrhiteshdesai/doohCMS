import api from './api';

export interface ScreenGroup {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  screenCount: number;
  createdAt: string;
}

export interface ScreenGroupDetail extends ScreenGroup {
  screens: any[]; // Replace with Screen type
}

export const getGroups = async () => {
  const response = await api.get('/screen-groups');
  return response.data;
};

export const getGroupById = async (id: string) => {
  const response = await api.get(`/screen-groups/${id}`);
  return response.data;
};

export const createGroup = async (data: { name: string; description?: string; tags?: string[] }) => {
  const response = await api.post('/screen-groups', data);
  return response.data;
};

export const updateGroup = async (id: string, data: { name?: string; description?: string; tags?: string[] }) => {
  const response = await api.put(`/screen-groups/${id}`, data);
  return response.data;
};

export const deleteGroup = async (id: string) => {
  await api.delete(`/screen-groups/${id}`);
};

export const assignScreens = async (id: string, screenIds: string[]) => {
  const response = await api.post(`/screen-groups/${id}/screens`, { screenIds });
  return response.data;
};

export const publishToGroup = async (groupId: string, playlistId: string) => {
  const response = await api.post(`/screen-groups/${groupId}/publish`, { playlistId });
  return response.data;
};

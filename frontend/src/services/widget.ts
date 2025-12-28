import api from './api';
import { Widget } from '../types/widget';

export const getWidgets = async () => {
  const response = await api.get('/widgets');
  return response.data;
};

export const getWidget = async (id: string) => {
  const response = await api.get(`/widgets/${id}`);
  return response.data;
};

export const createWidget = async (data: Omit<Widget, 'id' | 'createdAt' | 'updatedAt'>) => {
  const response = await api.post('/widgets', data);
  return response.data;
};

export const updateWidget = async (id: string, data: Partial<Widget>) => {
  const response = await api.put(`/widgets/${id}`, data);
  return response.data;
};

export const deleteWidget = async (id: string) => {
  const response = await api.delete(`/widgets/${id}`);
  return response.data;
};

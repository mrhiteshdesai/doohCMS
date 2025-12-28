import api from './api';
import { Layout, CreateLayoutData, UpdateLayoutData } from '../types/layout';

export const getLayouts = async (params?: { search?: string; sortField?: string; sortDir?: string }) => {
  const response = await api.get<Layout[]>('/layouts', { params });
  return response.data;
};

export const createLayout = async (data: CreateLayoutData) => {
  const response = await api.post<Layout>('/layouts', data);
  return response.data;
};

export const getLayoutById = async (id: string) => {
  const response = await api.get<Layout>(`/layouts/${id}`);
  return response.data;
};

export const updateLayout = async (id: string, data: UpdateLayoutData) => {
  const response = await api.put<Layout>(`/layouts/${id}`, data);
  return response.data;
};

export const deleteLayout = async (id: string) => {
  const response = await api.delete(`/layouts/${id}`);
  return response.data;
};

export const bulkDeleteLayouts = async (ids: string[]) => {
  const response = await api.post('/layouts/bulk-delete', { ids });
  return response.data;
};

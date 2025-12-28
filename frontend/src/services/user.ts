import api from './api';

export interface Role {
  id: string;
  name: string;
  permissions: string; // JSON string or '*'
}

export interface User {
  id: string;
  name: string;
  email: string;
  userRoles: { role: Role }[];
  permissions?: string; // JSON string override
  createdAt: string;
  isActive: boolean;
}

export const getUsers = async (): Promise<User[]> => {
  const response = await api.get('/users');
  return response.data;
};

export const createUser = async (data: any) => {
  const response = await api.post('/users', data);
  return response.data;
};

export const updateUser = async (id: string, data: any) => {
  const response = await api.put(`/users/${id}`, data);
  return response.data;
};

export const deleteUser = async (id: string) => {
  const response = await api.delete(`/users/${id}`);
  return response.data;
};

export const getRoles = async (): Promise<Role[]> => {
  const response = await api.get('/users/roles');
  return response.data;
};

export const getProfile = async (): Promise<User> => {
  const response = await api.get('/users/profile');
  return response.data;
};

export const updateProfile = async (data: { name?: string; password?: string }) => {
  const response = await api.put('/users/profile', data);
  return response.data;
};

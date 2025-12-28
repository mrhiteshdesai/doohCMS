import api from './api';

export const login = async (data: any) => {
  const response = await api.post('/auth/login', data);
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
  }
  return response.data;
};

export const registerTenant = async (data: any) => {
  const response = await api.post('/auth/register', data);
  return response.data;
};

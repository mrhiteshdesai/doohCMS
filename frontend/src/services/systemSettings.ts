import api from './api';

export interface SystemSettings {
  storage: {
    provider: 'local' | 's3';
    bucket?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
  };
}

export const getSystemSettings = async (): Promise<SystemSettings> => {
  const response = await api.get('/system-settings');
  return response.data;
};

export const updateSystemSettings = async (settings: Partial<SystemSettings>): Promise<void> => {
  await api.put('/system-settings', settings);
};

import api from './api';

export interface SystemSettings {
  storage: {
    provider: 'local' | 's3';
    bucket?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;
    hasAccessKeyId?: boolean;
    hasSecretAccessKey?: boolean;
  };
  cdn?: {
    enabled: boolean;
    baseUrl: string;
  };
  traffic?: {
    downloadJitter: number; // in seconds
  };
}

export const getSystemSettings = async (): Promise<SystemSettings> => {
  const response = await api.get('/system-settings');
  return response.data;
};

export const updateSystemSettings = async (settings: Partial<SystemSettings>): Promise<void> => {
  await api.put('/system-settings', settings);
};

export const getRetentionPolicies = async (): Promise<Record<string, number>> => {
  const response = await api.get('/system-settings/retention');
  return response.data;
};

export const updateRetentionPolicy = async (tableName: string, days: number): Promise<void> => {
  await api.post('/system-settings/retention', { tableName, days });
};

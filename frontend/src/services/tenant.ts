import api from './api';

export interface TenantSettings {
  name: string;
  config: {
    // General & Branding
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    playerBranding?: boolean;
    supportContact?: string;
    
    // Player Customization
    player?: {
      backgroundColor?: string;
      codeBlock?: {
        backgroundColor?: string;
        borderColor?: string;
        borderWidth?: number;
      };
      systemInfo?: {
        backgroundColor?: string;
        textColor?: string;
      };
      rightSide?: {
        title?: string;
        titleColor?: string;
        subtitle?: string;
        subtitleColor?: string;
      };
    };
    
    // Regional & Defaults
    timezone?: string;
    dateFormat?: string;
    timeFormat?: '12h' | '24h';
    defaultDuration?: number;
    defaultOrientation?: 'LANDSCAPE' | 'PORTRAIT';
    
    // Integrations
    weatherApiKey?: string;
    googleMapsApiKey?: string;
    newsFeedUrls?: string[];
    
    // Player Management
    defaultPlaylistId?: string;
    heartbeatInterval?: number;
    dailyReboot?: boolean;
    rebootTime?: string;
    sleepSchedule?: {
      enabled: boolean;
      sleepTime: string;
      wakeTime: string;
    };
    offlineAlertThreshold?: number;
    
    // Storage & Maintenance
    autoCleanup?: boolean;
    cleanupDays?: number;
  };
}

export const getTenantSettings = async (): Promise<TenantSettings> => {
  const response = await api.get('/tenant/settings');
  return response.data;
};

export const getPublicBranding = async (): Promise<any> => {
  const response = await api.get('/tenant/branding');
  return response.data;
};

export const updateTenantSettings = async (settings: Partial<TenantSettings> | any): Promise<TenantSettings> => {
  const response = await api.put('/tenant/settings', settings);
  return response.data;
};

export const uploadLogo = async (file: Blob, filename: string = 'logo.png'): Promise<string> => {
  const formData = new FormData();
  formData.append('files', file, filename);
  // Correct endpoint is /library/upload (mapped to /api/library/upload)
  const response = await api.post('/library/upload', formData);
  return response.data[0].url;
};

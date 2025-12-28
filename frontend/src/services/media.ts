import api from './api';
import { AxiosProgressEvent } from 'axios';

export const getLibrary = async (folderId?: string) => {
  const params = folderId ? { folderId } : {};
  const response = await api.get('/library', { params });
  return response.data;
};

export const getAllFolders = async () => {
  const response = await api.get('/library/folders');
  return response.data;
};

export const createFolder = async (name: string, parentId?: string | null) => {
  const response = await api.post('/library/folders', { name, parentId });
  return response.data;
};

export const uploadFiles = async (
  files: File[], 
  folderId?: string | null,
  onProgress?: (progress: number) => void,
  metadata?: any[]
) => {
  const formData = new FormData();
  
  if (folderId) {
    formData.append('folderId', folderId);
  }

  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata));
  }

  files.forEach(file => {
    formData.append('files', file);
  });
  
  const response = await api.post('/library/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        if (onProgress) {
          onProgress(percentCompleted);
        }
      }
    },
  });
  return response.data;
};

export const deleteFile = async (id: string) => {
  const response = await api.delete(`/library/files/${id}`);
  return response.data;
};

export const updateFile = async (id: string, data: any) => {
  const response = await api.put(`/library/files/${id}`, data);
  return response.data;
};

export const deleteFolder = async (id: string) => {
  const response = await api.delete(`/library/folders/${id}`);
  return response.data;
};

export const updateFolder = async (id: string, data: any) => {
  const response = await api.put(`/library/folders/${id}`, data);
  return response.data;
};

export const bulkDelete = async (fileIds: string[], folderIds: string[]) => {
  const response = await api.post('/library/bulk/delete', { fileIds, folderIds });
  return response.data;
};

export const bulkMove = async (fileIds: string[], folderIds: string[], targetFolderId: string | null) => {
  const response = await api.post('/library/bulk/move', { fileIds, folderIds, targetFolderId });
  return response.data;
};

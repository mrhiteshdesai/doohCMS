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

export const getPresignedUrl = async (filename: string, contentType: string) => {
  const response = await api.post('/library/presigned-url', { filename, contentType });
  return response.data;
};

export const registerFile = async (data: any) => {
  const response = await api.post('/library/register', data);
  return response.data;
};

export const uploadToS3 = async (url: string, file: File, contentType: string, onProgress?: (progress: number) => void) => {
  return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', contentType);
      
      xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              onProgress(percentComplete);
          }
      };
      
      xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
              resolve(true);
          } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
          }
      };
      
      xhr.onerror = () => reject(new Error('Upload failed'));
      
      xhr.send(file);
  });
};
export const getFiles = async (folderId?: string, search?: string) => {
    const params: any = {};
    if (folderId) params.folderId = folderId;
    if (search) params.search = search;
    const response = await api.get('/library', { params });
    // Assuming the response structure is { folders: [], files: [] } or just files depending on endpoint
    // But getLibrary returns { folders, files }. This function seems redundant or specific.
    // Let's check getLibrary usage.
    // Actually mediaController.getLibrary handles both.
    return response.data.files;
};
export const getFolders = getAllFolders; // Alias if needed

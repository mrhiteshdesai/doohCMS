import { Request, Response } from 'express';
import * as mediaService from '../services/mediaService';

export const uploadFiles = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;

    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      console.error('No files uploaded');
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const uploadedFiles = [];
    const files = req.files as Express.Multer.File[];

    // Parse metadata if present
    let metadataMap: Record<string, any> = {};
    if (req.body.metadata) {
      try {
        const metadataList = JSON.parse(req.body.metadata);
        if (Array.isArray(metadataList)) {
            metadataList.forEach((m: any) => {
                if (m && m.name) {
                    metadataMap[m.name] = m;
                }
            });
        }
      } catch (e) {
        console.error("Failed to parse metadata", e);
      }
    }

    for (const file of files) {
      // Construct URL
      const url = `/uploads/${file.filename}`;
      
      const meta = metadataMap[file.originalname] || {};

      const fileData = {
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        url: url,
        folderId: req.body.folderId || undefined,
        width: meta.width,
        height: meta.height,
        duration: meta.duration
      };

      const savedFile = await mediaService.createFile(tenantId, fileData);
      uploadedFiles.push(savedFile);
    }

    res.status(201).json(uploadedFiles);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const createFolder = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const folder = await mediaService.createFolder(tenantId, req.body);
    res.status(201).json(folder);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getAllFolders = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const folders = await mediaService.getFolders(tenantId);
    res.json(folders);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getLibrary = async (req: Request, res: Response) => {
  try {
    const { tenantId } = (req as any).user;
    const { folderId, search } = req.query;
    
    const files = await mediaService.getFiles(tenantId, folderId as string, search as string);
    const allFolders = await mediaService.getFolders(tenantId); 
    
    const targetFolderId = (folderId as string) || null;
    const currentFolders = allFolders.filter(f => f.parentId === targetFolderId);

    res.json({ folders: currentFolders, files });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateFile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId } = (req as any).user;
    const file = await mediaService.updateFile(id, tenantId, req.body);
    res.json(file);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId } = (req as any).user;
    await mediaService.deleteFile(id, tenantId);
    res.json({ message: 'File deleted' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateFolder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId } = (req as any).user;
    const folder = await mediaService.updateFolder(id, tenantId, req.body);
    res.json(folder);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId } = (req as any).user;
    await mediaService.deleteFolder(id, tenantId);
    res.status(200).json({ message: 'Folder deleted' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const bulkDelete = async (req: Request, res: Response) => {
  try {
    const { fileIds = [], folderIds = [] } = req.body;
    const { tenantId } = (req as any).user;
    
    await mediaService.bulkDelete(tenantId, fileIds, folderIds);
    res.status(200).json({ message: 'Items deleted' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const bulkMove = async (req: Request, res: Response) => {
  try {
    const { fileIds = [], folderIds = [], targetFolderId } = req.body;
    const { tenantId } = (req as any).user;
    
    await mediaService.bulkMove(tenantId, fileIds, folderIds, targetFolderId);
    res.status(200).json({ message: 'Items moved' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

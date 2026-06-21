import { getFullUrl } from '../utils/url';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Folder, 
  FileVideo, 
  Upload, 
  Plus, 
  Trash2, 
  Edit2, 
  ArrowLeft,
  Search,
  Grid,
  List as ListIcon,
  Eye,
  X,
  FileText,
  CheckSquare,
  Square,
  Move,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import * as mediaService from '../services/media';
import PermissionGuard from '../components/PermissionGuard';

interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
}

interface MediaFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt?: string;
  width?: number;
  height?: number;
  duration?: number;
}

interface FolderNode extends MediaFolder {
  children: FolderNode[];
}

const FolderTreeItem = ({ 
  node, 
  selectedId, 
  onSelect, 
  disabledIds,
  level = 0 
}: { 
  node: FolderNode, 
  selectedId: string | null, 
  onSelect: (id: string | null) => void,
  disabledIds: Set<string>,
  level?: number
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isDisabled = disabledIds.has(node.id);

  return (
    <div>
      <div 
        className={`
          flex items-center p-2 rounded cursor-pointer transition-colors
          ${selectedId === node.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => !isDisabled && onSelect(node.id)}
      >
        <div 
          className={`p-1 mr-1 rounded hover:bg-gray-200 cursor-pointer ${hasChildren ? 'visible' : 'invisible'}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <Folder size={18} className={`mr-2 ${selectedId === node.id ? 'text-blue-600' : 'text-yellow-500'}`} />
        <span className="truncate font-medium">{node.name}</span>
      </div>
      
      {isOpen && hasChildren && (
        <div className="border-l border-gray-200 ml-5">
          {node.children.map(child => (
            <FolderTreeItem 
              key={child.id} 
              node={child} 
              selectedId={selectedId} 
              onSelect={onSelect} 
              disabledIds={disabledIds}
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Library = () => {
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<{id: string | null, name: string}[]>([{id: null, name: 'Home'}]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [showRename, setShowRename] = useState(false);
  const [renameItem, setRenameItem] = useState<{id: string, type: 'folder' | 'file', name: string} | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaFile | null>(null);

  // Bulk Actions
  const [selectedItems, setSelectedItems] = useState<{id: string, type: 'folder' | 'file'}[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null);
  const [allFolders, setAllFolders] = useState<FolderNode[]>([]); // For move picker
  const [disabledMoveTargetIds, setDisabledMoveTargetIds] = useState<Set<string>>(new Set());

  // Upload
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    fetchLibrary();
  }, [currentFolderId]);

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const data = await mediaService.getLibrary(currentFolderId || undefined);
      setFolders(data.folders);
      setFiles(data.files);
    } catch (error) {
      console.error('Failed to fetch library', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (folderId: string | null, folderName: string) => {
    setCurrentFolderId(folderId);
    setFolderHistory([...folderHistory, { id: folderId, name: folderName }]);
    setSearchQuery(''); // Clear search on navigation
  };

  const handleNavigateUp = () => {
    if (folderHistory.length <= 1) return;
    const newHistory = [...folderHistory];
    newHistory.pop(); // Remove current
    const parent = newHistory[newHistory.length - 1];
    setCurrentFolderId(parent.id);
    setFolderHistory(newHistory);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newHistory = folderHistory.slice(0, index + 1);
    const target = newHistory[newHistory.length - 1];
    setCurrentFolderId(target.id);
    setFolderHistory(newHistory);
  };

  const handleCreateFolder = async () => {
    if (!newItemName.trim()) return;
    try {
      await mediaService.createFolder(newItemName, currentFolderId);
      setNewItemName('');
      setShowNewFolder(false);
      fetchLibrary();
    } catch (error) {
      alert('Failed to create folder');
    }
  };

  const processFiles = async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList);
    if (filesToUpload.length === 0) return;
    
    setLoading(true);
    setUploadProgress(0);

    // Helper functions for metadata extraction
    const getImageDimensions = (file: File): Promise<{ width: number, height: number }> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = URL.createObjectURL(file);
      });
    };

    const getVideoInfo = (file: File): Promise<{ width: number, height: number, duration: number }> => {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
          URL.revokeObjectURL(video.src);
        };
        video.onerror = () => resolve({ width: 0, height: 0, duration: 0 });
        video.src = URL.createObjectURL(file);
      });
    };

    // Extract metadata
    const metadata: any[] = [];
    for (const file of filesToUpload) {
      if (file.type.startsWith('image/')) {
        const dims = await getImageDimensions(file);
        metadata.push({ name: file.name, ...dims });
      } else if (file.type.startsWith('video/')) {
        const info = await getVideoInfo(file);
        metadata.push({ name: file.name, ...info });
      } else {
        metadata.push({ name: file.name });
      }
    }
    
    try {
      // Try to upload using S3 Presigned URLs first
      let useLegacy = false;
      
      try {
          // Check if S3 is configured by requesting a URL for the first file
          // We don't use this URL, just checking configuration
          await mediaService.getPresignedUrl(filesToUpload[0].name, filesToUpload[0].type);
      } catch (e: any) {
          // If 400 (Bad Request), likely "S3 storage is not configured"
          if (e.response && e.response.status === 400) {
              useLegacy = true;
          } else {
              throw e; // Real error (network, 500, etc)
          }
      }

      if (useLegacy) {
          await mediaService.uploadFiles(
            filesToUpload, 
            currentFolderId,
            (progress) => setUploadProgress(progress),
            metadata
          );
      } else {
          // S3 Direct Upload Flow
          for (let i = 0; i < filesToUpload.length; i++) {
              const file = filesToUpload[i];
              const fileMeta = metadata[i];
              
              // 1. Get Presigned URL
              const { uploadUrl, key } = await mediaService.getPresignedUrl(file.name, file.type);
              
              // 2. Upload to S3
              await mediaService.uploadToS3(uploadUrl, file, file.type, (pct) => {
                  const globalPct = Math.round(((i * 100) + pct) / filesToUpload.length);
                  setUploadProgress(globalPct);
              });

              // 3. Register File
              await mediaService.registerFile({
                  key,
                  filename: file.name,
                  size: file.size,
                  mimeType: file.type,
                  folderId: currentFolderId,
                  metadata: fileMeta
              });
          }
      }

      fetchLibrary();
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || 'Failed to upload files');
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    await processFiles(e.target.files);
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  }, [currentFolderId]);

  // Delete confirmation modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    item: { id: string; type: 'folder' | 'file'; name: string } | null;
    usageData: any[] | null;
    error: string | null;
  }>({
    isOpen: false,
    item: null,
    usageData: null,
    error: null
  });

  const handleDelete = async (id: string, type: 'folder' | 'file', name?: string) => {
    // Only file deletions trigger the detailed check initially if we want to be safe,
    // but the backend logic is specific to files. Folders are less risky or handled differently.
    // For now, we'll try to delete and catch the specific 409 error.
    
    // Optimistic confirmation for folders or simple delete
    if (!window.confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) return;

    try {
      if (type === 'folder') {
        await mediaService.deleteFolder(id);
      } else {
        await mediaService.deleteFile(id);
      }
      fetchLibrary();
    } catch (error: any) {
      if (type === 'file' && error.response && error.response.status === 409 && error.response.data.code === 'MEDIA_IN_USE') {
         // Show usage modal
         setDeleteConfirmation({
            isOpen: true,
            item: { id, type, name: name || 'File' },
            usageData: error.response.data.playlists,
            error: null
         });
      } else {
        alert(`Failed to delete ${type}: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const closeDeleteModal = () => {
    setDeleteConfirmation({ isOpen: false, item: null, usageData: null, error: null });
  };


  const handleRenameClick = (id: string, type: 'folder' | 'file', name: string) => {
    setRenameItem({ id, type, name });
    setShowRename(true);
  };

  const handleRenameSubmit = async () => {
    if (!renameItem || !renameItem.name.trim()) return;
    try {
      if (renameItem.type === 'folder') {
        await mediaService.updateFolder(renameItem.id, { name: renameItem.name });
      } else {
        await mediaService.updateFile(renameItem.id, { name: renameItem.name });
      }
      setShowRename(false);
      setRenameItem(null);
      fetchLibrary();
    } catch (error) {
      alert('Failed to rename item');
    }
  };

  const handlePreviewClick = (file: MediaFile) => {
    setPreviewItem(file);
  };

  // Bulk Actions
  const toggleSelection = (id: string, type: 'folder' | 'file') => {
    setSelectedItems(prev => {
      const exists = prev.find(item => item.id === id);
      if (exists) {
        return prev.filter(item => item.id !== id);
      }
      return [...prev, { id, type }];
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredFolders.length + filteredFiles.length) {
      setSelectedItems([]);
    } else {
      const newSelection = [
        ...filteredFolders.map(f => ({ id: f.id, type: 'folder' as const })),
        ...filteredFiles.map(f => ({ id: f.id, type: 'file' as const }))
      ];
      setSelectedItems(newSelection);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedItems.length} items? This action cannot be undone.`)) return;
    
    try {
      const fileIds = selectedItems.filter(i => i.type === 'file').map(i => i.id);
      const folderIds = selectedItems.filter(i => i.type === 'folder').map(i => i.id);
      
      const response = await mediaService.bulkDelete(fileIds, folderIds);
      
      // If backend returns result with errors/blocked files
      if (response && response.result && response.result.errors && response.result.errors.length > 0) {
        // Filter out errors that are simply "In use" to show special modal
        const inUseErrors = response.result.errors.filter((e: any) => e.playlists && e.playlists.length > 0);
        
        if (inUseErrors.length > 0) {
            setDeleteConfirmation({
                isOpen: true,
                item: { id: 'bulk', type: 'file', name: `${inUseErrors.length} files` },
                usageData: inUseErrors.map((e: any) => ({
                    name: e.name,
                    playlists: e.playlists
                })),
                error: null
            });
        }
        
        // Show alert for other errors if any
        const otherErrors = response.result.errors.filter((e: any) => !e.playlists);
        if (otherErrors.length > 0) {
            alert(`Some items could not be deleted: ${otherErrors.map((e: any) => e.reason).join(', ')}`);
        }
      }

      setSelectedItems([]);
      fetchLibrary();
    } catch (error: any) {
       // Fallback for older backend or network errors
      alert('Failed to delete items: ' + (error.message || 'Unknown error'));
    }
  };

  const openMoveModal = async () => {
    try {
      const folders = await mediaService.getAllFolders();
      
      // Build Tree
      const folderMap = new Map<string, FolderNode>();
      const roots: FolderNode[] = [];

      // Initialize nodes
      folders.forEach((f: MediaFolder) => {
        folderMap.set(f.id, { ...f, children: [] });
      });

      // Build hierarchy
      folders.forEach((f: MediaFolder) => {
        const node = folderMap.get(f.id)!;
        if (f.parentId && folderMap.has(f.parentId)) {
          const parent = folderMap.get(f.parentId)!;
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      });
      
      setAllFolders(roots);

      // Calculate disabled IDs (folders being moved and their descendants)
      const selectedFolderIds = selectedItems.filter(i => i.type === 'folder').map(i => i.id);
      const disabledIds = new Set<string>(selectedFolderIds);
      
      // Recursive helper to disable children
      const disableChildren = (node: FolderNode) => {
        if (disabledIds.has(node.id)) {
          // If parent is disabled, children are effectively disabled too, 
          // but let's explicitly add them for clarity if we want to gray them out individually
          // Or just logic: if we are moving Folder A, we can't move it into Folder A or A's children.
          // The tree traversal will handle finding the descendants.
        }
        
        // Actually, we need to find descendants of selected folders in the map
        if (disabledIds.has(node.id)) {
           // This node is selected, so all its children should be disabled
           const stack = [...node.children];
           while(stack.length > 0) {
             const child = stack.pop()!;
             disabledIds.add(child.id);
             stack.push(...child.children);
           }
        } else {
           // Continue searching down
           node.children.forEach(disableChildren);
        }
      };

      roots.forEach(disableChildren);
      setDisabledMoveTargetIds(disabledIds);

      setShowMoveModal(true);
    } catch (error) {
      console.error('Failed to fetch folders for move', error);
    }
  };

  const handleBulkMove = async () => {
    try {
      const fileIds = selectedItems.filter(i => i.type === 'file').map(i => i.id);
      const folderIds = selectedItems.filter(i => i.type === 'folder').map(i => i.id);
      
      await mediaService.bulkMove(fileIds, folderIds, moveTargetFolderId);
      setShowMoveModal(false);
      setSelectedItems([]);
      fetchLibrary();
    } catch (error) {
      alert('Failed to move items');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter items based on search query
  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div 
      className="p-6 h-full min-h-screen relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-blue-500/20 border-4 border-blue-500 border-dashed z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white p-8 rounded-xl shadow-lg flex flex-col items-center animate-bounce">
            <Upload size={48} className="text-blue-600 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800">Drop files to upload</h2>
          </div>
        </div>
      )}

      {/* Upload Progress Overlay */}
      {uploadProgress !== null && (
        <div className="fixed bottom-6 right-6 bg-white p-4 rounded-lg shadow-lg z-50 w-80 border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-gray-800">Uploading files...</h3>
            <span className="text-sm text-gray-500">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Media Library</h1>
        <div className="flex space-x-2">
          <PermissionGuard module="media" action="write">
            <label className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition shadow-sm">
              <Upload size={20} />
              <span>Upload</span>
              <input 
                type="file" 
                className="hidden" 
                onChange={handleUpload} 
                multiple 
                accept="image/*,video/*" 
              />
            </label>
          </PermissionGuard>
          <PermissionGuard module="media" action="write">
            <button 
              onClick={() => setShowNewFolder(true)}
              className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg transition shadow-sm"
            >
              <Plus size={20} />
              <span>New Folder</span>
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Breadcrumbs & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 gap-4 min-h-[72px]">
        {selectedItems.length > 0 ? (
          <div className="flex items-center space-x-4 w-full animate-fade-in">
            <div className="flex items-center space-x-2">
              <button onClick={() => setSelectedItems([])} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                <X size={20} />
              </button>
              <span className="font-bold text-gray-800">{selectedItems.length} selected</span>
            </div>
            
            <div className="flex-1"></div>
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 px-3 font-medium"
              >
                {selectedItems.length === filteredFolders.length + filteredFiles.length ? 'Deselect All' : 'Select All'}
              </button>
              <div className="h-6 w-px bg-gray-300 mx-2"></div>
              <PermissionGuard module="media" action="write">
                <button 
                  onClick={openMoveModal}
                  className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg transition"
                >
                  <Move size={18} />
                  <span className="hidden sm:inline">Move</span>
                </button>
              </PermissionGuard>
              <PermissionGuard module="media" action="write">
                <button 
                  onClick={handleBulkDelete}
                  className="flex items-center space-x-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg transition"
                >
                  <Trash2 size={18} />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </PermissionGuard>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-2 text-sm text-gray-600 overflow-x-auto">
              {folderHistory.length > 1 && (
                <button onClick={handleNavigateUp} className="p-1 hover:bg-gray-100 rounded-full">
                  <ArrowLeft size={16} />
                </button>
              )}
              {folderHistory.map((folder, index) => (
                <div key={folder.id || 'root'} className="flex items-center whitespace-nowrap">
                  {index > 0 && <span className="mx-2">/</span>}
                  <button 
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`hover:text-blue-600 ${index === folderHistory.length - 1 ? 'font-bold text-gray-900' : ''}`}
                  >
                    {folder.name}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full md:w-64">
                <Search size={18} className="text-gray-500 mr-2" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent outline-none flex-1 text-sm"
                />
              </div>
              <div className="flex items-center space-x-2 border-l pl-4">
                <button 
                  onClick={() => setViewMode('grid')} 
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                >
                  <Grid size={20} />
                </button>
                <button 
                  onClick={() => setViewMode('list')} 
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                >
                  <ListIcon size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Content Area */}
      {loading && !uploadProgress ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Upload size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium">This folder is empty</p>
          <p className="text-sm">Drag and drop files to upload</p>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredFolders.map(folder => (
                <div 
                  key={folder.id}
                  className={`
                    group relative border rounded-lg p-4 cursor-pointer hover:shadow-md transition bg-yellow-50 border-yellow-100 flex flex-col items-center text-center
                    ${selectedItems.find(i => i.id === folder.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                  `}
                  onClick={() => handleNavigate(folder.id, folder.name)}
                >
                  <div 
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => { e.stopPropagation(); toggleSelection(folder.id, 'folder'); }}
                  >
                     {selectedItems.find(i => i.id === folder.id) ? (
                        <CheckSquare className="text-blue-600 bg-white rounded" size={20} />
                     ) : (
                        <Square className="text-gray-400 opacity-0 group-hover:opacity-100 bg-white rounded" size={20} />
                     )}
                  </div>
                  <div className="mb-2">
                    <Folder size={48} className="text-yellow-500" />
                  </div>
                  <span className="font-medium text-gray-700 truncate w-full">{folder.name}</span>
                  
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 bg-white/90 rounded p-1 shadow-sm z-10">
                    <PermissionGuard module="media" action="write">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRenameClick(folder.id, 'folder', folder.name); }}
                        className="p-1 hover:bg-blue-100 text-blue-600 rounded"
                        title="Rename"
                      >
                        <Edit2 size={16} />
                      </button>
                    </PermissionGuard>
                    <PermissionGuard module="media" action="write">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(folder.id, 'folder'); }}
                        className="p-1 hover:bg-red-100 text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </PermissionGuard>
                  </div>
                </div>
              ))}

              {filteredFiles.map(file => (
                <div 
                  key={file.id}
                  className={`
                    group relative border rounded-lg p-4 cursor-pointer hover:shadow-md transition bg-white overflow-hidden flex flex-col items-center text-center
                    ${selectedItems.find(i => i.id === file.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                  `}
                  onClick={() => handlePreviewClick(file)}
                >
                  <div 
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => { e.stopPropagation(); toggleSelection(file.id, 'file'); }}
                  >
                     {selectedItems.find(i => i.id === file.id) ? (
                        <CheckSquare className="text-blue-600 bg-white rounded" size={20} />
                     ) : (
                        <Square className="text-gray-400 opacity-0 group-hover:opacity-100 bg-white rounded" size={20} />
                     )}
                  </div>
                  <div className="mb-2 w-full flex justify-center relative aspect-square bg-gray-100 rounded overflow-hidden items-center">

                    {file.mimeType.startsWith('image/') ? (
                      <img 
                        src={getFullUrl(file.url)} 
                        alt={file.name} 
                        className="w-full h-full object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).onerror = null; 
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : file.mimeType.startsWith('video/') ? (
                      <div className="w-full h-full relative bg-gray-100 rounded overflow-hidden">
                        <video 
                          src={`${getFullUrl(file.url)}#t=0.1`} 
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                          onMouseOver={(e) => e.currentTarget.play()}
                          onMouseOut={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                        />
                        <div className="absolute top-2 right-2 pointer-events-none bg-black/50 p-1.5 rounded-full">
                           <FileVideo size={14} className="text-white" />
                        </div>
                      </div>
                    ) : (
                      <FileVideo size={48} className="text-blue-500" />
                    )}
                    {/* Fallback for broken image */}
                    <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
                      <FileText size={32} />
                    </div>
                  </div>
                  
                  <div className="w-full">
                    <div className="font-medium text-gray-700 truncate w-full">{file.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{formatSize(file.size)}</div>
                  </div>

                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 bg-white/90 rounded p-1 shadow-sm z-10">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePreviewClick(file); }}
                      className="p-1 hover:bg-blue-100 text-blue-600 rounded"
                      title="Preview"
                    >
                      <Eye size={16} />
                    </button>
                    <PermissionGuard module="media" action="write">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRenameClick(file.id, 'file', file.name); }}
                        className="p-1 hover:bg-blue-100 text-blue-600 rounded"
                        title="Rename"
                      >
                        <Edit2 size={16} />
                      </button>
                    </PermissionGuard>
                    <PermissionGuard module="media" action="write">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(file.id, 'file'); }}
                        className="p-1 hover:bg-red-100 text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </PermissionGuard>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left w-10">
                      <button onClick={handleSelectAll} className="text-gray-400 hover:text-gray-600">
                        {selectedItems.length > 0 && selectedItems.length === filteredFolders.length + filteredFiles.length ? (
                          <CheckSquare size={20} className="text-blue-600" />
                        ) : (
                          <Square size={20} />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredFolders.map(folder => (
                    <tr 
                      key={folder.id} 
                      className={`hover:bg-gray-50 cursor-pointer ${selectedItems.find(i => i.id === folder.id) ? 'bg-blue-50' : ''}`}
                      onClick={() => handleNavigate(folder.id, folder.name)}
                    >
                      <td className="px-6 py-4" onClick={(e) => { e.stopPropagation(); toggleSelection(folder.id, 'folder'); }}>
                         {selectedItems.find(i => i.id === folder.id) ? (
                            <CheckSquare className="text-blue-600" size={20} />
                         ) : (
                            <Square className="text-gray-400" size={20} />
                         )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <Folder className="text-yellow-500" size={20} />
                          <span className="text-sm font-medium text-gray-900">{folder.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-sm text-gray-500">Folder</td>
                      <td className="px-6 py-4 text-sm text-gray-500">-</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                          <PermissionGuard module="media" action="write">
                            <button 
                              onClick={() => handleRenameClick(folder.id, 'folder', folder.name)}
                              className="text-gray-400 hover:text-blue-600"
                            >
                              <Edit2 size={16} />
                            </button>
                          </PermissionGuard>
                          <PermissionGuard module="media" action="write">
                            <button 
                              onClick={() => handleDelete(folder.id, 'folder', folder.name)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </PermissionGuard>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredFiles.map(file => (
                    <tr 
                      key={file.id} 
                      className={`hover:bg-gray-50 cursor-pointer ${selectedItems.find(i => i.id === file.id) ? 'bg-blue-50' : ''}`}
                      onClick={() => handlePreviewClick(file)}
                    >
                      <td className="px-6 py-4" onClick={(e) => { e.stopPropagation(); toggleSelection(file.id, 'file'); }}>
                         {selectedItems.find(i => i.id === file.id) ? (
                            <CheckSquare className="text-blue-600" size={20} />
                         ) : (
                            <Square className="text-gray-400" size={20} />
                         )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {file.mimeType.startsWith('image/') ? (
                            <div className="w-8 h-8 rounded bg-gray-100 overflow-hidden">
                              <img src={getFullUrl(file.url)} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : file.mimeType.startsWith('video/') ? (
                            <div className="w-8 h-8 rounded bg-gray-100 overflow-hidden relative group/video">
                              <video 
                                src={`${getFullUrl(file.url)}#t=0.1`} 
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                              />
                            </div>
                          ) : (
                            <FileVideo className="text-blue-500" size={20} />
                          )}
                          <span className="text-sm font-medium text-gray-900">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatSize(file.size)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{file.mimeType}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{file.createdAt ? new Date(file.createdAt).toLocaleDateString('en-GB') : '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => handlePreviewClick(file)}
                            className="text-gray-400 hover:text-blue-600"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <PermissionGuard module="media" action="write">
                            <button 
                              onClick={() => handleRenameClick(file.id, 'file', file.name)}
                              className="text-gray-400 hover:text-blue-600"
                            >
                              <Edit2 size={16} />
                            </button>
                          </PermissionGuard>
                          <PermissionGuard module="media" action="write">
                            <button 
                              onClick={() => handleDelete(file.id, 'file', file.name)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </PermissionGuard>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4">Create New Folder</h2>
            <input 
              type="text" 
              placeholder="Folder Name" 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full border p-2 rounded mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setShowNewFolder(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateFolder}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRename && renameItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4">Rename Item</h2>
            <input 
              type="text" 
              value={renameItem.name}
              onChange={(e) => setRenameItem({ ...renameItem, name: e.target.value })}
              className="w-full border p-2 rounded mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setShowRename(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={handleRenameSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-red-600 mb-4">Cannot Delete File(s)</h3>
            
            <p className="mb-4 text-gray-700">
              The following file(s) are currently in use by one or more playlists and cannot be deleted:
            </p>

            {deleteConfirmation.item?.id === 'bulk' && deleteConfirmation.usageData ? (
                <div className="bg-gray-50 p-3 rounded mb-4 max-h-40 overflow-y-auto text-sm">
                    {deleteConfirmation.usageData.map((data: any, idx: number) => (
                        <div key={idx} className="mb-2 border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                            <div className="font-semibold text-gray-800">{data.name}</div>
                            <div className="text-gray-500 pl-2">
                                Used in: {data.playlists.join(', ')}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                deleteConfirmation.usageData && (
                    <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
                        <div className="font-semibold text-gray-800">{deleteConfirmation.item?.name}</div>
                        <div className="text-gray-500 mt-1">
                            Used in: {deleteConfirmation.usageData.join(', ')}
                        </div>
                    </div>
                )
            )}

            <p className="text-sm text-gray-500 mb-6">
              Please remove the files from these playlists before deleting.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-h-[80vh] flex flex-col">
            <h2 className="text-lg font-bold mb-4">Move {selectedItems.length} Items To...</h2>
            
            <div className="flex-1 overflow-y-auto border rounded p-2 mb-4 space-y-1">
              <div 
                className={`p-2 rounded cursor-pointer hover:bg-gray-100 flex items-center ${moveTargetFolderId === null ? 'bg-blue-50 text-blue-600' : ''}`}
                onClick={() => setMoveTargetFolderId(null)}
              >
                 <div className="w-[14px] mr-1"></div> {/* Spacer for indent */}
                 <Folder size={18} className="mr-2 text-blue-500" />
                 <span className="font-medium">Home (Root)</span>
              </div>
              
              <div className="border-t my-1"></div>

              {allFolders.map(node => (
                <FolderTreeItem 
                  key={node.id} 
                  node={node} 
                  selectedId={moveTargetFolderId} 
                  onSelect={setMoveTargetFolderId}
                  disabledIds={disabledMoveTargetIds}
                />
              ))}
            </div>

            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setShowMoveModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={handleBulkMove}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Move Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Usage Warning) */}
      {deleteConfirmation.isOpen && deleteConfirmation.item && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3 text-amber-600 mb-2">
                <div className="p-2 bg-amber-50 rounded-full">
                  <Eye size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Media In Use</h3>
              </div>
              <p className="text-gray-600">
                The file <span className="font-semibold text-gray-900">"{deleteConfirmation.item.name}"</span> is currently being used in the following playlists.
                Deleting it will remove it from these playlists.
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {deleteConfirmation.usageData?.map((playlist: any) => (
                  <div key={playlist.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-white rounded shadow-sm text-blue-600">
                        <ListIcon size={18} />
                      </div>
                      <span className="font-medium text-gray-900">{playlist.name}</span>
                    </div>
                    <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded font-medium">
                      Playlist
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
              <button 
                onClick={closeDeleteModal}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  // Force delete not implemented yet, or user just acknowledges and goes to playlists to fix
                  // Actually the requirement is just to show the modal.
                  // If we want to allow force delete, we'd need a backend flag or remove associations first.
                  // For now, this is just an informational blocker as per "restrict deletion".
                  closeDeleteModal();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewItem(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Left Side: Media Preview */}
            <div className="w-2/3 bg-gray-100 flex items-center justify-center relative">
              {previewItem.mimeType.startsWith('image/') ? (
                <img 
                  src={getFullUrl(previewItem.url)} 
                  alt={previewItem.name} 
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <video 
                  src={getFullUrl(previewItem.url)} 
                  controls 
                  className="max-w-full max-h-full"
                />
              )}
            </div>

            {/* Right Side: Metadata */}
            <div className="w-1/3 p-6 flex flex-col border-l relative">
              <button 
                onClick={() => setPreviewItem(null)} 
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-full z-10"
              >
                <X size={24} />
              </button>

              <div className="mb-6 mt-2 pr-8">
                <h2 className="text-xl font-bold text-gray-800 break-words">{previewItem.name}</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">File Type</label>
                  <div className="flex items-center space-x-2 mt-1">
                    {previewItem.mimeType.startsWith('image/') ? <FileText size={16} /> : <FileVideo size={16} />}
                    <span className="text-gray-700">{previewItem.mimeType}</span>
                  </div>
                </div>

                <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Size</label>
                    <p className="text-gray-700 mt-1">{formatSize(previewItem.size)}</p>
                  </div>

                  {previewItem.width && previewItem.height && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">Dimensions</label>
                      <p className="text-gray-700 mt-1">{previewItem.width} x {previewItem.height}</p>
                    </div>
                  )}

                  {previewItem.duration && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase">Duration</label>
                      <p className="text-gray-700 mt-1">{Math.round(previewItem.duration)}s</p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Created At</label>
                  <p className="text-gray-700 mt-1">
                    {previewItem.createdAt ? new Date(previewItem.createdAt).toLocaleString() : 'N/A'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">URL</label>
                  <p className="text-gray-700 mt-1 text-sm break-all bg-gray-50 p-2 rounded">
                    {getFullUrl(previewItem.url)}
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t flex space-x-2">
                 <button 
                  onClick={() => {
                     // Trigger download
                     const link = document.createElement('a');
                     link.href = getFullUrl(previewItem.url);
                     link.download = previewItem.name;
                     link.click();
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition"
                 >
                   Download
                 </button>
                 <button 
                  onClick={() => {
                    handleDelete(previewItem.id, 'file');
                    setPreviewItem(null);
                  }}
                  className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 py-2 rounded-lg transition"
                 >
                   Delete
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;

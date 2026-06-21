import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Unique filename: timestamp-random-originalName
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Create tenant and date-based folder structure middleware
const createUploadFolder = (req: any, file: any, cb: any) => {
  const date = new Date();
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // Use tenantId if available, otherwise 'common' or similar
  const tenantId = req.user?.tenantId || 'common';
  
  const folderPath = path.join(uploadDir, tenantId, year, month, day);
  
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  
  // Attach relative path to request for later use
  req.fileRelativePath = `${tenantId}/${year}/${month}/${day}`;
  
  cb(null, folderPath);
};

// Override storage destination to use dynamic folders
const dynamicStorage = multer.diskStorage({
  destination: createUploadFolder,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow images and videos
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error(`Only image and video files are allowed! Received: ${file.mimetype}`));
  }
};

const upload = multer({ 
  storage: dynamicStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB limit
  }
});

const supportBundleUpload = multer({
  storage: dynamicStorage,
  fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed =
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.mimetype === 'application/json' ||
      file.mimetype.startsWith('text/');
    if (allowed) {
      cb(null, true);
    } else {
      cb(new Error(`Only support bundle files are allowed! Received: ${file.mimetype}`));
    }
  },
  limits: {
    fileSize: 250 * 1024 * 1024,
  }
});

export default upload;
export { supportBundleUpload };

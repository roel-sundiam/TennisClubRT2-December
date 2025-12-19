import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

// Memory storage for Supabase upload (we'll process in memory before uploading to Supabase)
const storage = multer.memoryStorage();

// File filter - only allow JPG and PNG images
const imageFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG and PNG images are allowed.'));
  }
};

// Configure multer with file size limits and validation
export const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 10 // Allow up to 10 files at once
  }
});

// Error handler for Multer errors
export const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    console.error('❌ Multer error:', err.code, err.message);
    console.error('   Field:', err.field);

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size exceeds the 5MB limit'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 files can be uploaded at once'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: `Unexpected field: ${err.field}. Expected field name is "images"`
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`
    });
  }

  if (err) {
    console.error('❌ Upload error (not Multer):', err.message);
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  next();
};

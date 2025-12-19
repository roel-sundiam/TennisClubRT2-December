import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import sharp from 'sharp';
import GalleryImage from '../models/GalleryImage';
import { AuthenticatedRequest, authenticateToken, requireSuperAdmin } from '../middleware/auth';
import { upload, handleMulterError } from '../middleware/upload';
import { supabase, GALLERY_BUCKET, getPublicUrl, deleteFromStorage } from '../config/supabase';
import { UploadGalleryImageRequest, UpdateGalleryImageRequest } from '../types';

const router = express.Router();

// Validation rules for upload
const uploadValidation = [
  body('title')
    .isString()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        try {
          JSON.parse(value);
          return true;
        } catch (e) {
          return false;
        }
      }
      return Array.isArray(value);
    })
    .withMessage('Tags must be a valid array'),
  body('eventDate').optional().isISO8601().withMessage('Event date must be a valid date')
];

// GET /api/gallery - Public access - list all visible images
router.get('/', async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, tags, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = { isVisible: true };

    if (tags) {
      const tagArray = (tags as string).split(',').map((t) => t.trim().toLowerCase());
      query.tags = { $in: tagArray };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const [images, totalCount] = await Promise.all([
      GalleryImage.find(query)
        .populate('uploadedBy', 'fullName username')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .exec(),
      GalleryImage.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: images,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching gallery images:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gallery images'
    });
  }
});

// GET /api/gallery/:id - Public access - get single image
router.get('/:id', async (req, res: Response) => {
  try {
    const image = await GalleryImage.findById(req.params.id)
      .populate('uploadedBy', 'fullName username')
      .exec();

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    if (!image.isVisible) {
      return res.status(404).json({
        success: false,
        error: 'Image not available'
      });
    }

    // Increment view count
    await GalleryImage.findByIdAndUpdate(req.params.id, {
      $inc: { viewCount: 1 }
    });

    res.json({
      success: true,
      data: image
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch image'
    });
  }
});

// POST /api/gallery - Superadmin only - Upload new images (single or multiple)
router.post(
  '/',
  authenticateToken,
  requireSuperAdmin,
  upload.array('images', 10), // Changed from single to array
  handleMulterError,
  uploadValidation,
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No image files provided'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const files = req.files as Express.Multer.File[];
    const uploadedImages: any[] = [];
    const errors_list: any[] = [];

    try {
      // Parse tags once (applies to all images)
      let parsedTags: string[] = [];
      if (req.body.tags) {
        if (typeof req.body.tags === 'string') {
          try {
            parsedTags = JSON.parse(req.body.tags);
          } catch (e) {
            parsedTags = [];
          }
        } else if (Array.isArray(req.body.tags)) {
          parsedTags = req.body.tags;
        }
      }

      // Process each file
      let fileIndex = 0;
      for (const file of files) {
        if (!file) continue; // Skip if file is undefined
        try {
          // Optimize and validate image with sharp
          const metadata = await sharp(file!.buffer).metadata();

          // Optimize image (max 1920px width, 85% quality)
          const optimizedBuffer = await sharp(file!.buffer)
            .resize(1920, null, {
              withoutEnlargement: true,
              fit: 'inside'
            })
            .jpeg({ quality: 85 })
            .toBuffer();

          // Generate thumbnail (400px width)
          const thumbnailBuffer = await sharp(file!.buffer)
            .resize(400, null, {
              withoutEnlargement: true,
              fit: 'inside'
            })
            .jpeg({ quality: 80 })
            .toBuffer();

          // Generate unique filename with index to avoid conflicts
          const timestamp = Date.now() + fileIndex; // Add index to timestamp for uniqueness
          const sanitizedFilename = file!.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
          const fileName = `${timestamp}-${sanitizedFilename}`;
          const thumbnailFileName = `${timestamp}-thumb-${sanitizedFilename}`;
          const storagePath = `gallery/${fileName}`;
          const thumbnailPath = `gallery/thumbnails/${thumbnailFileName}`;

          // Upload to Supabase Storage
          const [uploadResult, thumbnailResult] = await Promise.all([
            supabase.storage.from(GALLERY_BUCKET).upload(storagePath, optimizedBuffer, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: false
            }),
            supabase.storage.from(GALLERY_BUCKET).upload(thumbnailPath, thumbnailBuffer, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: false
            })
          ]);

          if (uploadResult.error) {
            console.error(`❌ Supabase upload error for ${file!.originalname}:`, uploadResult.error);
            throw new Error(`Upload failed: ${uploadResult.error.message}`);
          }

          if (thumbnailResult.error) {
            console.warn(`⚠️ Thumbnail upload failed for ${file!.originalname}:`, thumbnailResult.error);
          }

          // Get public URLs
          const publicUrl = getPublicUrl(storagePath);
          const thumbnailUrl = thumbnailResult.error ? publicUrl : getPublicUrl(thumbnailPath);

          // Save metadata to MongoDB
          const galleryImage = await GalleryImage.create({
            title: req.body.title,
            description: req.body.description || '',
            fileName: file!.originalname,
            storagePath,
            publicUrl,
            thumbnailUrl,
            fileSize: optimizedBuffer.length,
            mimeType: 'image/jpeg',
            width: metadata.width,
            height: metadata.height,
            uploadedBy: req.user._id,
            isVisible: true,
            tags: parsedTags,
            eventDate: req.body.eventDate ? new Date(req.body.eventDate) : undefined
          });

          const populatedImage = await GalleryImage.findById(galleryImage._id)
            .populate('uploadedBy', 'fullName username')
            .exec();

          uploadedImages.push(populatedImage);
          console.log(`🖼️ Image ${fileIndex + 1}/${files.length} uploaded: "${file!.originalname}" by ${req.user!.username}`);
          fileIndex++;

        } catch (fileError: any) {
          console.error(`❌ Error uploading ${file!.originalname}:`, fileError);
          errors_list.push({
            fileName: file!.originalname,
            error: fileError.message
          });
          fileIndex++;
        }
      }

      // Return response based on results
      if (uploadedImages.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'Failed to upload any images',
          errors: errors_list
        });
      }

      const responseMessage = uploadedImages.length === files.length
        ? `Successfully uploaded ${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''}`
        : `Uploaded ${uploadedImages.length} of ${files.length} images`;

      res.status(201).json({
        success: true,
        message: responseMessage,
        data: uploadedImages,
        uploadedCount: uploadedImages.length,
        totalCount: files.length,
        errors: errors_list.length > 0 ? errors_list : undefined
      });
    } catch (error: any) {
      console.error('❌ Error uploading image:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload image',
        details: error.message
      });
    }
  }
);

// PATCH /api/gallery/:id - Superadmin only - Update image metadata
router.patch(
  '/:id',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updateData: UpdateGalleryImageRequest = req.body;

      const image = await GalleryImage.findByIdAndUpdate(
        req.params.id,
        {
          ...updateData,
          eventDate: updateData.eventDate ? new Date(updateData.eventDate) : undefined
        },
        { new: true, runValidators: true }
      ).populate('uploadedBy', 'fullName username');

      if (!image) {
        return res.status(404).json({
          success: false,
          error: 'Image not found'
        });
      }

      console.log(`🖼️ Image updated: ${req.params.id} by ${req.user!.username}`);

      res.json({
        success: true,
        message: 'Image updated successfully',
        data: image
      });
    } catch (error) {
      console.error('Error updating image:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update image'
      });
    }
  }
);

// DELETE /api/gallery/:id - Superadmin only - Delete image
router.delete(
  '/:id',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const image = await GalleryImage.findById(req.params.id);

      if (!image) {
        return res.status(404).json({
          success: false,
          error: 'Image not found'
        });
      }

      // Delete from Supabase Storage
      const deleteResult = await deleteFromStorage(image.storagePath);

      if (!deleteResult.success) {
        console.warn('⚠️ Failed to delete from Supabase:', deleteResult.error);
      }

      // Try to delete thumbnail (don't fail if it doesn't exist)
      if (image.thumbnailUrl && image.thumbnailUrl !== image.publicUrl) {
        // Reconstruct thumbnail path: gallery/1234-image.jpg -> gallery/thumbnails/1234-thumb-image.jpg
        const fileName = image.storagePath.replace('gallery/', ''); // 1234-image.jpg
        const parts = fileName.split('-'); // [1234, image.jpg]
        if (parts.length >= 2) {
          const timestamp = parts[0]; // 1234
          const originalName = parts.slice(1).join('-'); // image.jpg
          const thumbnailPath = `gallery/thumbnails/${timestamp}-thumb-${originalName}`;
          await deleteFromStorage(thumbnailPath);
        }
      }

      // Delete from MongoDB
      await GalleryImage.findByIdAndDelete(req.params.id);

      console.log(`🖼️ Image deleted: "${image.title}" (ID: ${req.params.id}) by ${req.user!.username}`);

      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error) {
      console.error('❌ Error deleting image:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete image'
      });
    }
  }
);

export default router;

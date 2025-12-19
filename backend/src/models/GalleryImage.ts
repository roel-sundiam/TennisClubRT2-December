import mongoose, { Schema, Document, Model } from 'mongoose';
import { GalleryImage as IGalleryImage } from '../types';

export interface IGalleryImageDocument extends Omit<IGalleryImage, '_id'>, Document {
  _id: mongoose.Types.ObjectId;
}

interface IGalleryImageModel extends Model<IGalleryImageDocument> {
  getRecentImages(limit: number): Promise<IGalleryImageDocument[]>;
  getImageStats(): Promise<{
    totalImages: number;
    totalSize: number;
    totalViews: number;
    avgFileSize: number;
  }>;
}

const galleryImageSchema = new Schema<IGalleryImageDocument>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: ''
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true
    },
    storagePath: {
      type: String,
      required: [true, 'Storage path is required'],
      trim: true,
      unique: true,
      index: true
    },
    publicUrl: {
      type: String,
      required: [true, 'Public URL is required'],
      trim: true
    },
    thumbnailUrl: {
      type: String,
      trim: true
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size cannot be negative'],
      max: [5242880, 'File size cannot exceed 5MB']
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      enum: {
        values: ['image/jpeg', 'image/jpg', 'image/png'],
        message: 'Only JPG and PNG images are allowed'
      }
    },
    width: {
      type: Number,
      min: [1, 'Width must be positive']
    },
    height: {
      type: Number,
      min: [1, 'Height must be positive']
    },
    uploadedBy: {
      type: String,
      ref: 'User',
      required: [true, 'Uploader is required'],
      index: true
    },
    isVisible: {
      type: Boolean,
      default: true,
      index: true
    },
    viewCount: {
      type: Number,
      default: 0,
      min: [0, 'View count cannot be negative']
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [30, 'Tag cannot exceed 30 characters']
      }
    ],
    eventDate: {
      type: Date,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete (ret as any).__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        delete (ret as any).__v;
        return ret;
      }
    }
  }
);

// Indexes for efficient queries
galleryImageSchema.index({ createdAt: -1 });
galleryImageSchema.index({ isVisible: 1, createdAt: -1 });
galleryImageSchema.index({ uploadedBy: 1, createdAt: -1 });
galleryImageSchema.index({ tags: 1 });
galleryImageSchema.index({ eventDate: -1 });

// Virtual to populate uploader info
galleryImageSchema.virtual('uploader', {
  ref: 'User',
  localField: 'uploadedBy',
  foreignField: '_id',
  justOne: true
});

// Virtual for human-readable file size
galleryImageSchema.virtual('fileSizeFormatted').get(function (this: IGalleryImageDocument) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = this.fileSize;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
});

// Static method to get recent visible images
galleryImageSchema.statics.getRecentImages = function (limit: number = 20) {
  return this.find({ isVisible: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('uploadedBy', 'fullName username')
    .exec();
};

// Static method for image statistics
galleryImageSchema.statics.getImageStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalImages: { $sum: 1 },
        totalSize: { $sum: '$fileSize' },
        totalViews: { $sum: '$viewCount' },
        avgFileSize: { $avg: '$fileSize' }
      }
    }
  ]);

  return (
    stats[0] || {
      totalImages: 0,
      totalSize: 0,
      totalViews: 0,
      avgFileSize: 0
    }
  );
};

const GalleryImage = mongoose.model<IGalleryImageDocument, IGalleryImageModel>(
  'GalleryImage',
  galleryImageSchema
);

export default GalleryImage;

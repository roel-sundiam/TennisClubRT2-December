import { Schema, model, Document, Types } from 'mongoose';

export interface IImpersonationLogDocument extends Document {
  adminId: Types.ObjectId;
  impersonatedUserId: Types.ObjectId;
  startedAt: Date;
  endedAt?: Date;
  duration?: number; // In seconds
  ipAddress: string;
  userAgent: string;
  status: 'active' | 'ended' | 'expired';
  metadata: {
    adminUsername: string;
    adminFullName: string;
    impersonatedUsername: string;
    impersonatedFullName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const impersonationLogSchema = new Schema<IImpersonationLogDocument>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    impersonatedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    endedAt: {
      type: Date
    },
    duration: {
      type: Number // In seconds
    },
    ipAddress: {
      type: String,
      required: true
    },
    userAgent: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'ended', 'expired'],
      required: true,
      default: 'active',
      index: true
    },
    metadata: {
      adminUsername: {
        type: String,
        required: true
      },
      adminFullName: {
        type: String,
        required: true
      },
      impersonatedUsername: {
        type: String,
        required: true
      },
      impersonatedFullName: {
        type: String,
        required: true
      }
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for common queries
impersonationLogSchema.index({ adminId: 1, startedAt: -1 });
impersonationLogSchema.index({ impersonatedUserId: 1, startedAt: -1 });
impersonationLogSchema.index({ status: 1, startedAt: -1 });

const ImpersonationLog = model<IImpersonationLogDocument>('ImpersonationLog', impersonationLogSchema);

export default ImpersonationLog;

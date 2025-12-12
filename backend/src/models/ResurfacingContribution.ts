import mongoose, { Document, Schema } from 'mongoose';

export interface IResurfacingContribution extends Document {
  contributorName: string;
  amount: number;
  paymentMethod: 'cash' | 'gcash' | 'bank_transfer';
  status: 'pledged' | 'received' | 'cancelled';
  notes?: string;
  receivedBy?: mongoose.Types.ObjectId; // Admin who confirmed receipt
  receivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ResurfacingContributionSchema = new Schema<IResurfacingContribution>(
  {
    contributorName: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'gcash', 'bank_transfer'],
      required: true
    },
    status: {
      type: String,
      enum: ['pledged', 'received', 'cancelled'],
      default: 'pledged'
    },
    notes: {
      type: String,
      trim: true
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    receivedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient querying
ResurfacingContributionSchema.index({ status: 1, createdAt: -1 });
ResurfacingContributionSchema.index({ contributorName: 1 });

const ResurfacingContribution = mongoose.model<IResurfacingContribution>(
  'ResurfacingContribution',
  ResurfacingContributionSchema
);

export default ResurfacingContribution;

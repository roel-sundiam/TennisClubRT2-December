import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * System Settings Interface
 *
 * Stores system-wide configuration that can be updated by admins
 * without requiring code deployment.
 */
export interface ISystemSettings extends Document {
  tennisBallCostPerCan: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: mongoose.Types.ObjectId;
}

/**
 * System Settings Schema
 *
 * Single document collection (only one settings document should exist).
 * Stores configurable pricing and system parameters.
 */
const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    tennisBallCostPerCan: {
      type: Number,
      required: [true, 'Tennis ball cost per can is required'],
      min: [0, 'Cost per can cannot be negative'],
      max: [1000, 'Cost per can cannot exceed ₱1000'],
      default: 120, // Default price: ₱120 per can
      validate: {
        validator: function(value: number) {
          // Ensure value is a multiple of 10 for cleaner pricing
          return value % 10 === 0;
        },
        message: 'Cost per can must be a multiple of ₱10'
      }
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Updated by user is required']
    }
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: 'systemsettings'
  }
);

// Index for faster queries (though we only have one document)
systemSettingsSchema.index({ updatedAt: -1 });

/**
 * Static method to get or create settings
 * Ensures only one settings document exists
 */
systemSettingsSchema.statics.getSettings = async function(): Promise<ISystemSettings> {
  let settings = await this.findOne();

  if (!settings) {
    // Create default settings if none exist
    // This should be seeded on first deployment
    throw new Error('System settings not found. Please initialize settings first.');
  }

  return settings;
};

/**
 * Static method to initialize settings with default values
 * Should be called during app initialization or by admin
 */
systemSettingsSchema.statics.initializeSettings = async function(adminUserId: mongoose.Types.ObjectId): Promise<ISystemSettings> {
  const existingSettings = await this.findOne();

  if (existingSettings) {
    return existingSettings;
  }

  const settings = await this.create({
    tennisBallCostPerCan: 120,
    updatedBy: adminUserId
  });

  return settings;
};

// Create the model
const SystemSettings: Model<ISystemSettings> = mongoose.model<ISystemSettings>('SystemSettings', systemSettingsSchema);

export default SystemSettings;

import mongoose, { Schema, Document } from 'mongoose';

export interface IMedal {
  type: 'gold' | 'silver' | 'bronze';
  tournamentName?: string;
  awardedAt: Date;
}

export interface IPlayer extends Document {
  fullName: string;
  email?: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other';

  // Tournament stats (replacing User model stats for tournament players)
  seedPoints: number;
  matchesWon: number;
  matchesPlayed: number;

  // Medal achievements (can have multiple medals with tournament info)
  medals: IMedal[];

  // Optional link to User account (for members who are also players)
  linkedUserId?: string;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new Schema<IPlayer>({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Full name must be at least 2 characters'],
    maxlength: [100, 'Full name cannot exceed 100 characters'],
    index: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    sparse: true,
    index: true
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  gender: {
    type: String,
    enum: {
      values: ['male', 'female', 'other'],
      message: 'Gender must be male, female, or other'
    }
  },
  seedPoints: {
    type: Number,
    default: 0,
    min: [0, 'Seed points cannot be negative'],
    index: true
  },
  matchesWon: {
    type: Number,
    default: 0,
    min: [0, 'Matches won cannot be negative']
  },
  matchesPlayed: {
    type: Number,
    default: 0,
    min: [0, 'Matches played cannot be negative']
  },
  medals: {
    type: [{
      type: {
        type: String,
        enum: ['gold', 'silver', 'bronze'],
        required: true
      },
      tournamentName: {
        type: String,
        trim: true,
        maxlength: [200, 'Tournament name cannot exceed 200 characters']
      },
      awardedAt: {
        type: Date,
        default: Date.now
      }
    }],
    default: []
  },
  linkedUserId: {
    type: String,
    ref: 'User',
    sparse: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
playerSchema.index({ isActive: 1, seedPoints: -1 });
playerSchema.index({ fullName: 1, isActive: 1 });

// Virtual for win rate
playerSchema.virtual('winRate').get(function(this: IPlayer) {
  if (this.matchesPlayed === 0) return 0;
  return Math.round((this.matchesWon / this.matchesPlayed) * 100) / 100;
});

// Pre-save middleware to ensure data consistency
playerSchema.pre('save', function(next) {
  // Ensure matchesWon doesn't exceed matchesPlayed
  if (this.matchesWon > this.matchesPlayed) {
    this.matchesWon = this.matchesPlayed;
  }
  next();
});

const Player = mongoose.model<IPlayer>('Player', playerSchema);

export default Player;

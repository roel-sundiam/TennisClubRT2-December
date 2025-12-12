import mongoose, { Schema, Document } from 'mongoose';

export interface ISeedingPoint extends Document {
  userId?: string; // Legacy field for backward compatibility
  playerId?: string; // NEW: reference to Player model
  points: number;
  description: string;
  tournamentTier?: '100' | '250' | '500'; // Made optional for new tournament system
  matchId?: string;
  pollId?: string;
  source?: 'reservation' | 'open_play' | 'tournament'; // NEW: distinguish point sources
  tournamentId?: string; // NEW: reference to Tournament model
  matchIndex?: number; // NEW: which match in tournament
  isWinner?: boolean; // NEW: track if this was a winning performance for proper reversal
  processedAt?: Date; // When points were awarded
  processedBy?: string; // System/user who triggered processing
  processingVersion?: string; // Track code version for debugging
  reversedAt?: Date; // If/when points were reversed
  reversalReason?: string; // Why points were reversed
  createdAt: Date;
  updatedAt: Date;
}

const seedingPointSchema = new Schema<ISeedingPoint>({
  userId: {
    type: String,
    ref: 'User',
    required: false, // Made optional for backward compatibility
    sparse: true,
    index: true
  },
  playerId: {
    type: String,
    ref: 'Player',
    required: false,
    sparse: true,
    index: true
  },
  points: {
    type: Number,
    required: [true, 'Points value is required'],
    min: [1, 'Points must be positive']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [200, 'Description cannot exceed 200 characters'],
    trim: true
  },
  tournamentTier: {
    type: String,
    enum: {
      values: ['100', '250', '500'],
      message: 'Tournament tier must be 100, 250, or 500'
    },
    required: false, // Made optional for new tournament system
    index: true
  },
  matchId: {
    type: String,
    required: false,
    sparse: true
  },
  pollId: {
    type: String,
    ref: 'Poll',
    required: false,
    sparse: true
  },
  source: {
    type: String,
    enum: {
      values: ['reservation', 'open_play', 'tournament'],
      message: 'Source must be reservation, open_play, or tournament'
    },
    required: false,
    index: true
  },
  tournamentId: {
    type: String,
    ref: 'Tournament',
    required: false,
    sparse: true,
    index: true
  },
  matchIndex: {
    type: Number,
    required: false,
    min: [0, 'Match index cannot be negative']
  },
  isWinner: {
    type: Boolean,
    required: false,
    default: false
  },
  processedAt: {
    type: Date,
    required: false,
    default: Date.now
  },
  processedBy: {
    type: String,
    required: false,
    default: 'system'
  },
  processingVersion: {
    type: String,
    required: false,
    default: '2.0.0'
  },
  reversedAt: {
    type: Date,
    required: false
  },
  reversalReason: {
    type: String,
    required: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
seedingPointSchema.index({ userId: 1, createdAt: -1 });
seedingPointSchema.index({ playerId: 1, createdAt: -1 }); // NEW index for Player-based points
seedingPointSchema.index({ tournamentTier: 1, createdAt: -1 });
seedingPointSchema.index({ pollId: 1, userId: 1 });
seedingPointSchema.index({ source: 1, createdAt: -1 });
seedingPointSchema.index({ tournamentId: 1, matchIndex: 1 });

// CRITICAL: Unique constraint to prevent duplicate point awards for same tournament match
// This prevents processing the same match multiple times for the same player
seedingPointSchema.index(
  { tournamentId: 1, matchIndex: 1, playerId: 1 },
  {
    unique: true,
    sparse: true, // Allow nulls for non-tournament points (open play, reservations)
    name: 'unique_tournament_match_player'
  }
);

// Virtual for formatted description
seedingPointSchema.virtual('formattedDescription').get(function(this: ISeedingPoint) {
  return `+${this.points} pts - ${this.description}`;
});

const SeedingPoint = mongoose.model<ISeedingPoint>('SeedingPoint', seedingPointSchema);

export default SeedingPoint;
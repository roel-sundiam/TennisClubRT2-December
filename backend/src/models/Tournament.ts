import mongoose, { Schema, Document } from 'mongoose';

export interface ITournamentMatch {
  matchType: 'singles' | 'doubles'; // Match type
  // Singles fields
  player1?: string; // Player ID (singles)
  player2?: string; // Player ID (singles)
  player1Name?: string; // Non-registered player name (singles)
  player2Name?: string; // Non-registered player name (singles)
  // Doubles fields
  team1Player1?: string; // Player ID (doubles team 1, player 1)
  team1Player2?: string; // Player ID (doubles team 1, player 2)
  team2Player1?: string; // Player ID (doubles team 2, player 1)
  team2Player2?: string; // Player ID (doubles team 2, player 2)
  team1Player1Name?: string; // Non-registered player name (doubles team 1, player 1)
  team1Player2Name?: string; // Non-registered player name (doubles team 1, player 2)
  team2Player1Name?: string; // Non-registered player name (doubles team 2, player 1)
  team2Player2Name?: string; // Non-registered player name (doubles team 2, player 2)
  // Common fields
  score: string; // "8-6", "10-8"
  winner: string; // Player ID (singles) or "team1"/"team2" (doubles)
  round: string; // "Round 1", "Quarterfinal", "Semifinal", "Final"
  player1Games?: number; // Calculated from score (singles)
  player2Games?: number; // Calculated from score (singles)
  team1Games?: number; // Calculated from score (doubles)
  team2Games?: number; // Calculated from score (doubles)
  pointsProcessed: boolean; // Prevent double-processing
}

export interface ITournament extends Document {
  name: string;
  date: Date;
  createdBy: string; // Admin user ID
  matches: ITournamentMatch[];
  status: 'draft' | 'completed';
  totalMatches: number;
  createdAt: Date;
  updatedAt: Date;
}

const tournamentMatchSchema = new Schema<ITournamentMatch>({
  matchType: {
    type: String,
    enum: ['singles', 'doubles'],
    required: [true, 'Match type is required'],
    default: 'singles'
  },
  // Singles fields
  player1: {
    type: String,
    ref: 'Player'
  },
  player2: {
    type: String,
    ref: 'Player'
  },
  player1Name: {
    type: String,
    trim: true
  },
  player2Name: {
    type: String,
    trim: true
  },
  // Doubles fields
  team1Player1: {
    type: String,
    ref: 'Player'
  },
  team1Player2: {
    type: String,
    ref: 'Player'
  },
  team2Player1: {
    type: String,
    ref: 'Player'
  },
  team2Player2: {
    type: String,
    ref: 'Player'
  },
  team1Player1Name: {
    type: String,
    trim: true
  },
  team1Player2Name: {
    type: String,
    trim: true
  },
  team2Player1Name: {
    type: String,
    trim: true
  },
  team2Player2Name: {
    type: String,
    trim: true
  },
  // Common fields
  score: {
    type: String,
    required: [true, 'Score is required'],
    trim: true,
    validate: {
      validator: function(v: string) {
        // Validate score format like "8-6", "10-8"
        return /^\d+\s*-\s*\d+$/.test(v);
      },
      message: 'Score must be in format like "8-6" or "10-8"'
    }
  },
  winner: {
    type: String,
    required: [true, 'Winner is required']
  },
  round: {
    type: String,
    required: [true, 'Round is required'],
    trim: true
  },
  player1Games: {
    type: Number,
    min: [0, 'Games cannot be negative'],
    default: 0
  },
  player2Games: {
    type: Number,
    min: [0, 'Games cannot be negative'],
    default: 0
  },
  team1Games: {
    type: Number,
    min: [0, 'Games cannot be negative'],
    default: 0
  },
  team2Games: {
    type: Number,
    min: [0, 'Games cannot be negative'],
    default: 0
  },
  pointsProcessed: {
    type: Boolean,
    default: false,
    index: true
  }
}, { _id: false });

const tournamentSchema = new Schema<ITournament>({
  name: {
    type: String,
    required: [true, 'Tournament name is required'],
    trim: true,
    minlength: [3, 'Tournament name must be at least 3 characters'],
    maxlength: [100, 'Tournament name cannot exceed 100 characters'],
    index: true
  },
  date: {
    type: Date,
    required: [true, 'Tournament date is required'],
    index: true
  },
  createdBy: {
    type: String,
    ref: 'User',
    required: [true, 'Created by is required'],
    index: true
  },
  matches: {
    type: [tournamentMatchSchema],
    default: []
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'completed'],
      message: 'Status must be draft or completed'
    },
    default: 'completed',
    index: true
  },
  totalMatches: {
    type: Number,
    default: 0,
    min: [0, 'Total matches cannot be negative']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for better query performance
tournamentSchema.index({ date: -1, status: 1 });
tournamentSchema.index({ createdBy: 1, date: -1 });
tournamentSchema.index({ status: 1, date: -1 });

// Pre-save middleware to calculate game scores from score string
tournamentSchema.pre('save', function(next) {
  const tournament = this;

  // Update totalMatches
  tournament.totalMatches = tournament.matches.length;

  // Calculate game scores for each match based on match type
  tournament.matches.forEach((match) => {
    if (match.score) {
      const scoreMatch = match.score.trim().match(/^(\d+)\s*-\s*(\d+)$/);
      if (scoreMatch && scoreMatch[1] && scoreMatch[2]) {
        const games1 = parseInt(scoreMatch[1] as string);
        const games2 = parseInt(scoreMatch[2] as string);

        if (match.matchType === 'doubles') {
          match.team1Games = games1;
          match.team2Games = games2;
        } else {
          // Singles
          match.player1Games = games1;
          match.player2Games = games2;
        }
      }
    }
  });

  next();
});

// Virtual for formatted date
tournamentSchema.virtual('formattedDate').get(function(this: ITournament) {
  return this.date.toISOString().split('T')[0];
});

// Virtual for completion percentage
tournamentSchema.virtual('completionPercentage').get(function(this: ITournament) {
  if (this.totalMatches === 0) return 0;
  const processedMatches = this.matches.filter(m => m.pointsProcessed).length;
  return Math.round((processedMatches / this.totalMatches) * 100);
});

const Tournament = mongoose.model<ITournament>('Tournament', tournamentSchema);

export default Tournament;

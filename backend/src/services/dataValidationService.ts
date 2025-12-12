import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';

export interface ValidationResult {
  playerId: string;
  playerName: string;
  expected: {
    seedPoints: number;
    matchesWon: number;
    matchesPlayed: number;
  };
  actual: {
    seedPoints: number;
    matchesWon: number;
    matchesPlayed: number;
  };
  mismatch: boolean;
  differences: {
    seedPoints: number;
    matchesWon: number;
    matchesPlayed: number;
  };
}

export interface ValidationReport {
  totalPlayers: number;
  validPlayers: number;
  mismatchPlayers: number;
  results: ValidationResult[];
  timestamp: Date;
}

export interface RepairResult {
  playerId: string;
  playerName: string;
  success: boolean;
  before: {
    seedPoints: number;
    matchesWon: number;
    matchesPlayed: number;
  };
  after: {
    seedPoints: number;
    matchesWon: number;
    matchesPlayed: number;
  };
  changes: {
    seedPoints: number;
    matchesWon: number;
    matchesPlayed: number;
  };
  error?: string;
}

export interface RepairAllResult {
  repaired: number;
  errors: number;
  details: RepairResult[];
}

class DataValidationService {
  /**
   * Validate a single player's stats against SeedingPoint records
   */
  static async validatePlayerStats(playerId: string): Promise<ValidationResult> {
    const player = await Player.findById(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Get all non-reversed tournament SeedingPoints for this player
    const playerPoints = await SeedingPoint.find({
      playerId: player._id,
      tournamentId: { $exists: true },
      matchIndex: { $exists: true },
      reversedAt: { $exists: false }
    });

    // Calculate expected stats from unique matches
    const uniqueMatches = new Map<string, { points: number; isWinner: boolean }>();

    for (const point of playerPoints) {
      const matchKey = `${point.tournamentId}_${point.matchIndex}`;

      // Only count each match once
      if (!uniqueMatches.has(matchKey)) {
        uniqueMatches.set(matchKey, {
          points: point.points,
          isWinner: point.isWinner || false
        });
      }
    }

    // Calculate expected stats
    const expected = {
      seedPoints: Array.from(uniqueMatches.values()).reduce((sum, m) => sum + m.points, 0),
      matchesWon: Array.from(uniqueMatches.values()).filter(m => m.isWinner).length,
      matchesPlayed: uniqueMatches.size
    };

    // Actual stats from Player model
    const actual = {
      seedPoints: player.seedPoints || 0,
      matchesWon: player.matchesWon || 0,
      matchesPlayed: player.matchesPlayed || 0
    };

    // Check for mismatches
    const mismatch =
      expected.seedPoints !== actual.seedPoints ||
      expected.matchesWon !== actual.matchesWon ||
      expected.matchesPlayed !== actual.matchesPlayed;

    return {
      playerId: player._id ? String(player._id) : '',
      playerName: player.fullName,
      expected,
      actual,
      mismatch,
      differences: {
        seedPoints: actual.seedPoints - expected.seedPoints,
        matchesWon: actual.matchesWon - expected.matchesWon,
        matchesPlayed: actual.matchesPlayed - expected.matchesPlayed
      }
    };
  }

  /**
   * Validate all players in the system
   */
  static async validateAllPlayers(): Promise<ValidationReport> {
    console.log('🔍 Starting validation of all players...');

    const players = await Player.find({});
    const results: ValidationResult[] = [];
    let validCount = 0;
    let mismatchCount = 0;

    for (const player of players) {
      try {
        const result = await this.validatePlayerStats(player._id ? String(player._id) : '');
        results.push(result);

        if (result.mismatch) {
          mismatchCount++;
        } else {
          validCount++;
        }
      } catch (error) {
        console.error(`Error validating player ${player.fullName}:`, error);
      }
    }

    console.log(`✅ Validation complete: ${validCount} valid, ${mismatchCount} mismatched`);

    return {
      totalPlayers: players.length,
      validPlayers: validCount,
      mismatchPlayers: mismatchCount,
      results,
      timestamp: new Date()
    };
  }

  /**
   * Auto-repair a single player's stats by recalculating from SeedingPoints
   */
  static async repairPlayerStats(playerId: string): Promise<RepairResult> {
    try {
      const player = await Player.findById(playerId);
      if (!player) {
        throw new Error(`Player ${playerId} not found`);
      }

      // Save original stats
      const before = {
        seedPoints: player.seedPoints || 0,
        matchesWon: player.matchesWon || 0,
        matchesPlayed: player.matchesPlayed || 0
      };

      // Validate to get expected stats
      const validation = await this.validatePlayerStats(playerId);

      if (!validation.mismatch) {
        // No repair needed
        return {
          playerId: player._id ? String(player._id) : '',
          playerName: player.fullName,
          success: true,
          before,
          after: before,
          changes: {
            seedPoints: 0,
            matchesWon: 0,
            matchesPlayed: 0
          }
        };
      }

      // Update player with correct stats
      player.seedPoints = validation.expected.seedPoints;
      player.matchesWon = validation.expected.matchesWon;
      player.matchesPlayed = validation.expected.matchesPlayed;
      await player.save();

      const after = {
        seedPoints: player.seedPoints,
        matchesWon: player.matchesWon,
        matchesPlayed: player.matchesPlayed
      };

      console.log(`🔧 Repaired ${player.fullName}: ${before.seedPoints} → ${after.seedPoints} pts`);

      return {
        playerId: player._id ? String(player._id) : '',
        playerName: player.fullName,
        success: true,
        before,
        after,
        changes: {
          seedPoints: after.seedPoints - before.seedPoints,
          matchesWon: after.matchesWon - before.matchesWon,
          matchesPlayed: after.matchesPlayed - before.matchesPlayed
        }
      };
    } catch (error: any) {
      console.error(`❌ Error repairing player ${playerId}:`, error);
      return {
        playerId,
        playerName: 'Unknown',
        success: false,
        before: { seedPoints: 0, matchesWon: 0, matchesPlayed: 0 },
        after: { seedPoints: 0, matchesWon: 0, matchesPlayed: 0 },
        changes: { seedPoints: 0, matchesWon: 0, matchesPlayed: 0 },
        error: error.message
      };
    }
  }

  /**
   * Repair all players with mismatched stats
   */
  static async repairAllMismatches(): Promise<RepairAllResult> {
    console.log('🔧 Starting auto-repair of all mismatched players...');

    // First validate all players to find mismatches
    const validation = await this.validateAllPlayers();
    const mismatched = validation.results.filter(r => r.mismatch);

    if (mismatched.length === 0) {
      console.log('✅ No mismatches found - all players have correct stats');
      return {
        repaired: 0,
        errors: 0,
        details: []
      };
    }

    console.log(`Found ${mismatched.length} players with mismatched stats`);

    const details: RepairResult[] = [];
    let repaired = 0;
    let errors = 0;

    for (const mismatch of mismatched) {
      const result = await this.repairPlayerStats(mismatch.playerId);
      details.push(result);

      if (result.success) {
        repaired++;
      } else {
        errors++;
      }
    }

    console.log(`✅ Auto-repair complete: ${repaired} repaired, ${errors} errors`);

    return {
      repaired,
      errors,
      details
    };
  }

  /**
   * Get quick health check of rankings data integrity
   */
  static async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    totalPlayers: number;
    mismatchCount: number;
    mismatchPercentage: number;
  }> {
    const validation = await this.validateAllPlayers();
    const mismatchPercentage = (validation.mismatchPlayers / validation.totalPlayers) * 100;

    let status: 'healthy' | 'warning' | 'error';
    if (validation.mismatchPlayers === 0) {
      status = 'healthy';
    } else if (validation.mismatchPlayers < 5 || mismatchPercentage < 5) {
      status = 'warning';
    } else {
      status = 'error';
    }

    return {
      status,
      totalPlayers: validation.totalPlayers,
      mismatchCount: validation.mismatchPlayers,
      mismatchPercentage: parseFloat(mismatchPercentage.toFixed(2))
    };
  }
}

export default DataValidationService;

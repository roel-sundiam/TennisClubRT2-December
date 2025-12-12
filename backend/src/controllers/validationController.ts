import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import DataValidationService from '../services/dataValidationService';

/**
 * @route   GET /api/validation/rankings
 * @desc    Validate all player rankings and return report
 * @access  Admin
 */
export const validateRankings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('📊 Validating player rankings...');

  const report = await DataValidationService.validateAllPlayers();

  res.status(200).json({
    success: true,
    data: {
      summary: {
        totalPlayers: report.totalPlayers,
        validPlayers: report.validPlayers,
        mismatchPlayers: report.mismatchPlayers,
        validPercentage: ((report.validPlayers / report.totalPlayers) * 100).toFixed(2),
        mismatchPercentage: ((report.mismatchPlayers / report.totalPlayers) * 100).toFixed(2)
      },
      mismatches: report.results.filter(r => r.mismatch),
      timestamp: report.timestamp
    },
    message: `Validation complete: ${report.mismatchPlayers} mismatches found`
  });
});

/**
 * @route   GET /api/validation/player/:playerId
 * @desc    Validate a specific player's stats
 * @access  Admin
 */
export const validatePlayer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { playerId } = req.params;

  if (!playerId) {
    res.status(400).json({
      success: false,
      error: 'Player ID is required'
    });
    return;
  }

  console.log(`📊 Validating player ${playerId}...`);

  const result = await DataValidationService.validatePlayerStats(playerId);

  res.status(200).json({
    success: true,
    data: result,
    message: result.mismatch
      ? `Player has mismatched stats`
      : `Player stats are correct`
  });
});

/**
 * @route   POST /api/validation/repair/:playerId
 * @desc    Repair a specific player's stats
 * @access  Admin
 */
export const repairPlayer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { playerId } = req.params;

  if (!playerId) {
    res.status(400).json({
      success: false,
      error: 'Player ID is required'
    });
    return;
  }

  console.log(`🔧 Repairing player ${playerId}...`);

  const result = await DataValidationService.repairPlayerStats(playerId);

  if (!result.success) {
    res.status(500).json({
      success: false,
      error: result.error || 'Failed to repair player stats'
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: result,
    message: result.changes.seedPoints === 0
      ? 'No changes needed - stats were already correct'
      : `Repaired ${result.playerName}: ${result.changes.seedPoints > 0 ? '+' : ''}${result.changes.seedPoints} pts`
  });
});

/**
 * @route   POST /api/validation/repair-all
 * @desc    Repair all players with mismatched stats
 * @access  Admin
 */
export const repairAllPlayers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔧 Repairing all mismatched players...');

  const result = await DataValidationService.repairAllMismatches();

  res.status(200).json({
    success: true,
    data: {
      summary: {
        repaired: result.repaired,
        errors: result.errors,
        total: result.details.length
      },
      details: result.details
    },
    message: `Repaired ${result.repaired} players with ${result.errors} errors`
  });
});

/**
 * @route   GET /api/validation/health
 * @desc    Quick health check of rankings data integrity
 * @access  Admin
 */
export const getRankingHealth = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🏥 Checking ranking health...');

  const health = await DataValidationService.getHealthStatus();

  res.status(200).json({
    success: true,
    data: health,
    message: `Ranking health: ${health.status.toUpperCase()}`
  });
});

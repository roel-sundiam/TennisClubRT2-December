import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import CalculatedRankingService from '../services/calculatedRankingService';

/**
 * @route   GET /api/rankings
 * @desc    Get calculated rankings for all players
 * @access  Public
 */
export const getRankings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { gender, limit } = req.query;

  console.log('📊 Fetching calculated rankings...');

  const stats = await CalculatedRankingService.calculateRankings({
    gender: gender as 'male' | 'female' | undefined,
    limit: limit ? parseInt(limit as string) : undefined
  });

  res.status(200).json({
    success: true,
    data: stats,
    message: `Retrieved ${stats.rankings.length} player rankings`
  });
});

/**
 * @route   GET /api/rankings/player/:playerId
 * @desc    Get ranking for a specific player
 * @access  Public
 */
export const getPlayerRanking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { playerId } = req.params;

  if (!playerId) {
    res.status(400).json({
      success: false,
      error: 'Player ID is required'
    });
    return;
  }

  console.log(`📊 Fetching ranking for player ${playerId}...`);

  const ranking = await CalculatedRankingService.getPlayerRanking(playerId);

  if (!ranking) {
    res.status(404).json({
      success: false,
      error: 'Player not found or has no tournament matches'
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: ranking,
    message: `Retrieved ranking for ${ranking.playerName}`
  });
});

/**
 * @route   GET /api/rankings/player/:playerId/stats
 * @desc    Get detailed stats for a specific player
 * @access  Public
 */
export const getPlayerStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { playerId } = req.params;

  if (!playerId) {
    res.status(400).json({
      success: false,
      error: 'Player ID is required'
    });
    return;
  }

  console.log(`📊 Fetching detailed stats for player ${playerId}...`);

  const stats = await CalculatedRankingService.getPlayerStats(playerId);

  if (!stats.ranking) {
    res.status(404).json({
      success: false,
      error: 'Player not found or has no tournament matches'
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: stats,
    message: `Retrieved stats for ${stats.ranking.playerName}`
  });
});

/**
 * @route   GET /api/rankings/top/:count
 * @desc    Get top N players
 * @access  Public
 */
export const getTopPlayers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { count } = req.params;
  const { gender } = req.query;

  if (!count) {
    res.status(400).json({
      success: false,
      error: 'Count parameter is required'
    });
    return;
  }

  const limit = parseInt(count);
  if (isNaN(limit) || limit < 1 || limit > 100) {
    res.status(400).json({
      success: false,
      error: 'Invalid count parameter (must be between 1 and 100)'
    });
    return;
  }

  console.log(`📊 Fetching top ${limit} players...`);

  const topPlayers = await CalculatedRankingService.getTopPlayers(
    limit,
    gender as 'male' | 'female' | undefined
  );

  res.status(200).json({
    success: true,
    data: topPlayers,
    message: `Retrieved top ${topPlayers.length} players`
  });
});

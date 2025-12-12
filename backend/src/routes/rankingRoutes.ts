import express from 'express';
import {
  getRankings,
  getPlayerRanking,
  getPlayerStats,
  getTopPlayers
} from '../controllers/rankingController';

const router = express.Router();

/**
 * @route   GET /api/rankings
 * @desc    Get calculated rankings for all players
 * @access  Public
 * @query   gender - Filter by 'male' or 'female'
 * @query   limit - Limit number of results
 */
router.get('/', getRankings);

/**
 * @route   GET /api/rankings/top/:count
 * @desc    Get top N players
 * @access  Public
 * @param   count - Number of top players to return (1-100)
 * @query   gender - Filter by 'male' or 'female'
 */
router.get('/top/:count', getTopPlayers);

/**
 * @route   GET /api/rankings/player/:playerId
 * @desc    Get ranking for a specific player
 * @access  Public
 * @param   playerId - Player ID
 */
router.get('/player/:playerId', getPlayerRanking);

/**
 * @route   GET /api/rankings/player/:playerId/stats
 * @desc    Get detailed stats for a specific player
 * @access  Public
 * @param   playerId - Player ID
 */
router.get('/player/:playerId/stats', getPlayerStats);

export default router;

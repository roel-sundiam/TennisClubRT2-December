import express from 'express';
import {
  validateRankings,
  validatePlayer,
  repairPlayer,
  repairAllPlayers,
  getRankingHealth
} from '../controllers/validationController';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();

// All validation routes require admin access
router.use(requireAdmin);

/**
 * @route   GET /api/validation/rankings
 * @desc    Validate all player rankings and return report
 * @access  Admin
 */
router.get('/rankings', validateRankings);

/**
 * @route   GET /api/validation/player/:playerId
 * @desc    Validate a specific player's stats
 * @access  Admin
 */
router.get('/player/:playerId', validatePlayer);

/**
 * @route   POST /api/validation/repair/:playerId
 * @desc    Repair a specific player's stats
 * @access  Admin
 */
router.post('/repair/:playerId', repairPlayer);

/**
 * @route   POST /api/validation/repair-all
 * @desc    Repair all players with mismatched stats
 * @access  Admin
 */
router.post('/repair-all', repairAllPlayers);

/**
 * @route   GET /api/validation/health
 * @desc    Quick health check of rankings data integrity
 * @access  Admin
 */
router.get('/health', getRankingHealth);

export default router;

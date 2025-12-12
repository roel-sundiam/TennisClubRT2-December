import express from 'express';
import {
  getPlayers,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
  getPlayerStats,
  updatePlayerMedal,
  deletePlayerMedal,
  editPlayerMedal
} from '../controllers/playerController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Public/Member routes (require authentication)
router.get('/', authenticateToken, getPlayers);
router.get('/:id/stats', authenticateToken, getPlayerStats);
router.get('/:id', authenticateToken, getPlayer);

// Admin routes (require admin privileges)
router.post('/', authenticateToken, requireAdmin, createPlayer);
router.put('/:id/medal', authenticateToken, requireAdmin, updatePlayerMedal);
router.patch('/:id/medal', authenticateToken, requireAdmin, editPlayerMedal);
router.delete('/:id/medal', authenticateToken, requireAdmin, deletePlayerMedal);
router.put('/:id', authenticateToken, requireAdmin, updatePlayer);
router.delete('/:id', authenticateToken, requireAdmin, deletePlayer);

export default router;

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import {
  getTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  processTournamentPoints,
  getTournamentStats,
  createTournamentValidation,
  updateTournamentValidation
} from '../controllers/tournamentController';

const router = Router();

// Public read endpoints - all authenticated users can view tournaments
router.get('/', authenticateToken, getTournaments);
router.get('/stats', authenticateToken, getTournamentStats);
router.get('/:id', authenticateToken, getTournament);

// Admin-only write endpoints
router.post('/', authenticateToken, requireAdmin, createTournamentValidation, createTournament);
router.put('/:id', authenticateToken, requireAdmin, updateTournamentValidation, updateTournament);
router.delete('/:id', authenticateToken, requireAdmin, deleteTournament);
router.post('/:id/process-points', authenticateToken, requireAdmin, processTournamentPoints);

export default router;

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { getClubInsightsReport } from '../controllers/clubInsightsController';

const router = Router();

router.get('/reports', authenticateToken, requireAdmin, getClubInsightsReport);

export default router;

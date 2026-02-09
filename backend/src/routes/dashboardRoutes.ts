import express from 'express';
import { getDashboardData } from '../controllers/superadminDashboardController';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/dashboard/superadmin
 * @desc    Get superadmin dashboard data with all 7 sections
 * @access  Superadmin only
 */
router.get('/superadmin', authenticateToken, requireSuperAdmin, getDashboardData);

export default router;

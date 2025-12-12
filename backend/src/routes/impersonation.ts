import express from 'express';
import {
  startImpersonation,
  stopImpersonation,
  getCurrentImpersonation,
  getImpersonationHistory
} from '../controllers/impersonationController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/impersonation/start/:userId
 * Start impersonating a user (admin only)
 */
router.post('/start/:userId', requireAdmin, startImpersonation);

/**
 * POST /api/impersonation/stop
 * Stop impersonating and return to admin account
 * (any impersonating user can call this)
 */
router.post('/stop', stopImpersonation);

/**
 * GET /api/impersonation/current
 * Get current impersonation context
 */
router.get('/current', getCurrentImpersonation);

/**
 * GET /api/impersonation/history
 * Get impersonation audit logs (admin only)
 */
router.get('/history', requireAdmin, getImpersonationHistory);

export default router;

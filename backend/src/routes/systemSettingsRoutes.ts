import express from 'express';
import {
  getSystemSettings,
  updateSystemSettings,
  initializeSystemSettings,
  getTennisBallsStats
} from '../controllers/systemSettingsController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * System Settings Routes
 *
 * Manages system-wide configuration settings like tennis ball pricing
 */

// GET /api/system-settings - Get current settings (all authenticated users)
router.get('/', authenticateToken, getSystemSettings);

// PUT /api/system-settings - Update settings (admins only)
router.put('/', authenticateToken, requireAdmin, updateSystemSettings);

// POST /api/system-settings/initialize - Initialize settings (superadmin only)
router.post('/initialize', authenticateToken, requireAdmin, initializeSystemSettings);

// GET /api/system-settings/tennis-balls-stats - Get tennis balls statistics (admins only)
router.get('/tennis-balls-stats', authenticateToken, requireAdmin, getTennisBallsStats);

export default router;

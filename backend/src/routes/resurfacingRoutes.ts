import express from 'express';
import { body } from 'express-validator';
import {
  createContribution,
  getAllContributions,
  updateContributionStatus,
  deleteContribution,
  getContributionStats,
  getPublicContributors
} from '../controllers/resurfacingController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/resurfacing/contributions
 * @desc    Create a new contribution pledge
 * @access  Public (any logged-in user)
 */
router.post(
  '/contributions',
  authenticateToken,
  [
    body('contributorName').trim().notEmpty().withMessage('Contributor name is required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    body('paymentMethod').isIn(['cash', 'gcash', 'bank_transfer']).withMessage('Invalid payment method'),
    body('notes').optional().trim()
  ],
  createContribution
);

/**
 * @route   GET /api/resurfacing/public-stats
 * @desc    Get public contribution statistics (no sensitive data)
 * @access  Public (authenticated users)
 */
router.get('/public-stats', authenticateToken, getContributionStats);

/**
 * @route   GET /api/resurfacing/public-contributors
 * @desc    Get list of public contributors (no sensitive data)
 * @access  Public (authenticated users)
 */
router.get('/public-contributors', authenticateToken, getPublicContributors);

/**
 * @route   GET /api/resurfacing/contributions
 * @desc    Get all contributions
 * @access  Admin only
 */
router.get('/contributions', authenticateToken, requireAdmin, getAllContributions);

/**
 * @route   GET /api/resurfacing/stats
 * @desc    Get contribution statistics
 * @access  Admin only
 */
router.get('/stats', authenticateToken, requireAdmin, getContributionStats);

/**
 * @route   PATCH /api/resurfacing/contributions/:id
 * @desc    Update contribution (full edit or status change)
 * @access  Admin only
 */
router.patch(
  '/contributions/:id',
  authenticateToken,
  requireAdmin,
  [
    body('contributorName').optional().trim().notEmpty().withMessage('Contributor name cannot be empty'),
    body('amount').optional().isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    body('paymentMethod').optional().isIn(['cash', 'gcash', 'bank_transfer']).withMessage('Invalid payment method'),
    body('status').optional().isIn(['pledged', 'received', 'cancelled']).withMessage('Invalid status'),
    body('notes').optional().trim()
  ],
  updateContributionStatus
);

/**
 * @route   DELETE /api/resurfacing/contributions/:id
 * @desc    Delete a contribution
 * @access  Admin only
 */
router.delete('/contributions/:id', authenticateToken, requireAdmin, deleteContribution);

export default router;

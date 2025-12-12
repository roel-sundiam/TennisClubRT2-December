import { Router, Request, Response, NextFunction } from 'express';
import {
  getMembers,
  getMemberProfile,
  getMemberActivity,
  getMemberStats,
  searchMembers,
  getMembersValidation,
  updateMemberApproval,
  deleteMember,
  getPendingMembers,
  resetMemberPassword
} from '../controllers/memberController';
import { authenticateToken, requireRole, preventImpersonationFor, AuthenticatedRequest } from '../middleware/auth';
import { validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }
  next();
};

/**
 * @route GET /api/members
 * @desc Get all members with filtering and pagination
 * @access Private
 */
router.get(
  '/',
  authenticateToken,
  getMembersValidation,
  handleValidationErrors,
  getMembers
);

/**
 * @route GET /api/members/search
 * @desc Search members by name, username, or email
 * @access Private
 */
router.get('/search', authenticateToken, searchMembers);

/**
 * @route GET /api/members/stats
 * @desc Get member statistics (admin only)
 * @access Private (Admin/SuperAdmin)
 */
router.get(
  '/stats',
  authenticateToken,
  requireRole(['admin', 'superadmin']),
  getMemberStats
);

/**
 * @route GET /api/members/:id
 * @desc Get member profile details
 * @access Private
 */
router.get('/:id', authenticateToken, getMemberProfile);

/**
 * @route GET /api/members/:id/activity
 * @desc Get member activity feed
 * @access Private
 */
router.get('/:id/activity', authenticateToken, getMemberActivity);

/**
 * @route GET /api/members/admin/pending
 * @desc Get pending members awaiting approval (admin only)
 * @access Private (Admin/SuperAdmin)
 */
router.get('/admin/pending', authenticateToken, requireRole(['admin', 'superadmin']), getPendingMembers);

/**
 * @route PUT /api/members/:id/approval
 * @desc Update member approval status (admin only)
 * @access Private (Admin/SuperAdmin)
 */
router.put('/:id/approval', authenticateToken, requireRole(['admin', 'superadmin']), preventImpersonationFor(['approve members']), updateMemberApproval);

/**
 * @route DELETE /api/members/:id
 * @desc Deactivate member (admin only)
 * @access Private (Admin/SuperAdmin)
 */
router.delete('/:id', authenticateToken, requireRole(['admin', 'superadmin']), preventImpersonationFor(['delete members']), deleteMember);

/**
 * @route PUT /api/members/:id/reset-password
 * @desc Reset member password to default (admin only)
 * @access Private (Admin/SuperAdmin)
 */
router.put('/:id/reset-password', authenticateToken, requireRole(['admin', 'superadmin']), resetMemberPassword);

export default router;
import express from 'express';
import {
  getCreditBalance,
  getCreditTransactions,
  depositCredits,
  adjustCredits,
  getCreditStats,
  refundCredits,
  getAllUserCredits,
  getAllCreditDeposits,
  recordCreditDeposit,
  getUserTransactions
} from '../controllers/creditController';
import { authenticateToken, requireApprovedUser, requireAdmin, requireFinancialAccess } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, query } from 'express-validator';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// Get current user's credit balance
router.get('/balance', 
  requireApprovedUser,
  getCreditBalance
);

// Get current user's credit transaction history
router.get('/transactions',
  requireApprovedUser,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['deposit', 'deduction', 'refund', 'adjustment']),
  validateRequest,
  getCreditTransactions
);

// Deposit credits (member can top-up their account)
router.post('/deposit',
  requireApprovedUser,
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be a positive number'),
  body('paymentMethod')
    .isIn(['cash', 'bank_transfer', 'gcash'])
    .withMessage('Payment method must be cash, bank_transfer, or gcash'),
  body('paymentReference')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Payment reference cannot exceed 100 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters'),
  validateRequest,
  depositCredits
);

// Get credit statistics (current user)
router.get('/stats',
  requireApprovedUser,
  getCreditStats
);

// Admin routes - Allow financial access (treasurer, admin, superadmin)
router.use(requireFinancialAccess);

// Get a specific user's credit transaction history (admin only)
router.get('/admin/user/:userId/transactions',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['deposit', 'deduction', 'refund', 'adjustment']),
  validateRequest,
  getUserTransactions
);

// Get all users' credit balances (admin only)
router.get('/admin/all-balances',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('search').optional().isString().trim(),
  validateRequest,
  getAllUserCredits
);

// Get all credit deposits (admin only)
router.get('/admin/deposits',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'completed', 'recorded', 'failed']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  getAllCreditDeposits
);

// Mark credit deposit as recorded (admin only)
router.post('/admin/deposits/:transactionId/record',
  validateRequest,
  recordCreditDeposit
);

// Adjust user credits (admin only)
router.post('/admin/adjust',
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('type')
    .isIn(['deposit', 'deduction'])
    .withMessage('Type must be deposit or deduction'),
  body('reason')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Reason must be between 3 and 200 characters'),
  validateRequest,
  adjustCredits
);

// Refund credits (admin only)
router.post('/admin/refund',
  body('reservationId')
    .optional()
    .isMongoId()
    .withMessage('Valid reservation ID is required'),
  body('pollId')
    .optional()
    .isMongoId()
    .withMessage('Valid poll ID is required'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('reason')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Reason must be between 3 and 200 characters'),
  validateRequest,
  refundCredits
);

export default router;
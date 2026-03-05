import express from 'express';
import {
  getReservations,
  getReservationsForDate,
  getReservation,
  createReservation,
  updateReservation,
  cancelReservation,
  joinReservation,
  leaveReservation,
  updateReservationStatus,
  completeReservation,
  getMyUpcomingReservations,
  createReservationValidation,
  updateReservationValidation,
  completeReservationValidation,
  blockCourt,
  getBlockedReservations,
  updateBlockedReservation,
  deleteBlockedReservation,
  blockCourtValidation
} from '../controllers/reservationController';
import { requireAdmin, requireApprovedUser, requireMembershipFees, authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = express.Router();

// Get user's upcoming reservations (just authentication required, no approval needed)
router.get('/my-upcoming', authenticateToken, getMyUpcomingReservations);

// All other reservation routes require approved users
router.use(requireApprovedUser);

// Get all reservations (with filtering)
router.get('/', getReservations);

// Get reservations for specific date with availability
router.get('/date/:date', getReservationsForDate);

// Get single reservation
router.get('/:id', getReservation);

// Create new reservation (requires membership fees paid)
router.post('/', 
  requireMembershipFees,
  createReservationValidation,
  validateRequest,
  createReservation
);

// Join an existing reservation (requires membership fees paid)
router.post('/:id/join', requireMembershipFees, joinReservation);

// Leave a reservation the user previously joined
router.post('/:id/leave', leaveReservation);

// Update reservation (requires membership fees paid)
router.put('/:id',
  requireMembershipFees,
  updateReservationValidation,
  validateRequest,
  updateReservation
);

// Cancel reservation
router.delete('/:id', cancelReservation);

// Admin only: Update reservation status
router.patch('/:id/status', requireAdmin, updateReservationStatus);

// Admin only: Complete reservation with match results
router.patch('/:id/complete',
  requireAdmin,
  completeReservationValidation,
  validateRequest,
  completeReservation
);

// Admin only: Court blocking routes
router.get('/admin/blocks', requireAdmin, getBlockedReservations);
router.post('/admin/block',
  requireAdmin,
  blockCourtValidation,
  validateRequest,
  blockCourt
);
router.put('/admin/block/:id', requireAdmin, updateBlockedReservation);
router.delete('/admin/block/:id', requireAdmin, deleteBlockedReservation);

export default router;
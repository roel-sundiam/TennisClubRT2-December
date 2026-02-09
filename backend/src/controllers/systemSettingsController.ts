import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import SystemSettings from '../models/SystemSettings';
import mongoose from 'mongoose';
import Reservation from '../models/Reservation';
import Payment from '../models/Payment';

/**
 * @desc    Get system settings
 * @route   GET /api/system-settings
 * @access  Private (authenticated users can view)
 */
export const getSystemSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  let settings = await SystemSettings.findOne();

  // Auto-create settings if they don't exist (with default values)
  if (!settings) {
    console.log('⚙️  System settings not found, creating with defaults...');

    // Use the authenticated user's ID as the creator
    const adminUserId = req.user?._id || new mongoose.Types.ObjectId();

    settings = await SystemSettings.create({
      tennisBallCostPerCan: 120,
      updatedBy: adminUserId
    });

    console.log('✅ System settings created successfully');
  }

  res.status(200).json({
    success: true,
    data: settings
  });
});

/**
 * @desc    Update system settings
 * @route   PUT /api/system-settings
 * @access  Private (Admin/SuperAdmin only)
 */
export const updateSystemSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tennisBallCostPerCan } = req.body;

  // Validation
  if (tennisBallCostPerCan !== undefined) {
    if (typeof tennisBallCostPerCan !== 'number' || tennisBallCostPerCan < 0) {
      res.status(400);
      throw new Error('Tennis ball cost per can must be a non-negative number');
    }

    if (tennisBallCostPerCan > 1000) {
      res.status(400);
      throw new Error('Tennis ball cost per can cannot exceed ₱1000');
    }

    if (tennisBallCostPerCan % 10 !== 0) {
      res.status(400);
      throw new Error('Tennis ball cost per can must be a multiple of ₱10');
    }
  }

  // Get or create settings
  let settings = await SystemSettings.findOne();

  if (!settings) {
    // Create if doesn't exist
    settings = new SystemSettings({
      tennisBallCostPerCan: tennisBallCostPerCan || 120,
      updatedBy: req.user!._id
    });
  } else {
    // Update existing settings
    if (tennisBallCostPerCan !== undefined) {
      settings.tennisBallCostPerCan = tennisBallCostPerCan;
    }
    settings.updatedBy = req.user!._id;
  }

  await settings.save();

  console.log(`⚙️  System settings updated by ${req.user!.username}`);
  console.log(`💰 Tennis ball cost per can: ₱${settings.tennisBallCostPerCan}`);

  res.status(200).json({
    success: true,
    message: 'System settings updated successfully',
    data: settings
  });
});

/**
 * @desc    Initialize system settings (for first-time setup)
 * @route   POST /api/system-settings/initialize
 * @access  Private (SuperAdmin only)
 */
export const initializeSystemSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const existingSettings = await SystemSettings.findOne();

  if (existingSettings) {
    res.status(400);
    throw new Error('System settings already initialized');
  }

  const settings = await SystemSettings.create({
    tennisBallCostPerCan: 120,
    updatedBy: req.user!._id
  });

  console.log(`⚙️  System settings initialized by ${req.user!.username}`);

  res.status(201).json({
    success: true,
    message: 'System settings initialized successfully',
    data: settings
  });
});

/**
 * @desc    Get tennis balls statistics
 * @route   GET /api/system-settings/tennis-balls-stats
 * @access  Private (Admin/SuperAdmin only)
 */
export const getTennisBallsStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Get all reservations with tennis balls
  const reservationsWithBalls = await Reservation.find({
    'tennisBalls.quantity': { $gt: 0 }
  })
  .select('tennisBalls date timeSlot createdAt userId paymentStatus')
  .populate('userId', 'username fullName')
  .sort({ date: -1 });

  // Get all paid reservations with tennis balls (to count sold/paid balls only)
  const paidReservationsWithBalls = await Reservation.find({
    'tennisBalls.quantity': { $gt: 0 },
    paymentStatus: 'paid'
  }).select('tennisBalls date timeSlot createdAt');

  // Calculate statistics
  const totalCansPurchased = reservationsWithBalls.reduce((sum, res) => {
    return sum + (res.tennisBalls?.quantity || 0);
  }, 0);

  const totalCansPaid = paidReservationsWithBalls.reduce((sum, res) => {
    return sum + (res.tennisBalls?.quantity || 0);
  }, 0);

  const totalRevenue = paidReservationsWithBalls.reduce((sum, res) => {
    return sum + (res.tennisBalls?.totalCost || 0);
  }, 0);

  const pendingRevenue = reservationsWithBalls
    .filter((res: any) => {
      // Find if this reservation is NOT in paid list
      return !paidReservationsWithBalls.some((paid: any) => paid._id.toString() === res._id.toString());
    })
    .reduce((sum, res) => {
      return sum + (res.tennisBalls?.totalCost || 0);
    }, 0);

  // Get current settings for average cost
  const settings = await SystemSettings.findOne();
  const currentCostPerCan = settings?.tennisBallCostPerCan || 120;

  // Build detailed purchases list
  const purchases = reservationsWithBalls.map((reservation: any) => ({
    reserverName: reservation.userId?.fullName || reservation.userId?.username || 'Unknown',
    date: reservation.date,
    quantity: reservation.tennisBalls?.quantity || 0,
    costPerCan: reservation.tennisBalls?.costPerCan || 0,
    totalCost: reservation.tennisBalls?.totalCost || 0,
    paymentStatus: reservation.paymentStatus || 'pending'
  }));

  res.status(200).json({
    success: true,
    data: {
      totalCansPurchased,
      totalCansPaid,
      totalCansPending: totalCansPurchased - totalCansPaid,
      totalRevenue,
      pendingRevenue,
      currentCostPerCan,
      totalReservationsWithBalls: reservationsWithBalls.length,
      paidReservationsWithBalls: paidReservationsWithBalls.length,
      purchases
    }
  });
});

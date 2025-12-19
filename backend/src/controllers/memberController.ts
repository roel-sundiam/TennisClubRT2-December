import { Response } from 'express';
import { query } from 'express-validator';
import User from '../models/User';
import Reservation from '../models/Reservation';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

// Get all members with filtering and pagination
export const getMembers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  // Build filter query
  const filter: any = {
    role: { $in: ['member', 'admin'] }
  };

  // Include active/approved filters unless explicitly requesting all users
  if (!req.query.includeAll) {
    filter.isActive = true;
    filter.isApproved = true;
  }

  // Search functionality
  if (req.query.search) {
    const searchTerm = req.query.search as string;
    filter.$or = [
      { fullName: { $regex: searchTerm, $options: 'i' } },
      { username: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } }
    ];
  }

  // Filter by gender
  if (req.query.gender) {
    filter.gender = req.query.gender;
  }

  // Filter by role
  if (req.query.role && ['member', 'admin'].includes(req.query.role as string)) {
    filter.role = req.query.role;
  }

  // Sort options
  let sortOption: any = { fullName: 1 }; // Default sort by name
  if (req.query.sort) {
    switch (req.query.sort) {
      case 'name':
        sortOption = { fullName: 1 };
        break;
      case 'newest':
        sortOption = { registrationDate: -1 };
        break;
      case 'oldest':
        sortOption = { registrationDate: 1 };
        break;
      case 'active':
        sortOption = { lastLogin: -1 };
        break;
    }
  }

  const total = await User.countDocuments(filter);

  // Select only public fields for members directory
  const publicFields = 'fullName username email gender profilePicture registrationDate lastLogin role coinBalance membershipFeesPaid isActive isApproved membershipYearsPaid';

  const members = await User.find(filter, publicFields)
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  return res.status(200).json({
    success: true,
    data: members,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  });
});

// Get member profile details
export const getMemberProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const member = await User.findOne({
    _id: id,
    isActive: true,
    isApproved: true
  }).select('fullName username email gender phone dateOfBirth profilePicture registrationDate lastLogin role coinBalance membershipFeesPaid');

  if (!member) {
    return res.status(404).json({
      success: false,
      error: 'Member not found'
    });
  }

  // Get member statistics
  const stats = await Promise.all([
    // Total reservations
    Reservation.countDocuments({ userId: id }),
    // Completed reservations
    Reservation.countDocuments({ userId: id, status: 'completed' }),
    // Total coins earned - DEPRECATED: Coin system removed
    Promise.resolve([{ _id: null, totalEarned: 0 }]),
    // Recent activity (last 5 reservations)
    Reservation.find({ userId: id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('date timeSlot status createdAt')
  ]);

  const memberStats = {
    totalReservations: stats[0],
    completedReservations: stats[1],
    totalCoinsEarned: stats[2][0]?.totalEarned || 0,
    recentActivity: stats[3]
  };

  return res.status(200).json({
    success: true,
    data: {
      ...member.toObject(),
      stats: memberStats
    }
  });
});

// Get member activity feed
export const getMemberActivity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  // Check if member exists and is accessible
  const member = await User.findOne({
    _id: id,
    isActive: true,
    isApproved: true
  });

  if (!member) {
    return res.status(404).json({
      success: false,
      error: 'Member not found'
    });
  }

  // Privacy check - only show own activity unless admin
  if (req.user?.role === 'member' && req.user._id.toString() !== id) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  // Get recent activities
  const activities = await Promise.all([
    // Recent reservations
    Reservation.find({ userId: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('date timeSlot status createdAt'),
    
    // Recent coin transactions - DEPRECATED: Coin system removed
    Promise.resolve([])
  ]);

  // Combine and sort activities by date
  const combinedActivities = [
    ...activities[0].map(reservation => ({
      type: 'reservation',
      date: reservation.createdAt,
      data: reservation
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);

  return res.status(200).json({
    success: true,
    data: combinedActivities
  });
});

// Get member statistics (admin only)
export const getMemberStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate } = req.query;
  
  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
  const end = endDate ? new Date(endDate as string) : new Date();
  
  if (end) {
    end.setHours(23, 59, 59, 999);
  }

  // Get member statistics
  const stats = await Promise.all([
    // Total members
    User.countDocuments({
      isActive: true,
      isApproved: true,
      role: { $in: ['member', 'admin'] }
    }),
    
    // New members in period
    User.countDocuments({
      isActive: true,
      isApproved: true,
      role: { $in: ['member', 'admin'] },
      registrationDate: { $gte: start, $lte: end }
    }),
    
    // Active members (logged in within 30 days)
    User.countDocuments({
      isActive: true,
      isApproved: true,
      role: { $in: ['member', 'admin'] },
      lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }),
    
    // Gender distribution
    User.aggregate([
      {
        $match: {
          isActive: true,
          isApproved: true,
          role: { $in: ['member', 'admin'] }
        }
      },
      {
        $group: {
          _id: '$gender',
          count: { $sum: 1 }
        }
      }
    ]),
    
    // Members with paid fees
    User.countDocuments({
      isActive: true,
      isApproved: true,
      role: { $in: ['member', 'admin'] },
      membershipFeesPaid: true
    }),
    
    // Average coin balance
    User.aggregate([
      {
        $match: {
          isActive: true,
          isApproved: true,
          role: { $in: ['member', 'admin'] }
        }
      },
      {
        $group: {
          _id: null,
          avgBalance: { $avg: '$coinBalance' },
          totalCoins: { $sum: '$coinBalance' }
        }
      }
    ])
  ]);

  return res.status(200).json({
    success: true,
    data: {
      totalMembers: stats[0],
      newMembers: stats[1],
      activeMembers: stats[2],
      genderDistribution: stats[3],
      membersWithPaidFees: stats[4],
      coinStats: stats[5][0] || { avgBalance: 0, totalCoins: 0 },
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }
    }
  });
});

// Search members
export const searchMembers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { q } = req.query;
  
  if (!q || (q as string).length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Search query must be at least 2 characters long'
    });
  }

  const searchTerm = q as string;
  const limit = parseInt(req.query.limit as string) || 10;

  const members = await User.find({
    isActive: true,
    isApproved: true,
    role: { $in: ['member', 'admin'] },
    $or: [
      { fullName: { $regex: searchTerm, $options: 'i' } },
      { username: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } }
    ]
  })
  .select('fullName username email profilePicture role')
  .limit(limit);

  return res.status(200).json({
    success: true,
    data: members
  });
});

// Update member approval status (Admin only)
export const updateMemberApproval = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { isApproved, membershipFeesPaid, notes } = req.body;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Member ID is required'
    });
  }

  // Check if user is admin
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }

  try {
    const member = await User.findById(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    // Update fields
    const updateFields: any = {};
    if (typeof isApproved === 'boolean') {
      updateFields.isApproved = isApproved;
    }
    if (typeof membershipFeesPaid === 'boolean') {
      updateFields.membershipFeesPaid = membershipFeesPaid;
    }

    const updatedMember = await User.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    ).select('-password');

    console.log(`👤 Member ${member.username} updated by ${req.user?.username}:`, updateFields);

    return res.status(200).json({
      success: true,
      message: `Member ${updatedMember?.fullName} updated successfully`,
      data: updatedMember
    });

  } catch (error) {
    console.error('Error updating member:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update member'
    });
  }
});

// Delete member (Admin only)
export const deleteMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Member ID is required'
    });
  }

  // Check if user is admin
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }

  try {
    const member = await User.findById(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    // Instead of deleting, mark as inactive
    const updatedMember = await User.findByIdAndUpdate(
      id,
      {
        isActive: false,
        deletedAt: new Date(),
        deletedBy: req.user?._id
      },
      { new: true }
    ).select('-password');

    console.log(`🗑️ Member ${member.username} deactivated by ${req.user?.username}`);

    return res.status(200).json({
      success: true,
      message: `Member ${member.fullName} has been deactivated`,
      data: updatedMember
    });

  } catch (error) {
    console.error('Error deleting member:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete member'
    });
  }
});

// Reactivate member (admin only)
export const reactivateMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Member ID is required'
    });
  }

  // Check if user is admin
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }

  try {
    const member = await User.findById(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    // Reactivate the member
    const updatedMember = await User.findByIdAndUpdate(
      id,
      {
        isActive: true,
        $unset: { deletedAt: 1, deletedBy: 1 }
      },
      { new: true }
    ).select('-password');

    console.log(`✅ Member ${member.username} reactivated by ${req.user?.username}`);

    return res.status(200).json({
      success: true,
      message: `Member ${member.fullName} has been reactivated`,
      data: updatedMember
    });

  } catch (error) {
    console.error('Error reactivating member:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reactivate member'
    });
  }
});

// Get pending members (Admin only)
export const getPendingMembers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Check if user is admin
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  try {
    const filter = {
      role: { $in: ['member'] },
      isActive: true,
      isApproved: false
    };

    const [pendingMembers, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ registrationDate: -1 })
        .limit(limit)
        .skip(skip),
      User.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: pendingMembers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching pending members:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch pending members'
    });
  }
});

// Reset member password to default (Admin only)
export const resetMemberPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const defaultPassword = 'RT2Tennis'; // Fixed default password

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Member ID is required'
    });
  }

  // Check if user is admin
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }

  try {
    const member = await User.findById(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    // Don't allow resetting admin/superadmin passwords unless you're a superadmin
    if (member.role === 'superadmin' || (member.role === 'admin' && req.user?.role !== 'superadmin')) {
      return res.status(403).json({
        success: false,
        error: 'Cannot reset password for this user level'
      });
    }

    // Update password directly - the pre-save hook will hash it
    member.password = defaultPassword;
    await member.save();

    console.log(`🔑 Password reset for ${member.username} by ${req.user?.username}`);

    return res.status(200).json({
      success: true,
      message: `Password for ${member.fullName} has been reset to "RT2Tennis"`
    });

  } catch (error) {
    console.error('Error resetting member password:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

// Validation rules
export const getMembersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Search term must be 2-50 characters'),
  query('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Invalid gender'),
  query('role')
    .optional()
    .isIn(['member', 'admin'])
    .withMessage('Invalid role'),
  query('sort')
    .optional()
    .isIn(['name', 'newest', 'oldest', 'active'])
    .withMessage('Invalid sort option')
];
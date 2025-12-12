import { Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import User from '../models/User';
import ImpersonationLog from '../models/ImpersonationLog';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Generate JWT token with optional impersonation claims
 */
const generateToken = (
  userId: string,
  impersonation?: {
    adminId: string;
    impersonatedUserId: string;
    startedAt: number;
  }
): string => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined');
  }

  const payload: any = { userId };

  if (impersonation) {
    payload.impersonation = impersonation;
  }

  return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn } as SignOptions);
};

/**
 * Extract IP address from request
 */
const getClientIP = (req: AuthenticatedRequest): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

/**
 * Start impersonating a user
 * POST /api/impersonation/start/:userId
 */
export const startImpersonation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const adminUser = req.user!;
  const targetUserId = req.params.userId;

  console.log(`👥 Impersonation start requested by ${adminUser.username} for user ${targetUserId}`);

  // Validate target user exists
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    });
    return;
  }

  // Validate target user is active
  if (!targetUser.isActive) {
    res.status(400).json({
      success: false,
      error: 'Cannot impersonate inactive user'
    });
    return;
  }

  // Validate target user is not an admin/superadmin
  if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
    res.status(403).json({
      success: false,
      error: 'Cannot impersonate administrators'
    });
    return;
  }

  // Generate new JWT with impersonation claims
  const startedAt = Date.now();
  const token = generateToken(targetUser._id.toString(), {
    adminId: adminUser._id.toString(),
    impersonatedUserId: targetUser._id.toString(),
    startedAt
  });

  // Create impersonation log entry
  const impersonationLog = new ImpersonationLog({
    adminId: adminUser._id,
    impersonatedUserId: targetUser._id,
    startedAt: new Date(startedAt),
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    status: 'active',
    metadata: {
      adminUsername: adminUser.username,
      adminFullName: adminUser.fullName,
      impersonatedUsername: targetUser.username,
      impersonatedFullName: targetUser.fullName
    }
  });

  await impersonationLog.save();

  console.log(`✅ Impersonation started: ${adminUser.username} → ${targetUser.username} (log ID: ${impersonationLog._id})`);

  res.json({
    success: true,
    data: {
      token,
      user: targetUser.toObject(),
      adminUser: {
        _id: adminUser._id,
        username: adminUser.username,
        fullName: adminUser.fullName,
        role: adminUser.role
      },
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      impersonationLogId: impersonationLog._id
    },
    message: `Now viewing as ${targetUser.fullName}`
  });
});

/**
 * Stop impersonating and return to admin account
 * POST /api/impersonation/stop
 */
export const stopImpersonation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const impersonation = req.impersonation;

  // Validate that we're currently impersonating
  if (!impersonation?.isImpersonating) {
    res.status(400).json({
      success: false,
      error: 'Not currently impersonating any user'
    });
    return;
  }

  const adminUser = impersonation.adminUser!;

  console.log(`👥 Stopping impersonation: ${adminUser.username} was viewing as ${currentUser.username}`);

  // Generate new JWT with original admin userId (no impersonation claims)
  const token = generateToken(adminUser._id.toString());

  // Update impersonation log - find the most recent active log
  const impersonationLog = await ImpersonationLog.findOne({
    adminId: adminUser._id,
    impersonatedUserId: currentUser._id,
    status: 'active'
  }).sort({ startedAt: -1 });

  if (impersonationLog) {
    const endedAt = new Date();
    const duration = Math.floor((endedAt.getTime() - impersonationLog.startedAt.getTime()) / 1000);

    impersonationLog.endedAt = endedAt;
    impersonationLog.duration = duration;
    impersonationLog.status = 'ended';
    await impersonationLog.save();

    console.log(`✅ Impersonation ended (duration: ${duration}s, log ID: ${impersonationLog._id})`);
  }

  res.json({
    success: true,
    data: {
      token,
      user: adminUser.toObject(),
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },
    message: `Returned to ${adminUser.fullName}'s account`
  });
});

/**
 * Get current impersonation context
 * GET /api/impersonation/current
 */
export const getCurrentImpersonation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const impersonation = req.impersonation;

  if (!impersonation?.isImpersonating) {
    res.json({
      success: true,
      data: {
        isImpersonating: false
      }
    });
    return;
  }

  res.json({
    success: true,
    data: {
      isImpersonating: true,
      adminUser: {
        _id: impersonation.adminUser!._id,
        username: impersonation.adminUser!.username,
        fullName: impersonation.adminUser!.fullName,
        role: impersonation.adminUser!.role
      },
      impersonatedUser: {
        _id: req.user!._id,
        username: req.user!.username,
        fullName: req.user!.fullName,
        role: req.user!.role
      }
    }
  });
});

/**
 * Get impersonation history (admin only)
 * GET /api/impersonation/history
 * Query params: page, limit, adminId, impersonatedUserId, startDate, endDate
 */
export const getImpersonationHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  // Build query filters
  const query: any = {};

  if (req.query.adminId) {
    query.adminId = req.query.adminId;
  }

  if (req.query.impersonatedUserId) {
    query.impersonatedUserId = req.query.impersonatedUserId;
  }

  if (req.query.status) {
    query.status = req.query.status;
  }

  if (req.query.startDate || req.query.endDate) {
    query.startedAt = {};
    if (req.query.startDate) {
      query.startedAt.$gte = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      query.startedAt.$lte = new Date(req.query.endDate as string);
    }
  }

  // Execute query with pagination
  const [logs, total] = await Promise.all([
    ImpersonationLog.find(query)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('adminId', 'username fullName role')
      .populate('impersonatedUserId', 'username fullName role'),
    ImpersonationLog.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: logs,
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

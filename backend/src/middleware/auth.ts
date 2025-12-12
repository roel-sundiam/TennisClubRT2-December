import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUserDocument } from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: IUserDocument;
  userId?: string;
  // Impersonation context
  impersonation?: {
    isImpersonating: boolean;
    adminUser?: IUserDocument;
    adminId?: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('🔐 Auth middleware - Headers:', Object.keys(req.headers));
    console.log('🔐 Auth middleware - Authorization header:', req.headers.authorization ? 'present' : 'missing');
    
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('🔐 Auth middleware - No token found');
      res.status(401).json({
        success: false,
        error: 'Access token required'
      });
      return;
    }

    console.log('🔐 Auth middleware - Token found, verifying...');

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({
        success: false,
        error: 'JWT secret not configured'
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      impersonation?: {
        adminId: string;
        impersonatedUserId: string;
        startedAt: number;
      };
    };

    const user = await User.findById(decoded.userId).select('+password');
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid token - user not found'
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        error: 'Account has been deactivated'
      });
      return;
    }

    if (!user.isApproved && user.role !== 'superadmin') {
      res.status(401).json({
        success: false,
        error: 'Account pending approval'
      });
      return;
    }

    req.user = user;
    req.userId = user._id.toString();

    // Handle impersonation context
    if (decoded.impersonation) {
      const adminUser = await User.findById(decoded.impersonation.adminId);

      if (!adminUser || !['admin', 'superadmin'].includes(adminUser.role)) {
        res.status(401).json({
          success: false,
          error: 'Invalid impersonation - admin not found or unauthorized'
        });
        return;
      }

      req.impersonation = {
        isImpersonating: true,
        adminUser,
        adminId: adminUser._id.toString()
      };

      console.log(`👥 Impersonation: ${adminUser.username} viewing as ${user.username}`);
    }

    next();
  } catch (error) {
    console.log('🔐 Auth middleware - Error occurred:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      console.log('🔐 Auth middleware - JWT Error:', error.message);
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      console.log('🔐 Auth middleware - Token expired:', error.message);
      res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    } else {
      console.log('🔐 Auth middleware - Other error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication error'
      });
    }
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(['admin', 'superadmin']);
export const requireSuperAdmin = requireRole(['superadmin']);

export const requireApprovedUser = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  if (!req.user.isApproved && req.user.role !== 'superadmin') {
    res.status(403).json({
      success: false,
      error: 'Account pending approval'
    });
    return;
  }

  next();
};

export const requireMembershipFees = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  if (!req.user.membershipFeesPaid && req.user.role === 'member') {
    res.status(403).json({
      success: false,
      error: 'Membership fees must be paid before using this feature'
    });
    return;
  }

  next();
};

export const preventImpersonationFor = (actions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (req.impersonation?.isImpersonating) {
      res.status(403).json({
        success: false,
        error: `Action not allowed during impersonation: ${actions.join(', ')}`
      });
      return;
    }
    next();
  };
};
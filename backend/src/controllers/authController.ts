import { Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import User from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { RegisterRequest, LoginRequest, AuthResponse } from '../types';

const generateToken = (userId: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined');
  }
  
  return jwt.sign({ userId }, jwtSecret, { expiresIn: jwtExpiresIn } as SignOptions);
};

export const register = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { username, fullName, email, password, gender, phone, dateOfBirth }: RegisterRequest = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ username }, { email }]
  });

  if (existingUser) {
    res.status(400).json({
      success: false,
      error: existingUser.username === username ? 'Username already exists' : 'Email already exists'
    });
    return;
  }

  // Create new user
  const user = new User({
    username,
    fullName,
    email,
    password,
    gender,
    phone,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    isApproved: false // Requires admin approval
  });

  await user.save();

  // Generate token for immediate login (even though approval is pending)
  const token = generateToken(user._id.toString());

  const response: AuthResponse = {
    token,
    user: { ...user.toObject(), _id: user._id.toString() },
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  };

  res.status(201).json({
    success: true,
    data: response,
    message: 'Registration successful. Your account is pending approval by an administrator.'
  });
});

export const login = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { username, password }: LoginRequest = req.body;

  // Find user and include password field
  const user = await User.findOne({
    $or: [{ username }, { email: username }]
  }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    res.status(401).json({
      success: false,
      error: 'Invalid username or password'
    });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({
      success: false,
      error: 'Your account has been deactivated'
    });
    return;
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate token
  const token = generateToken(user._id.toString());

  const response: AuthResponse = {
    token,
    user: { ...user.toObject(), _id: user._id.toString() },
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  };

  res.status(200).json({
    success: true,
    data: response,
    message: 'Login successful'
  });
});

export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // In a stateless JWT implementation, logout is handled client-side
  // You could implement token blacklisting here if needed
  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: req.user.toObject()
  });
});

export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    });
    return;
  }

  const allowedUpdates = ['fullName', 'email', 'phone', 'dateOfBirth'];
  const updates = Object.keys(req.body);
  const isValidOperation = updates.every(update => allowedUpdates.includes(update));

  if (!isValidOperation) {
    res.status(400).json({
      success: false,
      error: 'Invalid updates'
    });
    return;
  }

  // Check if email is already taken by another user
  if (req.body.email && req.body.email !== req.user.email) {
    const existingUser = await User.findOne({ 
      email: req.body.email,
      _id: { $ne: req.user._id }
    });
    
    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
      return;
    }
  }

  updates.forEach(update => {
    (req.user as any)[update] = req.body[update];
  });

  if (req.body.dateOfBirth) {
    req.user.dateOfBirth = new Date(req.body.dateOfBirth);
  }

  await req.user.save();

  res.status(200).json({
    success: true,
    data: req.user.toObject(),
    message: 'Profile updated successfully'
  });
});

export const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'User not authenticated'
    });
    return;
  }

  const { currentPassword, newPassword } = req.body;

  // Get user with password field
  const user = await User.findById(req.user._id).select('+password');
  
  if (!user || !(await user.comparePassword(currentPassword))) {
    res.status(400).json({
      success: false,
      error: 'Current password is incorrect'
    });
    return;
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});
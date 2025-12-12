/**
 * Test Controller for E2E Testing
 * Provides endpoints for seeding and cleaning up test data
 * IMPORTANT: These endpoints should only be available in test environment
 */

import { Request, Response } from 'express';
import User from '../models/User';
import Reservation from '../models/Reservation';
import Payment from '../models/Payment';
import CreditTransaction from '../models/CreditTransaction';
import Poll from '../models/Poll';
import Suggestion from '../models/Suggestion';

/**
 * Seed test database with initial data
 * Creates test users, sets up basic data for testing
 */
export const seedTestData = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only allow in test environment
    if (process.env.NODE_ENV !== 'test') {
      res.status(403).json({
        success: false,
        message: 'Test endpoints only available in test environment'
      });
      return;
    }

    console.log('🌱 Seeding test database...');

    // Create test users if they don't exist
    const testUsers = [
      {
        username: 'superadmin',
        email: 'superadmin@tennisclub.com',
        password: 'admin123', // Will be hashed by pre-save hook
        firstName: 'Super',
        lastName: 'Admin',
        role: 'superadmin',
        isApproved: true,
        membershipFeesPaid: true,
        coinBalance: 1000
      },
      {
        username: 'admin',
        email: 'admin@tennisclub.com',
        password: 'admin123',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'admin',
        isApproved: true,
        membershipFeesPaid: true,
        coinBalance: 500
      },
      {
        username: 'RoelSundiam',
        email: 'roel@tennisclub.com',
        password: 'RT2Tennis',
        firstName: 'Roel',
        lastName: 'Sundiam',
        role: 'member',
        isApproved: true,
        membershipFeesPaid: true,
        coinBalance: 0 // For testing low balance warnings
      },
      {
        username: 'testmember',
        email: 'testmember@tennisclub.com',
        password: 'pass123',
        firstName: 'Test',
        lastName: 'Member',
        role: 'member',
        isApproved: true,
        membershipFeesPaid: true,
        coinBalance: 100
      }
    ];

    for (const userData of testUsers) {
      const existingUser = await User.findOne({ username: userData.username });
      if (!existingUser) {
        await User.create(userData);
        console.log(`✅ Created test user: ${userData.username}`);
      } else {
        console.log(`ℹ️  Test user already exists: ${userData.username}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Test data seeded successfully',
      data: {
        usersCreated: testUsers.length
      }
    });
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed test data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Cleanup test database
 * Removes all test data except core users
 */
export const cleanupTestData = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only allow in test environment
    if (process.env.NODE_ENV !== 'test') {
      res.status(403).json({
        success: false,
        message: 'Test endpoints only available in test environment'
      });
      return;
    }

    console.log('🧹 Cleaning up test database...');

    // Delete all reservations
    const reservationsDeleted = await Reservation.deleteMany({});
    console.log(`🗑️  Deleted ${reservationsDeleted.deletedCount} reservations`);

    // Delete all payments
    const paymentsDeleted = await Payment.deleteMany({});
    console.log(`🗑️  Deleted ${paymentsDeleted.deletedCount} payments`);

    // Delete all credit transactions
    const creditTxDeleted = await CreditTransaction.deleteMany({});
    console.log(`🗑️  Deleted ${creditTxDeleted.deletedCount} credit transactions`);

    // Delete all polls
    const pollsDeleted = await Poll.deleteMany({});
    console.log(`🗑️  Deleted ${pollsDeleted.deletedCount} polls`);

    // Delete all suggestions
    const suggestionsDeleted = await Suggestion.deleteMany({});
    console.log(`🗑️  Deleted ${suggestionsDeleted.deletedCount} suggestions`);

    console.log('✅ Test database cleaned successfully');

    res.status(200).json({
      success: true,
      message: 'Test data cleaned up successfully',
      data: {
        reservationsDeleted: reservationsDeleted.deletedCount,
        paymentsDeleted: paymentsDeleted.deletedCount,
        creditTransactionsDeleted: creditTxDeleted.deletedCount,
        pollsDeleted: pollsDeleted.deletedCount,
        suggestionsDeleted: suggestionsDeleted.deletedCount
      }
    });
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup test data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Health check for test environment
 */
export const testHealthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: 'Test environment is ready',
      data: {
        environment: process.env.NODE_ENV,
        database: 'TennisClubRT2_Test',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Test environment check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

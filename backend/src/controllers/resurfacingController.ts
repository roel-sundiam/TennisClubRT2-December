import { Request, Response } from 'express';
import ResurfacingContribution from '../models/ResurfacingContribution';
import { validationResult } from 'express-validator';

/**
 * Create a new resurfacing contribution
 */
export const createContribution = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
      return;
    }

    const { contributorName, amount, paymentMethod, notes } = req.body;

    const contribution = new ResurfacingContribution({
      contributorName,
      amount,
      paymentMethod,
      notes,
      status: 'pledged'
    });

    await contribution.save();

    console.log('✅ Resurfacing contribution created:', contribution._id);
    res.status(201).json({
      success: true,
      message: 'Contribution pledge recorded successfully!',
      data: contribution
    });
  } catch (error) {
    console.error('❌ Error creating contribution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record contribution',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get all contributions (Admin only)
 */
export const getAllContributions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;

    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const contributions = await ResurfacingContribution.find(filter)
      .populate('receivedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Calculate totals
    const totals = {
      pledged: 0,
      received: 0,
      total: 0
    };

    contributions.forEach(contrib => {
      totals.total += contrib.amount;
      if (contrib.status === 'pledged') {
        totals.pledged += contrib.amount;
      } else if (contrib.status === 'received') {
        totals.received += contrib.amount;
      }
    });

    res.json({
      success: true,
      data: {
        contributions,
        totals,
        count: contributions.length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching contributions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contributions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update contribution status (Admin only)
 */
export const updateContributionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes, contributorName, amount, paymentMethod } = req.body;
    const adminId = (req as any).user?.userId;

    const contribution = await ResurfacingContribution.findById(id);

    if (!contribution) {
      res.status(404).json({ success: false, message: 'Contribution not found' });
      return;
    }

    // Update all provided fields
    if (contributorName !== undefined) {
      contribution.contributorName = contributorName;
    }
    if (amount !== undefined) {
      contribution.amount = amount;
    }
    if (paymentMethod !== undefined) {
      contribution.paymentMethod = paymentMethod;
    }
    if (status !== undefined) {
      contribution.status = status;
    }
    if (notes !== undefined) {
      contribution.notes = notes;
    }

    // If marking as received, record who and when
    if (status === 'received' && contribution.status !== 'received') {
      contribution.receivedBy = adminId;
      contribution.receivedAt = new Date();
    }

    await contribution.save();

    console.log(`✅ Contribution ${id} updated successfully`);
    res.json({
      success: true,
      message: 'Contribution updated successfully',
      data: contribution
    });
  } catch (error) {
    console.error('❌ Error updating contribution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contribution',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Delete a contribution (Admin only)
 */
export const deleteContribution = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const contribution = await ResurfacingContribution.findByIdAndDelete(id);

    if (!contribution) {
      res.status(404).json({ success: false, message: 'Contribution not found' });
      return;
    }

    console.log(`✅ Contribution ${id} deleted`);
    res.json({
      success: true,
      message: 'Contribution deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting contribution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contribution',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get contribution statistics (Admin only)
 */
export const getContributionStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await ResurfacingContribution.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const formattedStats = {
      pledged: { count: 0, amount: 0 },
      received: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
      overall: { count: 0, amount: 0 }
    };

    stats.forEach(stat => {
      const status = stat._id as 'pledged' | 'received' | 'cancelled';
      if (status === 'pledged' || status === 'received' || status === 'cancelled') {
        formattedStats[status] = {
          count: stat.count,
          amount: stat.totalAmount
        };
      }
      formattedStats.overall.count += stat.count;
      if (stat._id !== 'cancelled') {
        formattedStats.overall.amount += stat.totalAmount;
      }
    });

    res.json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    console.error('❌ Error fetching contribution stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get public contributors list (Public - authenticated users)
 * Returns only non-sensitive data for public display
 */
export const getPublicContributors = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only show non-cancelled contributions
    const contributions = await ResurfacingContribution.find({
      status: { $in: ['pledged', 'received'] }
    })
      .select('contributorName amount status createdAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: contributions
    });
  } catch (error) {
    console.error('❌ Error fetching public contributors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contributors',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

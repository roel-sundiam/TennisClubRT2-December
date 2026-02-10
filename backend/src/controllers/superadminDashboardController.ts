import { Request, Response } from 'express';
import Reservation from '../models/Reservation';
import Payment from '../models/Payment';
import User from '../models/User';
import Suggestion from '../models/Suggestion';
import { PageView } from '../models/Analytics';
import { asyncHandler } from '../middleware/errorHandler';
import { nowInManila } from '../utils/timezone.util';

/**
 * Get Superadmin Dashboard Data

 * Returns all 7 dashboard sections in a single response
 * Recent payments filtered to last 30 days

 * @route GET /api/dashboard/superadmin
 * @access Superadmin only
 */
export const getDashboardData = asyncHandler(async (req: Request, res: Response) => {
  // Use Philippine time for all time-based filtering
  const manilaTime = nowInManila();
  const currentHour = manilaTime.hour;
  
  // Get Philippine date for querying today's reservations
  const phTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
  const phTime = new Date(phTimeStr);
  const now = phTime;
  
  // Get today's date string in YYYY-MM-DD format (Philippine time)
  const year = phTime.getFullYear();
  const month = String(phTime.getMonth() + 1).padStart(2, '0');
  const day = String(phTime.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  
  // Set date boundaries for querying (using the same logic as getReservationsForDate)
  const queryDate = new Date(todayStr);
  const startOfToday = new Date(queryDate);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(queryDate);
  endOfToday.setHours(23, 59, 59, 999);

  console.log('🕐 Superadmin Dashboard - Philippine Time:', phTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  console.log('🕐 Current Hour:', currentHour);
  console.log('📅 Query date string:', todayStr);
  console.log('📅 Date boundaries:', startOfToday.toISOString(), 'to', endOfToday.toISOString());

  // Set date range for recent payments (last 30 days)
  // NOTE: Filters by createdAt to match Court Receipts Report (/admin/reports) behavior
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); // 30 days back

  try {
    // Execute all queries in parallel for optimal performance
    const [
      todaysReservations,
      recentReservations,
      recentPayments,
      latestFeedback,
      lastTennisBallPurchase,
      recentPageVisits,
      membersWithOverpayments
    ] = await Promise.all([
      // 1. Fetch ALL reservations for today (we'll filter for current/next in JavaScript)
      Reservation.find({
        date: { $gte: startOfToday, $lte: endOfToday },
        status: { $in: ['confirmed', 'pending'] }
      })
        .populate('userId', 'fullName username')
        .select('userId date timeSlot endTimeSlot players status totalFee')
        .sort({ timeSlot: 1 })
        .lean(),

      // 3. Last 5 reservations
      Reservation.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'fullName username')
        .select('userId date timeSlot endTimeSlot players totalFee status createdAt')
        .lean(),

      // 4. Last 5 completed payments (from last 30 days)
      // NOTE: Using createdAt instead of paymentDate to match Court Receipts Report behavior
      Payment.find({
        status: 'completed',
        createdAt: { $gte: thirtyDaysAgo }
      })
        .sort({ paymentDate: -1 })
        .limit(5)
        .populate('userId', 'fullName username')
        .select('userId amount paymentMethod paymentDate description status')
        .lean()
        .then(payments => {
          console.log('💰 Recent Payments Query Results (last 30 days by createdAt):', payments.length, 'payments');
          payments.forEach((p: any, i) => {
            console.log(`  ${i + 1}. ${p.userId?.fullName || 'Unknown'} - ₱${p.amount} - Status: ${p.status} - Created: ${p.createdAt}`);
          });
          return payments;
        }),

      // 5. Latest feedback (5 items)
      Suggestion.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'fullName username')
        .select('userId type title description status priority createdAt')
        .lean(),

      // 6. Last tennis ball purchase
      Reservation.findOne({
        'tennisBalls.quantity': { $gt: 0 }
      })
        .sort({ createdAt: -1 })
        .populate('userId', 'fullName username')
        .select('userId date timeSlot tennisBalls createdAt')
        .lean(),

      // 7. Recent page views (last 20, excluding superadmin users and login/register pages)
      PageView.aggregate([
        // Filter out login/register pages and anonymous visits
        {
          $match: {
            userId: { $exists: true, $ne: '' },
            page: { $nin: ['Login', 'Registration'] }
          }
        },
        // Sort by most recent
        { $sort: { timestamp: -1 } },
        // Limit to get enough results before filtering
        { $limit: 100 },
        // Convert string userId to ObjectId for lookup
        {
          $addFields: {
            userObjectId: {
              $cond: {
                if: { $and: [{ $ne: ['$userId', null] }, { $ne: ['$userId', ''] }] },
                then: { $toObjectId: '$userId' },
                else: null
              }
            }
          }
        },
        // Left join with User collection
        {
          $lookup: {
            from: 'users',
            localField: 'userObjectId',
            foreignField: '_id',
            as: 'user'
          }
        },
        // Unwind user array
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        // Filter out superadmin users
        {
          $match: {
            'user.role': { $ne: 'superadmin' }
          }
        },
        // Project only needed fields
        {
          $project: {
            _id: 1,
            userId: {
              _id: { $ifNull: ['$user._id', null] },
              fullName: { $ifNull: ['$user.fullName', 'Unknown User'] },
              username: { $ifNull: ['$user.username', ''] },
              role: { $ifNull: ['$user.role', ''] }
            },
            page: 1,
            path: 1,
            timestamp: 1
          }
        },
        // Limit final results to 20
        { $limit: 20 }
      ]),

      // 8. Members with overpayments (credit balance > 0)
      User.find({
        creditBalance: { $gt: 0 },
        isActive: true,
        isApproved: true
      })
        .sort({ creditBalance: -1 })
        .select('fullName username email creditBalance')
        .lean()
    ]);

    console.log('📋 Today\'s Active Reservations:', todaysReservations.length);
    todaysReservations.forEach((r: any) => {
      console.log(`  - ${r.timeSlot}:00-${r.endTimeSlot}:00 (${r.status})`);
    });

    console.log('📊 Recent User Activity:', recentPageVisits.length);
    if (recentPageVisits.length > 0) {
      recentPageVisits.slice(0, 5).forEach((pv: any, i: number) => {
        console.log(`  ${i + 1}. ${pv.userId?.fullName || 'Unknown'} - ${pv.action} (${pv.component}) - ${new Date(pv.timestamp).toLocaleString()}`);
      });
    } else {
      console.log('  ⚠️ No non-superadmin user activity found');
    }

    // Filter current and next reservations in JavaScript (same logic as court status service)
    let currentReservation: any = null;
    let nextReservation: any = null;

    // Current reservation: one that covers the current hour
    for (const res of todaysReservations) {
      if (res.timeSlot <= currentHour && res.endTimeSlot && res.endTimeSlot > currentHour) {
        currentReservation = res;
        console.log('✅ Found CURRENT reservation:', res.timeSlot, '-', res.endTimeSlot);
        break;
      }
    }

    if (!currentReservation) {
      console.log('❌ No current reservation');
    }

    // Next reservation: first one that starts after current hour (excluding current)
    const upcomingReservations = todaysReservations
      .filter((r: any) => {
        // Exclude current reservation if it exists
        if (currentReservation && r._id.toString() === currentReservation._id.toString()) {
          return false;
        }
        // Include only reservations starting after current hour
        return r.timeSlot > currentHour;
      })
      .sort((a: any, b: any) => a.timeSlot - b.timeSlot);

    console.log('🔍 Potential NEXT reservations:', upcomingReservations.length);

    if (upcomingReservations.length > 0) {
      nextReservation = upcomingReservations[0];
      console.log('✅ Found NEXT reservation:', nextReservation.timeSlot, '-', nextReservation.endTimeSlot);
    } else {
      console.log('❌ No next reservation');
    }

    // Log court status results for debugging
    console.log('📊 Court Status Results:');
    if (currentReservation) {
      console.log('  ✅ Current:', `${currentReservation.timeSlot}:00-${currentReservation.endTimeSlot}:00`, currentReservation.status);
    } else {
      console.log('  ❌ No current reservation');
    }
    if (nextReservation) {
      console.log('  ✅ Next:', `${nextReservation.timeSlot}:00-${nextReservation.endTimeSlot}:00`, nextReservation.status);
    } else {
      console.log('  ❌ No next reservation');
    }

    // Structure the response
    res.status(200).json({
      success: true,
      data: {
        courtStatus: {
          current: currentReservation,
          next: nextReservation
        },
        recentReservations,
        recentPayments,
        latestFeedback,
        lastTennisBallPurchase,
        recentPageVisits,
        membersWithOverpayments
      }
    });
  } catch (error: any) {
    console.error('Error fetching superadmin dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});


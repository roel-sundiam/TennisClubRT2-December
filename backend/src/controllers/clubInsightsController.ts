import { Response } from 'express';
import Reservation from '../models/Reservation';
import User from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const TOTAL_DAILY_SLOTS = 17; // 5 AM to 10 PM (slots 5–21)
const ACTIVE_STATUSES = ['pending', 'confirmed', 'completed', 'no-show'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COACH_USERNAMES = ['PJQuiazon', 'OyetMartin', 'JoeyEspiritu'];

// Thresholds
const THRESHOLDS = {
  utilization: { low: 20, high: 80 },
  noShow: { elevated: 10, critical: 25 },
  cancellation: { elevated: 10, high: 20 },
  demandImbalance: 2, // top day > 2x bottom day
  trendChange: 20,    // % week-over-week change considered significant
};

interface Insight {
  category: 'utilization' | 'noShow' | 'cancellation' | 'demand' | 'trend';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  icon: string;
}

interface Recommendation {
  type: 'scheduling' | 'noShow' | 'utilization' | 'engagement';
  priority: 'low' | 'medium' | 'high';
  action: string;
  detail: string;
  icon: string;
}

function formatTimeSlot(slot: number): string {
  const hour = slot % 12 || 12;
  const ampm = slot < 12 ? 'AM' : 'PM';
  const nextSlot = slot + 1;
  const nextHour = nextSlot % 12 || 12;
  const nextAmpm = nextSlot < 12 ? 'AM' : 'PM';
  return `${hour}:00 ${ampm} – ${nextHour}:00 ${nextAmpm}`;
}

function generateIntelligence(params: {
  avgDailyUtilization: number;
  noShowRate: number;
  cancellationRate: number;
  dayOfWeekRanking: Array<{ dayName: string; count: number; percentage: number }>;
  peakHours: Array<{ label: string; count: number }>;
  weeklyTrend: Array<{ week: string; count: number; percentChange: number | null }>;
  totalBookings: number;
  bookingTypeBreakdown: { coaching: number; regular: number; total: number };
}): { insights: Insight[]; recommendations: Recommendation[] } {
  const { avgDailyUtilization, noShowRate, cancellationRate, dayOfWeekRanking, peakHours, weeklyTrend, totalBookings, bookingTypeBreakdown } = params;

  const insights: Insight[] = [];
  const recommendations: Recommendation[] = [];

  if (totalBookings === 0) {
    insights.push({
      category: 'utilization',
      severity: 'info',
      message: 'No booking data found for the selected period. Try a wider date range.',
      icon: 'info',
    });
    return { insights, recommendations };
  }

  // ── Utilization Insights ──
  if (avgDailyUtilization < THRESHOLDS.utilization.low) {
    insights.push({
      category: 'utilization',
      severity: 'warning',
      message: `Court utilization is below optimal levels (${avgDailyUtilization}%). Significant unused capacity exists during this period.`,
      icon: 'trending_down',
    });
    recommendations.push({
      type: 'utilization',
      priority: 'high',
      action: 'Introduce off-peak promotions',
      detail: `Offer discounted rates or coaching sessions during low-utilization hours to increase court usage from the current ${avgDailyUtilization}%.`,
      icon: 'local_offer',
    });
    recommendations.push({
      type: 'engagement',
      priority: 'medium',
      action: 'Create beginner open play sessions',
      detail: 'Schedule beginner-friendly open play on weekday mornings to attract new players and fill underused slots.',
      icon: 'sports_tennis',
    });
  } else if (avgDailyUtilization > THRESHOLDS.utilization.high) {
    insights.push({
      category: 'utilization',
      severity: 'warning',
      message: `Court is operating near full capacity (${avgDailyUtilization}%). High demand may be turning away bookings.`,
      icon: 'whatshot',
    });
    recommendations.push({
      type: 'scheduling',
      priority: 'high',
      action: 'Consider extending court availability',
      detail: 'With utilization above 80%, explore extending operating hours or adding an additional court slot during peak periods.',
      icon: 'schedule',
    });
  } else {
    insights.push({
      category: 'utilization',
      severity: 'info',
      message: `Court utilization is healthy at ${avgDailyUtilization}%. The court is being used effectively.`,
      icon: 'check_circle',
    });
  }

  // ── Cancellation Insights ──
  if (cancellationRate > THRESHOLDS.cancellation.high) {
    insights.push({
      category: 'cancellation',
      severity: 'critical',
      message: `Cancellation rate is high at ${cancellationRate}%. Review the booking policy — slots are being blocked and then released late.`,
      icon: 'cancel',
    });
    recommendations.push({
      type: 'scheduling',
      priority: 'high',
      action: 'Enforce a minimum cancellation window',
      detail: 'Require cancellations to be made at least 2 hours in advance. Late cancellations could count as no-shows to discourage last-minute drops.',
      icon: 'timer',
    });
  } else if (cancellationRate > THRESHOLDS.cancellation.elevated) {
    insights.push({
      category: 'cancellation',
      severity: 'warning',
      message: `Cancellation rate is moderately elevated at ${cancellationRate}%. Monitor trends to identify any recurring patterns.`,
      icon: 'event_busy',
    });
  } else {
    insights.push({
      category: 'cancellation',
      severity: 'info',
      message: `Cancellation rate is low at ${cancellationRate}%. Members are committing to their bookings.`,
      icon: 'event_available',
    });
  }

  // ── Demand Pattern Insights ──
  if (dayOfWeekRanking.length >= 2) {
    const topDay = dayOfWeekRanking[0]!;
    const bottomDay = dayOfWeekRanking[dayOfWeekRanking.length - 1]!;

    if (topDay.count > bottomDay.count * THRESHOLDS.demandImbalance) {
      insights.push({
        category: 'demand',
        severity: 'warning',
        message: `${topDay.dayName} is the busiest day (${topDay.percentage}% of bookings), while ${bottomDay.dayName} is significantly underused (${bottomDay.percentage}%). Demand is unevenly distributed across the week.`,
        icon: 'bar_chart',
      });
      recommendations.push({
        type: 'scheduling',
        priority: 'medium',
        action: `Shift open play sessions to ${bottomDay.dayName}`,
        detail: `Move or add open play sessions to ${bottomDay.dayName} to balance weekly court demand and reduce congestion on ${topDay.dayName}.`,
        icon: 'swap_horiz',
      });
    } else {
      insights.push({
        category: 'demand',
        severity: 'info',
        message: `Booking demand is reasonably spread across the week. ${topDay.dayName} is the busiest day at ${topDay.percentage}% of total bookings.`,
        icon: 'calendar_view_week',
      });
    }
  }

  // Peak hours insight
  if (peakHours.length > 0) {
    const top3 = peakHours.slice(0, 3).map(h => h.label).join(', ');
    insights.push({
      category: 'demand',
      severity: 'info',
      message: `Peak demand is concentrated in: ${top3}. These slots fill up fastest and may benefit from waitlist management.`,
      icon: 'schedule',
    });
    if (avgDailyUtilization < THRESHOLDS.utilization.low && peakHours.length > 3) {
      const lowPeak = peakHours[peakHours.length - 1]!;
      recommendations.push({
        type: 'utilization',
        priority: 'low',
        action: `Promote the ${lowPeak.label} slot`,
        detail: `This time slot has the fewest bookings. A targeted promotion (e.g., coaching clinic or group session) could help fill it.`,
        icon: 'campaign',
      });
    }
  }

  // ── Weekly Trend Insights ──
  if (weeklyTrend.length >= 2) {
    const lastWeek = weeklyTrend[weeklyTrend.length - 1]!;
    const prevWeek = weeklyTrend[weeklyTrend.length - 2]!;
    const change = lastWeek.percentChange;

    if (change !== null && change <= -THRESHOLDS.trendChange) {
      insights.push({
        category: 'trend',
        severity: 'warning',
        message: `Booking demand dropped ${Math.abs(change)}% last week compared to the prior week. Investigate if this is seasonal or a sign of declining engagement.`,
        icon: 'trending_down',
      });
      recommendations.push({
        type: 'engagement',
        priority: 'high',
        action: 'Run a re-engagement campaign',
        detail: `With a ${Math.abs(change)}% week-over-week drop in bookings, consider sending a club newsletter or posting an announcement to re-engage members.`,
        icon: 'campaign',
      });
    } else if (change !== null && change >= THRESHOLDS.trendChange) {
      insights.push({
        category: 'trend',
        severity: 'info',
        message: `Booking demand grew ${change}% last week compared to the prior week. Court activity is on an upward trend.`,
        icon: 'trending_up',
      });
    } else if (change !== null) {
      insights.push({
        category: 'trend',
        severity: 'info',
        message: `Week-over-week booking volume is stable (${change > 0 ? '+' : ''}${change}%). No significant trend detected.`,
        icon: 'trending_flat',
      });
    }
    void prevWeek; // used implicitly via lastWeek.percentChange
  }

  // ── Coaching / Training Insights ──
  if (bookingTypeBreakdown.coaching > 0) {
    const coachingPct = Math.round((bookingTypeBreakdown.coaching / bookingTypeBreakdown.total) * 1000) / 10;
    insights.push({
      category: 'demand',
      severity: 'info',
      message: `${bookingTypeBreakdown.coaching} booking${bookingTypeBreakdown.coaching > 1 ? 's' : ''} (${coachingPct}%) involved a coach or trainer (PJQuiazon, OyetMartin, or JoeyEspiritu) during this period.`,
      icon: 'sports',
    });
    if (coachingPct > 30) {
      recommendations.push({
        type: 'scheduling',
        priority: 'medium',
        action: 'Designate dedicated coaching time slots',
        detail: `Training and coaching sessions make up ${coachingPct}% of court usage. Consider reserving specific slots for coaching to ensure court availability for regular members.`,
        icon: 'event_note',
      });
    }
  }

  return { insights, recommendations };
}

export const getClubInsightsReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);
  defaultStart.setHours(0, 0, 0, 0);

  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : defaultStart;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : now;
  if (req.query.endDate) {
    endDate.setHours(23, 59, 59, 999);
  }

  const dateMatch = { date: { $gte: startDate, $lte: endDate } };
  const activeMatch = { ...dateMatch, status: { $in: ACTIVE_STATUSES } };

  // Resolve coach user IDs from usernames so we can match by userId (reliable) not name
  const coachUsers = await User.find(
    { username: { $in: COACH_USERNAMES } },
    { _id: 1, username: 1, fullName: 1 }
  ).lean();
  const coachUserIds = coachUsers.map((u: any) => u._id.toString());

  const [
    utilizationRaw,
    peakHoursRaw,
    statusBreakdownRaw,
    dayOfWeekRaw,
    weeklyTrendRaw,
    bookingTypeRaw,
  ] = await Promise.all([
    Reservation.aggregate([
      { $match: activeMatch },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, bookedSlots: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Reservation.aggregate([
      { $match: activeMatch },
      { $group: { _id: '$timeSlot', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Reservation.aggregate([
      { $match: dateMatch },
      {
        $addFields: {
          displayStatus: {
            $cond: {
              if: { $and: [
                { $eq: ['$status', 'no-show'] },
                { $eq: ['$paymentStatus', 'paid'] },
              ]},
              then: 'completed',
              else: '$status',
            },
          },
        },
      },
      { $group: { _id: '$displayStatus', count: { $sum: 1 } } },
    ]),
    Reservation.aggregate([
      { $match: activeMatch },
      { $group: { _id: { $dayOfWeek: '$date' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Reservation.aggregate([
      { $match: activeMatch },
      { $group: { _id: { year: { $isoWeekYear: '$date' }, week: { $isoWeek: '$date' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.week': 1 } },
    ]),
    // F) Booking type — resolved after Promise.all using coach user IDs
    Promise.resolve([]),
  ]);

  // Shape data
  const courtUtilization = utilizationRaw.map((d) => ({
    date: d._id,
    bookedSlots: d.bookedSlots,
    totalSlots: TOTAL_DAILY_SLOTS,
    utilization: Math.round((d.bookedSlots / TOTAL_DAILY_SLOTS) * 100),
  }));

  const peakHours = peakHoursRaw.map((d, i) => ({
    hour: d._id,
    label: formatTimeSlot(d._id),
    count: d.count,
    rank: i + 1,
  }));

  const statusMap: Record<string, number> = {};
  let total = 0;
  for (const s of statusBreakdownRaw) {
    const key = s._id === 'no-show' ? 'noShow' : s._id;
    statusMap[key] = s.count;
    total += s.count;
  }
  const bookingStatusBreakdown = {
    confirmed: statusMap['confirmed'] || 0,
    completed: statusMap['completed'] || 0,
    cancelled: statusMap['cancelled'] || 0,
    noShow: statusMap['noShow'] || 0,
    pending: statusMap['pending'] || 0,
    blocked: statusMap['blocked'] || 0,
    total,
  };

  const activeTotal = dayOfWeekRaw.reduce((sum: number, d: any) => sum + d.count, 0);
  const dayOfWeekRanking = dayOfWeekRaw.map((d: any) => ({
    dayNumber: d._id,
    dayName: DAY_NAMES[d._id - 1] ?? 'Unknown',
    count: d.count,
    percentage: activeTotal > 0 ? Math.round((d.count / activeTotal) * 1000) / 10 : 0,
  }));

  const weeklyTrend = weeklyTrendRaw.map((d: any, i: number) => {
    const prev = i > 0 ? weeklyTrendRaw[i - 1].count : null;
    const percentChange = prev !== null && prev > 0 ? Math.round(((d.count - prev) / prev) * 100) : null;
    return {
      week: `${d._id.year}-W${String(d._id.week).padStart(2, '0')}`,
      label: `Week ${d._id.week}`,
      count: d.count,
      percentChange,
    };
  });

  // Shape booking type breakdown — run after we have coachUserIds
  const bookingTypeBreakdown = { coaching: 0, regular: 0, total: 0 };
  void bookingTypeRaw; // placeholder result not used
  if (coachUserIds.length > 0) {
    const bookingTypeAgg = await Reservation.aggregate([
      { $match: activeMatch },
      {
        $addFields: {
          isCoaching: {
            $gt: [
              { $size: { $filter: {
                input: { $ifNull: ['$players', []] },
                as: 'p',
                cond: { $in: [{ $ifNull: ['$$p.userId', ''] }, coachUserIds] },
              }}},
              0,
            ],
          },
        },
      },
      { $group: { _id: '$isCoaching', count: { $sum: 1 } } },
    ]);
    for (const r of bookingTypeAgg) {
      if (r._id === true) bookingTypeBreakdown.coaching = r.count;
      else bookingTypeBreakdown.regular = r.count;
    }
  }

  // Summary cards
  const activeBookings = bookingStatusBreakdown.confirmed + bookingStatusBreakdown.completed +
    bookingStatusBreakdown.noShow + bookingStatusBreakdown.pending;

  // Fallback if no coach users found in DB
  if (coachUserIds.length === 0) bookingTypeBreakdown.regular = activeBookings;
  const avgDailyUtilization = courtUtilization.length > 0
    ? Math.round(courtUtilization.reduce((s, d) => s + d.utilization, 0) / courtUtilization.length)
    : 0;
  const cancellationRate = total > 0 ? Math.round((bookingStatusBreakdown.cancelled / total) * 1000) / 10 : 0;
  const noShowRate = total > 0 ? Math.round((bookingStatusBreakdown.noShow / total) * 1000) / 10 : 0;

  bookingTypeBreakdown.total = bookingTypeBreakdown.coaching + bookingTypeBreakdown.regular;

  // Intelligence layer
  const { insights, recommendations } = generateIntelligence({
    avgDailyUtilization,
    noShowRate,
    cancellationRate,
    dayOfWeekRanking,
    peakHours,
    weeklyTrend,
    totalBookings: activeBookings,
    bookingTypeBreakdown,
  });

  res.json({
    success: true,
    data: {
      courtUtilization,
      peakHours,
      bookingStatusBreakdown,
      dayOfWeekRanking,
      weeklyTrend,
      summaryCards: { totalBookings: activeBookings, avgDailyUtilization, cancellationRate, noShowRate },
      bookingTypeBreakdown,
      insights,
      recommendations,
    },
  });
});

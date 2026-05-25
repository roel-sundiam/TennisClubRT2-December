import { Response } from 'express';
import Reservation from '../models/Reservation';
import User from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const TOTAL_DAILY_SLOTS = 17; // 5 AM–10 PM
const ACTIVE_STATUSES = ['pending', 'confirmed', 'completed', 'no-show'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COACH_USERNAMES = ['PJQuiazon', 'OyetMartin', 'JoeyEspiritu'];

function formatTimeSlot(slot: number): string {
  const hour = slot % 12 || 12;
  const ampm = slot < 12 ? 'AM' : 'PM';
  return `${hour}:00 ${ampm}`;
}

function formatTimeSlotRange(slot: number): string {
  const hour = slot % 12 || 12;
  const ampm = slot < 12 ? 'AM' : 'PM';
  const next = slot + 1;
  const nextHour = next % 12 || 12;
  const nextAmpm = next < 12 ? 'AM' : 'PM';
  return `${hour}:00 ${ampm} – ${nextHour}:00 ${nextAmpm}`;
}

function modeOf(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const freq: Record<number, number> = {};
  for (const v of arr) freq[v] = (freq[v] ?? 0) + 1;
  let best = arr[0]!;
  for (const k in freq) {
    if ((freq[+k] ?? 0) > (freq[best] ?? 0)) best = +k;
  }
  return best;
}

export const getMemberTrends = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 30);
  startDate.setHours(0, 0, 0, 0);

  const dateMatch = { date: { $gte: startDate, $lte: now } };
  const activeMatch = { ...dateMatch, status: { $in: ACTIVE_STATUSES } };
  const userId = req.userId!;

  // Resolve coach user IDs from usernames (same logic as Club Insights)
  const coachUsers = await User.find({ username: { $in: COACH_USERNAMES } }, { _id: 1 }).lean();
  const coachUserIds = coachUsers.map((u: any) => u._id.toString());

  // Run independent aggregations in parallel
  const [peakHoursRaw, dayOfWeekRaw, utilizationRaw, myReservations, upcomingCount] = await Promise.all([
    Reservation.aggregate([
      { $match: activeMatch },
      { $group: { _id: '$timeSlot', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Reservation.aggregate([
      { $match: activeMatch },
      { $group: { _id: { $dayOfWeek: '$date' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Reservation.aggregate([
      { $match: activeMatch },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, bookedSlots: { $sum: 1 } } },
    ]),
    Reservation.find(
      { ...dateMatch, status: { $nin: ['blocked'] }, 'players.userId': userId },
      { status: 1, timeSlot: 1, date: 1 }
    ).lean(),
    Reservation.countDocuments({
      date: { $gte: now },
      status: { $in: ['pending', 'confirmed'] },
      'players.userId': userId,
    }),
  ]);

  // Booking type breakdown (same aggregation as Club Insights)
  const bookingTypeBreakdown = { coaching: 0, regular: 0, total: 0 };
  if (coachUserIds.length > 0) {
    const btAgg = await Reservation.aggregate([
      { $match: activeMatch },
      {
        $addFields: {
          isCoaching: {
            $gt: [{
              $size: {
                $filter: {
                  input: { $ifNull: ['$players', []] },
                  as: 'p',
                  cond: { $in: [{ $ifNull: ['$$p.userId', ''] }, coachUserIds] },
                },
              },
            }, 0],
          },
        },
      },
      { $group: { _id: '$isCoaching', count: { $sum: 1 } } },
    ]);
    for (const r of btAgg) {
      if (r._id === true) bookingTypeBreakdown.coaching = r.count;
      else bookingTypeBreakdown.regular = r.count;
    }
  }
  bookingTypeBreakdown.total = bookingTypeBreakdown.coaching + bookingTypeBreakdown.regular;

  // My personal stats (scoped to the requesting user)
  const nonCancelled = myReservations.filter((r: any) => r.status !== 'cancelled');
  const cancelledCount = myReservations.length - nonCancelled.length;
  const myHours: number[] = nonCancelled.map((r: any) => r.timeSlot as number);
  // $dayOfWeek returns 1=Sun … 7=Sat; getDay() returns 0=Sun … 6=Sat → add 1 to align
  const myDays: number[] = nonCancelled.map((r: any) => new Date(r.date).getDay() + 1);
  const prefHourSlot = modeOf(myHours);
  const prefDayNum = modeOf(myDays);

  const myStats = {
    totalBookings: nonCancelled.length,
    upcomingCount,
    cancelledCount,
    preferredDay: prefDayNum !== null ? (DAY_NAMES[prefDayNum - 1] ?? null) : null,
    preferredHour: prefHourSlot !== null ? formatTimeSlotRange(prefHourSlot) : null,
  };

  // Shape peak hours (sorted desc, full list)
  const allSortedHours = peakHoursRaw.map((d: any, i: number) => ({
    hour: d._id as number,
    label: formatTimeSlotRange(d._id),
    shortLabel: formatTimeSlot(d._id),
    count: d.count as number,
    rank: i + 1,
  }));
  const peakHours = allSortedHours.slice(0, 10);
  // Quietest = ascending by count — take bottom 5 from the full sorted list
  const quietHours = [...allSortedHours].reverse().slice(0, 5);

  // Day-of-week ranking
  const activeTotal = dayOfWeekRaw.reduce((s: number, d: any) => s + d.count, 0);
  const dayOfWeekRanking = dayOfWeekRaw.map((d: any) => ({
    dayNumber: d._id as number,
    dayName: DAY_NAMES[d._id - 1] ?? 'Unknown',
    count: d.count as number,
    percentage: activeTotal > 0 ? Math.round((d.count / activeTotal) * 1000) / 10 : 0,
  }));

  // Average utilization
  const avgUtilization = utilizationRaw.length > 0
    ? Math.round(
        utilizationRaw.reduce((s: number, d: any) =>
          s + Math.min((d.bookedSlots / TOTAL_DAILY_SLOTS) * 100, 100), 0
        ) / utilizationRaw.length
      )
    : 0;

  res.json({
    success: true,
    data: {
      peakHours,
      quietHours,
      dayOfWeekRanking,
      avgUtilization,
      bookingTypeBreakdown,
      myStats,
    },
  });
});

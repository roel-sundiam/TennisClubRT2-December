import { Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import Reservation from '../models/Reservation';
import User from '../models/User';
import Poll from '../models/Poll';
import Payment from '../models/Payment';
import SystemSettings from '../models/SystemSettings';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { CreateReservationRequest, UpdateReservationRequest, CompleteReservationRequest } from '../types';
import weatherService from '../services/weatherService';
import SeedingService from '../services/seedingService';

// Helper function for string similarity calculation (Levenshtein distance)
function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0]![j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }
  
  const maxLength = Math.max(str1.length, str2.length);
  const distance = matrix[str2.length]?.[str1.length] ?? maxLength;
  return (maxLength - distance) / maxLength;
}

// Helper function to convert player names to ReservationPlayer objects (December 2025)
async function convertPlayersToObjects(playerNames: string[]): Promise<any[]> {
  // Get all members for matching
  const allMembers = await User.find({ isApproved: true, isActive: true, role: { $in: ['member', 'admin', 'superadmin'] } });
  const memberNames = allMembers.map(m => m.fullName.toLowerCase().trim());
  const memberMap = new Map(allMembers.map(m => [m.fullName.toLowerCase().trim(), m._id.toString()]));
  const homeownerMap = new Map(allMembers.map(m => [m.fullName.toLowerCase().trim(), m.isHomeowner === true]));

  const players: any[] = [];

  for (const playerName of playerNames) {
    const cleanName = playerName.toLowerCase().trim();
    let isMember = false;
    let matchedMemberName: string | null = null;

    // Exact match first
    if (memberNames.includes(cleanName)) {
      isMember = true;
      matchedMemberName = cleanName;
    } else {
      // Fuzzy matching
      for (const memberName of memberNames) {
        const similarity = calculateStringSimilarity(cleanName, memberName);
        if (similarity > 0.8) {
          isMember = true;
          matchedMemberName = memberName;
          break;
        }
      }
    }

    const userId = matchedMemberName ? (memberMap.get(matchedMemberName) || null) : null;
    const isHomeowner = matchedMemberName ? (homeownerMap.get(matchedMemberName) ?? false) : false;

    players.push({
      name: playerName.trim(),
      userId,
      isMember,
      isGuest: !isMember,
      isHomeowner
    });
  }

  return players;
}

// Helper to determine if all players are homeowners (court fee waiver applies)
function isAllHomeownerReservation(playerObjects: any[]): boolean {
  if (playerObjects.length === 0) return false;
  if (playerObjects.some((p: any) => p.isGuest)) return false;
  return playerObjects.every((p: any) => p.isMember && p.isHomeowner === true);
}

// Get all reservations with filtering and pagination
export const getReservations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  // Build filter query
  const filter: any = {};
  
  if (req.query.userId) {
    filter.userId = req.query.userId;
  }
  
  if (req.query.date) {
    const queryDate = new Date(req.query.date as string);
    const startOfDay = new Date(queryDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(queryDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    filter.date = {
      $gte: startOfDay,
      $lte: endOfDay
    };
  }
  
  if (req.query.dateFrom && req.query.dateTo) {
    const fromDate = new Date(req.query.dateFrom as string);
    const toDate = new Date(req.query.dateTo as string);
    toDate.setHours(23, 59, 59, 999);
    
    filter.date = {
      $gte: fromDate,
      $lte: toDate
    };
  }
  
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  if (req.query.paymentStatus) {
    filter.paymentStatus = req.query.paymentStatus;
  }

  // If not admin/superadmin, only show own reservations unless explicitly requesting all
  if (req.user?.role === 'member' && req.query.showAll !== 'true') {
    filter.userId = req.user._id.toString();
  }

  console.log('🔍 Reservation Filter Debug:');
  console.log('- User role:', req.user?.role);
  console.log('- showAll query:', req.query.showAll);
  console.log('- Final filter:', JSON.stringify(filter));
  console.log('- Will show all users?', req.user?.role !== 'member' || req.query.showAll === 'true');

  // Auto-mark past pending reservations as 'no-show'
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  try {
    const updateResult = await Reservation.updateMany(
      {
        status: 'pending',
        date: { $lt: yesterday }
      },
      {
        $set: { status: 'no-show' }
      }
    );

    if (updateResult.modifiedCount > 0) {
      console.log(`🔄 Auto-marked ${updateResult.modifiedCount} past pending reservation(s) as 'no-show'`);
    }
  } catch (error) {
    console.error('Error auto-marking no-show reservations:', error);
    // Continue with normal flow even if auto-marking fails
  }

  const total = await Reservation.countDocuments(filter);
  const reservations = await Reservation.find(filter)
    .populate('userId', 'username fullName email')
    .sort({ date: 1, timeSlot: 1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    data: reservations,
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

// Get reservations for a specific date
export const getReservationsForDate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { date } = req.params;
  const { excludeId } = req.query; // Get excludeId from query params (for edit mode)

  if (!date) {
    res.status(400).json({
      success: false,
      error: 'Date parameter is required'
    });
    return;
  }

  const queryDate = new Date(date);
  console.log(`🔍 QUERY DEBUG: Requested date: ${date}, Parsed queryDate: ${queryDate.toISOString()}`);
  if (excludeId) {
    console.log(`🔍 EDIT MODE: Excluding reservation ID ${excludeId} from availability checks`);
  }

  let reservations = await (Reservation as any).getReservationsForDate(queryDate);

  // Ensure reservations is always an array
  if (!reservations || !Array.isArray(reservations)) {
    console.warn(`⚠️ getReservationsForDate returned invalid data:`, reservations);
    reservations = [];
  }

  // Filter out the excluded reservation if in edit mode
  if (excludeId) {
    reservations = reservations.filter((r: any) => r._id.toString() !== excludeId);
    console.log(`🔍 EDIT MODE: After excluding ${excludeId}, ${reservations.length} reservations remain`);
  }

  console.log(`🔍 QUERY DEBUG: Found ${reservations.length} reservations for date ${date}`);

  // Check for Open Play blocked slots
  // Account for timezone issues by expanding the search range
  const startOfDay = new Date(queryDate.getTime() - 24 * 60 * 60 * 1000); // Previous day
  const endOfDay = new Date(queryDate.getTime() + 2 * 24 * 60 * 60 * 1000); // Next day
  
  const allPossibleEvents = await Poll.find({
    'metadata.category': 'open_play',
    status: { $in: ['active', 'closed'] },
    'openPlayEvent.eventDate': {
      $gte: startOfDay,
      $lt: endOfDay
    }
  });

  // Filter events that actually match the requested date in Philippine timezone
  const openPlayEvents = allPossibleEvents.filter(event => {
    if (!event.openPlayEvent?.eventDate) return false;
    
    // Convert stored UTC date to Philippine date string
    const eventDate = new Date(event.openPlayEvent.eventDate);
    const phEventDate = eventDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // YYYY-MM-DD format
    const requestedDate = queryDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    return phEventDate === requestedDate;
  });

  const blockedSlots = new Set();
  openPlayEvents.forEach(event => {
    if (event?.openPlayEvent?.blockedTimeSlots && Array.isArray(event.openPlayEvent.blockedTimeSlots)) {
      event.openPlayEvent.blockedTimeSlots.forEach(slot => blockedSlots.add(slot));
    }
  });

  // Generate time slots availability with weather data and Open Play blocking
  console.log(`🔍 BACKEND DEBUG for date ${date} (UPDATED LOGIC):`);
  console.log(`📊 Total reservations found: ${reservations.length}`);
  console.log(`🚫 Blocked Open Play slots: [${Array.from(blockedSlots).join(', ')}]`);
  console.log(`📅 All reservations:`, reservations.map((r: any) => ({
    id: r._id,
    timeSlot: r.timeSlot,
    endTimeSlot: r.endTimeSlot,
    duration: r.duration,
    status: r.status,
    range: `${r.timeSlot}:00 - ${(r.endTimeSlot || r.timeSlot + (r.duration || 1))}:00`
  })));

  const timeSlots = [];
  for (let hour = 5; hour <= 22; hour++) {
    // FIXED LOGIC: Check if this hour is actually occupied by a reservation
    // For START TIME availability: hour must not be occupied by any active reservation
    const occupyingReservation = reservations.find((r: any) =>
      hour >= r.timeSlot &&
      hour < (r.endTimeSlot || r.timeSlot + (r.duration || 1)) &&
      (r.status === 'pending' || r.status === 'confirmed' || r.status === 'blocked')
    );

    // For END TIME availability: hour can be used as end time if no reservation STARTS at that hour
    // Key insight: A reservation ending at time X means the next reservation can START at time X
    // So hour H can be an END time if there's no reservation that STARTS at H
    // Special case: hour 22 (10 PM) can ONLY be used as end time, never as start time
    let canBeEndTime = false;
    if (hour === 22) {
      // Hour 22 is available as end time if there's no reservation that extends beyond 22
      canBeEndTime = !reservations.find((r: any) =>
        (r.endTimeSlot || r.timeSlot + (r.duration || 1)) > 22 &&
        (r.status === 'pending' || r.status === 'confirmed' || r.status === 'blocked')
      );
    } else {
      // For other hours: can be end time if no reservation extends PAST this hour
      // Key insight: If a reservation ends AT hour H, then H is available as an end time
      // Only block if a reservation extends BEYOND hour H (i.e., ends > H)
      canBeEndTime = !reservations.find((r: any) =>
        r.timeSlot < hour &&
        (r.endTimeSlot || r.timeSlot + (r.duration || 1)) > hour &&
        (r.status === 'pending' || r.status === 'confirmed' || r.status === 'blocked')
      );
    }

    const isBlockedByOpenPlay = blockedSlots.has(hour);
    const openPlayEvent = isBlockedByOpenPlay ?
      openPlayEvents.find(event => event.openPlayEvent?.blockedTimeSlots && Array.isArray(event.openPlayEvent.blockedTimeSlots) && event.openPlayEvent.blockedTimeSlots.includes(hour)) : null;

    // Enhanced debugging for specific hours that might be problematic
    if (hour === 17 || hour === 21 || hour === 22) {
      console.log(`🔍 DETAILED DEBUG for hour ${hour} (NEW LOGIC):`);
      console.log(`  - Occupying reservation: ${occupyingReservation ? `${occupyingReservation.timeSlot}:00-${(occupyingReservation.endTimeSlot || occupyingReservation.timeSlot + (occupyingReservation.duration || 1))}:00 (status: ${occupyingReservation.status})` : 'NONE'}`);
      console.log(`  - Can be end time: ${canBeEndTime}`);
      console.log(`  - Blocked by Open Play: ${isBlockedByOpenPlay}`);
      console.log(`  - Available for START: ${!occupyingReservation && !isBlockedByOpenPlay}`);
      console.log(`  - Available for END: ${canBeEndTime && !isBlockedByOpenPlay}`);
    }

    // Get weather forecast for this time slot
    let weather = null;
    let weatherSuitability = null;
    try {
      weather = await weatherService.getWeatherForDateTime(queryDate, hour);
      if (weather) {
        weatherSuitability = weatherService.isWeatherSuitableForTennis(weather);
      }
    } catch (error) {
      console.warn(`Failed to fetch weather for ${date} ${hour}:00:`, error);
    }

    const slotData = {
      hour,
      timeDisplay: `${hour}:00 - ${hour + 1}:00`,
      available: !occupyingReservation && !isBlockedByOpenPlay,
      availableAsEndTime: canBeEndTime && !isBlockedByOpenPlay,
      reservation: occupyingReservation || null,
      blockedByOpenPlay: isBlockedByOpenPlay,
      openPlayEvent: openPlayEvent ? {
        id: openPlayEvent._id,
        title: openPlayEvent.title,
        status: openPlayEvent.status,
        startTime: openPlayEvent.openPlayEvent?.startTime,
        endTime: openPlayEvent.openPlayEvent?.endTime,
        confirmedPlayers: openPlayEvent.openPlayEvent?.confirmedPlayers?.length || 0,
        maxPlayers: openPlayEvent.openPlayEvent?.maxPlayers || 12
      } : null,
      weather,
      weatherSuitability
    };

    // Special logging for hour 17, 21, and 22 to debug frontend issue
    if (hour === 17 || hour === 21 || hour === 22) {
      console.log(`🔍 BACKEND RESPONSE DATA for Hour ${hour}:`);
      console.log(`  - hour:`, slotData.hour);
      console.log(`  - available:`, slotData.available);
      console.log(`  - availableAsEndTime:`, slotData.availableAsEndTime);
      console.log(`  - canBeEndTime value was:`, canBeEndTime);
      console.log(`  - isBlockedByOpenPlay:`, isBlockedByOpenPlay);
    }

    timeSlots.push(slotData);
  }

  res.status(200).json({
    success: true,
    data: {
      date: queryDate.toISOString().split('T')[0],
      timeSlots,
      reservations
    }
  });
});

// Get single reservation
export const getReservation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  
  const reservation = await Reservation.findById(id).populate('userId', 'username fullName email');
  
  if (!reservation) {
    res.status(404).json({
      success: false,
      error: 'Reservation not found'
    });
    return;
  }

  // Check access permissions
  // Extract the actual user ID from the populated userId field
  const reservationUserId = (reservation.userId as any)?._id || reservation.userId;
  
  if (req.user?.role === 'member' && reservationUserId?.toString() !== req.user?._id?.toString()) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: reservation
  });
});

// Create a single pending Payment for the reserver, covering the full reservation fee.
// Other members in the reservation are not billed.
async function createReserverPayment(reservation: any): Promise<string[]> {
  if (!reservation.totalFee || reservation.totalFee <= 0) return [];

  const members = (reservation.players as any[]).filter(p => typeof p === 'object' && p.isMember);
  if (members.length === 0) return [];

  const paymentDueDate = new Date(reservation.date);
  paymentDueDate.setDate(paymentDueDate.getDate() + 1);
  paymentDueDate.setHours(23, 59, 59, 999);

  const calculatedEndTimeSlot = reservation.endTimeSlot || (reservation.timeSlot + reservation.duration);

  // reservation.userId may already be populated (a full User document) by the time this
  // runs, depending on the call site — extract the raw ID in either case.
  const reserverId = ((reservation.userId as any)?._id || reservation.userId).toString();

  const payment = new Payment({
    userId: reserverId,
    reservationId: reservation._id,
    amount: Math.round(reservation.totalFee * 100) / 100,
    currency: 'PHP',
    paymentMethod: 'cash',
    status: 'pending',
    dueDate: paymentDueDate,
    description: `Court reservation (Reserver) - ${reservation.date.toDateString()} ${reservation.timeSlot}:00-${calculatedEndTimeSlot}:00`,
    metadata: {
      timeSlot: reservation.timeSlot,
      date: reservation.date,
      playerCount: (reservation.players as any[]).length,
      originalFee: Math.round(reservation.totalFee * 100) / 100
    }
  });

  await payment.save();
  return [(payment._id as any).toString()];
}

// Create new reservation
export const createReservation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { date, timeSlot, players, duration = 1, tournamentTier = '100', totalFee, allowJoin = false }: CreateReservationRequest = req.body;

  console.log('🔍 CREATE RESERVATION REQUEST:', {
    date,
    timeSlot,
    playersCount: players?.length,
    players,
    duration,
    totalFee,
    user: req.user?.username
  });

  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  // Check for overdue payments (1+ days past due)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  oneDayAgo.setHours(23, 59, 59, 999);

  // Check 1: Payment collection for pending overdue payments
  const overduePayments = await Payment.find({
    userId: req.user._id,
    status: 'pending',
    dueDate: { $lt: oneDayAgo }
  });

  // Check 2: Reservations with pending payment status where reservation date has passed
  const overdueReservations = await Reservation.find({
    userId: req.user._id,
    paymentStatus: 'pending',
    date: { $lt: oneDayAgo },
    status: { $in: ['pending', 'confirmed'] }
  });

  const totalOverdue = overduePayments.length + overdueReservations.length;

  if (totalOverdue > 0) {
    // Format overdue details
    const overdueDetails: any[] = [];

    // Add payment records
    overduePayments.forEach(p => {
      overdueDetails.push({
        id: p._id,
        amount: p.amount,
        dueDate: p.dueDate,
        daysOverdue: p.dueDate ? Math.ceil((Date.now() - p.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
        description: p.description
      });
    });

    // Add reservation records without payment
    overdueReservations.forEach(r => {
      const daysOverdue = Math.ceil((Date.now() - r.date.getTime()) / (1000 * 60 * 60 * 24));
      overdueDetails.push({
        id: r._id,
        amount: r.totalFee || 0,
        dueDate: r.date,
        daysOverdue: daysOverdue,
        description: `Court reservation payment for ${r.date.toDateString()} ${r.timeSlot}:00-${(r.endTimeSlot || r.timeSlot + 1)}:00`
      });
    });

    console.log(`⚠️ User ${req.user.username} has ${totalOverdue} overdue payment(s) (${overduePayments.length} payments + ${overdueReservations.length} unpaid reservations), blocking reservation`);

    res.status(403).json({
      success: false,
      error: 'Cannot create reservation with overdue payments',
      message: 'You have pending payments that are overdue. Please settle them before making a new reservation.',
      overduePayments: overdueDetails
    });
    return;
  }

  // Validate date is not in the past
  const reservationDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (reservationDate < today) {
    res.status(400).json({
      success: false,
      error: 'Cannot make reservations for past dates'
    });
    return;
  }

  // Validate 2-week rolling booking window
  const maxBookingDate = new Date(today);
  maxBookingDate.setDate(maxBookingDate.getDate() + 14);
  if (reservationDate > maxBookingDate) {
    res.status(400).json({
      success: false,
      error: 'Reservations can only be made up to 2 weeks in advance.'
    });
    return;
  }

  // Validate time slot
  if (timeSlot < 5 || timeSlot > 21) {
    res.status(400).json({
      success: false,
      error: 'Court operates from 5:00 AM to 10:00 PM'
    });
    return;
  }

  // Validate duration
  if (duration < 1 || duration > 4) {
    res.status(400).json({
      success: false,
      error: 'Duration must be between 1 and 4 hours'
    });
    return;
  }

  // Validate that reservation doesn't extend beyond court hours
  const endTimeSlot = timeSlot + duration;
  if (endTimeSlot > 23) {
    res.status(400).json({
      success: false,
      error: `Booking extends beyond court hours. Court closes at 10 PM (22:00). Duration: ${duration} hours from ${timeSlot}:00 would end at ${endTimeSlot}:00.`
    });
    return;
  }

  // Check if slot range is available (supports multi-hour)
  const isAvailable = await (Reservation as any).isSlotRangeAvailable(reservationDate, timeSlot, endTimeSlot);
  if (!isAvailable) {
    const conflictMessage = duration > 1 
      ? `One or more time slots in the range ${timeSlot}:00-${endTimeSlot}:00 are already reserved`
      : 'Time slot is already reserved';
    res.status(400).json({
      success: false,
      error: conflictMessage
    });
    return;
  }

  // Check if any slot in the reservation range is blocked by Open Play event
  const slotsToCheck: number[] = [];
  for (let slot = timeSlot; slot < endTimeSlot; slot++) {
    slotsToCheck.push(slot);
  }

  // Check for Open Play conflicts with timezone awareness
  const startOfDay = new Date(reservationDate.getTime() - 24 * 60 * 60 * 1000);
  const endOfDay = new Date(reservationDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  
  const allPossibleEvents = await Poll.find({
    'metadata.category': 'open_play',
    status: { $in: ['active', 'closed'] },
    'openPlayEvent.eventDate': {
      $gte: startOfDay,
      $lt: endOfDay
    },
    'openPlayEvent.blockedTimeSlots': { $in: slotsToCheck }
  });

  // Filter for events that match the requested date in Philippine timezone
  const requestedDate = reservationDate.toISOString().split('T')[0];
  const openPlayEvent = allPossibleEvents.find(event => {
    if (!event.openPlayEvent?.eventDate) return false;
    
    const eventDate = new Date(event.openPlayEvent.eventDate);
    const phEventDate = eventDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    
    return phEventDate === requestedDate;
  });

  if (openPlayEvent) {
    const blockedSlots = openPlayEvent.openPlayEvent?.blockedTimeSlots?.filter((slot: number) => slotsToCheck.includes(slot)) || [];
    const blockedSlotsDisplay = blockedSlots.map((slot: number) => `${slot}:00-${slot + 1}:00`).join(', ');
    
    res.status(400).json({
      success: false,
      error: `Reservation conflicts with Open Play event "${openPlayEvent.title}". Blocked time slots: ${blockedSlotsDisplay}`,
      details: {
        openPlayEvent: {
          id: openPlayEvent._id,
          title: openPlayEvent.title,
          startTime: openPlayEvent.openPlayEvent?.startTime,
          endTime: openPlayEvent.openPlayEvent?.endTime,
          blockedSlots: blockedSlots
        },
        requestedRange: `${timeSlot}:00-${endTimeSlot}:00`,
        conflictingSlots: blockedSlotsDisplay
      }
    });
    return;
  }

  // Validate players
  if (!players || players.length === 0) {
    res.status(400).json({
      success: false,
      error: 'At least one player is required'
    });
    return;
  }

  const trimmedPlayers = players.map(p => p.trim());
  const playerObjects = await convertPlayersToObjects(trimmedPlayers);

  if (req.user.isCoach && !playerObjects.some((player: any) => player.isGuest)) {
    res.status(400).json({
      success: false,
      error: 'Coaches and trainers must include at least one guest in every court reservation'
    });
    return;
  }

  // Check if user has paid membership fees
  if (!req.user.membershipFeesPaid && req.user.role === 'member') {
    res.status(400).json({
      success: false,
      error: 'Membership fees must be paid before making reservations'
    });
    return;
  }

  // Get weather forecast for the reservation time
  let weatherForecast = null;
  try {
    const weather = await weatherService.getWeatherForDateTime(reservationDate, timeSlot);
    if (weather) {
      weatherForecast = {
        temperature: weather.temperature,
        description: weather.description,
        humidity: weather.humidity,
        windSpeed: weather.windSpeed,
        icon: weather.icon,
        rainChance: weather.rainChance,
        timestamp: weather.timestamp,
        lastFetched: new Date(),
        isMockData: weather.isMockData || false
      };
    }
  } catch (error) {
    console.warn('Failed to fetch weather for reservation:', error);
  }

  // Get user with current balances
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    });
    return;
  }

  // Use totalFee from frontend if provided, otherwise calculate fallback
  let finalTotalFee = totalFee || 0;
  
  if (!finalTotalFee) {
    // Fallback calculation if frontend doesn't provide totalFee
    const peakHours = (process.env.PEAK_HOURS || '5,18,19,20,21').split(',').map(h => parseInt(h));
    const peakHourFee = parseInt(process.env.PEAK_HOUR_FEE || '100');
    const offPeakFeePerMember = parseInt(process.env.OFF_PEAK_FEE_PER_MEMBER || '20');
    
    if (peakHours.includes(timeSlot)) {
      finalTotalFee = peakHourFee * duration;
    } else {
      finalTotalFee = trimmedPlayers.length * offPeakFeePerMember * duration;
    }
    console.log(`⚠️  Using fallback calculation: ₱${finalTotalFee}`);
  } else {
    console.log(`✅ Using frontend calculated fee: ₱${finalTotalFee}`);
  }

  // Will be overridden below if homeowner waiver applies
  let paymentStatus = 'pending';

  // Convert players to ReservationPlayer objects for December 2025 pricing
  // Check homeowner fee waiver: all members + no guests + booked at least 6 hours before slot = court fee waived
  const slotDateTime = new Date(reservationDate);
  slotDateTime.setHours(timeSlot, 0, 0, 0);
  const hoursUntilSlot = (slotDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const allHomeowners = isAllHomeownerReservation(playerObjects) && hoursUntilSlot <= 6;

  // Handle tennis balls if requested
  let tennisBallsData: { quantity: number; costPerCan: number; totalCost: number } | undefined;
  if (req.body.tennisBalls && req.body.tennisBalls.quantity > 0) {
    const quantity = req.body.tennisBalls.quantity;

    // Fetch current tennis ball cost from settings
    const settings = await SystemSettings.findOne();
    const costPerCan = settings?.tennisBallCostPerCan || 120; // Default ₱120 if not found

    tennisBallsData = {
      quantity,
      costPerCan,
      totalCost: quantity * costPerCan
    };

    console.log(`🎾 Tennis balls requested: ${quantity} cans × ₱${costPerCan} = ₱${tennisBallsData.totalCost}`);
  }

  // Apply homeowner fee waiver: court fee is free, only tennis balls charged
  if (allHomeowners) {
    finalTotalFee = tennisBallsData?.totalCost || 0;
    paymentStatus = tennisBallsData ? 'pending' : 'not_applicable';
    console.log(`🏠 All-homeowner reservation: court fee waived. Total fee: ₱${finalTotalFee}`);
  }

  // Create reservation with new player format
  const reservation = new Reservation({
    userId: req.user._id,
    date: reservationDate,
    timeSlot,
    duration,
    players: playerObjects,
    status: 'pending',
    paymentStatus,
    tournamentTier,
    totalFee: finalTotalFee,
    feeWaived: allHomeowners,
    allowJoin: req.user.isCoach ? false : allowJoin,
    weatherForecast,
    tennisBalls: tennisBallsData,
    paymentIds: [] // Will be populated with payment IDs
  });

  await reservation.save();
  await reservation.populate('userId', 'username fullName email');

  // Create a single pending payment for the reserver, covering the full reservation fee.
  const paymentIds = await createReserverPayment(reservation);
  reservation.paymentIds = paymentIds;
  await reservation.save({ validateBeforeSave: false });

  const message = allHomeowners
    ? `Reservation created successfully. Court fee waived — all players are homeowners.${tennisBallsData ? ` Tennis balls payment created for reserver.` : ''}`
    : `Reservation created successfully. Payment can be made after the reservation time.`;

  res.status(201).json({
    success: true,
    data: {
      ...reservation.toJSON(),
      paymentsCreated: paymentIds.length
    },
    message
  });
});

// Update reservation (with duration and payment recalculation)
export const updateReservation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { date, timeSlot, endTimeSlot, duration, isMultiHour, players, tennisBalls, allowJoin }: UpdateReservationRequest = req.body;

  const reservation = await Reservation.findById(id);
  
  if (!reservation) {
    res.status(404).json({
      success: false,
      error: 'Reservation not found'
    });
    return;
  }

  const reservationOwner = await User.findById(reservation.userId).select('isCoach');

  // Check access permissions
  if (req.user?.role === 'member' && reservation.userId.toString() !== req.user._id.toString()) {
    res.status(403).json({
      success: false,
      error: 'Access denied'
    });
    return;
  }

  // Cannot edit past reservations or reservations that have already started
  // Admins bypass this restriction to allow data corrections
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  if (!isAdmin) {
    const now = new Date();
    const reservationDateTime = new Date(reservation.date);
    reservationDateTime.setHours(reservation.timeSlot, 0, 0, 0);

    if (reservationDateTime <= now) {
      res.status(400).json({
        success: false,
        error: 'Cannot edit reservations that have already started or passed. Payments can be made after the reservation time.'
      });
      return;
    }
  }

  // Cannot edit cancelled or completed reservations
  if (reservation.status === 'cancelled' || reservation.status === 'completed') {
    res.status(400).json({
      success: false,
      error: 'Cannot edit cancelled or completed reservations'
    });
    return;
  }

  // If changing date or time slot, validate availability
  if (date || timeSlot) {
    const newDate = date ? new Date(date) : reservation.date;
    const newTimeSlot = timeSlot || reservation.timeSlot;

    // Validate new date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (newDate < today) {
      res.status(400).json({
        success: false,
        error: 'Cannot reschedule to a past date'
      });
      return;
    }

    // Validate time slot
    if (newTimeSlot < 5 || newTimeSlot > 21) {
      res.status(400).json({
        success: false,
        error: 'Court operates from 5:00 AM to 10:00 PM'
      });
      return;
    }

    // Check if new slot is available (excluding current reservation)
    const isAvailable = await (Reservation as any).isSlotAvailable(newDate, newTimeSlot, id);
    if (!isAvailable) {
      res.status(400).json({
        success: false,
        error: 'New time slot is already reserved'
      });
      return;
    }

    reservation.date = newDate;
    reservation.timeSlot = newTimeSlot;
  }

  // Update duration and end time slot if provided
  if (endTimeSlot !== undefined) {
    reservation.endTimeSlot = endTimeSlot;
  }
  if (duration !== undefined) {
    reservation.duration = duration;
  }
  if (isMultiHour !== undefined) {
    reservation.isMultiHour = isMultiHour;
  }
  if (reservationOwner?.isCoach) {
    reservation.allowJoin = false;
  } else if (allowJoin !== undefined) {
    reservation.allowJoin = allowJoin;
  }

  // Update players if provided
  if (players) {
    if (players.length === 0) {
      res.status(400).json({
        success: false,
        error: 'At least one player is required'
      });
      return;
    }

    // Validate the new player list before changing payments or reservation data.
    const trimmedPlayers = players.map(p => p.trim());
    const playerObjects = await convertPlayersToObjects(trimmedPlayers);
    if (reservationOwner?.isCoach && !playerObjects.some((player: any) => player.isGuest)) {
      res.status(400).json({
        success: false,
        error: 'Coaches and trainers must include at least one guest in every court reservation'
      });
      return;
    }

    // December 2025: Cancel old payments and create new ones when players change
    if (reservation.paymentIds && reservation.paymentIds.length > 0) {
      // Cancel all existing pending payments
      await Payment.updateMany(
        { _id: { $in: reservation.paymentIds }, status: 'pending' },
        { $set: { status: 'cancelled' } }
      );
      console.log(`📝 Cancelled ${reservation.paymentIds.length} pending payments for reservation ${id}`);
    }

    reservation.players = playerObjects;
    // players is a Mixed-typed array — Mongoose can't auto-detect this reassignment as a change,
    // so the pre-save hook's fee recalculation would otherwise silently be skipped.
    reservation.markModified('players');

    // Check homeowner fee waiver: all homeowners + booked at least 6 hours before slot
    const updateSlotDateTime = new Date(reservation.date);
    updateSlotDateTime.setHours(reservation.timeSlot, 0, 0, 0);
    const updateHoursUntilSlot = (updateSlotDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const allHomeowners = isAllHomeownerReservation(playerObjects) && updateHoursUntilSlot <= 6;
    reservation.feeWaived = allHomeowners;

    // Handle tennis balls update
    if (tennisBalls !== undefined) {
      if (tennisBalls.quantity > 0) {
        const settings = await SystemSettings.findOne();
        const costPerCan = settings?.tennisBallCostPerCan || 120;

        reservation.tennisBalls = {
          quantity: tennisBalls.quantity,
          costPerCan,
          totalCost: tennisBalls.quantity * costPerCan
        };

        console.log(`🎾 Updated tennis balls: ${tennisBalls.quantity} cans × ₱${costPerCan} = ₱${reservation.tennisBalls.totalCost}`);
      } else {
        // Remove tennis balls if quantity is 0
        reservation.tennisBalls = undefined;
        console.log('🎾 Removed tennis balls from reservation');
      }
    }

    // Recalculate total fee (pre-save hook handles feeWaived logic)
    reservation.totalFee = 0;
    if (allHomeowners) {
      reservation.paymentStatus = reservation.tennisBalls ? 'pending' : 'not_applicable';
      console.log(`🏠 All-homeowner reservation update: court fee waived`);
    } else {
      reservation.paymentStatus = 'pending';
    }

    // Save with recalculated fee
    await reservation.save();

    // Create a single pending payment for the reserver, covering the full reservation fee.
    const paymentIds = await createReserverPayment(reservation);
    reservation.paymentIds = paymentIds;
    await reservation.save({ validateBeforeSave: false });
    console.log(`✅ Created reserver payment for reservation ${id}`);
  } else if (!players && (endTimeSlot !== undefined || duration !== undefined || tennisBalls !== undefined)) {
    // No player changes but duration/time/tennis balls changed - need to recalculate fee and update payments
    console.log('🔄 Duration/time/tennis balls changed without player changes - recalculating fees');

    // Handle tennis balls update
    if (tennisBalls !== undefined) {
      if (tennisBalls.quantity > 0) {
        const settings = await SystemSettings.findOne();
        const costPerCan = settings?.tennisBallCostPerCan || 120;

        reservation.tennisBalls = {
          quantity: tennisBalls.quantity,
          costPerCan,
          totalCost: tennisBalls.quantity * costPerCan
        };

        console.log(`🎾 Updated tennis balls: ${tennisBalls.quantity} cans × ₱${costPerCan} = ₱${reservation.tennisBalls.totalCost}`);
      } else {
        // Remove tennis balls if quantity is 0
        reservation.tennisBalls = undefined;
        console.log('🎾 Removed tennis balls from reservation');
      }
    }

    // Recalculate total fee (pre-save hook handles feeWaived logic)
    reservation.totalFee = 0;
    await reservation.save();

    // Cancel old payments and create new ones
    if (reservation.paymentIds && reservation.paymentIds.length > 0) {
      await Payment.updateMany(
        { _id: { $in: reservation.paymentIds }, status: 'pending' },
        { $set: { status: 'cancelled' } }
      );
      console.log(`📝 Cancelled ${reservation.paymentIds.length} pending payments for reservation ${id}`);
    }

    // Create a single pending payment for the reserver, covering the full reservation fee.
    const paymentIds = await createReserverPayment(reservation);
    reservation.paymentIds = paymentIds;
    await reservation.save({ validateBeforeSave: false });
    console.log(`✅ Created reserver payment for updated reservation ${id}`);
  } else if (!players) {
    // No player changes and no time changes, just save other modifications
    await reservation.save({ validateBeforeSave: false });
  }

  await reservation.populate('userId', 'username fullName email');

  res.status(200).json({
    success: true,
    data: reservation,
    message: 'Reservation updated successfully'
  });
});

// Cancel reservation
export const cancelReservation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  console.log(`🗑️  Attempting to cancel reservation: ${id}`);

  const reservation = await Reservation.findById(id);
  
  if (!reservation) {
    console.log(`❌ Reservation not found: ${id}`);
    res.status(404).json({
      success: false,
      error: 'Reservation not found'
    });
    return;
  }

  console.log(`📅 Reservation details:`, {
    id: reservation._id,
    date: reservation.date,
    status: reservation.status,
    userId: reservation.userId,
    requestUserId: req.user?._id
  });

  // Check access permissions
  if (req.user?.role === 'member' && reservation.userId.toString() !== req.user._id.toString()) {
    console.log(`🚫 Access denied - User ${req.user._id} trying to cancel reservation owned by ${reservation.userId}`);
    res.status(403).json({
      success: false,
      error: 'Access denied'
    });
    return;
  }

  // Allow cancellation for today and future dates only
  // For same-day reservations, allow cancellation up to 1 hour before the time slot
  const now = new Date();
  const currentHour = now.getHours();
  const reservationDateTime = new Date(reservation.date);
  const reservationHour = reservation.timeSlot;
  
  // Check if the reservation is for today
  const isToday = reservationDateTime.toDateString() === now.toDateString();
  
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  console.log(`📅 Date/time validation:`, {
    now: now.toISOString(),
    reservationDate: reservationDateTime.toISOString(),
    reservationHour,
    currentHour,
    isToday,
    todayStart: todayStart.toISOString(),
    isPastDate: reservationDateTime < todayStart
  });
  
  // Allow cancellation of any reservation regardless of date
  
  // If reservation is for today but the time slot has already started, allow cancellation anyway
  // (Business rule: Allow cancellation for weather/emergency even if time has passed)
  if (isToday && currentHour >= reservationHour) {
    console.log(`⚠️  Same-day cancellation for ongoing/past time slot - allowing for emergency/weather reasons`);
  }

  // 12-hour late cancellation check
  const reservationDate = new Date(reservation.date);
  const reservationStartTime = new Date(
    reservationDate.getFullYear(),
    reservationDate.getMonth(),
    reservationDate.getDate(),
    reservation.timeSlot, // hour in local time
    0, 0, 0
  );
  const hoursUntilReservation = (reservationStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const reservationCreatedDate = new Date((reservation as any).createdAt);
  const bookedToday = reservationCreatedDate.toDateString() === now.toDateString();
  const isLateCancellation = hoursUntilReservation < 12 && req.user?.role === 'member' && !bookedToday;
  console.log(`⏱️  Hours until reservation: ${hoursUntilReservation.toFixed(2)}, bookedToday: ${bookedToday}, isLateCancellation: ${isLateCancellation}`);

  // Cannot cancel already cancelled or completed reservations
  if (reservation.status === 'cancelled' || reservation.status === 'completed') {
    console.log(`❌ Cannot cancel - reservation status is: ${reservation.status}`);
    res.status(400).json({
      success: false,
      error: 'Reservation is already cancelled or completed'
    });
    return;
  }

  const { reason } = req.body;

  // Capture userId string BEFORE populate (populate replaces it with a User document)
  const reserverId = reservation.userId.toString();

  reservation.status = 'cancelled';
  await reservation.save({ validateBeforeSave: false });
  await reservation.populate('userId', 'username fullName email');

  const LATE_CANCELLATION_FEE = 100;
  let cancellationFeeCharged = false;

  if (isLateCancellation) {
    // Charge ₱100 late cancellation fee as a pending payment
    try {
      const Payment = require('../models/Payment').default;
      // Delete any existing pending payments for this reservation first
      await Payment.deleteMany({ reservationId: reservation._id, status: 'pending' });
      // Create the cancellation fee payment
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7); // due in 7 days
      await Payment.create({
        userId: reserverId,
        reservationId: reservation._id,
        amount: LATE_CANCELLATION_FEE,
        status: 'pending',
        paymentMethod: 'cash',
        paymentType: 'cancellation_fee',
        dueDate,
        description: `Late cancellation fee — reservation on ${reservationStartTime.toLocaleDateString('en-PH', { dateStyle: 'medium' })} at ${reservation.timeSlot}:00`,
        notes: `Cancelled within 12 hours of the scheduled reservation (${hoursUntilReservation.toFixed(1)} hrs before start). Reason: ${reason || 'No reason provided'}`
      });
      cancellationFeeCharged = true;
      console.log(`💸 ₱${LATE_CANCELLATION_FEE} late cancellation fee added to pending for user ${reserverId}`);
    } catch (error) {
      console.error('Failed to create cancellation fee payment:', error);
      // Continue with cancellation even if fee creation fails
    }
  } else {
    // No fee — delete pending payments as before
    try {
      const Payment = require('../models/Payment').default;
      const deletedPayments = await Payment.deleteMany({
        reservationId: reservation._id,
        status: 'pending'
      });
      console.log(`🗑️  Deleted ${deletedPayments.deletedCount} pending payment(s) for cancelled reservation`);
    } catch (error) {
      console.error('Failed to delete payments for cancelled reservation:', error);
      // Continue even if payment deletion fails
    }
  }

  let message = `Reservation cancelled successfully.`;

  if (cancellationFeeCharged) {
    message += ` A ₱${LATE_CANCELLATION_FEE} late cancellation fee has been added to your pending payments.`;
  }

  res.status(200).json({
    success: true,
    data: {
      ...reservation.toJSON(),
      cancellationFeeCharged,
      cancellationFee: cancellationFeeCharged ? LATE_CANCELLATION_FEE : 0
    },
    message
  });
});

// Admin: Update reservation status
export const updateReservationStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'confirmed', 'cancelled', 'completed', 'no-show'].includes(status)) {
    res.status(400).json({
      success: false,
      error: 'Invalid status'
    });
    return;
  }

  const reservation = await Reservation.findById(id);
  
  if (!reservation) {
    res.status(404).json({
      success: false,
      error: 'Reservation not found'
    });
    return;
  }

  reservation.status = status;
  await reservation.save({ validateBeforeSave: false });
  await reservation.populate('userId', 'username fullName email');

  res.status(200).json({
    success: true,
    data: reservation,
    message: 'Reservation status updated successfully'
  });
});

// Admin: Complete reservation with match results and award points
export const completeReservation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { matchResults }: CompleteReservationRequest = req.body;

  const reservation = await Reservation.findById(id);
  
  if (!reservation) {
    res.status(404).json({
      success: false,
      error: 'Reservation not found'
    });
    return;
  }

  if (reservation.status === 'completed') {
    res.status(400).json({
      success: false,
      error: 'Reservation is already completed'
    });
    return;
  }

  if (reservation.status === 'cancelled') {
    res.status(400).json({
      success: false,
      error: 'Cannot complete a cancelled reservation'
    });
    return;
  }

  // Update reservation status to completed
  reservation.status = 'completed';
  
  // If match results are provided, process them and award points
  if (matchResults && matchResults.length > 0) {
    try {
      await SeedingService.processMatchResults(id!, matchResults);
      console.log(`🎾 Match results processed for reservation ${id}`);
    } catch (error) {
      console.error('Error processing match results:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to process match results. Please try again.'
      });
      return;
    }
  } else {
    // Just mark as completed without processing points
    await reservation.save({ validateBeforeSave: false });
  }

  await reservation.populate('userId', 'username fullName email');

  res.status(200).json({
    success: true,
    data: reservation,
    message: matchResults && matchResults.length > 0 
      ? 'Reservation completed successfully and points awarded'
      : 'Reservation completed successfully'
  });
});

// Get user's upcoming reservations
export const getMyUpcomingReservations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  const reservations = await Reservation.find({
    userId: req.user._id.toString(),
    status: { $in: ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'] }
  }).sort({ date: 1, timeSlot: 1 });

  res.status(200).json({
    success: true,
    data: reservations
  });
});

// Validation rules
export const createReservationValidation = [
  body('date')
    .isISO8601()
    .withMessage('Invalid date format'),
  body('timeSlot')
    .isInt({ min: 5, max: 22 })
    .withMessage('Time slot must be between 5 and 22'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 4 })
    .withMessage('Duration must be between 1 and 4 hours'),
  body('players')
    .isArray({ min: 1 })
    .withMessage('Players must be an array with at least 1 item'),
  body('players.*')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Player name must be 1-50 characters long'),
  body('tournamentTier')
    .optional()
    .isIn(['100', '250', '500'])
    .withMessage('Tournament tier must be 100, 250, or 500')
];

export const updateReservationValidation = [
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('timeSlot')
    .optional()
    .isInt({ min: 5, max: 22 })
    .withMessage('Time slot must be between 5 and 22'),
  body('players')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Players must be an array with at least 1 item'),
  body('players.*')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Player name must be 1-50 characters long')
];

export const completeReservationValidation = [
  body('matchResults')
    .optional()
    .isArray()
    .withMessage('Match results must be an array'),
  body('matchResults.*.winnerId')
    .isMongoId()
    .withMessage('Winner ID must be a valid MongoDB ObjectId'),
  body('matchResults.*.participants')
    .isArray({ min: 2 })
    .withMessage('Participants must be an array with at least 2 players'),
  body('matchResults.*.participants.*')
    .isMongoId()
    .withMessage('Participant ID must be a valid MongoDB ObjectId'),
  body('matchResults.*.score')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Score must be a string with max 50 characters')
];

// Admin: Block court (create administrative block)
export const blockCourt = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { date, timeSlot, duration = 1, blockReason = 'maintenance', blockNotes = '' } = req.body;

  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  // Validate date and time slot
  const blockDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (blockDate < today) {
    res.status(400).json({
      success: false,
      error: 'Cannot block courts for past dates'
    });
    return;
  }

  if (timeSlot < 5 || timeSlot > 22) {
    res.status(400).json({
      success: false,
      error: 'Court operates from 5:00 AM to 10:00 PM'
    });
    return;
  }

  // Validate duration
  if (duration < 1 || duration > 12) {
    res.status(400).json({
      success: false,
      error: 'Duration must be between 1 and 12 hours'
    });
    return;
  }

  const endTimeSlot = timeSlot + duration;
  if (endTimeSlot > 23) {
    res.status(400).json({
      success: false,
      error: `Block extends beyond court hours. Court closes at 10 PM (22:00).`
    });
    return;
  }

  // Check if slot range is available
  const isAvailable = await (Reservation as any).isSlotRangeAvailable(blockDate, timeSlot, endTimeSlot);
  if (!isAvailable) {
    res.status(400).json({
      success: false,
      error: `One or more time slots in the range ${timeSlot}:00-${endTimeSlot}:00 are already reserved or blocked`
    });
    return;
  }

  // Get weather forecast for the blocked time
  let weatherForecast = null;
  try {
    const weather = await weatherService.getWeatherForDateTime(blockDate, timeSlot);
    if (weather) {
      weatherForecast = {
        temperature: weather.temperature,
        description: weather.description,
        humidity: weather.humidity,
        windSpeed: weather.windSpeed,
        icon: weather.icon,
        rainChance: weather.rainChance,
        timestamp: weather.timestamp,
        lastFetched: new Date(),
        isMockData: weather.isMockData || false
      };
    }
  } catch (error) {
    console.error('Error fetching weather for blocked reservation:', error);
    // Continue without weather - not critical
  }

  // Create blocked reservation
  const blockedReservation = new Reservation({
    userId: req.user._id,
    date: blockDate,
    timeSlot,
    duration,
    endTimeSlot,
    status: 'blocked',
    paymentStatus: 'not_applicable',
    blockReason,
    blockNotes,
    players: [],
    totalFee: 0,
    weatherForecast
  });

  await blockedReservation.save();
  await blockedReservation.populate('userId', 'username fullName email');

  console.log(`🚫 Court blocked: ${date} ${timeSlot}:00-${endTimeSlot}:00 by ${req.user.username} (${blockReason})`);

  res.status(201).json({
    success: true,
    data: blockedReservation,
    message: 'Court successfully blocked'
  });
});

// Admin: Get all blocked reservations
export const getBlockedReservations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const blockedReservations = await Reservation.find({
    status: 'blocked'
  })
    .populate('userId', 'username fullName email')
    .sort({ date: 1, timeSlot: 1 });

  // Add timeSlotDisplay for frontend
  const formattedReservations = blockedReservations.map(r => {
    const endTime = r.endTimeSlot || r.timeSlot + (r.duration || 1);
    return {
      ...r.toJSON(),
      timeSlotDisplay: `${r.timeSlot}:00 - ${endTime}:00`
    };
  });

  res.status(200).json({
    success: true,
    data: formattedReservations
  });
});

// Admin: Update blocked reservation
export const updateBlockedReservation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { date, timeSlot, duration, blockReason, blockNotes } = req.body;

  const reservation = await Reservation.findById(id);

  if (!reservation) {
    res.status(404).json({
      success: false,
      error: 'Blocked reservation not found'
    });
    return;
  }

  if (reservation.status !== 'blocked') {
    res.status(400).json({
      success: false,
      error: 'This is not a blocked reservation'
    });
    return;
  }

  // Update fields if provided
  if (date) {
    const blockDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (blockDate < today) {
      res.status(400).json({
        success: false,
        error: 'Cannot block courts for past dates'
      });
      return;
    }

    reservation.date = blockDate;
  }

  if (timeSlot !== undefined) {
    if (timeSlot < 5 || timeSlot > 22) {
      res.status(400).json({
        success: false,
        error: 'Court operates from 5:00 AM to 10:00 PM'
      });
      return;
    }
    reservation.timeSlot = timeSlot;
  }

  if (duration !== undefined) {
    if (duration < 1 || duration > 12) {
      res.status(400).json({
        success: false,
        error: 'Duration must be between 1 and 12 hours'
      });
      return;
    }
    reservation.duration = duration;
    reservation.endTimeSlot = reservation.timeSlot + duration;
  }

  if (blockReason) reservation.blockReason = blockReason;
  if (blockNotes !== undefined) reservation.blockNotes = blockNotes;

  // Check availability for the updated time slot
  const endTimeSlot = reservation.endTimeSlot || reservation.timeSlot + (reservation.duration || 1);
  const isAvailable = await (Reservation as any).isSlotRangeAvailable(reservation.date, reservation.timeSlot, endTimeSlot, id);

  if (!isAvailable) {
    res.status(400).json({
      success: false,
      error: `Time slot conflict detected`
    });
    return;
  }

  await reservation.save({ validateBeforeSave: false });
  await reservation.populate('userId', 'username fullName email');

  res.status(200).json({
    success: true,
    data: reservation,
    message: 'Block updated successfully'
  });
});

// Admin: Delete blocked reservation
export const deleteBlockedReservation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const reservation = await Reservation.findById(id);

  if (!reservation) {
    res.status(404).json({
      success: false,
      error: 'Blocked reservation not found'
    });
    return;
  }

  if (reservation.status !== 'blocked') {
    res.status(400).json({
      success: false,
      error: 'This is not a blocked reservation'
    });
    return;
  }

  await Reservation.deleteOne({ _id: id });

  console.log(`🗑️ Court block removed: ${reservation.date} ${reservation.timeSlot}:00`);

  res.status(200).json({
    success: true,
    message: 'Block removed successfully'
  });
});

// Helper: Generate all dates matching a recurrence pattern between startDate and endDate (inclusive)
function generateRecurringDates(
  startDate: Date,
  endDate: Date,
  recurrenceType: 'daily' | 'weekly' | 'monthly',
  recurrenceDays: number[] = []
): Date[] {
  const dates: Date[] = [];

  if (recurrenceType === 'daily') {
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
  } else if (recurrenceType === 'weekly') {
    const current = new Date(startDate);
    while (current <= endDate) {
      if (recurrenceDays.includes(current.getUTCDay())) {
        dates.push(new Date(current));
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
  } else if (recurrenceType === 'monthly') {
    const originalDay = startDate.getUTCDate();
    const current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    while (current <= endDate) {
      const candidate = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), originalDay));
      // Skip months where the day doesn't exist (e.g. Feb 30)
      if (candidate.getUTCDate() === originalDay && candidate >= startDate && candidate <= endDate) {
        dates.push(candidate);
      }
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  }

  return dates;
}

// Admin: Create recurring court blocks
export const blockCourtRecurring = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    startDate,
    endDate,
    timeSlot,
    duration = 1,
    blockReason = 'maintenance',
    blockNotes = '',
    recurrenceType,
    recurrenceDays = []
  } = req.body;

  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  // Parse and normalize dates to midnight UTC
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    res.status(400).json({ success: false, error: 'Invalid date format' });
    return;
  }

  if (end < start) {
    res.status(400).json({ success: false, error: 'End date must be on or after start date' });
    return;
  }

  const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 365) {
    res.status(400).json({ success: false, error: 'Date range cannot exceed 365 days' });
    return;
  }

  const slot = parseInt(timeSlot, 10);
  const dur = parseInt(duration, 10);

  if (slot < 5 || slot > 22) {
    res.status(400).json({ success: false, error: 'Court operates from 5:00 AM to 10:00 PM' });
    return;
  }

  if (dur < 1 || dur > 12) {
    res.status(400).json({ success: false, error: 'Duration must be between 1 and 12 hours' });
    return;
  }

  const endSlot = slot + dur;
  if (endSlot > 23) {
    res.status(400).json({ success: false, error: `Booking extends beyond court hours. ${slot}:00 + ${dur}h ends at ${endSlot}:00` });
    return;
  }

  if (!['daily', 'weekly', 'monthly'].includes(recurrenceType)) {
    res.status(400).json({ success: false, error: 'Recurrence type must be daily, weekly, or monthly' });
    return;
  }

  if (recurrenceType === 'weekly' && (!Array.isArray(recurrenceDays) || recurrenceDays.length === 0)) {
    res.status(400).json({ success: false, error: 'Weekly recurrence requires at least one day of the week' });
    return;
  }

  // Generate dates
  const dates = generateRecurringDates(start, end, recurrenceType, recurrenceDays);

  if (dates.length === 0) {
    res.status(400).json({ success: false, error: 'No dates match the selected recurrence pattern' });
    return;
  }

  // All-or-nothing conflict check
  const conflicts: string[] = [];
  for (const date of dates) {
    const available = await (Reservation as any).isSlotRangeAvailable(date, slot, endSlot);
    if (!available) {
      conflicts.push(date.toISOString().substring(0, 10));
    }
  }

  if (conflicts.length > 0) {
    res.status(409).json({
      success: false,
      error: `Conflicts found on ${conflicts.length} date(s)`,
      conflicts
    });
    return;
  }

  // Build documents — set computed fields explicitly since insertMany skips pre-save hooks
  const groupId = randomUUID();
  const userId = req.user._id;
  const docs = dates.map(date => ({
    userId,
    date,
    timeSlot: slot,
    duration: dur,
    endTimeSlot: endSlot,
    isMultiHour: dur > 1,
    status: 'blocked',
    paymentStatus: 'not_applicable',
    blockReason,
    blockNotes,
    recurringGroupId: groupId,
    recurrenceType,
    totalFee: 0
  }));

  await Reservation.insertMany(docs);

  console.log(`🔄 Recurring court blocks created: ${docs.length} blocks (${recurrenceType}) by ${req.user.username}`);

  res.status(201).json({
    success: true,
    message: `${docs.length} recurring block${docs.length !== 1 ? 's' : ''} created successfully`,
    data: { recurringGroupId: groupId, count: docs.length }
  });
});

// Admin: Delete an entire recurring block series
export const deleteRecurringBlockGroup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { groupId } = req.params;

  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const result = await Reservation.deleteMany({ recurringGroupId: groupId, status: 'blocked' });

  if (result.deletedCount === 0) {
    res.status(404).json({ success: false, error: 'No recurring blocks found with that group ID' });
    return;
  }

  console.log(`🗑️ Recurring block series removed: ${result.deletedCount} blocks (group: ${groupId}) by ${req.user.username}`);

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} recurring block${result.deletedCount !== 1 ? 's' : ''} removed successfully`,
    count: result.deletedCount
  });
});

// Join an existing reservation (member adds themselves to someone else's reservation)
export const joinReservation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const currentUserId = req.user?._id?.toString();

  const reservation = await Reservation.findById(id);
  if (!reservation) {
    res.status(404).json({ success: false, message: 'Reservation not found' });
    return;
  }

  const reservationOwner = await User.findById(reservation.userId).select('isCoach');
  if (reservationOwner?.isCoach) {
    res.status(403).json({ success: false, message: 'Coach and trainer reservations are not open for members to join' });
    return;
  }

  // Only pending or confirmed reservations can be joined
  if (!['pending', 'confirmed'].includes(reservation.status)) {
    res.status(400).json({ success: false, message: 'Cannot join a reservation that is not active' });
    return;
  }

  // Reserver must have allowed other members to join
  if (!reservation.allowJoin) {
    res.status(403).json({ success: false, message: 'The reserver has not allowed other members to join this reservation' });
    return;
  }

  // Must be a future reservation
  const reservationDateTime = new Date(reservation.date);
  reservationDateTime.setHours(reservation.timeSlot, 0, 0, 0);
  if (reservationDateTime <= new Date()) {
    res.status(400).json({ success: false, message: 'Cannot join a past reservation' });
    return;
  }

  // User must not already be the reserver
  if (reservation.userId.toString() === currentUserId) {
    res.status(400).json({ success: false, message: 'You are already the reserver of this reservation' });
    return;
  }

  // User must not already be in the players list
  const alreadyJoined = reservation.players.some((p: any) => {
    const uid = typeof p === 'object' ? p.userId?.toString() : null;
    return uid === currentUserId;
  });
  if (alreadyJoined) {
    res.status(400).json({ success: false, message: 'You are already part of this reservation' });
    return;
  }

  // Get user record for their full name
  const user = await User.findById(currentUserId);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  // Cancel the reserver's existing pending payment (fee will be recalculated with the new player count)
  if (reservation.paymentIds && reservation.paymentIds.length > 0) {
    await Payment.updateMany(
      { _id: { $in: reservation.paymentIds }, status: 'pending' },
      { $set: { status: 'cancelled' } }
    );
    console.log(`📝 Cancelled ${reservation.paymentIds.length} pending payment(s) to recalculate for join`);
  }

  // Add the joining member to players array
  (reservation.players as any[]).push({
    name: user.fullName || user.username,
    userId: user._id.toString(),
    isMember: true,
    isGuest: false
  });

  // Reset total fee so pre-save hook recalculates with the new member count
  reservation.totalFee = 0;
  await reservation.save();

  // Recreate the reserver's single pending payment for the updated reservation.
  const paymentIds = await createReserverPayment(reservation);
  reservation.paymentIds = paymentIds;
  await reservation.save({ validateBeforeSave: false });
  console.log(`✅ Recreated reserver payment after ${user.fullName} joined reservation ${id}`);

  await reservation.populate('userId', 'username fullName email');

  res.status(200).json({
    success: true,
    data: reservation,
    message: `Successfully joined the reservation`
  });
});

// Leave (unjoin) a reservation the current user previously joined
export const leaveReservation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const currentUserId = req.user?._id?.toString();

  const reservation = await Reservation.findById(id);
  if (!reservation) {
    res.status(404).json({ success: false, message: 'Reservation not found' });
    return;
  }

  // Only pending or confirmed reservations can be left
  if (!['pending', 'confirmed'].includes(reservation.status)) {
    res.status(400).json({ success: false, message: 'Cannot leave a reservation that is not active' });
    return;
  }

  // Must be a future reservation
  const reservationDateTime = new Date(reservation.date);
  reservationDateTime.setHours(reservation.timeSlot, 0, 0, 0);
  if (reservationDateTime <= new Date()) {
    res.status(400).json({ success: false, message: 'Cannot leave a past reservation' });
    return;
  }

  // Reserver cannot leave — they must cancel
  if (reservation.userId.toString() === currentUserId) {
    res.status(400).json({ success: false, message: 'You are the reserver. Please cancel the reservation instead.' });
    return;
  }

  // User must actually be in the players list
  const playerIndex = (reservation.players as any[]).findIndex((p: any) => {
    const uid = typeof p === 'object' ? p.userId?.toString() : null;
    return uid === currentUserId;
  });
  if (playerIndex === -1) {
    res.status(400).json({ success: false, message: 'You are not part of this reservation' });
    return;
  }

  // Cancel all existing pending payments
  if (reservation.paymentIds && reservation.paymentIds.length > 0) {
    await Payment.updateMany(
      { _id: { $in: reservation.paymentIds }, status: 'pending' },
      { $set: { status: 'cancelled' } }
    );
    console.log(`📝 Cancelled ${reservation.paymentIds.length} pending payments for leave`);
  }

  // Remove the leaving member from players array
  (reservation.players as any[]).splice(playerIndex, 1);

  // Reset total fee so pre-save hook recalculates with one fewer member
  reservation.totalFee = 0;
  await reservation.save();

  // Recreate the reserver's single pending payment for the updated reservation.
  const paymentIds = await createReserverPayment(reservation);
  reservation.paymentIds = paymentIds;
  await reservation.save({ validateBeforeSave: false });
  console.log(`✅ Recreated reserver payment after member left reservation ${id}`);

  await reservation.populate('userId', 'username fullName email');

  res.status(200).json({
    success: true,
    data: reservation,
    message: 'You have successfully left the reservation'
  });
});

// Validation rules for blocking
export const blockCourtValidation = [
  body('date')
    .isISO8601()
    .withMessage('Invalid date format'),
  body('timeSlot')
    .isInt({ min: 5, max: 22 })
    .withMessage('Time slot must be between 5 and 22'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Duration must be between 1 and 12 hours'),
  body('blockReason')
    .optional()
    .isIn(['maintenance', 'private_event', 'weather', 'other'])
    .withMessage('Invalid block reason'),
  body('blockNotes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Block notes must not exceed 200 characters')
];

// Validation rules for recurring court blocking
export const blockCourtRecurringValidation = [
  body('startDate')
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .isISO8601()
    .withMessage('Invalid end date format'),
  body('timeSlot')
    .isInt({ min: 5, max: 22 })
    .withMessage('Time slot must be between 5 and 22'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Duration must be between 1 and 12 hours'),
  body('blockReason')
    .optional()
    .isIn(['maintenance', 'private_event', 'weather', 'other'])
    .withMessage('Invalid block reason'),
  body('blockNotes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Block notes must not exceed 200 characters'),
  body('recurrenceType')
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Recurrence type must be daily, weekly, or monthly'),
  body('recurrenceDays')
    .optional()
    .isArray()
    .withMessage('Recurrence days must be an array'),
  body('recurrenceDays.*')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('Each recurrence day must be an integer 0 (Sun) through 6 (Sat)')
];

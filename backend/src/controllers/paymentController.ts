import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import Payment from '../models/Payment';
import Reservation from '../models/Reservation';
import Poll from '../models/Poll';
import User from '../models/User';
import CourtUsageReport from '../models/CourtUsageReport';
import CreditTransaction from '../models/CreditTransaction';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { attachProofOfPayment } from '../services/paymentProofService';
import { getSignedProofUrl } from '../config/supabase';
import * as fs from 'fs';
import * as path from 'path';

// Helper function for string similarity (used for fuzzy player name matching)
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

// Helper function to get current Google Sheets baseline amount
async function getGoogleSheetsBaselineAmount(): Promise<number> {
  try {
    const { sheetsService } = await import('../services/sheetsService');
    const freshData = await sheetsService.getFinancialReportData();
    
    const courtReceiptsItem = freshData.receiptsCollections.find((item: any) => 
      item.description === 'Tennis Court Usage Receipts'
    );
    
    return courtReceiptsItem?.amount || 67800; // Fallback to 67800 if not found
  } catch (error) {
    console.error('⚠️ Failed to get Google Sheets baseline, using fallback:', error);
    return 67800; // Fallback amount
  }
}

// Helper function to update Tennis Court Usage Receipts in financial report
async function updateFinancialReportCourtReceipts(): Promise<void> {
  try {
    console.log('💰 Updating Tennis Court Usage Receipts in financial report...');
    
    // Calculate total amount from all recorded payments
    const result = await Payment.aggregate([
      {
        $match: {
          status: 'record',
          recordedAt: { $exists: true, $ne: null },
          paymentType: { $ne: 'membership_fee' }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    const totalCourtReceipts = result[0]?.totalAmount || 0;
    console.log(`💰 Total Tennis Court Usage Receipts: ₱${totalCourtReceipts.toFixed(2)}`);
    
    // Read current financial report
    const dataPath = path.join(__dirname, '../../data/financial-report.json');
    if (!fs.existsSync(dataPath)) {
      console.warn('⚠️ Financial report JSON file not found, skipping update');
      return;
    }
    
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    const financialData = JSON.parse(fileContent);

    // Ensure manual values are preserved
    const advancesIndex = financialData.receiptsCollections.findIndex((item: any) =>
      item.description === 'Advances'
    );
    if (advancesIndex !== -1) {
      financialData.receiptsCollections[advancesIndex].amount = 0; // Keep manual value
    }
    
    // Find and update Tennis Court Usage Receipts
    const courtReceiptsIndex = financialData.receiptsCollections.findIndex((item: any) => 
      item.description === 'Tennis Court Usage Receipts'
    );
    
    if (courtReceiptsIndex !== -1) {
      const oldAmount = financialData.receiptsCollections[courtReceiptsIndex].amount;
      
      // Use manual baseline amount (no Google Sheets integration)
      const baselineAmount = 69705; // Manual baseline amount
      const newAmount = baselineAmount + totalCourtReceipts;
      
      financialData.receiptsCollections[courtReceiptsIndex].amount = newAmount;
      
      // Recalculate total receipts
      financialData.totalReceipts = financialData.receiptsCollections.reduce((sum: number, item: any) => sum + item.amount, 0);
      
      // Calculate App Service Fee based on recorded payments only (20% of recorded payments)
      const appServiceFee = totalCourtReceipts * 0.20;
      const appServiceFeeIndex = financialData.disbursementsExpenses.findIndex(
        (item: any) => item.description === 'App Service Fee'
      );

      if (appServiceFeeIndex === -1) {
        // Add App Service Fee if it doesn't exist
        financialData.disbursementsExpenses.push({
          description: 'App Service Fee',
          amount: appServiceFee
        });
        console.log(`💰 Added App Service Fee to financial report: ₱${appServiceFee.toFixed(2)}`);
      } else {
        // Update App Service Fee amount
        financialData.disbursementsExpenses[appServiceFeeIndex].amount = appServiceFee;
        console.log(`💰 Updated App Service Fee: ₱${appServiceFee.toFixed(2)}`);
      }
      
      // Recalculate total disbursements to include App Service Fee
      financialData.totalDisbursements = financialData.disbursementsExpenses.reduce((sum: number, item: any) => sum + item.amount, 0);
      
      // Recalculate net income and fund balance
      financialData.netIncome = financialData.totalReceipts - financialData.totalDisbursements;
      financialData.fundBalance = financialData.beginningBalance.amount + financialData.netIncome;
      
      // Update timestamp
      financialData.lastUpdated = new Date().toISOString();
      
      // Save updated financial report
      fs.writeFileSync(dataPath, JSON.stringify(financialData, null, 2), 'utf8');
      
      console.log(`💰 Financial report updated: Court Receipts ₱${oldAmount} → ₱${newAmount} (₱${baselineAmount} baseline + ₱${totalCourtReceipts} recorded)`);
      console.log(`💰 New Total Receipts: ₱${financialData.totalReceipts.toLocaleString()}`);
      console.log(`💰 New Fund Balance: ₱${financialData.fundBalance.toLocaleString()}`);
      
      // Emit real-time financial update
      try {
        const { webSocketService } = await import('../services/websocketService');
        if (webSocketService.isInitialized()) {
          webSocketService.emitFinancialUpdate({
            type: 'financial_data_updated',
            data: financialData,
            timestamp: new Date().toISOString(),
            message: `💰 Tennis Court Usage Receipts updated: ₱${totalCourtReceipts.toLocaleString()}`
          });
          console.log('📡 Real-time financial update broadcasted');
        }
      } catch (error) {
        console.error('⚠️ Failed to broadcast financial update:', error);
      }
    } else {
      console.warn('⚠️ Tennis Court Usage Receipts not found in financial report');
    }
    
  } catch (error) {
    console.error('❌ Error updating financial report court receipts:', error);
  }
}

// Helper function to subtract from CourtUsageReport when payment is unrecorded
async function subtractFromCourtUsageReport(payment: any): Promise<void> {
  try {
    // Assigned expenses are not court usage — skip
    if (payment.metadata?.isAssignedExpense === true) {
      console.log('📊 Skipping court usage report subtraction for assigned expense');
      return;
    }

    // Membership fees are not court usage — skip
    if (payment.paymentType === 'membership_fee') {
      console.log('📊 Skipping court usage report subtraction for membership fee');
      return;
    }

    console.log('📊 Subtracting from court usage report for unrecorded payment...');

    // Get user information to find member name
    await payment.populate('userId', 'fullName');
    const memberName = (payment.userId as any)?.fullName;
    
    if (!memberName) {
      console.warn('⚠️ No member name found for payment, skipping court usage update');
      return;
    }
    
    // Determine the month to update based on payment date (for year filtering)
    // Use paymentDate first so admin-set dates control which year/month it appears in
    const usageDate = payment.paymentDate || payment.metadata?.courtUsageDate || new Date();
    const month = new Date(usageDate).getMonth(); // 0-11
    const year = new Date(usageDate).getFullYear();
    
    // Create dynamic month key in YYYY-MM format for the new Map-based storage
    const monthKey = `${year}-${(month + 1).toString().padStart(2, '0')}`;
    const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long' });
    
    // All months are now supported with the dynamic system
    console.log(`📊 Processing ${monthName} ${year} (${monthKey}) for court usage report`);
    
    console.log(`📊 Subtracting ₱${payment.amount} from ${memberName}'s ${monthName} ${year} court usage`);
    
    // Find the member's court usage record
    const courtUsageRecord = await CourtUsageReport.findOne({ 
      memberName: memberName,
      year: year
    });
    
    if (!courtUsageRecord) {
      console.warn(`⚠️ No court usage record found for ${memberName} (${year}), skipping subtraction`);
      return;
    }
    
    // Subtract from existing amount using the Map, but don't go below 0
    const currentAmount = courtUsageRecord.monthlyAmounts?.get(monthKey) || 0;
    const newAmount = Math.max(0, currentAmount - payment.amount);
    
    if (newAmount > 0) {
      courtUsageRecord.monthlyAmounts.set(monthKey, newAmount);
    } else {
      courtUsageRecord.monthlyAmounts.delete(monthKey); // Remove entry if amount becomes 0
    }
    courtUsageRecord.markModified('monthlyAmounts');
    
    console.log(`📊 Updated ${memberName}'s ${monthName} from ₱${currentAmount} to ₱${newAmount}`);
    
    // Save the record (totalAmount will be calculated automatically by pre-save middleware)
    await courtUsageRecord.save();
    
    console.log(`✅ Court usage report updated for ${memberName}: -₱${payment.amount} in ${monthName} ${year}`);
    
    // Emit real-time update for court usage report
    try {
      const { webSocketService } = await import('../services/websocketService');
      if (webSocketService.isInitialized()) {
        webSocketService.emitCourtUsageUpdate({
          type: 'court_usage_data_updated',
          data: null, // Will trigger a full refresh on the frontend
          timestamp: new Date().toISOString(),
          message: `📊 Court usage updated: ${memberName} -₱${payment.amount} (${monthName} ${year})`
        });
        console.log('📡 Real-time court usage update broadcasted');
      }
    } catch (error) {
      console.error('⚠️ Failed to broadcast court usage update:', error);
    }
    
  } catch (error) {
    console.error('❌ Error updating court usage report:', error);
    // Don't throw error - payment unrecording should still succeed even if court usage update fails
  }
}

// Helper function to update CourtUsageReport when payment is recorded
async function updateCourtUsageReport(payment: any): Promise<void> {
  try {
    // Assigned expenses (tournament entry fees, etc.) are not court usage — skip
    if (payment.metadata?.isAssignedExpense === true) {
      console.log('📊 Skipping court usage report update for assigned expense');
      return;
    }

    // Membership fees are not court usage — skip
    if (payment.paymentType === 'membership_fee') {
      console.log('📊 Skipping court usage report update for membership fee');
      return;
    }

    console.log('📊 Updating court usage report for recorded payment...');

    // Get user information to find member name
    await payment.populate('userId', 'fullName');
    const memberName = (payment.userId as any)?.fullName;
    
    if (!memberName) {
      console.warn('⚠️ No member name found for payment, skipping court usage update');
      return;
    }
    
    // Determine the month to update based on payment date (for year filtering)
    // Use paymentDate first so admin-set dates control which year/month it appears in
    const usageDate = payment.paymentDate || payment.metadata?.courtUsageDate || new Date();
    const month = new Date(usageDate).getMonth(); // 0-11
    const year = new Date(usageDate).getFullYear();
    
    // Create dynamic month key in YYYY-MM format for the new Map-based storage
    const monthKey = `${year}-${(month + 1).toString().padStart(2, '0')}`;
    const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long' });
    
    // All months are now supported with the dynamic system
    console.log(`📊 Processing ${monthName} ${year} (${monthKey}) for court usage report`);
    
    console.log(`📊 Updating ${memberName}'s ${monthName} ${year} court usage with ₱${payment.amount}`);
    
    // Find or create the member's court usage record
    let courtUsageRecord = await CourtUsageReport.findOne({ 
      memberName: memberName,
      year: year
    });
    
    if (!courtUsageRecord) {
      // Create new record for this member with Map-based storage
      courtUsageRecord = new CourtUsageReport({
        memberName: memberName,
        year: year,
        monthlyAmounts: new Map()
      });
      courtUsageRecord.monthlyAmounts.set(monthKey, payment.amount);
      console.log(`📊 Created new court usage record for ${memberName} (${year})`);
    } else {
      // Update existing record - add to existing amount using Map
      const currentAmount = courtUsageRecord.monthlyAmounts?.get(monthKey) || 0;
      courtUsageRecord.monthlyAmounts.set(monthKey, currentAmount + payment.amount);
      courtUsageRecord.markModified('monthlyAmounts');
      console.log(`📊 Updated ${memberName}'s ${monthName} from ₱${currentAmount} to ₱${currentAmount + payment.amount}`);
    }
    
    // Save the record (totalAmount will be calculated automatically by pre-save middleware)
    await courtUsageRecord.save();
    
    console.log(`✅ Court usage report updated for ${memberName}: +₱${payment.amount} in ${monthName} ${year}`);
    
    // Emit real-time update for court usage report
    try {
      const { webSocketService } = await import('../services/websocketService');
      if (webSocketService.isInitialized()) {
        webSocketService.emitCourtUsageUpdate({
          type: 'court_usage_data_updated',
          data: null, // Will trigger a full refresh on the frontend
          timestamp: new Date().toISOString(),
          message: `📊 Court usage updated: ${memberName} +₱${payment.amount} (${monthName} ${year})`
        });
        console.log('📡 Real-time court usage update broadcasted');
      }
    } catch (error) {
      console.error('⚠️ Failed to broadcast court usage update:', error);
    }
    
  } catch (error) {
    console.error('❌ Error updating court usage report:', error);
    // Don't throw error - payment recording should still succeed even if court usage update fails
  }
}

// Create payment for a reservation
export const createPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  let { reservationId, paymentMethod, amount, customAmount, isManualPayment, playerNames, courtUsageDate, notes } = req.body;

  // Normalize fields that arrive as strings when the request is multipart/form-data (proof-of-payment upload)
  if (typeof isManualPayment === 'string') {
    isManualPayment = isManualPayment === 'true';
  }
  if (typeof playerNames === 'string') {
    try {
      playerNames = JSON.parse(playerNames);
    } catch {
      playerNames = [playerNames];
    }
  }

  console.log('💰 CREATE PAYMENT REQUEST:', {
    reservationId,
    paymentMethod,
    amount,
    customAmount,
    isManualPayment,
    playerNames,
    courtUsageDate,
    notes,
    userRole: req.user?.role,
    username: req.user?.username,
    fullRequestBody: req.body
  });

  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  let reservation = null;
  
  // Handle manual payments vs reservation payments differently
  if (isManualPayment) {
    // Validate manual payment fields
    if (!playerNames || !Array.isArray(playerNames) || playerNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Player names are required for manual payments'
      });
    }

    if (!courtUsageDate) {
      return res.status(400).json({
        success: false,
        error: 'Court usage date is required for manual payments'
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required for manual payments'
      });
    }
  } else {
    // Validate reservation exists and belongs to user (or user is admin)
    reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reservation not found'
      });
    }
  }

  // Check if user can create payment for this reservation (skip for manual payments)
  if (!isManualPayment && req.user.role === 'member' && reservation && reservation.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  // Check if payment already exists for this reservation (skip for manual payments)
  let existingPayment = null;
  if (!isManualPayment && reservationId) {
    existingPayment = await Payment.findOne({
      reservationId,
      status: { $in: ['pending', 'completed'] }
    });
  }

  console.log('💰 EXISTING PAYMENT CHECK:', {
    reservationId,
    existingPayment: existingPayment ? {
      id: existingPayment._id,
      status: existingPayment.status,
      amount: existingPayment.amount,
      paymentMethod: existingPayment.paymentMethod
    } : null,
    userRole: req.user?.role
  });

  if (existingPayment) {
    // If user is admin and trying to create payment, redirect to update the existing one
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      console.log('💰 Admin attempting to create payment for existing record, redirecting to update:', existingPayment._id);
      
      // Update the existing payment instead of creating a new one
      const updateData: any = {};
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      
      // Handle custom amount (now available to all users)
      if (customAmount) {
        const newAmount = parseFloat(customAmount);
        if (newAmount > 0) {
          updateData.amount = newAmount;
          const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
          updateData.notes = isAdmin 
            ? `Admin override: Custom amount ₱${newAmount.toFixed(2)} set by ${req.user.username}`
            : `Custom amount ₱${newAmount.toFixed(2)} set by ${req.user.username}`;
          updateData.metadata = {
            ...existingPayment.metadata,
            discounts: existingPayment.metadata?.discounts || [], // Preserve existing discounts or initialize empty array
            isAdminOverride: isAdmin,
            originalFee: newAmount
          };
        }
      }
      
      // Apply updates
      Object.assign(existingPayment, updateData);
      await existingPayment.save();
      await existingPayment.populate('userId', 'username fullName email');
      await existingPayment.populate('reservationId', 'userId date timeSlot endTimeSlot duration players status totalFee timeSlotDisplay tennisBalls');
      await existingPayment.populate('pollId', 'title openPlayEvent.eventDate openPlayEvent.startTime openPlayEvent.endTime');
      
      return res.status(200).json({
        success: true,
        data: existingPayment,
        message: 'Payment updated successfully (existing payment found and updated)'
      });
    }
    
    // For non-admin users, return the error
    return res.status(400).json({
      success: false,
      error: 'Payment already exists for this reservation'
    });
  }

  // Calculate payment amount if not provided
  let paymentAmount = amount;
  let calculationBreakdown = null;
  let isAdminOverride = false;
  
  // For manual payments, use the provided amount
  if (isManualPayment) {
    paymentAmount = parseFloat(amount);
    calculationBreakdown = {
      amount: paymentAmount,
      isManualPayment: true,
      breakdown: {
        playerCount: playerNames.length,
        calculation: `Manual payment for player: ${playerNames[0]}`
      }
    };
  } else {
    // Check for custom amount (now available to all users)
    if (customAmount) {
      paymentAmount = parseFloat(customAmount);
      isAdminOverride = req.user.role === 'admin' || req.user.role === 'superadmin';
    } else if (!paymentAmount && reservation && reservation.players.length > 0 &&
               typeof reservation.players[0] === 'object' && 'isMember' in (reservation.players[0] as any) &&
               reservation.totalFee > 0) {
      // New-format (Dec 2025+) reservations already have the correct total fee computed
      // by the model's pre-save hook — the reserver owes the full amount.
      paymentAmount = reservation.totalFee;
      calculationBreakdown = {
        amount: paymentAmount,
        breakdown: {
          calculation: `Reservation total fee: ₱${paymentAmount}`
        }
      };
    } else if (!paymentAmount && reservation) {
      // Legacy (pre-December 2025) pricing for old string-array player format
      const peakHours = (process.env.PEAK_HOURS || '5,18,19,20,21').split(',').map(h => parseInt(h));
      const peakHourFee = parseInt(process.env.PEAK_HOUR_FEE || '100');
      const offPeakFeePerMember = parseInt(process.env.OFF_PEAK_FEE_PER_MEMBER || '20');
      const offPeakFeePerNonMember = parseInt(process.env.OFF_PEAK_FEE_PER_NON_MEMBER || '50');

      const isPeakHour = peakHours.includes(reservation.timeSlot);

    // Get all active members for player categorization
    const members = await User.find({
      role: { $in: ['member', 'admin'] },
      isActive: true,
      isApproved: true
    }).select('fullName').lean();
    
    const memberNames = members.map((m: any) => m.fullName.toLowerCase().trim());
    
    // Categorize players as members or non-members
    let memberCount = 0;
    let nonMemberCount = 0;

    reservation!.players.forEach(player => {
      // December 2025: Check if player is new format (object) or old format (string)
      if (typeof player === 'object' && 'isMember' in player) {
        // New format: player is {name, userId, isMember, isGuest}
        if (player.isMember) {
          memberCount++;
        } else {
          nonMemberCount++;
        }
        return;
      }

      // Old format: player is a string, use fuzzy matching
      const playerName = player as string;
      const cleanPlayerName = playerName.toLowerCase().trim();
      const isFoundInMembers = memberNames.includes(cleanPlayerName);
      
      if (isFoundInMembers) {
        memberCount++;
        console.log(`💰 Payment: "${playerName}" is a MEMBER (exact match)`);
      } else {
        // Enhanced fuzzy matching with multiple strategies
        let matchFound = false;
        let bestMatch = '';
        let bestSimilarity = 0;
        
        for (const memberName of memberNames) {
          // Strategy 1: Levenshtein similarity (relaxed threshold)
          const similarity = calculateStringSimilarity(cleanPlayerName, memberName);
          if (similarity > 0.6 && similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = memberName;
            matchFound = true;
          }
          
          // Strategy 2: Check if input is contained within member name (partial match)
          if (!matchFound && memberName.includes(cleanPlayerName) && cleanPlayerName.length > 2) {
            bestMatch = memberName;
            matchFound = true;
            console.log(`💰 Payment: "${playerName}" is a MEMBER (partial match: "${bestMatch}")`);
            break;
          }
          
          // Strategy 3: Check if any word in member name matches input
          if (!matchFound) {
            const memberWords = memberName.split(' ');
            const inputWords = cleanPlayerName.split(' ');
            const wordMatch = memberWords.some((mWord: string) => 
              inputWords.some((iWord: string) => {
                if (iWord.length > 2 && mWord.length > 2) {
                  return calculateStringSimilarity(iWord, mWord) > 0.8;
                }
                return false;
              })
            );
            
            if (wordMatch) {
              bestMatch = memberName;
              matchFound = true;
              console.log(`💰 Payment: "${playerName}" is a MEMBER (word match: "${bestMatch}")`);
              break;
            }
          }
        }
        
        if (matchFound && bestSimilarity > 0.6) {
          memberCount++;
          console.log(`💰 Payment: "${playerName}" is a MEMBER (fuzzy match: "${bestMatch}", similarity: ${bestSimilarity.toFixed(2)})`);
        } else if (matchFound) {
          memberCount++;
        } else {
          nonMemberCount++;
          console.log(`💰 Payment: "${playerName}" is a NON-MEMBER (no match found)`);
        }
      }
    });
    
    if (isPeakHour) {
      // Peak hours: calculate fee with ₱100 minimum
      const calculatedFee = (memberCount * offPeakFeePerMember) + (nonMemberCount * offPeakFeePerNonMember);
      paymentAmount = Math.max(peakHourFee, calculatedFee);
    } else {
      // Off-peak hours: member/non-member based pricing
      paymentAmount = (memberCount * offPeakFeePerMember) + (nonMemberCount * offPeakFeePerNonMember);
    }
    
    calculationBreakdown = {
      amount: paymentAmount,
      isPeakHour: isPeakHour,
      breakdown: {
        memberCount,
        nonMemberCount,
        calculation: isPeakHour 
          ? `Peak hour: max(₱${peakHourFee}, ${memberCount} members × ₱${offPeakFeePerMember} + ${nonMemberCount} non-members × ₱${offPeakFeePerNonMember}) = ₱${paymentAmount}`
          : `${memberCount} members × ₱${offPeakFeePerMember} + ${nonMemberCount} non-members × ₱${offPeakFeePerNonMember} = ₱${paymentAmount}`
      }
    };
    }
  }

  // Set due date 
  let dueDate = new Date();
  
  if (isManualPayment) {
    // Manual payments are due immediately
    dueDate.setHours(23, 59, 59, 999);
  } else {
    // Set due date (7 days from creation for advance bookings, immediate for same-day)
    const reservationDate = new Date(reservation!.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    reservationDate.setHours(0, 0, 0, 0);
    
    if (reservationDate.getTime() === today.getTime()) {
      // Same day booking - due immediately
      dueDate.setHours(23, 59, 59, 999);
    } else {
      // Advance booking - due 7 days from now or 1 day before reservation, whichever is earlier
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const oneDayBeforeReservation = new Date(reservationDate);
      oneDayBeforeReservation.setDate(oneDayBeforeReservation.getDate() - 1);
      
      dueDate.setTime(Math.min(sevenDaysFromNow.getTime(), oneDayBeforeReservation.getTime()));
    }
  }

  // Create single payment record
  let paymentData: any = {
    userId: isManualPayment ? req.user._id : reservation!.userId,
    amount: paymentAmount,
    paymentMethod,
    dueDate,
    notes: notes || (isAdminOverride ? `Admin override: Custom amount ₱${paymentAmount.toFixed(2)} set by ${req.user.username}` : undefined)
  };

  if (isManualPayment) {
    // Manual payment setup
    paymentData.description = `Manual payment for court usage on ${new Date(courtUsageDate).toDateString()}`;
    paymentData.metadata = {
      isManualPayment: true,
      playerNames: playerNames,
      courtUsageDate: new Date(courtUsageDate),
      playerCount: playerNames.length,
      originalFee: paymentAmount,
      discounts: []
    };
  } else {
    // Regular reservation payment setup
    paymentData.reservationId = reservationId;
    paymentData.description = `Court reservation payment for ${reservation!.date.toDateString()} ${reservation!.timeSlot}:00-${reservation!.timeSlot + 1}:00`;
    paymentData.metadata = {
      timeSlot: reservation!.timeSlot,
      date: reservation!.date,
      playerCount: reservation!.players.length,
      isPeakHour: calculationBreakdown?.isPeakHour,
      originalFee: paymentAmount,
      isAdminOverride: isAdminOverride,
      discounts: []
    };
  }

  if (paymentMethod !== 'cash' && !req.file) {
    return res.status(400).json({
      success: false,
      error: 'Proof of payment image is required to complete this payment'
    });
  }

  const payment = new Payment(paymentData);

  if (req.file && paymentMethod !== 'cash') {
    await attachProofOfPayment(payment, req.file, req.user._id.toString());
  }

  await payment.save();
  await payment.populate('userId', 'username fullName email');

  if (!isManualPayment) {
    await payment.populate('reservationId', 'userId date timeSlot endTimeSlot duration players status totalFee timeSlotDisplay tennisBalls');
    // Update reservation payment status - since payments are automatically completed, set to paid
    reservation!.paymentStatus = 'paid';
    await reservation!.save({ validateBeforeSave: false });
  }

  await payment.populate('pollId', 'title openPlayEvent.eventDate openPlayEvent.startTime openPlayEvent.endTime');

  return res.status(201).json({
    success: true,
    data: payment,
    calculation: calculationBreakdown,
    message: 'Payment record created successfully'
  });
});

// Get all payments with filtering and pagination
export const getPayments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('💰 GET PAYMENTS REQUEST:', {
    query: req.query,
    userRole: req.user?.role,
    userId: req.user?._id
  });

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 100; // Increase default limit for reports
  const skip = (page - 1) * limit;

  // Build filter query
  const filter: any = {};
  
  if (req.query.userId) {
    filter.userId = req.query.userId;
  }
  
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  if (req.query.paymentMethod) {
    filter.paymentMethod = req.query.paymentMethod;
  }

  if (req.query.paymentIds) {
    const ids = (req.query.paymentIds as string).split(',').filter(Boolean);
    filter._id = { $in: ids };
  }

  if (req.query.reservationId) {
    // Use reservation.paymentIds for reliable filtering (bypasses reservationId type mismatch in DB)
    const reservation = await Reservation.findById(req.query.reservationId)
      .select('paymentIds')
      .lean() as any;
    const paymentIds = reservation?.paymentIds ?? [];
    if (paymentIds.length > 0) {
      filter._id = { $in: paymentIds };
    } else {
      // Fallback for legacy reservations without paymentIds array
      filter.reservationId = req.query.reservationId;
    }
  }

  if (req.query.startDate && req.query.endDate) {
    const fromDate = new Date(req.query.startDate as string);
    const toDate = new Date(req.query.endDate as string);
    toDate.setHours(23, 59, 59, 999);

    filter.paymentDate = {
      $gte: fromDate,
      $lte: toDate
    };
  }

  // If regular member, only show own payments
  if (req.user?.role === 'member') {
    filter.userId = req.user._id.toString();
  }

  console.log('💰 PAYMENT FILTER:', filter);
  
  try {

    const total = await Payment.countDocuments(filter);
    console.log('💰 TOTAL PAYMENTS FOUND:', total);
    
    const paymentsRaw = await Payment.find(filter)
      .populate({
        path: 'reservationId',
        select: 'date timeSlot players status',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'pollId',
        select: 'title openPlayEvent.eventDate openPlayEvent.startTime openPlayEvent.endTime',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'approvedBy',
        select: 'username fullName',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'recordedBy',
        select: 'username fullName',
        options: { strictPopulate: false }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean() as any[];

    // Manually populate userId, skipping any corrupted (non-ObjectId) values
    const isValidObjectId = (id: any) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
    const validUserIds = [...new Set(paymentsRaw.map((p: any) => p.userId).filter(isValidObjectId))];
    const userDocs = validUserIds.length > 0
      ? await User.find({ _id: { $in: validUserIds } }).select('username fullName email creditBalance').lean() as any[]
      : [];
    const userMap = new Map(userDocs.map((u: any) => [u._id.toString(), u]));

    const payments = paymentsRaw.map((p: any) => ({
      ...p,
      userId: isValidObjectId(p.userId) ? (userMap.get(p.userId) || { _id: p.userId }) : { _id: null }
    }));

    console.log('💰 PAYMENTS RETRIEVED:', payments.length, 'payments');

    // Transform payments to ensure all required fields are present
    const transformedPayments = payments.map((payment: any) => {
      const reservation = payment.reservationId || null;
      return {
        ...payment,
        hasProofOfPayment: !!payment.proofOfPaymentPath,
        reservationId: reservation ? {
          _id: reservation._id,
          date: reservation.date,
          timeSlot: reservation.timeSlot,
          players: Array.isArray(reservation.players) ? reservation.players : [],
          status: reservation.status
        } : null
      };
    });

    return res.status(200).json({
      success: true,
      data: transformedPayments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('💰 ERROR IN GET PAYMENTS:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined,
      details: {
        filter,
        query: req.query
      }
    });
  }
});

// Get single payment
export const getPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  
  const payment = await Payment.findById(id)
    .populate('userId', 'username fullName email')
    .populate('reservationId', 'userId date timeSlot endTimeSlot duration players status totalFee timeSlotDisplay tennisBalls')
    .populate('pollId', 'title openPlayEvent.eventDate openPlayEvent.startTime openPlayEvent.endTime');
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  // Check access permissions
  if (req.user?.role === 'member' && payment.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  return res.status(200).json({
    success: true,
    data: payment
  });
});

// Get a short-lived signed URL for viewing a payment's uploaded proof of payment
export const getPaymentProofUrl = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const payment = await Payment.findById(id);

  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  const isOwner = payment.userId.toString() === req.user!._id.toString()
    || (payment.paidBy && payment.paidBy.toString() === req.user!._id.toString());
  const isPrivileged = ['treasurer', 'admin', 'superadmin'].includes(req.user!.role);

  if (!isOwner && !isPrivileged) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  if (!payment.proofOfPaymentPath) {
    return res.status(404).json({
      success: false,
      error: 'No proof of payment uploaded for this payment'
    });
  }

  const url = await getSignedProofUrl(payment.proofOfPaymentPath, 300);

  return res.status(200).json({
    success: true,
    url
  });
});

// Process payment (mark as completed)
export const processPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { transactionId, referenceNumber, notes } = req.body;

  console.log('💰 Processing payment:', id, 'by user:', req.user?.username);

  const payment = await Payment.findById(id);
  
  if (!payment) {
    console.log('❌ Payment not found:', id);
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  console.log('💰 Payment found:', {
    id: payment._id,
    status: payment.status,
    amount: payment.amount,
    method: payment.paymentMethod,
    description: payment.description,
    reservationId: payment.reservationId
  });

  if (payment.status !== 'pending') {
    console.log('❌ Payment not in pending status:', payment.status);
    return res.status(400).json({
      success: false,
      error: 'Payment is not in pending status'
    });
  }

  if (payment.paymentMethod !== 'cash' && !req.file && !payment.proofOfPaymentPath) {
    return res.status(400).json({
      success: false,
      error: 'Proof of payment image is required to complete this payment'
    });
  }

  try {
    // Start a transaction-like operation by updating payment first
    const originalStatus = payment.status;

    if (req.file && payment.paymentMethod !== 'cash') {
      await attachProofOfPayment(payment, req.file, req.user!._id.toString());
    }

    // Update payment status and set payment date
    payment.status = 'completed';
    payment.paymentDate = new Date();
    
    if (transactionId) {
      payment.transactionId = transactionId;
    }
    
    if (referenceNumber) {
      payment.referenceNumber = referenceNumber;
    }
    
    if (notes) {
      payment.notes = payment.notes ? `${payment.notes}\n${notes}` : notes;
    }

    await payment.save();
    console.log('✅ Payment status updated to:', payment.status, 'at:', payment.paymentDate);

    // Update reservation payment status if this is a court reservation
    if (payment.reservationId) {
      const reservation = await Reservation.findById(payment.reservationId);
      if (reservation) {
        console.log('💰 Updating reservation payment status from', reservation.paymentStatus, 'to paid');
        reservation.paymentStatus = 'paid';
        await reservation.save({ validateBeforeSave: false });
        console.log('✅ Reservation payment status updated successfully');
      } else {
        console.log('⚠️ No reservation found for payment:', payment.reservationId);
        // This is not a critical error, payment can still be marked as completed
      }
    }

    // Populate related data for response
    await payment.populate('userId', 'username fullName email');
    await payment.populate('reservationId', 'userId date timeSlot endTimeSlot duration players status totalFee timeSlotDisplay tennisBalls');
    await payment.populate('pollId', 'title openPlayEvent.eventDate openPlayEvent.startTime openPlayEvent.endTime');

    console.log('💰 Payment processing completed successfully:', {
      paymentId: payment._id,
      status: payment.status,
      paymentDate: payment.paymentDate,
      reservationUpdated: !!payment.reservationId
    });

    // Emit real-time update to court usage report when payment is completed
    try {
      const { webSocketService } = await import('../services/websocketService');
      if (webSocketService.isInitialized()) {
        const memberName = (payment.userId as any)?.fullName || 'Unknown Member';
        const amount = payment.amount || 0;
        
        webSocketService.emitCourtUsageUpdate({
          type: 'court_usage_data_updated',
          data: null, // Will trigger a full refresh on the frontend
          timestamp: new Date().toISOString(),
          message: `💳 Payment completed: ${memberName} paid ₱${amount.toFixed(2)}`
        });
        
        console.log('📡 Real-time court usage update broadcasted for payment completion');
      }
    } catch (error) {
      console.error('⚠️ Failed to broadcast payment completion update:', error);
      // Don't fail the payment processing if WebSocket broadcast fails
    }

    return res.status(200).json({
      success: true,
      data: payment,
      message: 'Payment processed successfully',
      details: {
        paymentCompleted: true,
        reservationUpdated: !!payment.reservationId,
        paymentDate: payment.paymentDate
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing payment:', error);
    
    // If payment was updated but reservation update failed, we still consider it successful
    // since the payment status is the primary concern
    if (payment.status === 'completed') {
      console.log('⚠️ Payment was marked completed but reservation update may have failed');
      return res.status(200).json({
        success: true,
        data: payment,
        message: 'Payment processed successfully (reservation update may have failed)',
        warning: 'Reservation status update encountered an error but payment is completed'
      });
    }
    
    // If payment update itself failed, return error
    return res.status(500).json({
      success: false,
      error: 'Failed to process payment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update payment details (payment method, transaction ID, etc.)
export const updatePayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('💰 🔥 UPDATE PAYMENT ENDPOINT HIT! 🔥 💰');
  console.log('💰 Request ID:', req.params.id);
  console.log('💰 Request body:', JSON.stringify(req.body, null, 2));
  console.log('💰 User:', req.user?.username, '(', req.user?.role, ')');
  
  const { id } = req.params;
  const { paymentMethod, transactionId, referenceNumber, customAmount, status, paymentDate, notes } = req.body;

  console.log('💰 UPDATE PAYMENT REQUEST:', {
    paymentId: id,
    paymentMethod,
    transactionId,
    referenceNumber,
    customAmount,
    status,
    paymentDate,
    notes,
    userRole: req.user?.role,
    username: req.user?.username
  });

  const payment = await Payment.findById(id);
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  // MIGRATION FIX: Ensure existing payments have proper metadata structure
  if (payment.metadata && !payment.metadata.discounts) {
    payment.metadata.discounts = [];
    console.log('💰 MIGRATION: Added missing discounts array to payment', id);
  } else if (!payment.metadata) {
    payment.metadata = { discounts: [] };
    console.log('💰 MIGRATION: Created missing metadata with discounts array for payment', id);
  }

  // Check permissions - only admins or payment owner can update
  if (req.user?.role === 'member' && payment.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  // Payment status update restrictions based on user role
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';

  // Admins cannot edit payments that have been recorded in financial reports
  if (payment.status === 'record') {
    return res.status(400).json({
      success: false,
      error: 'Recorded payments cannot be edited. Use unrecord feature first.'
    });
  }

  // Non-admins can only update pending payments (and not change status)
  if (!isAdmin && payment.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: 'Only pending payments can be updated'
    });
  }

  // Clean up duplicate notes to prevent exceeding 500 char limit
  if (payment.notes) {
    const lines = payment.notes.split('\n');
    const uniqueLines = [...new Set(lines)]; // Remove duplicates
    payment.notes = uniqueLines.join('\n');
    console.log('💰 Cleaned up notes:', { originalLines: lines.length, uniqueLines: uniqueLines.length });
  }

  // Handle status transitions (admin only)
  if (status && isAdmin) {
    console.log('💰 Processing status change:', { currentStatus: payment.status, newStatus: status, isAdmin });

    const validStatuses = ['pending', 'completed', 'failed', 'refunded'];
    if (!validStatuses.includes(status)) {
      console.log('💰 ERROR: Invalid status value:', status);
      return res.status(400).json({
        success: false,
        error: 'Invalid status value'
      });
    }

    if (status === 'record') {
      console.log('💰 ERROR: Cannot change to record status via update');
      return res.status(400).json({
        success: false,
        error: 'Use record endpoint to mark payment as recorded'
      });
    }

    if (payment.status !== status) {
      console.log('💰 Updating status from', payment.status, 'to', status);
      const statusNote = `Status changed from ${payment.status} to ${status} by ${req.user?.username}`;

      // Check if this exact note already exists
      const existingNotes = payment.notes || '';
      if (!existingNotes.includes(statusNote)) {
        payment.notes = payment.notes ? `${payment.notes}\n${statusNote}` : statusNote;
      }

      payment.status = status;
      payment.markModified('status'); // Explicitly mark status as modified

      if (status === 'completed' && !payment.paymentDate) {
        payment.paymentDate = new Date();
        payment.markModified('paymentDate'); // Explicitly mark as modified
        console.log('💰 Auto-set paymentDate for completed payment');
      }
    } else {
      console.log('💰 Status unchanged (already', status, ')');
    }
  } else if (status && !isAdmin) {
    console.log('💰 WARNING: Non-admin attempted to change status');
  }

  // Handle payment date updates (admin only)
  if (paymentDate && isAdmin) {
    const newDate = new Date(paymentDate);

    if (['completed', 'record'].includes(payment.status)) {
      if (newDate > new Date()) {
        return res.status(400).json({
          success: false,
          error: 'Payment date cannot be in the future for completed payments'
        });
      }
    }

    const dateNote = `Payment date changed from ${payment.paymentDate?.toISOString() || 'unset'} to ${newDate.toISOString()} by ${req.user?.username}`;

    // Check if this note already exists
    const existingNotes = payment.notes || '';
    if (!existingNotes.includes(dateNote)) {
      payment.notes = payment.notes ? `${payment.notes}\n${dateNote}` : dateNote;
    }

    payment.paymentDate = newDate;
  }

  // Handle admin notes
  if (notes && isAdmin) {
    const adminNote = `Admin note by ${req.user?.username}: ${notes}`;
    payment.notes = payment.notes ? `${payment.notes}\n${adminNote}` : adminNote;
  }

  // Update payment details
  if (paymentMethod) {
    payment.paymentMethod = paymentMethod;
  }
  
  if (transactionId) {
    payment.transactionId = transactionId;
  }
  
  if (referenceNumber) {
    payment.referenceNumber = referenceNumber;
  }
  
  // Handle custom amount (now available to all users)
  if (customAmount) {
    const newAmount = parseFloat(customAmount);
    if (newAmount > 0 && payment.amount !== newAmount) {
      // Only add note if amount is actually changing
      payment.amount = newAmount;
      // Add or update notes about custom amount
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
      const amountNote = isAdmin
        ? `Admin override: Custom amount ₱${newAmount.toFixed(2)} set by ${req.user?.username || 'admin'}`
        : `Custom amount ₱${newAmount.toFixed(2)} set by ${req.user?.username || 'user'}`;

      // Only add note if it's not a duplicate of the last note
      const existingNotes = payment.notes || '';
      if (!existingNotes.includes(amountNote)) {
        if (payment.notes) {
          payment.notes += `\n${amountNote}`;
        } else {
          payment.notes = amountNote;
        }
      }

      // Update metadata (create if it doesn't exist)
      if (!payment.metadata) {
        payment.metadata = {
          discounts: [] // Initialize discounts array to prevent length error
        };
      }
      payment.metadata.isAdminOverride = true;
      payment.metadata.originalFee = newAmount;
    }
  }

  // Truncate notes if they exceed 500 characters
  if (payment.notes && payment.notes.length > 500) {
    console.log('💰 WARNING: Notes exceed 500 characters, truncating...');
    // Keep the last 450 characters and add a note about truncation
    payment.notes = '...(truncated)\n' + payment.notes.substring(payment.notes.length - 450);
    console.log('💰 Notes truncated to:', payment.notes.length, 'characters');
  }

  try {
    console.log('💰 Saving payment...');
    await payment.save();
    console.log('💰 Payment saved successfully');
  } catch (error: any) {
    console.error('💰 ERROR during payment save:', error);
    console.error('💰 ERROR stack:', error.stack);
    throw error;
  }
  
  try {
    console.log('💰 Populating userId...');
    await payment.populate('userId', 'username fullName email');
    console.log('💰 userId populated successfully');
  } catch (error: any) {
    console.error('💰 ERROR during userId populate:', error);
    console.error('💰 ERROR stack:', error.stack);
    throw error;
  }
  
  try {
    console.log('💰 Populating reservationId...');
    await payment.populate('reservationId', 'userId date timeSlot endTimeSlot duration players status totalFee timeSlotDisplay tennisBalls');
    console.log('💰 reservationId populated successfully');
  } catch (error: any) {
    console.error('💰 ERROR during reservationId populate:', error);
    console.error('💰 ERROR stack:', error.stack);
    throw error;
  }
  
  try {
    console.log('💰 Populating pollId...');
    await payment.populate('pollId', 'title openPlayEvent.eventDate openPlayEvent.startTime openPlayEvent.endTime');
    console.log('💰 pollId populated successfully');
  } catch (error: any) {
    console.error('💰 ERROR during pollId populate:', error);
    console.error('💰 ERROR stack:', error.stack);
    console.error('💰 Poll document causing error:', payment.pollId ? JSON.stringify(payment.pollId, null, 2) : 'No pollId');
    throw error;
  }

  console.log('💰 UPDATE PAYMENT SUCCESS:', {
    paymentId: id,
    finalAmount: payment.amount,
    finalMethod: payment.paymentMethod,
    finalStatus: payment.status,
    hasMetadata: !!payment.metadata,
    isAdminOverride: payment.metadata?.isAdminOverride
  });

  console.log('💰 Payment object status before response:', payment.status);
  console.log('💰 Payment toJSON status:', payment.toJSON().status);

  return res.status(200).json({
    success: true,
    data: payment,
    message: 'Payment updated successfully'
  });
});

// Cancel/refund payment
export const cancelPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const payment = await Payment.findById(id);
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  if (payment.status === 'refunded') {
    return res.status(400).json({
      success: false,
      error: 'Payment is already refunded'
    });
  }

  // Check permissions - only admins or payment owner can cancel
  if (req.user?.role === 'member' && payment.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  // Allow cancellation of any reservation regardless of date

  const previousStatus = payment.status;
  payment.status = payment.status === 'completed' ? 'refunded' : 'failed';
  
  // Add refund/cancellation info to metadata
  if (!payment.metadata) {
    payment.metadata = {};
  }
  
  (payment.metadata as any).cancellation = {
    reason: reason || 'No reason provided',
    cancelledAt: new Date(),
    cancelledBy: req.user?._id,
    previousStatus
  };

  await payment.save();

  // Update reservation payment status
  const reservation = await Reservation.findById(payment.reservationId);
  if (reservation) {
    reservation.paymentStatus = 'pending';
    await reservation.save({ validateBeforeSave: false });
  }

  await payment.populate('userId', 'username fullName email');
  await payment.populate('reservationId', 'userId date timeSlot endTimeSlot duration players status totalFee timeSlotDisplay tennisBalls');
  await payment.populate('pollId', 'title openPlayEvent.eventDate openPlayEvent.startTime openPlayEvent.endTime');

  return res.status(200).json({
    success: true,
    data: payment,
    message: payment.status === 'refunded' ? 'Payment refunded successfully' : 'Payment cancelled successfully'
  });
});

// Get user's payment history
export const getMyPayments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🔍 getMyPayments called by user:', req.user?.username, 'with query:', req.query);
  
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {};
  
  // Admin and superadmin users can see all payments, regular members only see their own
  if (req.user.role === 'member') {
    filter.userId = req.user._id.toString();
  }
  
  if (req.query.status) {
    filter.status = req.query.status;
  }

  console.log('🔍 getMyPayments filter:', {
    userId: req.user._id.toString(),
    userRole: req.user.role,
    isAdmin: req.user.role === 'admin' || req.user.role === 'superadmin',
    status: req.query.status,
    filter: filter
  });

  const total = await Payment.countDocuments(filter);
  console.log('🔍 Total payments found for user:', total);
  
  // Add debug for completed payments specifically
  const completedFilter = { status: 'completed' };
  if (req.user.role === 'member') {
    (completedFilter as any).userId = req.user._id.toString();
  }
  const completedCount = await Payment.countDocuments(completedFilter);
  console.log('🔍 Completed payments for user:', completedCount);
  
  try {
    const paymentsRaw = await Payment.find(filter)
      .populate({
        path: 'reservationId',
        select: 'userId date timeSlot endTimeSlot duration players status totalFee tennisBalls',
        options: { virtuals: true }
      })
      .populate('pollId', 'title openPlayEvent.eventDate openPlayEvent.startTime openPlayEvent.endTime')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean() as any[];

    // Manually populate userId, skipping any corrupted (non-ObjectId) values
    const isValidObjectId = (id: any) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
    const validUserIds = [...new Set(paymentsRaw.map((p: any) => p.userId).filter(isValidObjectId))];
    const userDocs = validUserIds.length > 0
      ? await User.find({ _id: { $in: validUserIds } }).select('username fullName email').lean() as any[]
      : [];
    const userMap = new Map(userDocs.map((u: any) => [u._id.toString(), u]));

    const payments = paymentsRaw.map((p: any) => ({
      ...p,
      hasProofOfPayment: !!p.proofOfPaymentPath,
      userId: isValidObjectId(p.userId) ? (userMap.get(p.userId) || { _id: p.userId }) : { _id: null }
    }));

    // Manually add timeSlotDisplay virtual for reservations
    payments.forEach((payment: any) => {
      if (payment.reservationId) {
        const startHour = payment.reservationId.timeSlot;
        const endHour = payment.reservationId.endTimeSlot || (startHour + 1);
        payment.reservationId.timeSlotDisplay = `${startHour}:00 - ${endHour}:00`;
      }
    });

    console.log('🔍 Payments returned for user:', payments.map(p => ({
      id: p._id,
      description: p.description,
      status: p.status,
      amount: p.amount,
      userId: p.userId,
      createdAt: p.createdAt,
      paymentDate: p.paymentDate
    })));

    return res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error in getMyPayments:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined,
      details: {
        filter: filter,
        userId: req.user._id
      }
    });
  }
});

// Get overdue payments (admin only)
export const getOverduePayments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const overduePayments = await (Payment as any).getOverduePayments();

  return res.status(200).json({
    success: true,
    data: overduePayments,
    count: overduePayments.length
  });
});

// Check current user's overdue payments
export const checkMyOverduePayments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  console.log('🔍 Checking overdue payments for user:', req.user.username);

  // Check for overdue payments (1+ days past due)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  oneDayAgo.setHours(23, 59, 59, 999);

  // Check 1: Payment collection for pending overdue payments
  const overduePayments = await Payment.find({
    userId: req.user._id,
    status: 'pending',
    dueDate: { $lt: oneDayAgo }
  }).lean();

  console.log(`🔍 Found ${overduePayments.length} overdue Payment records`);

  // Check 2: Reservations with pending payment status where reservation date has passed
  const overdueReservations = await Reservation.find({
    userId: req.user._id,
    paymentStatus: 'pending',
    date: { $lt: oneDayAgo },
    status: { $in: ['pending', 'confirmed'] }
  }).lean();

  console.log(`🔍 Found ${overdueReservations.length} overdue Reservations`);

  // Format overdue details
  const overdueDetails: any[] = [];

  // Add Payment records
  overduePayments.forEach(payment => {
    const daysOverdue = payment.dueDate ? Math.ceil((new Date().getTime() - new Date(payment.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    overdueDetails.push({
      type: 'payment',
      id: payment._id,
      amount: payment.amount,
      dueDate: payment.dueDate,
      daysOverdue: daysOverdue,
      description: payment.description || 'Payment'
    });
  });

  // Add Reservation records
  overdueReservations.forEach(reservation => {
    const daysOverdue = Math.ceil((new Date().getTime() - new Date(reservation.date).getTime()) / (1000 * 60 * 60 * 24));
    const description = `Court reservation for ${new Date(reservation.date).toDateString()} ${reservation.timeSlot}:00-${(reservation.endTimeSlot || reservation.timeSlot + 1)}:00`;
    overdueDetails.push({
      type: 'reservation',
      id: reservation._id,
      amount: reservation.totalFee || 0,
      dueDate: reservation.date,
      daysOverdue: daysOverdue,
      description: description
    });
  });

  const totalOverdue = overdueDetails.length;

  console.log(`🔍 Total overdue items: ${totalOverdue}`);

  return res.status(200).json({
    success: true,
    hasOverdue: totalOverdue > 0,
    count: totalOverdue,
    overduePayments: overdueDetails
  });
});

// Get payment statistics (admin only)
export const getPaymentStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate } = req.query;
  
  const start = startDate ? new Date(startDate as string) : undefined;
  const end = endDate ? new Date(endDate as string) : undefined;
  
  if (end) {
    end.setHours(23, 59, 59, 999);
  }

  const stats = await (Payment as any).getPaymentStats(start, end);

  // Get payment method breakdown
  const methodBreakdown = await Payment.aggregate([
    {
      $match: {
        ...(start && { createdAt: { $gte: start } }),
        ...(end && { createdAt: { $lte: end } })
      }
    },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    },
    {
      $sort: { totalAmount: -1 }
    }
  ]);

  return res.status(200).json({
    success: true,
    data: {
      ...stats,
      paymentMethodBreakdown: methodBreakdown,
      period: {
        startDate: start?.toISOString(),
        endDate: end?.toISOString()
      }
    }
  });
});

// Approve payment (mark as approved and completed)
export const approvePayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { notes } = req.body;

  console.log('✅ Approving payment:', id, 'by admin:', req.user?.username);

  // Check admin permissions
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  const payment = await Payment.findById(id);
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  if (payment.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: 'Only pending payments can be approved'
    });
  }

  try {
    // Update payment status and approval info
    payment.status = 'completed';
    payment.paymentDate = new Date();
    payment.approvedBy = req.user._id.toString();
    payment.approvedAt = new Date();
    
    if (notes) {
      const approvalNote = `Approved by ${req.user.username}: ${notes}`;
      payment.notes = payment.notes ? `${payment.notes}\n${approvalNote}` : approvalNote;
    }

    await payment.save();

    // Update reservation payment status if this is a court reservation
    if (payment.reservationId) {
      const reservation = await Reservation.findById(payment.reservationId);
      if (reservation) {
        reservation.paymentStatus = 'paid';
        await reservation.save({ validateBeforeSave: false });
      }
    }

    // Populate related data for response
    await payment.populate('userId', 'username fullName email');
    await payment.populate('reservationId', 'userId date timeSlot endTimeSlot duration players status totalFee timeSlotDisplay tennisBalls');
    await payment.populate('approvedBy', 'username fullName');

    console.log('✅ Payment approved successfully:', {
      paymentId: payment._id,
      approvedBy: req.user.username,
      approvedAt: payment.approvedAt
    });

    return res.status(200).json({
      success: true,
      data: payment,
      message: 'Payment approved successfully'
    });
    
  } catch (error) {
    console.error('❌ Error approving payment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to approve payment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Record payment (mark as recorded after approval)
export const recordPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { notes, paymentDate, applyCredit, creditAmount } = req.body;

  console.log('📝 Recording payment:', id, 'by admin:', req.user?.username);

  // Check admin permissions
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  const payment = await Payment.findById(id);

  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  if (payment.status !== 'completed') {
    return res.status(400).json({
      success: false,
      error: 'Only completed payments can be recorded'
    });
  }

  try {
    // Update payment status and recording info
    payment.status = 'record';
    payment.recordedBy = req.user._id.toString();
    payment.recordedAt = new Date();

    // Update payment date if provided (allows admin to choose which year it appears in)
    if (paymentDate) {
      payment.paymentDate = new Date(paymentDate);
      console.log('📅 Custom payment date set:', new Date(paymentDate).toISOString());
    } else if (!payment.paymentDate) {
      // If no paymentDate was ever set, default to now
      payment.paymentDate = new Date();
    }
    
    if (notes) {
      const recordingNote = `Recorded by ${req.user.username}: ${notes}`;
      const newNotes = payment.notes ? `${payment.notes}\n${recordingNote}` : recordingNote;
      
      // Aggressively truncate notes to ensure it fits within 500 character limit
      if (newNotes.length > 500) {
        payment.notes = 'TRUNCATED: ...' + newNotes.slice(-(500-15));
      } else {
        payment.notes = newNotes;
      }
    }

    await payment.save();

    // Deduct from credit balance only if admin chose to apply it
    try {
      const paymentUser = await User.findById(payment.userId);
      if (applyCredit === true && paymentUser && (paymentUser.creditBalance || 0) > 0) {
        const creditBalance = paymentUser.creditBalance || 0;
        const maxDeduct = Math.min(creditBalance, payment.amount);
        // Use admin-specified amount if valid, otherwise fall back to max
        const requestedAmount = typeof creditAmount === 'number' && creditAmount > 0 ? creditAmount : maxDeduct;
        const deductAmount = Math.min(requestedAmount, maxDeduct);
        await CreditTransaction.createTransaction(
          paymentUser._id.toString(),
          'deduction',
          deductAmount,
          `Payment recorded for court reservation — ₱${deductAmount.toFixed(2)} deducted from credit balance`,
          {
            referenceId: String(payment._id),
            referenceType: 'payment',
            metadata: {
              source: 'payment_recorded',
              adminUserId: req.user._id.toString(),
              reason: `Credit applied when payment ${payment.referenceNumber} was recorded`
            }
          }
        );
        console.log(`💳 Credit deducted: ₱${deductAmount.toFixed(2)} from ${paymentUser.fullName} (balance was ₱${creditBalance})`);
      }
    } catch (creditError) {
      // Log but don't fail the payment recording
      console.error('⚠️ Failed to deduct credit balance during payment recording:', creditError);
    }

    // Update CourtUsageReport when payment is recorded
    await updateCourtUsageReport(payment);

    // Populate related data for response
    await payment.populate('userId', 'username fullName email');
    await payment.populate('reservationId', 'userId date timeSlot endTimeSlot duration players status totalFee timeSlotDisplay tennisBalls');
    await payment.populate('approvedBy', 'username fullName');
    await payment.populate('recordedBy', 'username fullName');

    console.log('📝 Payment recorded successfully:', {
      paymentId: payment._id,
      recordedBy: req.user.username,
      recordedAt: payment.recordedAt
    });

    // Emit real-time update to court usage report when payment is recorded
    try {
      const { webSocketService } = await import('../services/websocketService');
      if (webSocketService.isInitialized()) {
        const memberName = (payment.userId as any)?.fullName || 'Unknown Member';
        const amount = payment.amount || 0;
        
        webSocketService.emitCourtUsageUpdate({
          type: 'court_usage_data_updated',
          data: { summary: { message: 'Payment recorded - refresh report to see changes' } },
          timestamp: new Date().toISOString(),
          message: `📝 Payment recorded: ${memberName} - ₱${amount.toFixed(2)} recorded by ${req.user.username}`
        });
        
        console.log('📡 Real-time court usage update broadcasted for payment recording');
      }
    } catch (error) {
      console.error('⚠️ Failed to broadcast payment recording update:', error);
      // Don't fail the payment recording if WebSocket broadcast fails
    }

    // DISABLED FOR 2026: Financial report now calculated on-demand with year filtering
    // The JSON file remains static; calculations come from database queries
    // try {
    //   await updateFinancialReportCourtReceipts();
    // } catch (error) {
    //   console.error('⚠️ Failed to update financial report:', error);
    // }

    return res.status(200).json({
      success: true,
      data: payment,
      message: 'Payment recorded successfully'
    });
    
  } catch (error) {
    console.error('❌ Error recording payment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record payment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Unrecord payment (reverse recording)
export const unrecordPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { notes } = req.body;

  console.log('🔄 Unrecording payment:', id, 'by admin:', req.user?.username);

  // Check admin permissions
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  const payment = await Payment.findById(id);
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  if (payment.status !== 'record') {
    return res.status(400).json({
      success: false,
      error: 'Only recorded payments can be unrecorded'
    });
  }

  try {
    // Revert payment status and clear recording info
    payment.status = 'completed';
    payment.paymentDate = payment.paymentDate || new Date();
    payment.recordedBy = undefined;
    payment.recordedAt = undefined;
    
    if (notes) {
      const unrecordingNote = `Unrecorded by ${req.user.username}: ${notes}`;
      const newNotes = payment.notes ? `${payment.notes}\n${unrecordingNote}` : unrecordingNote;
      
      // Aggressively truncate notes to ensure it fits within 500 character limit
      if (newNotes.length > 500) {
        payment.notes = 'TRUNCATED: ...' + newNotes.slice(-(500-15));
      } else {
        payment.notes = newNotes;
      }
    }

    await payment.save();

    // Subtract from CourtUsageReport when payment is unrecorded
    await subtractFromCourtUsageReport(payment);

    // Populate related data for response
    await payment.populate('userId', 'username fullName email');
    await payment.populate('reservationId', 'userId date timeSlot endTimeSlot duration players status totalFee timeSlotDisplay tennisBalls');
    await payment.populate('approvedBy', 'username fullName');

    console.log('🔄 Payment unrecorded successfully:', {
      paymentId: payment._id,
      unrecordedBy: req.user.username,
      newStatus: payment.status
    });

    // Emit real-time update to court usage report when payment is unrecorded
    try {
      const { webSocketService } = await import('../services/websocketService');
      if (webSocketService.isInitialized()) {
        const memberName = (payment.userId as any)?.fullName || 'Unknown Member';
        const amount = payment.amount || 0;
        
        webSocketService.emitCourtUsageUpdate({
          type: 'court_usage_data_updated',
          data: { summary: { message: 'Payment unrecorded - refresh report to see changes' } },
          timestamp: new Date().toISOString(),
          message: `🔄 Payment unrecorded: ${memberName} - ₱${amount.toFixed(2)} unrecorded by ${req.user.username}`
        });
        
        console.log('📡 Real-time court usage update broadcasted for payment unrecording');
      }
    } catch (error) {
      console.error('⚠️ Failed to broadcast payment unrecording update:', error);
      // Don't fail the payment unrecording if WebSocket broadcast fails
    }

    // DISABLED FOR 2026: Financial report now calculated on-demand with year filtering
    // The JSON file remains static; calculations come from database queries
    // try {
    //   await updateFinancialReportCourtReceipts();
    // } catch (error) {
    //   console.error('⚠️ Failed to update financial report:', error);
    // }

    return res.status(200).json({
      success: true,
      data: payment,
      message: 'Payment unrecorded successfully'
    });
    
  } catch (error) {
    console.error('❌ Error unrecording payment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to unrecord payment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Calculate payment amount for a reservation
export const calculatePaymentAmount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { timeSlot, playerCount, date } = req.query;

  if (!timeSlot || !playerCount || !date) {
    return res.status(400).json({
      success: false,
      error: 'timeSlot, playerCount, and date are required'
    });
  }

  const calculation = (Payment as any).calculatePaymentAmount(
    parseInt(timeSlot as string),
    parseInt(playerCount as string),
    new Date(date as string)
  );

  return res.status(200).json({
    success: true,
    data: calculation
  });
});

// Clean up duplicate payments (admin utility)
export const cleanupDuplicatePayments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🧹 Starting payment cleanup process...');
  
  // Find all payments grouped by reservationId
  const duplicateGroups = await Payment.aggregate([
    {
      $match: {
        reservationId: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: '$reservationId',
        payments: {
          $push: {
            id: '$_id',
            status: '$status',
            createdAt: '$createdAt',
            description: '$description'
          }
        },
        count: { $sum: 1 }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]);

  console.log('🔍 Found', duplicateGroups.length, 'reservations with duplicate payments');
  
  let cleanedUp = 0;
  const cleanupReport = [];

  for (const group of duplicateGroups) {
    const payments = group.payments;
    console.log(`\n📋 Reservation ${group._id} has ${payments.length} payments:`);
    
    payments.forEach((p: any) => {
      console.log(`  - ${p.status}: ${p.description} (${p.id})`);
    });

    // Keep the completed payment, remove pending duplicates
    const completedPayments = payments.filter((p: any) => p.status === 'completed');
    const pendingPayments = payments.filter((p: any) => p.status === 'pending');
    
    if (completedPayments.length > 0 && pendingPayments.length > 0) {
      console.log(`✅ Keeping ${completedPayments.length} completed, removing ${pendingPayments.length} pending`);
      
      // Remove the pending duplicate payments
      for (const pendingPayment of pendingPayments) {
        await Payment.findByIdAndDelete(pendingPayment.id);
        cleanedUp++;
        cleanupReport.push({
          action: 'deleted',
          paymentId: pendingPayment.id,
          status: pendingPayment.status,
          description: pendingPayment.description,
          reason: 'Duplicate pending payment when completed payment exists'
        });
      }
    }
  }

  console.log(`🎉 Cleanup complete! Removed ${cleanedUp} duplicate payments`);

  return res.status(200).json({
    success: true,
    message: `Cleaned up ${cleanedUp} duplicate payment records`,
    duplicateGroupsFound: duplicateGroups.length,
    paymentsRemoved: cleanedUp,
    report: cleanupReport
  });
});

// Validation rules
export const createPaymentValidation = [
  body('reservationId')
    .if((value, { req }) => !req.body.isManualPayment)
    .notEmpty()
    .withMessage('Reservation ID is required')
    .isMongoId()
    .withMessage('Invalid reservation ID'),
  body('paymentMethod')
    .isIn(['cash', 'bank_transfer', 'gcash'])
    .withMessage('Invalid payment method'),
  body('amount')
    .if((value, { req }) => req.body.isManualPayment === true)
    .notEmpty()
    .withMessage('Amount is required for manual payments')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('amount')
    .if((value, { req }) => !req.body.isManualPayment)
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  // Manual payment specific validations
  body('isManualPayment')
    .optional()
    .isBoolean()
    .withMessage('isManualPayment must be a boolean'),
  body('playerNames')
    .if((value, { req }) => req.body.isManualPayment === true)
    .isArray({ min: 1 })
    .withMessage('Player names are required for manual payments')
    .custom((playerNames) => {
      if (!Array.isArray(playerNames) || playerNames.some(name => typeof name !== 'string' || !name.trim())) {
        throw new Error('Player names must be non-empty strings');
      }
      return true;
    }),
  body('courtUsageDate')
    .if((value, { req }) => req.body.isManualPayment === true)
    .notEmpty()
    .withMessage('Court usage date is required for manual payments')
    .isISO8601()
    .withMessage('Court usage date must be a valid date'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

export const processPaymentValidation = [
  body('transactionId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Transaction ID must be 1-100 characters'),
  body('referenceNumber')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Reference number must be 1-50 characters')
];

// ======================
// MEMBERSHIP FEE PAYMENTS
// ======================

// Record membership fee payment (Admin only)
export const recordMembershipFeePayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, membershipYear, amount, paymentMethod, paymentDate, notes } = req.body;

  console.log('💳 Recording membership fee payment:', { userId, membershipYear, amount, paymentMethod });

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check if user already paid for this year
  if (user.membershipYearsPaid && user.membershipYearsPaid.includes(membershipYear)) {
    return res.status(400).json({
      success: false,
      message: `User has already paid membership fee for year ${membershipYear}`
    });
  }

  // Create payment record
  const payment = await Payment.create({
    userId,
    amount,
    paymentMethod,
    paymentType: 'membership_fee',
    membershipYear,
    status: 'record', // Directly recorded by admin
    currency: 'PHP',
    description: `Annual Membership Fee for ${membershipYear}`,
    dueDate: new Date(membershipYear, 11, 31), // December 31 of the membership year
    paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
    notes,
    recordedBy: req.user?._id,
    recordedAt: new Date()
  });

  // Update user's membership years paid
  if (!user.membershipYearsPaid) {
    user.membershipYearsPaid = [];
  }
  user.membershipYearsPaid.push(membershipYear);
  user.membershipYearsPaid.sort((a, b) => b - a); // Sort descending
  user.lastMembershipPaymentDate = payment.paymentDate || new Date();

  // Also set the boolean flag to true for backward compatibility
  user.membershipFeesPaid = true;

  await user.save();

  console.log(`✅ Membership fee payment recorded for ${user.fullName} - Year ${membershipYear}`);

  // Update financial report (don't fail payment if this fails)
  try {
    await updateFinancialReportMembershipFees();
  } catch (error) {
    console.error('⚠️ Failed to update financial report:', error);
    // Payment still succeeds even if financial report update fails
  }

  const populatedPayment = await Payment.findById(payment._id)
    .populate('userId', 'username fullName email')
    .populate('recordedBy', 'username fullName');

  res.status(201).json({
    success: true,
    message: `Membership fee payment for ${membershipYear} recorded successfully`,
    data: populatedPayment
  });
});

// Get all membership fee payments
export const getMembershipPayments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { year, userId, status } = req.query;

  const filter: any = { paymentType: 'membership_fee' };

  if (year) {
    filter.membershipYear = parseInt(year as string);
  }

  if (userId) {
    filter.userId = userId;
  }

  if (status) {
    filter.status = status;
  }

  const payments = await Payment.find(filter)
    .populate('userId', 'username fullName email membershipYearsPaid')
    .populate('recordedBy', 'username fullName')
    .sort({ membershipYear: -1, createdAt: -1 });

  const total = payments.reduce((sum, p) => sum + (p.amount > 0 ? p.amount : 0), 0);
  const waivedCount = payments.filter(p => p.amount === 0).length;

  res.json({
    success: true,
    data: {
      payments,
      summary: {
        count: payments.length,
        totalAmount: total,
        waivedCount: waivedCount,
        years: [...new Set(payments.map(p => p.membershipYear))].sort((a, b) => (b || 0) - (a || 0))
      }
    }
  });
});

// Get membership payment summary by year
export const getMembershipPaymentSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const summary = await Payment.aggregate([
    {
      $match: {
        paymentType: 'membership_fee',
        status: 'record'
      }
    },
    {
      $group: {
        _id: '$membershipYear',
        totalAmount: {
          $sum: {
            $cond: [{ $gt: ['$amount', 0] }, '$amount', 0]
          }
        },
        count: { $sum: 1 },
        waivedCount: {
          $sum: { $cond: [{ $eq: ['$amount', 0] }, 1, 0] }
        }
      }
    },
    {
      $sort: { _id: -1 }
    }
  ]);

  res.json({
    success: true,
    data: summary.map(item => ({
      year: item._id,
      totalAmount: item.totalAmount,
      memberCount: item.count,
      waivedCount: item.waivedCount
    }))
  });
});

/**
 * Update membership fee payment
 * Admin/SuperAdmin can update any membership payment
 */
export const updateMembershipPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { amount, membershipYear, paymentMethod, paymentDate, notes } = req.body;

  // Find the payment
  const payment = await Payment.findById(id);

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  // Check if it's a membership fee payment
  if (payment.paymentType !== 'membership_fee') {
    return res.status(400).json({
      success: false,
      message: 'This endpoint is only for membership fee payments'
    });
  }

  // Get the old year before updating
  const oldYear = payment.membershipYear;
  const userId = payment.userId;

  // Update payment fields
  if (amount !== undefined) payment.amount = amount;
  if (membershipYear !== undefined) payment.membershipYear = membershipYear;
  if (paymentMethod !== undefined) payment.paymentMethod = paymentMethod;
  if (paymentDate !== undefined) payment.paymentDate = new Date(paymentDate);
  if (notes !== undefined) payment.notes = notes;

  await payment.save();

  // If year changed, update user's membershipYearsPaid array
  if (membershipYear !== undefined && oldYear !== membershipYear) {
    await User.findByIdAndUpdate(
      userId,
      {
        $pull: { membershipYearsPaid: oldYear },
        $addToSet: { membershipYearsPaid: membershipYear }
      }
    );
  }

  // Populate and return updated payment
  const updatedPayment = await Payment.findById(id)
    .populate('userId', 'fullName username email membershipYearsPaid')
    .populate('recordedBy', 'fullName username');

  console.log(`💳 Membership payment updated: ${payment._id} by ${req.user!.username}`);

  // Update financial report to reflect changes (especially if amount changed from/to zero)
  try {
    await updateFinancialReportMembershipFees();
  } catch (error) {
    console.error('⚠️ Failed to update financial report:', error);
    // Update still succeeds even if financial report update fails
  }

  res.json({
    success: true,
    message: 'Membership payment updated successfully',
    data: updatedPayment
  });
});

/**
 * Delete membership fee payment
 * Admin/SuperAdmin only - removes payment and updates user's membershipYearsPaid
 */
export const deleteMembershipPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  // Find the payment
  const payment = await Payment.findById(id);

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  // Check if it's a membership fee payment
  if (payment.paymentType !== 'membership_fee') {
    return res.status(400).json({
      success: false,
      message: 'This endpoint is only for membership fee payments'
    });
  }

  const userId = payment.userId;
  const membershipYear = payment.membershipYear;

  // Delete the payment
  await Payment.findByIdAndDelete(id);

  // Remove the year from user's membershipYearsPaid array
  await User.findByIdAndUpdate(
    userId,
    { $pull: { membershipYearsPaid: membershipYear } }
  );

  console.log(`🗑️ Membership payment deleted: ${id} (Year: ${membershipYear}) by ${req.user!.username}`);

  // Update financial report after deletion
  try {
    await updateFinancialReportMembershipFees();
  } catch (error) {
    console.error('⚠️ Failed to update financial report:', error);
    // Deletion still succeeds even if financial report update fails
  }

  res.json({
    success: true,
    message: 'Membership payment deleted successfully'
  });
});

// Update financial report to include membership fees
async function updateFinancialReportMembershipFees(): Promise<void> {
  try {
    console.log('💰 Updating Annual Membership Fees in financial report...');

    // Calculate total from all recorded membership fee payments grouped by year
    const result = await Payment.aggregate([
      {
        $match: {
          paymentType: 'membership_fee',
          status: 'record',
          recordedAt: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$membershipYear',
          totalAmount: {
            $sum: {
              $cond: [{ $gt: ['$amount', 0] }, '$amount', 0]
            }
          }
        }
      },
      {
        $sort: { _id: 1 } // Sort by year ascending
      }
    ]);

    console.log(`💰 Membership fees by year:`, result);

    // Read current financial report
    const dataPath = path.join(__dirname, '../../data/financial-report.json');
    if (!fs.existsSync(dataPath)) {
      console.warn('⚠️ Financial report JSON file not found, skipping update');
      return;
    }

    const fileContent = fs.readFileSync(dataPath, 'utf8');
    const financialData = JSON.parse(fileContent);

    // Update or add entries for each year with payments from database
    result.forEach(({ _id: year, totalAmount }) => {
      const existingIndex = financialData.receiptsCollections.findIndex((item: any) =>
        item.description === `Annual Membership Fees ${year}`
      );

      if (existingIndex !== -1) {
        // Update existing entry
        const oldAmount = financialData.receiptsCollections[existingIndex].amount;
        financialData.receiptsCollections[existingIndex].amount = totalAmount;
        console.log(`💰 Updated: Annual Membership Fees ${year}: ₱${oldAmount} → ₱${totalAmount.toFixed(2)}`);
      } else {
        // Add new entry
        financialData.receiptsCollections.push({
          description: `Annual Membership Fees ${year}`,
          amount: totalAmount
        });
        console.log(`💰 Added: Annual Membership Fees ${year}: ₱${totalAmount.toFixed(2)}`);
      }
    });

    // Recalculate total receipts
    financialData.totalReceipts = financialData.receiptsCollections.reduce((sum: number, item: any) => sum + item.amount, 0);

    // Recalculate net income and fund balance
    financialData.netIncome = financialData.totalReceipts - financialData.totalDisbursements;
    financialData.fundBalance = financialData.beginningBalance.amount + financialData.netIncome;

    // Update period with current date
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    financialData.period = `COVERING January 1, ${today.getFullYear()} - ${formattedDate}`;

    // Update timestamp
    financialData.lastUpdated = new Date().toISOString();

    // Save updated financial report
    fs.writeFileSync(dataPath, JSON.stringify(financialData, null, 2), 'utf8');

    console.log(`💰 Financial report updated with membership fees by year`);
    console.log(`💰 New Total Receipts: ₱${financialData.totalReceipts.toLocaleString()}`);
    console.log(`💰 New Fund Balance: ₱${financialData.fundBalance.toLocaleString()}`);

    // Emit real-time financial update
    try {
      const { webSocketService } = await import('../services/websocketService');
      if (webSocketService.isInitialized()) {
        webSocketService.emitFinancialUpdate({
          type: 'financial_data_updated',
          data: financialData,
          timestamp: new Date().toISOString(),
          message: `💰 Annual Membership Fees updated by year`
        });
        console.log('📡 Real-time financial update broadcasted');
      }
    } catch (error) {
      console.error('⚠️ Failed to broadcast financial update:', error);
    }

  } catch (error) {
    console.error('❌ Error updating financial report for membership fees:', error);
    throw error;
  }
}

/**
 * Get GCash Payment Configuration
 * Returns GCash account details for payment instructions
 */
export const getGCashConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('💳 GET /api/payments/gcash-config called');

  // Debug: Show all GCash-related environment variables
  console.log('🔍 Environment variables check:');
  console.log('   GCASH_PHONE_NUMBER =', process.env.GCASH_PHONE_NUMBER);
  console.log('   GCASH_ACCOUNT_NAME =', process.env.GCASH_ACCOUNT_NAME);
  console.log('   GCASH_QR_CODE_PATH =', process.env.GCASH_QR_CODE_PATH);
  console.log('   NODE_ENV =', process.env.NODE_ENV);

  const phoneNumber = process.env.GCASH_PHONE_NUMBER || '';
  const accountName = process.env.GCASH_ACCOUNT_NAME || '';
  const qrCodePath = process.env.GCASH_QR_CODE_PATH || 'uploads/gcash-qr.png';

  console.log('📞 Phone Number (after default):', phoneNumber);
  console.log('👤 Account Name (after default):', accountName);
  console.log('📂 QR Code Path (after default):', qrCodePath);

  // Check if QR code file exists
  const fullQrCodePath = path.join(__dirname, '../../', qrCodePath);
  const qrCodeUrl = fs.existsSync(fullQrCodePath) ? `/uploads/gcash-qr.png` : null;

  console.log('🖼️ QR Code URL:', qrCodeUrl);
  console.log('📁 Full QR Path:', fullQrCodePath);
  console.log('✅ File exists:', fs.existsSync(fullQrCodePath));

  // Generate deep link URL for mobile
  const cleanPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
  const deepLinkUrl = `gcash://pay?number=${cleanPhone}`;

  const response = {
    success: true,
    data: {
      phoneNumber,
      accountName,
      qrCodeUrl,
      deepLinkUrl
    }
  };

  console.log('📤 Sending response:', JSON.stringify(response, null, 2));

  res.json(response);
});

// Validation rules for membership fee payment
export const validateMembershipFeePayment = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('membershipYear')
    .notEmpty()
    .withMessage('Membership year is required')
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Membership year must be between 2020 and 2100'),
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0 })
    .withMessage('Amount cannot be negative'),
  body('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['cash', 'bank_transfer', 'gcash'])
    .withMessage('Invalid payment method'),
  body('paymentDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid payment date'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

// ============================================================
// Assign Expense to Members
// POST /api/payments/assign-expense
// Admin creates a pending payment for each selected member
// ============================================================

export const assignExpenseValidation = [
  body('title')
    .notEmpty().withMessage('Expense title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('memberIds')
    .isArray({ min: 1 }).withMessage('At least one member must be selected'),
  body('memberIds.*')
    .isString().withMessage('Member IDs must be strings'),
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters')
];

export const assignExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0]?.msg || 'Validation error', errors: errors.array() });
  }

  const { title, amount, memberIds, description } = req.body;
  const adminUser = req.user!;

  // Resolve members
  const members = await User.find({
    _id: { $in: memberIds },
    isApproved: true,
    isActive: true
  }).select('_id fullName username');

  if (members.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid active members found for the provided IDs' });
  }

  const createdPayments: any[] = [];
  const updatedPayments: any[] = [];

  for (const member of members) {
    const memberName = (member as any).fullName || (member as any).username;

    // If a pending assigned expense with the same title already exists, update its amount instead of skipping
    const existing = await Payment.findOne({
      userId: member._id.toString(),
      description: title,
      status: 'pending',
      'metadata.isAssignedExpense': true
    });

    if (existing) {
      existing.amount = Number(amount);
      if (description) (existing.metadata as any).reason = description;
      await existing.save();
      updatedPayments.push({ memberName, amount: existing.amount });
      continue;
    }

    const payment = new Payment({
      userId: member._id.toString(),
      amount: Number(amount),
      paymentMethod: 'cash',
      status: 'pending',
      paymentType: 'tournament_entry',
      description: title,
      metadata: {
        isAssignedExpense: true,
        isManualPayment: false,
        createdBy: (adminUser as any).fullName || (adminUser as any).username,
        createdById: (adminUser as any)._id?.toString() || (adminUser as any).id,
        reason: description || undefined
      }
    });

    await payment.save();
    createdPayments.push({
      paymentId: payment._id,
      memberId: member._id,
      memberName,
      amount: payment.amount,
      referenceNumber: payment.referenceNumber
    });
  }

  const parts: string[] = [];
  if (createdPayments.length > 0) parts.push(`${createdPayments.length} payment(s) created`);
  if (updatedPayments.length > 0) parts.push(`${updatedPayments.length} payment(s) updated to ₱${Number(amount).toFixed(2)}`);
  const message = parts.length > 0 ? parts.join(', ') + ` for "${title}"` : `No changes made for "${title}"`;

  return res.status(201).json({
    success: true,
    message,
    data: {
      created: createdPayments,
      updated: updatedPayments,
      count: createdPayments.length
    }
  });
});

// ============================================================
// GET /api/payments/expense-templates
// Returns distinct past assigned expense titles with amount
// for quick re-use on the assign expense page
// ============================================================

export const getExpenseTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const templates = await Payment.aggregate([
    { $match: { 'metadata.isAssignedExpense': true } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$description',
        amount: { $first: '$amount' },
        lastUsed: { $first: '$createdAt' },
        useCount: { $sum: 1 },
        memberIds: { $addToSet: '$userId' },
        reason: { $first: '$metadata.reason' }
      }
    },
    { $sort: { lastUsed: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        title: '$_id',
        amount: 1,
        lastUsed: 1,
        useCount: 1,
        memberIds: 1,
        reason: 1
      }
    }
  ]);

  return res.json({ success: true, data: templates });
});
export const renameAssignedExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { oldTitle, newTitle } = req.body;

  if (!oldTitle?.trim() || !newTitle?.trim()) {
    return res.status(400).json({ success: false, message: 'oldTitle and newTitle are required' });
  }
  if (oldTitle.trim() === newTitle.trim()) {
    return res.status(400).json({ success: false, message: 'New title must be different from old title' });
  }

  const result = await Payment.updateMany(
    { description: oldTitle.trim(), 'metadata.isAssignedExpense': true },
    { $set: { description: newTitle.trim() } }
  );

  console.log(`✏️ Renamed assigned expense "${oldTitle}" → "${newTitle}": ${result.modifiedCount} payments updated`);

  return res.json({
    success: true,
    message: `${result.modifiedCount} payment(s) renamed to "${newTitle.trim()}"`,
    data: { modifiedCount: result.modifiedCount }
  });
});

export const deleteAssignedExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { title } = req.body;
  if (!title?.trim()) {
    return res.status(400).json({ success: false, message: 'title is required' });
  }
  const result = await Payment.deleteMany({
    description: title.trim(),
    'metadata.isAssignedExpense': true
  });
  console.log(`🗑️ Deleted assigned expense "${title}": ${result.deletedCount} payments removed`);
  return res.json({
    success: true,
    message: `${result.deletedCount} payment(s) deleted for "${title.trim()}"`,
    data: { deletedCount: result.deletedCount }
  });
});

export const rebuildCourtUsageReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Delete all existing court usage records
  await CourtUsageReport.deleteMany({});

  // Re-process all recorded payments, excluding assigned expenses
  const recordedPayments = await Payment.find({
    status: 'record',
    'metadata.isAssignedExpense': { $ne: true }
  });

  console.log(`🔄 Rebuilding court usage report from ${recordedPayments.length} payments (excluding assigned expenses)...`);

  for (const payment of recordedPayments) {
    await updateCourtUsageReport(payment);
  }

  return res.json({
    success: true,
    message: `Court usage report rebuilt from ${recordedPayments.length} recorded payments`,
    data: { processedPayments: recordedPayments.length }
  });
});

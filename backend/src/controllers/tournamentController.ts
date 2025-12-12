import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import Tournament from '../models/Tournament';
import User from '../models/User';
import Player from '../models/Player';
import SeedingService from '../services/seedingService';
import CalculatedRankingService from '../services/calculatedRankingService';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

// Helper function to populate player names in matches
async function populateMatchPlayers(tournaments: any[]) {
  const allPlayerIds = new Set<string>();

  // Collect all player IDs from all tournaments (filter out empty/falsy values)
  tournaments.forEach(tournament => {
    tournament.matches?.forEach((match: any) => {
      if (match.player1 && typeof match.player1 === 'string' && match.player1.trim() !== '') {
        allPlayerIds.add(match.player1);
      }
      if (match.player2 && typeof match.player2 === 'string' && match.player2.trim() !== '') {
        allPlayerIds.add(match.player2);
      }
      if (match.team1Player1 && typeof match.team1Player1 === 'string' && match.team1Player1.trim() !== '') {
        allPlayerIds.add(match.team1Player1);
      }
      if (match.team1Player2 && typeof match.team1Player2 === 'string' && match.team1Player2.trim() !== '') {
        allPlayerIds.add(match.team1Player2);
      }
      if (match.team2Player1 && typeof match.team2Player1 === 'string' && match.team2Player1.trim() !== '') {
        allPlayerIds.add(match.team2Player1);
      }
      if (match.team2Player2 && typeof match.team2Player2 === 'string' && match.team2Player2.trim() !== '') {
        allPlayerIds.add(match.team2Player2);
      }
    });
  });

  // Fetch all players at once
  const players = await Player.find({ _id: { $in: Array.from(allPlayerIds) } })
    .select('_id fullName')
    .lean();

  // Create a map for quick lookup
  const playerMap = new Map(players.map(p => [p._id.toString(), p]));

  // Populate player data in each match
  tournaments.forEach(tournament => {
    tournament.matches?.forEach((match: any) => {
      // Singles
      if (match.player1 && typeof match.player1 === 'string' && match.player1.trim() !== '') {
        const player = playerMap.get(match.player1);
        match.player1 = player || { fullName: 'Unknown Player' };
      }
      if (match.player2 && typeof match.player2 === 'string' && match.player2.trim() !== '') {
        const player = playerMap.get(match.player2);
        match.player2 = player || { fullName: 'Unknown Player' };
      }
      // Doubles Team 1
      if (match.team1Player1 && typeof match.team1Player1 === 'string' && match.team1Player1.trim() !== '') {
        const player = playerMap.get(match.team1Player1);
        match.team1Player1 = player || { fullName: 'Unknown Player' };
      }
      if (match.team1Player2 && typeof match.team1Player2 === 'string' && match.team1Player2.trim() !== '') {
        const player = playerMap.get(match.team1Player2);
        match.team1Player2 = player || { fullName: 'Unknown Player' };
      }
      // Doubles Team 2
      if (match.team2Player1 && typeof match.team2Player1 === 'string' && match.team2Player1.trim() !== '') {
        const player = playerMap.get(match.team2Player1);
        match.team2Player1 = player || { fullName: 'Unknown Player' };
      }
      if (match.team2Player2 && typeof match.team2Player2 === 'string' && match.team2Player2.trim() !== '') {
        const player = playerMap.get(match.team2Player2);
        match.team2Player2 = player || { fullName: 'Unknown Player' };
      }
    });
  });

  return tournaments;
}

// Get all tournaments with pagination
export const getTournaments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  // Build filter query
  const filter: any = {};

  if (req.query.status) {
    filter.status = req.query.status;
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

  const total = await Tournament.countDocuments(filter);
  let tournaments = await Tournament.find(filter)
    .populate('createdBy', 'username fullName email')
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Manually populate player data
  tournaments = await populateMatchPlayers(tournaments);

  res.status(200).json({
    success: true,
    data: tournaments,
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

// Get single tournament
export const getTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const tournament = await Tournament.findById(id)
    .populate('createdBy', 'username fullName email')
    .populate('matches.player1', 'username fullName')
    .populate('matches.player2', 'username fullName')
    .populate('matches.team1Player1', 'username fullName')
    .populate('matches.team1Player2', 'username fullName')
    .populate('matches.team2Player1', 'username fullName')
    .populate('matches.team2Player2', 'username fullName')
    .populate('matches.winner', 'username fullName');

  if (!tournament) {
    res.status(404).json({
      success: false,
      error: 'Tournament not found'
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: tournament
  });
});

// Create new tournament
export const createTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, date, matches } = req.body;

  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  // Validate matches array
  if (matches && matches.length > 0) {
    for (const match of matches) {
      const matchType = match.matchType || 'singles';

      if (matchType === 'singles') {
        // Validate singles match - must have either member ID or name for each player
        const hasPlayer1 = (match.player1 && match.player1.trim()) || (match.player1Name && match.player1Name.trim());
        const hasPlayer2 = (match.player2 && match.player2.trim()) || (match.player2Name && match.player2Name.trim());

        if (!hasPlayer1 || !hasPlayer2) {
          res.status(400).json({
            success: false,
            error: 'Singles match requires both players (member ID or name)'
          });
          return;
        }

        // Verify players exist if IDs are provided
        if (match.player1 && match.player1.trim()) {
          const player1 = await Player.findById(match.player1.trim());
          if (!player1) {
            res.status(400).json({
              success: false,
              error: 'Player 1 not found'
            });
            return;
          }
        }

        if (match.player2 && match.player2.trim()) {
          const player2 = await Player.findById(match.player2.trim());
          if (!player2) {
            res.status(400).json({
              success: false,
              error: 'Player 2 not found'
            });
            return;
          }
        }

        // Verify winner is valid
        // For member matches: winner must be one of the player IDs
        // For non-member matches: winner can be "player1" or "player2"
        const validWinners = [];
        if (match.player1 && match.player1.trim()) validWinners.push(match.player1);
        if (match.player2 && match.player2.trim()) validWinners.push(match.player2);
        if (match.player1Name && match.player1Name.trim()) validWinners.push('player1');
        if (match.player2Name && match.player2Name.trim()) validWinners.push('player2');

        if (validWinners.length > 0 && !validWinners.includes(match.winner)) {
          res.status(400).json({
            success: false,
            error: 'Winner must be one of the match players'
          });
          return;
        }
      } else if (matchType === 'doubles') {
        // Validate doubles match - must have either member ID or name for each player
        const hasT1P1 = (match.team1Player1 && match.team1Player1.trim()) || (match.team1Player1Name && match.team1Player1Name.trim());
        const hasT1P2 = (match.team1Player2 && match.team1Player2.trim()) || (match.team1Player2Name && match.team1Player2Name.trim());
        const hasT2P1 = (match.team2Player1 && match.team2Player1.trim()) || (match.team2Player1Name && match.team2Player1Name.trim());
        const hasT2P2 = (match.team2Player2 && match.team2Player2.trim()) || (match.team2Player2Name && match.team2Player2Name.trim());

        if (!hasT1P1 || !hasT1P2 || !hasT2P1 || !hasT2P2) {
          res.status(400).json({
            success: false,
            error: 'Doubles match requires all 4 players (member ID or name)'
          });
          return;
        }

        // Check for duplicate member players in doubles match (only for member IDs)
        const memberIds = [
          match.team1Player1 && match.team1Player1.trim(),
          match.team1Player2 && match.team1Player2.trim(),
          match.team2Player1 && match.team2Player1.trim(),
          match.team2Player2 && match.team2Player2.trim()
        ].filter(id => id && id !== '');

        if (memberIds.length > 0) {
          const uniqueMemberIds = new Set(memberIds);
          if (uniqueMemberIds.size !== memberIds.length) {
            res.status(400).json({
              success: false,
              error: 'Each member can only appear once in a doubles match. Please select different members.'
            });
            return;
          }
        }

        // Verify players exist if IDs are provided
        if (match.team1Player1 && match.team1Player1.trim()) {
          const t1p1 = await Player.findById(match.team1Player1.trim());
          if (!t1p1) {
            res.status(400).json({ success: false, error: 'Team 1 Player 1 not found' });
            return;
          }
        }

        if (match.team1Player2 && match.team1Player2.trim()) {
          const t1p2 = await Player.findById(match.team1Player2.trim());
          if (!t1p2) {
            res.status(400).json({ success: false, error: 'Team 1 Player 2 not found' });
            return;
          }
        }

        if (match.team2Player1 && match.team2Player1.trim()) {
          const t2p1 = await Player.findById(match.team2Player1.trim());
          if (!t2p1) {
            res.status(400).json({ success: false, error: 'Team 2 Player 1 not found' });
            return;
          }
        }

        if (match.team2Player2 && match.team2Player2.trim()) {
          const t2p2 = await Player.findById(match.team2Player2.trim());
          if (!t2p2) {
            res.status(400).json({ success: false, error: 'Team 2 Player 2 not found' });
            return;
          }
        }

        // Verify winner is either team1 or team2
        if (match.winner !== 'team1' && match.winner !== 'team2') {
          res.status(400).json({
            success: false,
            error: 'Winner must be either team1 or team2 for doubles matches'
          });
          return;
        }
      }
    }
  }

  const tournament = new Tournament({
    name,
    date: new Date(date),
    createdBy: req.user._id,
    matches: matches || [],
    status: 'completed'
  });

  await tournament.save();
  await tournament.populate('createdBy', 'username fullName email');

  console.log(`🏆 Tournament created: ${name} by ${req.user.username}`);

  res.status(201).json({
    success: true,
    data: tournament,
    message: 'Tournament created successfully'
  });
});

// Update tournament
export const updateTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, date, matches, status } = req.body;

  const tournament = await Tournament.findById(id);

  if (!tournament) {
    res.status(404).json({
      success: false,
      error: 'Tournament not found'
    });
    return;
  }

  // Update fields
  if (name) tournament.name = name;
  if (date) tournament.date = new Date(date);
  if (status) tournament.status = status;

  if (matches) {
    // Validate matches based on match type
    for (const match of matches) {
      const matchType = match.matchType || 'singles';

      if (matchType === 'singles') {
        // Validate singles match - must have either member ID or name for each player
        const hasPlayer1 = (match.player1 && match.player1.trim()) || (match.player1Name && match.player1Name.trim());
        const hasPlayer2 = (match.player2 && match.player2.trim()) || (match.player2Name && match.player2Name.trim());

        if (!hasPlayer1 || !hasPlayer2) {
          res.status(400).json({
            success: false,
            error: 'Singles match requires both players (member ID or name)'
          });
          return;
        }

        // Verify players exist if IDs are provided
        if (match.player1 && match.player1.trim()) {
          const player1 = await Player.findById(match.player1.trim());
          if (!player1) {
            res.status(400).json({ success: false, error: 'Player 1 not found' });
            return;
          }
        }

        if (match.player2 && match.player2.trim()) {
          const player2 = await Player.findById(match.player2.trim());
          if (!player2) {
            res.status(400).json({ success: false, error: 'Player 2 not found' });
            return;
          }
        }

        // Verify winner is valid
        // For member matches: winner must be one of the player IDs
        // For non-member matches: winner can be "player1" or "player2"
        const validWinners = [];
        if (match.player1 && match.player1.trim()) validWinners.push(match.player1);
        if (match.player2 && match.player2.trim()) validWinners.push(match.player2);
        if (match.player1Name && match.player1Name.trim()) validWinners.push('player1');
        if (match.player2Name && match.player2Name.trim()) validWinners.push('player2');

        if (validWinners.length > 0 && !validWinners.includes(match.winner)) {
          res.status(400).json({
            success: false,
            error: 'Winner must be one of the match players'
          });
          return;
        }
      } else if (matchType === 'doubles') {
        // Validate doubles match - must have either member ID or name for each player
        const hasT1P1 = (match.team1Player1 && match.team1Player1.trim()) || (match.team1Player1Name && match.team1Player1Name.trim());
        const hasT1P2 = (match.team1Player2 && match.team1Player2.trim()) || (match.team1Player2Name && match.team1Player2Name.trim());
        const hasT2P1 = (match.team2Player1 && match.team2Player1.trim()) || (match.team2Player1Name && match.team2Player1Name.trim());
        const hasT2P2 = (match.team2Player2 && match.team2Player2.trim()) || (match.team2Player2Name && match.team2Player2Name.trim());

        if (!hasT1P1 || !hasT1P2 || !hasT2P1 || !hasT2P2) {
          res.status(400).json({
            success: false,
            error: 'Doubles match requires all 4 players (member ID or name)'
          });
          return;
        }

        // Check for duplicate member players (only for member IDs)
        const memberIds = [
          match.team1Player1 && match.team1Player1.trim(),
          match.team1Player2 && match.team1Player2.trim(),
          match.team2Player1 && match.team2Player1.trim(),
          match.team2Player2 && match.team2Player2.trim()
        ].filter(id => id && id !== '');

        if (memberIds.length > 0) {
          const uniqueMemberIds = new Set(memberIds);
          if (uniqueMemberIds.size !== memberIds.length) {
            res.status(400).json({
              success: false,
              error: 'Each member can only appear once in a doubles match'
            });
            return;
          }
        }

        // Verify players exist if IDs are provided
        if (match.team1Player1 && match.team1Player1.trim()) {
          const t1p1 = await Player.findById(match.team1Player1.trim());
          if (!t1p1) {
            res.status(400).json({ success: false, error: 'Team 1 Player 1 not found' });
            return;
          }
        }

        if (match.team1Player2 && match.team1Player2.trim()) {
          const t1p2 = await Player.findById(match.team1Player2.trim());
          if (!t1p2) {
            res.status(400).json({ success: false, error: 'Team 1 Player 2 not found' });
            return;
          }
        }

        if (match.team2Player1 && match.team2Player1.trim()) {
          const t2p1 = await Player.findById(match.team2Player1.trim());
          if (!t2p1) {
            res.status(400).json({ success: false, error: 'Team 2 Player 1 not found' });
            return;
          }
        }

        if (match.team2Player2 && match.team2Player2.trim()) {
          const t2p2 = await Player.findById(match.team2Player2.trim());
          if (!t2p2) {
            res.status(400).json({ success: false, error: 'Team 2 Player 2 not found' });
            return;
          }
        }

        if (match.winner !== 'team1' && match.winner !== 'team2') {
          res.status(400).json({
            success: false,
            error: 'Winner must be either team1 or team2 for doubles matches'
          });
          return;
        }
      }
    }

    // AUTO-REVERSAL: Check if any matches have been processed
    const hasProcessedMatches = tournament.matches.some(m => m.pointsProcessed);

    if (hasProcessedMatches) {
      console.log(`♻️ Tournament has processed matches, auto-reversing before update...`);

      try {
        const reversalResult = await SeedingService.reverseTournamentPoints(id as string);
        console.log(`♻️ Reversed ${reversalResult.reversed} point records (${reversalResult.errors} errors)`);

        if (reversalResult.errors > 0) {
          res.status(500).json({
            success: false,
            error: `Failed to reverse ${reversalResult.errors} point records. Cannot update tournament.`,
            hint: 'Check server logs for details. Some players may not exist or data may be corrupted.'
          });
          return;
        }
      } catch (error) {
        console.error('❌ Error during auto-reversal:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to reverse tournament points before update',
          hint: 'Tournament cannot be updated while points are processed. Please contact admin.'
        });
        return;
      }

      // Now safe to reset flags - will be reprocessed after update
      tournament.matches = matches.map((match: any) => ({
        ...match,
        pointsProcessed: false
      }));
    } else if (matches) {
      // No processed matches, safe to update without reversal
      tournament.matches = matches.map((match: any) => ({
        ...match,
        pointsProcessed: false
      }));
    }
  }

  await tournament.save();
  await tournament.populate('createdBy', 'username fullName email');
  await tournament.populate('matches.player1', 'username fullName');
  await tournament.populate('matches.player2', 'username fullName');
  await tournament.populate('matches.winner', 'username fullName');

  console.log(`🏆 Tournament updated: ${tournament.name}`);

  // Clear rankings cache since tournament data changed
  CalculatedRankingService.clearCache();

  res.status(200).json({
    success: true,
    data: tournament,
    message: 'Tournament updated successfully'
  });
});

// Delete tournament
export const deleteTournament = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const tournament = await Tournament.findById(id);

  if (!tournament) {
    res.status(404).json({
      success: false,
      error: 'Tournament not found'
    });
    return;
  }

  // Check if points have been processed - if so, reverse them first
  const hasProcessedMatches = tournament.matches.some(m => m.pointsProcessed);
  if (hasProcessedMatches) {
    console.log(`♻️ Tournament has processed points, reversing before deletion...`);
    try {
      const result = await SeedingService.reverseTournamentPoints(id as string);
      console.log(`♻️ Reversed ${result.reversed} point records`);
    } catch (error) {
      console.error(`Error reversing tournament points:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to reverse tournament points before deletion'
      });
      return;
    }
  }

  await Tournament.deleteOne({ _id: id });

  console.log(`🗑️ Tournament deleted: ${tournament.name}`);

  // Clear rankings cache since tournament was deleted
  CalculatedRankingService.clearCache();

  res.status(200).json({
    success: true,
    message: hasProcessedMatches
      ? 'Tournament deleted successfully. Points have been reversed.'
      : 'Tournament deleted successfully'
  });
});

// Process points for all matches in tournament
export const processTournamentPoints = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({
      success: false,
      error: 'Tournament ID is required'
    });
    return;
  }

  const tournament = await Tournament.findById(id);

  if (!tournament) {
    res.status(404).json({
      success: false,
      error: 'Tournament not found'
    });
    return;
  }

  if (tournament.matches.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Tournament has no matches to process'
    });
    return;
  }

  console.log(`🏆 Processing points for tournament: ${tournament.name}`);

  const result = await SeedingService.processTournamentPoints(id);

  res.status(200).json({
    success: true,
    data: {
      tournamentId: id,
      processed: result.processed,
      errors: result.errors,
      totalMatches: tournament.matches.length
    },
    message: `Successfully processed ${result.processed} matches${result.errors > 0 ? ` with ${result.errors} errors` : ''}`
  });
});

// Get tournament statistics
export const getTournamentStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const totalTournaments = await Tournament.countDocuments();
  const completedTournaments = await Tournament.countDocuments({ status: 'completed' });
  const draftTournaments = await Tournament.countDocuments({ status: 'draft' });

  // Get total matches across all tournaments
  const tournaments = await Tournament.find();
  const totalMatches = tournaments.reduce((sum, t) => sum + t.totalMatches, 0);
  const processedMatches = tournaments.reduce((sum, t) =>
    sum + t.matches.filter(m => m.pointsProcessed).length, 0
  );

  // Get recent tournaments
  const recentTournaments = await Tournament.find()
    .populate('createdBy', 'username fullName')
    .sort({ date: -1 })
    .limit(5)
    .select('name date status totalMatches');

  res.status(200).json({
    success: true,
    data: {
      totalTournaments,
      completedTournaments,
      draftTournaments,
      totalMatches,
      processedMatches,
      recentTournaments
    }
  });
});

// Validation rules
export const createTournamentValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Tournament name must be 3-100 characters'),
  body('date')
    .isISO8601()
    .withMessage('Invalid date format'),
  body('matches')
    .optional()
    .isArray()
    .withMessage('Matches must be an array'),
  body('matches.*.player1')
    .isMongoId()
    .withMessage('Player 1 must be a valid user ID'),
  body('matches.*.player2')
    .isMongoId()
    .withMessage('Player 2 must be a valid user ID'),
  body('matches.*.score')
    .matches(/^\d+\s*-\s*\d+$/)
    .withMessage('Score must be in format like "8-6"'),
  body('matches.*.winner')
    .isMongoId()
    .withMessage('Winner must be a valid user ID'),
  body('matches.*.round')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Round must be 1-50 characters')
];

export const updateTournamentValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Tournament name must be 3-100 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('status')
    .optional()
    .isIn(['draft', 'completed'])
    .withMessage('Status must be draft or completed'),
  body('matches')
    .optional()
    .isArray()
    .withMessage('Matches must be an array')
];

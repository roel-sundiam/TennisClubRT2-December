import { Response } from 'express';
import Player from '../models/Player';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import CalculatedRankingService from '../services/calculatedRankingService';

// Get all players with pagination and search
export const getPlayers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  // Build filter query
  const filter: any = {};

  // Search by name or email
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search as string, 'i');
    filter.$or = [
      { fullName: searchRegex },
      { email: searchRegex }
    ];
  }

  // Filter by active status (default: only active players)
  if (req.query.includeInactive !== 'true') {
    filter.isActive = true;
  }

  // Sort options
  let sortOption: any = { seedPoints: -1, fullName: 1 }; // Default: by seed points descending

  if (req.query.sort === 'name') {
    sortOption = { fullName: 1 };
  } else if (req.query.sort === 'newest') {
    sortOption = { createdAt: -1 };
  } else if (req.query.sort === 'oldest') {
    sortOption = { createdAt: 1 };
  }

  const total = await Player.countDocuments(filter);
  const players = await Player.find(filter)
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .lean();

  res.status(200).json({
    success: true,
    data: players,
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

// Get single player by ID
export const getPlayer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const player = await Player.findById(id);

  if (!player) {
    res.status(404).json({
      success: false,
      error: 'Player not found'
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: player
  });
});

// Create new player
export const createPlayer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { fullName, email, phone, gender, linkedUserId } = req.body;

  // Check for duplicate email if provided
  if (email) {
    const existingPlayer = await Player.findOne({
      email: email.toLowerCase().trim(),
      isActive: true
    });

    if (existingPlayer) {
      res.status(400).json({
        success: false,
        error: 'A player with this email already exists'
      });
      return;
    }
  }

  // Check for duplicate name (warn but allow)
  const duplicateName = await Player.findOne({
    fullName: { $regex: new RegExp(`^${fullName.trim()}$`, 'i') },
    isActive: true
  });

  const player = new Player({
    fullName: fullName.trim(),
    email: email ? email.toLowerCase().trim() : undefined,
    phone: phone ? phone.trim() : undefined,
    gender,
    linkedUserId,
    seedPoints: 0,
    matchesWon: 0,
    matchesPlayed: 0,
    isActive: true
  });

  await player.save();

  console.log(`👤 New player created: ${player.fullName} (ID: ${player._id})`);

  res.status(201).json({
    success: true,
    data: player,
    message: 'Player created successfully',
    warning: duplicateName ? 'A player with similar name already exists' : undefined
  });
});

// Update player
export const updatePlayer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { fullName, email, phone, gender, linkedUserId, isActive } = req.body;

  const player = await Player.findById(id);

  if (!player) {
    res.status(404).json({
      success: false,
      error: 'Player not found'
    });
    return;
  }

  // Check for duplicate email if updating email
  if (email && email !== player.email) {
    const existingPlayer = await Player.findOne({
      email: email.toLowerCase().trim(),
      _id: { $ne: id },
      isActive: true
    });

    if (existingPlayer) {
      res.status(400).json({
        success: false,
        error: 'A player with this email already exists'
      });
      return;
    }
  }

  // Update fields
  if (fullName) player.fullName = fullName.trim();
  if (email !== undefined) player.email = email ? email.toLowerCase().trim() : undefined;
  if (phone !== undefined) player.phone = phone ? phone.trim() : undefined;
  if (gender) player.gender = gender;
  if (linkedUserId !== undefined) player.linkedUserId = linkedUserId || undefined;
  if (isActive !== undefined) player.isActive = isActive;

  await player.save();

  console.log(`👤 Player updated: ${player.fullName} (ID: ${player._id})`);

  res.status(200).json({
    success: true,
    data: player,
    message: 'Player updated successfully'
  });
});

// Delete player (soft delete)
export const deletePlayer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const player = await Player.findById(id);

  if (!player) {
    res.status(404).json({
      success: false,
      error: 'Player not found'
    });
    return;
  }

  // Soft delete - just mark as inactive
  player.isActive = false;
  await player.save();

  console.log(`🗑️ Player deactivated: ${player.fullName} (ID: ${player._id})`);

  res.status(200).json({
    success: true,
    message: 'Player deactivated successfully'
  });
});

// Get player statistics and ranking
export const getPlayerStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const player = await Player.findById(id);

  if (!player) {
    res.status(404).json({
      success: false,
      error: 'Player not found'
    });
    return;
  }

  // Get player's rank among all active players
  const playersAbove = await Player.countDocuments({
    isActive: true,
    $or: [
      { seedPoints: { $gt: player.seedPoints } },
      {
        seedPoints: player.seedPoints,
        matchesWon: { $gt: player.matchesWon }
      },
      {
        seedPoints: player.seedPoints,
        matchesWon: player.matchesWon,
        fullName: { $lt: player.fullName }
      }
    ]
  });

  const rank = playersAbove + 1;
  const totalPlayers = await Player.countDocuments({ isActive: true });

  const winRate = player.matchesPlayed > 0
    ? Math.round((player.matchesWon / player.matchesPlayed) * 100)
    : 0;

  res.status(200).json({
    success: true,
    data: {
      player: {
        _id: player._id,
        fullName: player.fullName,
        email: player.email,
        seedPoints: player.seedPoints,
        matchesWon: player.matchesWon,
        matchesPlayed: player.matchesPlayed,
        winRate
      },
      rank,
      totalPlayers,
      percentile: totalPlayers > 0 ? Math.round(((totalPlayers - rank + 1) / totalPlayers) * 100) : 0
    }
  });
});

// Update player medal
export const updatePlayerMedal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { medal, tournamentName } = req.body;

  // Validate medal value
  if (medal && !['gold', 'silver', 'bronze'].includes(medal)) {
    res.status(400).json({
      success: false,
      error: 'Medal must be gold, silver, or bronze'
    });
    return;
  }

  const player = await Player.findById(id);

  if (!player) {
    res.status(404).json({
      success: false,
      error: 'Player not found'
    });
    return;
  }

  // Initialize medals array if it doesn't exist
  if (!player.medals) {
    player.medals = [];
  }

  const previousMedals = player.medals.map(m => m.type);

  // Add the new medal with tournament info
  if (medal) {
    player.medals.push({
      type: medal as 'gold' | 'silver' | 'bronze',
      tournamentName: tournamentName || undefined,
      awardedAt: new Date()
    });
  }

  await player.save();

  // Clear rankings cache so medals show up immediately
  CalculatedRankingService.clearCache();

  const medalEmoji = medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : medal === 'bronze' ? '🥉' : '';
  const tournamentInfo = tournamentName ? ` for ${tournamentName}` : '';
  console.log(`${medalEmoji} Medal awarded to ${player.fullName}${tournamentInfo}: [${previousMedals.join(', ')}] → [${player.medals.map(m => m.type).join(', ')}]`);

  res.status(200).json({
    success: true,
    data: player,
    message: `${medal} medal awarded to ${player.fullName}${tournamentInfo}`
  });
});

// Delete player medal
export const deletePlayerMedal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { medalIndex } = req.body;

  const player = await Player.findById(id);

  if (!player) {
    res.status(404).json({
      success: false,
      error: 'Player not found'
    });
    return;
  }

  if (!player.medals || player.medals.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Player has no medals to remove'
    });
    return;
  }

  if (medalIndex === undefined || medalIndex < 0 || medalIndex >= player.medals.length) {
    res.status(400).json({
      success: false,
      error: 'Invalid medal index'
    });
    return;
  }

  const previousMedals = player.medals.map(m => m.type);
  const removedMedal = player.medals[medalIndex]!; // We've already validated the index

  // Remove the medal at the specified index
  player.medals.splice(medalIndex, 1);
  await player.save();

  // Clear rankings cache so changes show up immediately
  CalculatedRankingService.clearCache();

  const medalEmoji = removedMedal.type === 'gold' ? '🥇' : removedMedal.type === 'silver' ? '🥈' : '🥉';
  const tournamentInfo = removedMedal.tournamentName ? ` for ${removedMedal.tournamentName}` : '';
  console.log(`${medalEmoji} Medal removed from ${player.fullName}${tournamentInfo}: [${previousMedals.join(', ')}] → [${player.medals.map(m => m.type).join(', ')}]`);

  res.status(200).json({
    success: true,
    data: player,
    message: `${removedMedal.type} medal removed from ${player.fullName}`
  });
});

// Edit/Update existing medal
export const editPlayerMedal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { medalIndex, tournamentName } = req.body;

  const player = await Player.findById(id);

  if (!player) {
    res.status(404).json({
      success: false,
      error: 'Player not found'
    });
    return;
  }

  if (!player.medals || player.medals.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Player has no medals to edit'
    });
    return;
  }

  if (medalIndex === undefined || medalIndex < 0 || medalIndex >= player.medals.length) {
    res.status(400).json({
      success: false,
      error: 'Invalid medal index'
    });
    return;
  }

  const medal = player.medals[medalIndex]!; // We've already validated the index
  const previousTournament = medal.tournamentName || 'No tournament';

  // Update tournament name
  medal.tournamentName = tournamentName || undefined;

  await player.save();

  // Clear rankings cache so changes show up immediately
  CalculatedRankingService.clearCache();

  const medalEmoji = medal.type === 'gold' ? '🥇' : medal.type === 'silver' ? '🥈' : '🥉';
  const newTournament = tournamentName || 'No tournament';
  console.log(`${medalEmoji} Medal updated for ${player.fullName}: ${previousTournament} → ${newTournament}`);

  res.status(200).json({
    success: true,
    data: player,
    message: `Medal tournament updated for ${player.fullName}`
  });
});

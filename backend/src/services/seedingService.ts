import mongoose from 'mongoose';
import User from '../models/User';
import Player from '../models/Player';
import Reservation from '../models/Reservation';
import Poll from '../models/Poll';
import SeedingPoint from '../models/SeedingPoint';
import Tournament from '../models/Tournament';
import { PlayerRanking, PlayerStats, MatchResult } from '../types';

export class SeedingService {
  // Point values for each tournament tier
  private static readonly POINT_VALUES = {
    '100': { winner: 10, participant: 5 },
    '250': { winner: 25, participant: 15 },
    '500': { winner: 50, participant: 30 }
  };

  /**
   * Process match results and award points to players
   */
  static async processMatchResults(reservationId: string, matchResults: MatchResult[]): Promise<void> {
    try {
      // Get the reservation to determine tournament tier
      const reservation = await Reservation.findById(reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.pointsProcessed) {
        throw new Error('Points have already been processed for this reservation');
      }

      const tierPoints = this.POINT_VALUES[reservation.tournamentTier];
      
      // Process each match result
      for (const match of matchResults) {
        await this.awardPointsForMatch(match, tierPoints, reservation.tournamentTier);
      }

      // Mark reservation as points processed
      reservation.matchResults = matchResults;
      reservation.pointsProcessed = true;
      await reservation.save({ validateBeforeSave: false });

    } catch (error) {
      console.error('Error processing match results:', error);
      throw error;
    }
  }

  /**
   * Award points for a single match
   */
  private static async awardPointsForMatch(
    match: MatchResult,
    tierPoints: { winner: number; participant: number },
    tournamentTier: string
  ): Promise<void> {
    const { winnerId, participants } = match;

    // Award winner points
    await User.findByIdAndUpdate(
      winnerId,
      {
        $inc: {
          seedPoints: tierPoints.winner,
          matchesWon: 1,
          matchesPlayed: 1
        }
      }
    );

    // Award participation points to other players
    const otherParticipants = participants.filter(p => p !== winnerId);
    for (const participantId of otherParticipants) {
      await User.findByIdAndUpdate(
        participantId,
        {
          $inc: {
            seedPoints: tierPoints.participant,
            matchesPlayed: 1
          }
        }
      );
    }

    console.log(`📊 Points awarded - Tier ${tournamentTier}: Winner ${winnerId} (+${tierPoints.winner}), ${otherParticipants.length} participants (+${tierPoints.participant} each)`);
  }

  /**
   * Get current player rankings
   */
  static async getRankings(limit: number = 50): Promise<PlayerRanking[]> {
    try {
      console.log(`🔍 Getting player rankings with limit: ${limit}`);

      // Query Player model instead of User model
      const players = await Player.find({
        isActive: true
      })
      .select('fullName seedPoints matchesWon matchesPlayed')
      .sort({ seedPoints: -1, matchesWon: -1, fullName: 1 })
      .limit(limit);

      console.log(`🔍 Found ${players.length} active players`);
      console.log(`🔍 Players with points:`, players.filter(p => p.seedPoints > 0).map(p => ({
        name: p.fullName,
        points: p.seedPoints,
        wins: p.matchesWon,
        played: p.matchesPlayed
      })));

      // Apply standard competition ranking (tied players get same rank, next rank skips)
      // Example: #1, #1, #3, #4 (if two players tied for first)
      const rankings: any[] = [];
      for (let index = 0; index < players.length; index++) {
        const player = players[index];
        if (!player) continue; // Skip if player is undefined

        let rank = index + 1;

        // Check if current player has same points as previous player
        const previousPlayer = players[index - 1];
        if (index > 0 && previousPlayer && player.seedPoints === previousPlayer.seedPoints) {
          // Use the same rank as the previous player
          rank = rankings[index - 1].rank;
        }

        rankings.push({
          _id: (player._id as any).toString(),
          username: player.fullName, // Use fullName for username field for compatibility
          fullName: player.fullName,
          seedPoints: player.seedPoints,
          matchesWon: player.matchesWon,
          matchesPlayed: player.matchesPlayed,
          winRate: player.matchesPlayed > 0 ? Math.round((player.matchesWon / player.matchesPlayed) * 100) / 100 : 0,
          rank: rank
        });
      }

      console.log(`🔍 Returning ${rankings.length} rankings`);
      return rankings;
    } catch (error) {
      console.error('Error getting rankings:', error);
      throw error;
    }
  }

  /**
   * Get detailed stats for a specific player
   */
  static async getPlayerStats(userId: string): Promise<PlayerStats | null> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.isActive || !user.isApproved) {
        return null;
      }

      // Get player's rank
      const allRankings = await this.getRankings(1000); // Get all players for accurate ranking
      const playerRanking = allRankings.find(r => r._id === userId);
      
      // If player is not in rankings (no matches played), create default stats
      if (!playerRanking) {
        return {
          user: {
            ...user.toObject(),
            _id: user._id.toString()
          },
          rank: 0, // Unranked
          totalPlayers: allRankings.length,
          recentMatches: []
        };
      }

      // Get recent match history
      const recentReservations = await Reservation.find({
        $or: [
          { userId: userId },
          { 'matchResults.winnerId': userId },
          { 'matchResults.participants': userId }
        ],
        status: 'completed',
        pointsProcessed: true
      })
      .sort({ date: -1 })
      .limit(10)
      .populate('userId', 'username fullName');

      const recentMatches = [];
      for (const reservation of recentReservations) {
        if (reservation.matchResults) {
          for (const match of reservation.matchResults) {
            if (match.participants.includes(userId)) {
              const tierPoints = this.POINT_VALUES[reservation.tournamentTier];
              const isWinner = match.winnerId === userId;
              const opponents = match.participants.filter(p => p !== userId);
              
              recentMatches.push({
                date: reservation.date,
                tournamentTier: reservation.tournamentTier,
                result: isWinner ? 'won' as const : 'played' as const,
                points: isWinner ? tierPoints.winner : tierPoints.participant,
                opponents: opponents
              });
            }
          }
        }
      }

      return {
        user: {
          ...user.toObject(),
          _id: user._id.toString()
        },
        rank: playerRanking.rank,
        totalPlayers: allRankings.length,
        recentMatches: recentMatches.slice(0, 10)
      };
    } catch (error) {
      console.error('Error getting player stats:', error);
      throw error;
    }
  }

  /**
   * Recalculate all seed points from scratch (admin function)
   */
  static async recalculateAllPoints(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      // Reset all user points
      await User.updateMany(
        {},
        {
          $set: {
            seedPoints: 0,
            matchesWon: 0,
            matchesPlayed: 0
          }
        }
      );

      // Get all completed reservations with match results
      const reservations = await Reservation.find({
        status: 'completed',
        matchResults: { $exists: true, $ne: [] }
      }).sort({ date: 1 });

      // Reprocess all match results
      for (const reservation of reservations) {
        try {
          if (reservation.matchResults && reservation.matchResults.length > 0) {
            const tierPoints = this.POINT_VALUES[reservation.tournamentTier];
            
            for (const match of reservation.matchResults) {
              await this.awardPointsForMatch(match, tierPoints, reservation.tournamentTier);
            }
            processed++;
          }
        } catch (error) {
          console.error(`Error reprocessing reservation ${reservation._id}:`, error);
          errors++;
        }
      }

      console.log(`🔄 Recalculation complete: ${processed} reservations processed, ${errors} errors`);
      return { processed, errors };
      
    } catch (error) {
      console.error('Error recalculating points:', error);
      throw error;
    }
  }

  /**
   * Award seeding points to a specific player
   */
  static async awardPoints(
    userId: string, 
    points: number, 
    reason: string, 
    tournamentTier: string = '100',
    pollId?: string,
    matchId?: string
  ): Promise<void> {
    try {
      console.log(`🔍 DEBUGGING: Attempting to award ${points} points to user ID: ${userId} for: ${reason}`);
      
      // First, check if user exists
      const user = await User.findById(userId);
      if (!user) {
        console.error(`❌ DEBUGGING: User with ID ${userId} not found!`);
        throw new Error(`User with ID ${userId} not found`);
      }
      
      console.log(`✅ DEBUGGING: Found user: ${user.fullName || user.username} (ID: ${userId})`);
      console.log(`🔍 DEBUGGING: User current stats - Points: ${user.seedPoints}, Wins: ${user.matchesWon}, Played: ${user.matchesPlayed}`);
      
      // Create SeedingPoint record for tracking and rankings
      const seedingPoint = new SeedingPoint({
        userId: userId,
        points: points,
        description: reason,
        tournamentTier: tournamentTier,
        pollId: pollId,
        matchId: matchId
      });
      
      await seedingPoint.save();
      console.log(`📝 DEBUGGING: Created SeedingPoint record with ${points} points`);
      
      // Update user stats
      const updateResult = await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            seedPoints: points,
            matchesWon: reason.includes('Won') ? 1 : 0,
            matchesPlayed: 1
          }
        },
        { new: true } // Return updated document
      );

      if (updateResult) {
        console.log(`📊 DEBUGGING: Points successfully awarded to ${updateResult.fullName || updateResult.username}:`);
        console.log(`   - New Points: ${updateResult.seedPoints} (+${points})`);
        console.log(`   - New Wins: ${updateResult.matchesWon}`);
        console.log(`   - New Played: ${updateResult.matchesPlayed}`);
      } else {
        console.error(`❌ DEBUGGING: Failed to update user ${userId}`);
      }

      console.log(`📊 Points awarded to ${userId}: +${points} (${reason})`);
    } catch (error) {
      console.error('❌ DEBUGGING: Error awarding points:', error);
      throw error;
    }
  }

  /**
   * Get tournament tier statistics
   */
  static async getTournamentStats(): Promise<{
    totalMatches: number;
    matchesByTier: Record<string, number>;
    totalEvents: number;
    activeMembers: number;
  }> {
    try {
      // Count all tournaments (active and completed)
      const totalEvents = await Tournament.countDocuments({
        status: { $in: ['active', 'completed'] }
      });

      // Count total matches across all tournaments
      const tournaments = await Tournament.find({
        status: { $in: ['active', 'completed'] }
      }).select('matches');

      let totalMatches = 0;
      tournaments.forEach((tournament: any) => {
        if (tournament.matches && Array.isArray(tournament.matches)) {
          totalMatches += tournament.matches.length;
        }
      });

      // Count active members
      const activeMembers = await User.countDocuments({
        isActive: true,
        isApproved: true
      });

      const matchesByTier: Record<string, number> = {
        '100': 0,
        '250': 0,
        '500': 0
      };

      return {
        totalMatches,
        matchesByTier,
        totalEvents,
        activeMembers
      };
    } catch (error) {
      console.error('Error getting tournament stats:', error);
      throw error;
    }
  }

  /**
   * Parse game score string and return winner/loser games
   * Examples: "8-6" -> { winnerGames: 8, loserGames: 6 }
   *           "10-8" -> { winnerGames: 10, loserGames: 8 }
   */
  static parseGameScore(scoreString: string): { winnerGames: number; loserGames: number } {
    // Remove whitespace and try to match score pattern
    const cleaned = scoreString?.trim();
    const match = cleaned?.match(/^(\d+)\s*-\s*(\d+)$/);

    if (match && match[1] && match[2]) {
      const num1 = parseInt(match[1] as string);
      const num2 = parseInt(match[2] as string);

      // Winner has higher score
      return {
        winnerGames: Math.max(num1, num2),
        loserGames: Math.min(num1, num2)
      };
    }

    // Default: assume close 8-6 match if score is invalid
    console.warn(`⚠️ Invalid score format: "${scoreString}", using default 8-6`);
    return { winnerGames: 8, loserGames: 6 };
  }

  /**
   * Process all matches in a tournament and award points
   */
  static async processTournamentPoints(tournamentId: string): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      const tournament = await Tournament.findById(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      console.log(`🏆 Processing points for tournament: ${tournament.name}`);

      // Process each match
      for (let i = 0; i < tournament.matches.length; i++) {
        const match = tournament.matches[i];

        // Skip if match is undefined or already processed
        if (!match || match.pointsProcessed) {
          console.log(`⏭️ Skipping match ${i + 1} - ${!match ? 'undefined' : 'already processed'}`);
          continue;
        }

        try {
          await this.processTournamentMatch(tournamentId, i);
          processed++;
        } catch (error) {
          console.error(`Error processing match ${i + 1}:`, error);
          errors++;
        }
      }

      // Update tournament status to completed
      tournament.status = 'completed';
      await tournament.save();

      console.log(`✅ Tournament processing complete: ${processed} matches processed, ${errors} errors`);
      return { processed, errors };

    } catch (error) {
      console.error('Error processing tournament points:', error);
      throw error;
    }
  }

  /**
   * Process a single match in a tournament and award game-based points
   */
  static async processTournamentMatch(tournamentId: string, matchIndex: number): Promise<void> {
    try {
      const tournament = await Tournament.findById(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      const match = tournament.matches[matchIndex];
      if (!match) {
        throw new Error(`Match ${matchIndex} not found in tournament`);
      }

      if (match.pointsProcessed) {
        console.log(`⏭️ Match ${matchIndex + 1} already processed`);
        return;
      }

      // Parse score to get games won by each player/team
      const { winnerGames, loserGames } = this.parseGameScore(match.score);

      console.log(`🎾 Processing ${match.matchType} match: ${match.score} - Winner gets ${winnerGames} pts, Loser gets ${loserGames} pts`);

      if (match.matchType === 'doubles') {
        // Doubles match - award points to all 4 players
        const winningTeam = match.winner; // "team1" or "team2"

        if (winningTeam === 'team1') {
          // Team 1 won
          if (match.team1Player1) {
            await this.awardTournamentPoints(
              match.team1Player1,
              winnerGames,
              `Tournament doubles - ${tournament.name} (${match.round}) - Won`,
              tournamentId,
              matchIndex,
              true
            );
          }
          if (match.team1Player2) {
            await this.awardTournamentPoints(
              match.team1Player2,
              winnerGames,
              `Tournament doubles - ${tournament.name} (${match.round}) - Won`,
              tournamentId,
              matchIndex,
              true
            );
          }
          // Team 2 lost
          if (match.team2Player1 && loserGames > 0) {
            await this.awardTournamentPoints(
              match.team2Player1,
              loserGames,
              `Tournament doubles - ${tournament.name} (${match.round}) - Played`,
              tournamentId,
              matchIndex,
              false
            );
          }
          if (match.team2Player2 && loserGames > 0) {
            await this.awardTournamentPoints(
              match.team2Player2,
              loserGames,
              `Tournament doubles - ${tournament.name} (${match.round}) - Played`,
              tournamentId,
              matchIndex,
              false
            );
          }
        } else {
          // Team 2 won
          if (match.team2Player1) {
            await this.awardTournamentPoints(
              match.team2Player1,
              winnerGames,
              `Tournament doubles - ${tournament.name} (${match.round}) - Won`,
              tournamentId,
              matchIndex,
              true
            );
          }
          if (match.team2Player2) {
            await this.awardTournamentPoints(
              match.team2Player2,
              winnerGames,
              `Tournament doubles - ${tournament.name} (${match.round}) - Won`,
              tournamentId,
              matchIndex,
              true
            );
          }
          // Team 1 lost
          if (match.team1Player1 && loserGames > 0) {
            await this.awardTournamentPoints(
              match.team1Player1,
              loserGames,
              `Tournament doubles - ${tournament.name} (${match.round}) - Played`,
              tournamentId,
              matchIndex,
              false
            );
          }
          if (match.team1Player2 && loserGames > 0) {
            await this.awardTournamentPoints(
              match.team1Player2,
              loserGames,
              `Tournament doubles - ${tournament.name} (${match.round}) - Played`,
              tournamentId,
              matchIndex,
              false
            );
          }
        }
      } else {
        // Singles match - award points to 2 players
        const winnerId = match.winner;
        const loserId = match.player1 === winnerId ? match.player2 : match.player1;

        if (winnerId) {
          await this.awardTournamentPoints(
            winnerId,
            winnerGames,
            `Tournament singles - ${tournament.name} (${match.round}) - Won`,
            tournamentId,
            matchIndex,
            true
          );
        }

        if (loserId && loserGames > 0) {
          await this.awardTournamentPoints(
            loserId,
            loserGames,
            `Tournament singles - ${tournament.name} (${match.round}) - Played`,
            tournamentId,
            matchIndex,
            false
          );
        }
      }

      // Mark match as processed
      match.pointsProcessed = true;
      await tournament.save();

      console.log(`✅ Match ${matchIndex + 1} processed successfully`);

    } catch (error) {
      console.error(`Error processing tournament match:`, error);
      throw error;
    }
  }

  /**
   * Reverse/undo all points for a tournament
   * Used when deleting tournaments with processed points
   */
  static async reverseTournamentPoints(tournamentId: string): Promise<{ reversed: number; errors: number }> {
    let reversed = 0;
    let errors = 0;

    try {
      console.log(`♻️ Reversing points for tournament: ${tournamentId}`);

      // Find all non-reversed seeding points for this tournament
      const seedingPoints = await SeedingPoint.find({
        tournamentId,
        reversedAt: { $exists: false } // Don't reverse already-reversed points
      });

      if (seedingPoints.length === 0) {
        console.log('   No points to reverse (all already reversed or none exist)');
        return { reversed: 0, errors: 0 };
      }

      console.log(`   Found ${seedingPoints.length} point records to reverse`);

      // Group adjustments by player to batch updates
      const playerAdjustments = new Map<string, {
        points: number;
        wins: number;
        matches: number;
        pointIds: string[];
      }>();

      // Calculate total adjustments per player
      for (const point of seedingPoints) {
        // Check if this is a player-based point or legacy user-based point
        const targetId = point.playerId || point.userId;
        const isPlayerBased = !!point.playerId;

        if (!targetId) {
          console.warn(`⚠️ No player or user ID found for seeding point ${point._id}, skipping`);
          errors++;
          continue;
        }

        // Only handle player-based points (legacy user points deprecated)
        if (!isPlayerBased) {
          console.warn(`⚠️ Skipping legacy user-based point ${point._id}`);
          continue;
        }

        const playerId = targetId.toString();

        if (!playerAdjustments.has(playerId)) {
          playerAdjustments.set(playerId, {
            points: 0,
            wins: 0,
            matches: 0,
            pointIds: []
          });
        }

        const adj = playerAdjustments.get(playerId)!;
        adj.points += point.points;
        adj.wins += point.isWinner ? 1 : 0;
        adj.matches += 1;
        adj.pointIds.push(point._id ? String(point._id as any) : '');
      }

      console.log(`   Affecting ${playerAdjustments.size} players`);

      // Use MongoDB transaction for atomicity
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Update each player
        for (const [playerId, adj] of playerAdjustments.entries()) {
          const player = await Player.findById(playerId).session(session);

          if (!player) {
            console.warn(`⚠️ Player ${playerId} not found, skipping reversal`);
            errors++;
            continue;
          }

          // Direct set with Math.max to prevent negative values
          player.seedPoints = Math.max(0, player.seedPoints - adj.points);
          player.matchesWon = Math.max(0, player.matchesWon - adj.wins);
          player.matchesPlayed = Math.max(0, player.matchesPlayed - adj.matches);

          await player.save({ session });

          // Mark seeding points as reversed (keep for audit trail, don't delete)
          await SeedingPoint.updateMany(
            { _id: { $in: adj.pointIds } },
            {
              $set: {
                reversedAt: new Date(),
                reversalReason: 'Tournament deleted or updated'
              }
            },
            { session }
          );

          console.log(`♻️ Reversed ${adj.points} points from ${player.fullName} (${adj.matches} matches)`);
          reversed += adj.pointIds.length;
        }

        await session.commitTransaction();

      } catch (error) {
        await session.abortTransaction();
        console.error('   ❌ Transaction failed, rolling back all changes');
        throw error;
      } finally {
        session.endSession();
      }

      console.log(`✅ Reversed ${reversed} point records with ${errors} errors`);
      return { reversed, errors };

    } catch (error) {
      console.error(`Error reversing tournament points:`, error);
      throw error;
    }
  }

  /**
   * Award tournament-based points to a player
   */
  static async awardTournamentPoints(
    playerId: string,
    points: number,
    description: string,
    tournamentId: string,
    matchIndex: number,
    isWinner: boolean
  ): Promise<void> {
    try {
      // IDEMPOTENCY CHECK: Has this point already been awarded?
      const existing = await SeedingPoint.findOne({
        tournamentId,
        matchIndex,
        playerId
      });

      if (existing) {
        console.log(`⏭️  Points already awarded for player ${playerId.substring(0, 8)}... in match ${matchIndex}, skipping`);
        return; // Idempotent - safe to call multiple times
      }

      // Verify player exists
      const player = await Player.findById(playerId);
      if (!player) {
        throw new Error(`Player ${playerId} not found`);
      }

      // Use MongoDB transaction to ensure atomicity
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Create SeedingPoint record with metadata
        const seedingPoint = new SeedingPoint({
          playerId: playerId,
          points: points,
          description: description,
          source: 'tournament',
          tournamentId: tournamentId,
          matchIndex: matchIndex,
          isWinner: isWinner,
          processedAt: new Date(),
          processedBy: 'system',
          processingVersion: '2.0.0'
        });

        await seedingPoint.save({ session });

        // Update player stats (still using $inc but within transaction)
        await Player.findByIdAndUpdate(
          playerId,
          {
            $inc: {
              seedPoints: points,
              matchesWon: isWinner ? 1 : 0,
              matchesPlayed: 1
            }
          },
          { session }
        );

        await session.commitTransaction();
        console.log(`📊 Awarded ${points} points to ${player.fullName} (${isWinner ? 'Winner' : 'Loser'})`);

      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

    } catch (error: any) {
      // Handle duplicate key error gracefully (from unique index)
      if (error.code === 11000) {
        console.log(`⏭️  Duplicate point award prevented by unique constraint for player in match ${matchIndex}`);
        return; // Silent success - already processed
      }
      console.error('Error awarding tournament points:', error);
      throw error;
    }
  }
}

export default SeedingService;
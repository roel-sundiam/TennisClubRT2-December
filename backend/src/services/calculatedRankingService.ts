import Tournament from '../models/Tournament';
import Player from '../models/Player';

export interface PlayerRanking {
  playerId: string;
  playerName: string;
  gender: string;
  totalPoints: number;
  matchesWon: number;
  matchesLost: number;
  matchesPlayed: number;
  winRate: number;
  tournamentsPlayed: number;
  rank: number;
  medals: ('gold' | 'silver' | 'bronze')[];
}

export interface RankingStats {
  totalTournaments: number;
  totalMatches: number;
  lastUpdated: Date;
  rankings: PlayerRanking[];
}

/**
 * CalculatedRankingService
 *
 * Calculates player rankings on-demand from tournament match results.
 * No processing, no stored points, no sync issues - just pure calculation.
 *
 * Single source of truth: Tournament.matches
 *
 * Includes simple in-memory caching with 5-minute TTL for performance.
 */
class CalculatedRankingService {
  // Simple in-memory cache
  private static cache: Map<string, { data: RankingStats; expiry: number }> = new Map();
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached rankings or calculate fresh
   */
  private static getCacheKey(gender?: 'male' | 'female', limit?: number): string {
    return `rankings_${gender || 'all'}_${limit || 'all'}`;
  }

  /**
   * Check if cache is valid
   */
  private static isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() < cached.expiry;
  }

  /**
   * Get from cache
   */
  private static getFromCache(key: string): RankingStats | null {
    if (!this.isCacheValid(key)) {
      this.cache.delete(key);
      return null;
    }
    return this.cache.get(key)!.data;
  }

  /**
   * Set cache
   */
  private static setCache(key: string, data: RankingStats): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL
    });
  }

  /**
   * Clear all cache (call when tournaments are updated)
   */
  static clearCache(): void {
    this.cache.clear();
    console.log('🗑️  Rankings cache cleared');
  }
  /**
   * Parse game score from match score string
   * Examples: "6-4", "7-5", "6-3, 4-6, 6-2"
   */
  private static parseGameScore(score: string): { winnerGames: number; loserGames: number } {
    if (!score || typeof score !== 'string') {
      return { winnerGames: 0, loserGames: 0 };
    }

    let winnerGames = 0;
    let loserGames = 0;

    // Split by comma for multiple sets
    const sets = score.split(',').map(s => s.trim());

    for (const set of sets) {
      // Match patterns like "6-4" or "7-5"
      const match = set.match(/(\d+)-(\d+)/);
      if (match && match[1] && match[2]) {
        const score1 = parseInt(match[1]);
        const score2 = parseInt(match[2]);

        // The higher score in each set belongs to the winner
        if (score1 > score2) {
          winnerGames += score1;
          loserGames += score2;
        } else {
          winnerGames += score2;
          loserGames += score1;
        }
      }
    }

    return { winnerGames, loserGames };
  }

  /**
   * Get loser ID from match
   */
  private static getLoserId(match: any): string | null {
    const winnerId = match.winner?.toString();

    if (match.matchType === 'singles') {
      const player1Id = match.player1?.toString();
      const player2Id = match.player2?.toString();

      if (winnerId === player1Id) return player2Id;
      if (winnerId === player2Id) return player1Id;
    } else if (match.matchType === 'doubles') {
      // For doubles, loser is the team that didn't win
      if (match.winner === 'team1') {
        // Team 2 lost
        return null; // Handle separately for each player
      } else if (match.winner === 'team2') {
        // Team 1 lost
        return null; // Handle separately for each player
      }
    }

    return null;
  }

  /**
   * Calculate rankings for all players based on completed tournament matches
   */
  static async calculateRankings(options?: {
    gender?: 'male' | 'female';
    limit?: number;
  }): Promise<RankingStats> {
    // Check cache first
    const cacheKey = this.getCacheKey(options?.gender, options?.limit);
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      console.log('📊 Returning cached rankings');
      return cached;
    }

    console.log('📊 Calculating rankings from tournament matches...');

    // Get all completed tournaments
    const tournaments = await Tournament.find({
      status: 'completed'
    }).sort({ date: -1 });

    console.log(`   Found ${tournaments.length} completed tournaments`);

    // Get all players
    const players = await Player.find({});

    // Filter by gender if specified
    const filteredPlayers = options?.gender
      ? players.filter(p => p.gender === options.gender)
      : players;

    console.log(`   Calculating for ${filteredPlayers.length} players${options?.gender ? ` (${options.gender})` : ''}`);

    // Initialize stats for each player
    const playerStats = new Map<string, {
      playerId: string;
      playerName: string;
      gender: string;
      medals: ('gold' | 'silver' | 'bronze')[];
      totalPoints: number;
      matchesWon: number;
      matchesLost: number;
      matchesPlayed: number;
      tournamentsPlayed: Set<string>;
    }>();

    for (const player of filteredPlayers) {
      const playerId = String(player._id);
      playerStats.set(playerId, {
        playerId: playerId,
        playerName: player.fullName || '',
        gender: player.gender || '',
        medals: (player.medals || []).map(m => m.type),
        totalPoints: 0,
        matchesWon: 0,
        matchesLost: 0,
        matchesPlayed: 0,
        tournamentsPlayed: new Set()
      });
    }

    let totalMatches = 0;

    // Process each tournament
    for (const tournament of tournaments) {
      for (const match of tournament.matches) {
        // Skip if match has no result
        if (!match.winner || !match.score) {
          continue;
        }

        totalMatches++;

        const { winnerGames, loserGames } = this.parseGameScore(match.score);

        // Handle singles matches
        if (match.matchType === 'singles') {
          const winnerId = match.winner?.toString();
          const player1Id = match.player1?.toString();
          const player2Id = match.player2?.toString();

          if (!winnerId || !player1Id || !player2Id) continue;

          const loserId = winnerId === player1Id ? player2Id : player1Id;

          // Update winner stats
          if (playerStats.has(winnerId)) {
            const stats = playerStats.get(winnerId)!;
            stats.totalPoints += winnerGames;
            stats.matchesWon += 1;
            stats.matchesPlayed += 1;
            stats.tournamentsPlayed.add(String(tournament._id));
          }

          // Update loser stats
          if (playerStats.has(loserId)) {
            const stats = playerStats.get(loserId)!;
            stats.totalPoints += loserGames;
            stats.matchesLost += 1;
            stats.matchesPlayed += 1;
            stats.tournamentsPlayed.add(String(tournament._id));
          }
        }
        // Handle doubles matches
        else if (match.matchType === 'doubles') {
          const winningTeam = match.winner; // "team1" or "team2"

          // Process all 4 players
          const players = [
            { id: match.team1Player1, team: 'team1' },
            { id: match.team1Player2, team: 'team1' },
            { id: match.team2Player1, team: 'team2' },
            { id: match.team2Player2, team: 'team2' }
          ];

          for (const player of players) {
            if (!player.id) continue;

            const playerId = player.id.toString();
            if (!playerStats.has(playerId)) continue;

            const stats = playerStats.get(playerId)!;
            const isWinner = player.team === winningTeam;

            if (isWinner) {
              stats.totalPoints += winnerGames;
              stats.matchesWon += 1;
            } else {
              stats.totalPoints += loserGames;
              stats.matchesLost += 1;
            }

            stats.matchesPlayed += 1;
            stats.tournamentsPlayed.add(String(tournament._id));
          }
        }
      }
    }

    // Convert to rankings array and calculate derived stats
    const rankings: PlayerRanking[] = Array.from(playerStats.values())
      .map(stats => ({
        playerId: stats.playerId,
        playerName: stats.playerName,
        gender: stats.gender,
        medals: stats.medals,
        totalPoints: stats.totalPoints,
        matchesWon: stats.matchesWon,
        matchesLost: stats.matchesLost,
        matchesPlayed: stats.matchesPlayed,
        winRate: stats.matchesPlayed > 0
          ? parseFloat(((stats.matchesWon / stats.matchesPlayed) * 100).toFixed(2))
          : 0,
        tournamentsPlayed: stats.tournamentsPlayed.size,
        rank: 0 // Will be assigned after sorting
      }))
      .filter(r => r.matchesPlayed > 0) // Only include players with matches
      .sort((a, b) => {
        // Sort by total points (descending)
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }
        // Tie-breaker: win rate
        if (b.winRate !== a.winRate) {
          return b.winRate - a.winRate;
        }
        // Tie-breaker: matches played
        return b.matchesPlayed - a.matchesPlayed;
      });

    // Assign ranks with tie handling
    // Players with same points AND same wins get the same rank
    let currentRank = 1;
    rankings.forEach((ranking, index) => {
      if (index > 0) {
        const prevRanking = rankings[index - 1];
        // Check if this player has same points AND same wins as previous
        if (prevRanking &&
            ranking.totalPoints === prevRanking.totalPoints &&
            ranking.matchesWon === prevRanking.matchesWon) {
          // Same rank as previous player (tie)
          ranking.rank = prevRanking.rank;
        } else {
          // Different stats, so new rank = current position
          currentRank = index + 1;
          ranking.rank = currentRank;
        }
      } else {
        // First player always gets rank 1
        ranking.rank = 1;
      }
    });

    // Apply limit if specified
    const limitedRankings = options?.limit
      ? rankings.slice(0, options.limit)
      : rankings;

    console.log(`✅ Calculated rankings for ${limitedRankings.length} players`);

    const result = {
      totalTournaments: tournaments.length,
      totalMatches,
      lastUpdated: new Date(),
      rankings: limitedRankings
    };

    // Cache the result
    this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Get ranking for a specific player
   */
  static async getPlayerRanking(playerId: string): Promise<PlayerRanking | null> {
    const stats = await this.calculateRankings();
    return stats.rankings.find(r => r.playerId === playerId) || null;
  }

  /**
   * Get top N players
   */
  static async getTopPlayers(limit: number, gender?: 'male' | 'female'): Promise<PlayerRanking[]> {
    const stats = await this.calculateRankings({ limit, gender });
    return stats.rankings;
  }

  /**
   * Get player statistics including match history
   */
  static async getPlayerStats(playerId: string): Promise<{
    ranking: PlayerRanking | null;
    recentMatches: any[];
    tournamentHistory: any[];
  }> {
    // Get ranking
    const ranking = await this.getPlayerRanking(playerId);

    // Get recent matches
    const tournaments = await Tournament.find({
      status: 'completed',
      $or: [
        { 'matches.player1': playerId },
        { 'matches.player2': playerId },
        { 'matches.team1Player1': playerId },
        { 'matches.team1Player2': playerId },
        { 'matches.team2Player1': playerId },
        { 'matches.team2Player2': playerId }
      ]
    }).sort({ date: -1 }).limit(10);

    const recentMatches: any[] = [];
    const tournamentHistory: any[] = [];

    for (const tournament of tournaments) {
      let playerMatchesInTournament = 0;
      let playerWinsInTournament = 0;

      for (const match of tournament.matches) {
        const isInMatch =
          match.player1?.toString() === playerId ||
          match.player2?.toString() === playerId ||
          match.team1Player1?.toString() === playerId ||
          match.team1Player2?.toString() === playerId ||
          match.team2Player1?.toString() === playerId ||
          match.team2Player2?.toString() === playerId;

        if (isInMatch && match.winner && match.score) {
          const isWinner =
            match.winner.toString() === playerId ||
            (match.winner === 'team1' && (match.team1Player1?.toString() === playerId || match.team1Player2?.toString() === playerId)) ||
            (match.winner === 'team2' && (match.team2Player1?.toString() === playerId || match.team2Player2?.toString() === playerId));

          recentMatches.push({
            tournamentName: tournament.name,
            tournamentDate: tournament.date,
            matchType: match.matchType,
            score: match.score,
            result: isWinner ? 'won' : 'lost',
            round: match.round
          });

          playerMatchesInTournament++;
          if (isWinner) playerWinsInTournament++;
        }
      }

      if (playerMatchesInTournament > 0) {
        tournamentHistory.push({
          tournamentId: tournament._id,
          tournamentName: tournament.name,
          date: tournament.date,
          matchesPlayed: playerMatchesInTournament,
          matchesWon: playerWinsInTournament,
          performance: `${playerWinsInTournament}/${playerMatchesInTournament}`
        });
      }
    }

    return {
      ranking,
      recentMatches: recentMatches.slice(0, 10),
      tournamentHistory
    };
  }
}

export default CalculatedRankingService;

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import Tournament from '../models/Tournament';
import { connectDatabase } from '../config/database';

dotenv.config();

async function verifyPlayerStats() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Find the Rich Town 2 tournament
    const tournament = await Tournament.findOne({
      name: /2nd Rich Town 2/i
    }).lean();

    if (!tournament) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    console.log(`📋 Tournament: ${tournament.name}\n`);

    // Get all seeding points for this tournament
    const seedingPoints = await SeedingPoint.find({
      tournamentId: tournament._id
    }).sort({ createdAt: 1 }).lean();

    console.log(`Total seeding points: ${seedingPoints.length}\n`);

    // Group by player
    const playerStats = new Map<string, {
      wins: number,
      losses: number,
      totalPoints: number,
      pointRecords: any[]
    }>();

    seedingPoints.forEach(sp => {
      if (!sp.playerId) return;

      const playerId = sp.playerId.toString();
      if (!playerStats.has(playerId)) {
        playerStats.set(playerId, {
          wins: 0,
          losses: 0,
          totalPoints: 0,
          pointRecords: []
        });
      }

      const stats = playerStats.get(playerId)!;
      stats.totalPoints += sp.points;
      stats.pointRecords.push(sp);

      if (sp.isWinner === true) {
        stats.wins++;
      } else if (sp.isWinner === false) {
        stats.losses++;
      }
    });

    // Get player info
    const playerIds = Array.from(playerStats.keys());
    const players = await Player.find({
      _id: { $in: playerIds }
    }).lean();

    const playerMap = new Map(players.map(p => [p._id.toString(), p]));

    // Show top 20 players with comparison
    console.log('🔍 Player Stats Verification:\n');
    console.log('Format: Player Name | Calculated vs Database | Match Records\n');

    const sortedPlayers = Array.from(playerStats.entries())
      .sort((a, b) => b[1].totalPoints - a[1].totalPoints)
      .slice(0, 20);

    for (const [playerId, stats] of sortedPlayers) {
      const player = playerMap.get(playerId);
      if (!player) continue;

      const calculatedWins = stats.wins;
      const calculatedMatches = stats.wins + stats.losses;
      const calculatedPoints = stats.totalPoints;

      const dbWins = player.matchesWon;
      const dbMatches = player.matchesPlayed;
      const dbPoints = player.seedPoints;

      const winsMatch = calculatedWins === dbWins ? '✅' : '❌';
      const matchesMatch = calculatedMatches === dbMatches ? '✅' : '❌';
      const pointsMatch = calculatedPoints === dbPoints ? '✅' : '❌';

      console.log(`\n${player.fullName}:`);
      console.log(`  Points:  ${calculatedPoints} (calculated) vs ${dbPoints} (db) ${pointsMatch}`);
      console.log(`  Wins:    ${calculatedWins}W/${calculatedMatches}P (calculated) vs ${dbWins}W/${dbMatches}P (db) ${winsMatch} ${matchesMatch}`);
      console.log(`  Seeding point records: ${stats.pointRecords.length}`);

      // Show breakdown of point records
      const winPoints = stats.pointRecords.filter(r => r.isWinner === true).reduce((sum, r) => sum + r.points, 0);
      const lossPoints = stats.pointRecords.filter(r => r.isWinner === false).reduce((sum, r) => sum + r.points, 0);
      console.log(`    - From wins: ${winPoints} pts (${stats.wins} wins)`);
      console.log(`    - From losses: ${lossPoints} pts (${stats.losses} losses)`);

      if (!pointsMatch || !winsMatch || !matchesMatch) {
        console.log(`  ⚠️  MISMATCH DETECTED!`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyPlayerStats();

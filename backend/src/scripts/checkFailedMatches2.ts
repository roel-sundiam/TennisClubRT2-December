import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import { connectDatabase } from '../config/database';

dotenv.config();

async function checkFailedMatches2() {
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

    console.log(`📋 Tournament: ${tournament.name}`);
    console.log(`📅 Date: ${new Date(tournament.date).toLocaleDateString()}`);
    console.log(`🎾 Total Matches: ${tournament.matches?.length || 0}\n`);

    // Check which matches have pointsProcessed = false
    const unprocessedMatches = tournament.matches?.filter((match: any) => !match.pointsProcessed) || [];
    const processedMatches = tournament.matches?.filter((match: any) => match.pointsProcessed) || [];

    console.log(`✅ Processed: ${processedMatches.length}`);
    console.log(`❌ Failed/Unprocessed: ${unprocessedMatches.length}\n`);

    if (unprocessedMatches.length > 0) {
      console.log('🔍 Checking unprocessed matches:\n');

      // Get all player IDs from unprocessed matches
      const playerIds = new Set<string>();
      unprocessedMatches.forEach((match: any) => {
        if (match.team1Player1) playerIds.add(match.team1Player1.toString());
        if (match.team1Player2) playerIds.add(match.team1Player2.toString());
        if (match.team2Player1) playerIds.add(match.team2Player1.toString());
        if (match.team2Player2) playerIds.add(match.team2Player2.toString());
      });

      // Look up players
      const players = await Player.find({
        _id: { $in: Array.from(playerIds) }
      }).lean();

      const playerMap = new Map(players.map(p => [p._id.toString(), p]));

      unprocessedMatches.forEach((match: any, index: number) => {
        console.log(`\n❌ Match ${index + 1}:`);
        console.log(`  Match Type: ${match.matchType}`);

        if (match.matchType === 'doubles') {
          const t1p1 = playerMap.get(match.team1Player1?.toString());
          const t1p2 = playerMap.get(match.team1Player2?.toString());
          const t2p1 = playerMap.get(match.team2Player1?.toString());
          const t2p2 = playerMap.get(match.team2Player2?.toString());

          console.log(`  Team 1: ${t1p1?.fullName || 'MISSING'} & ${t1p2?.fullName || 'MISSING'}`);
          console.log(`  Team 2: ${t2p1?.fullName || 'MISSING'} & ${t2p2?.fullName || 'MISSING'}`);
          console.log(`  Score: ${match.score}`);
          console.log(`  Winner: ${match.winner}`);

          // Check for missing players
          if (!t1p1) console.log(`  ⚠️  Team 1 Player 1 ID ${match.team1Player1} NOT FOUND in Player collection`);
          if (!t1p2) console.log(`  ⚠️  Team 1 Player 2 ID ${match.team1Player2} NOT FOUND in Player collection`);
          if (!t2p1) console.log(`  ⚠️  Team 2 Player 1 ID ${match.team2Player1} NOT FOUND in Player collection`);
          if (!t2p2) console.log(`  ⚠️  Team 2 Player 2 ID ${match.team2Player2} NOT FOUND in Player collection`);
        }
      });
    }

    // Check seeding points created
    console.log('\n\n📊 Seeding Points Summary:');
    const seedingPoints = await SeedingPoint.find({
      tournamentId: tournament._id
    }).lean();

    console.log(`Total seeding point records created: ${seedingPoints.length}`);

    // Group by player
    const pointsByPlayer = new Map<string, number>();
    seedingPoints.forEach(sp => {
      if (sp.playerId) {
        const playerId = sp.playerId.toString();
        const current = pointsByPlayer.get(playerId) || 0;
        pointsByPlayer.set(playerId, current + sp.points);
      }
    });

    console.log(`Players with points from this tournament: ${pointsByPlayer.size}\n`);

    // Show all players
    const playerIds = Array.from(pointsByPlayer.keys());
    const players = await Player.find({
      _id: { $in: playerIds }
    }).lean();

    const playerMap = new Map(players.map(p => [p._id.toString(), p]));

    const sortedPlayers = Array.from(pointsByPlayer.entries())
      .sort((a, b) => b[1] - a[1]);

    console.log('🏆 All Players from this Tournament:');
    sortedPlayers.forEach(([playerId, points], index) => {
      const player = playerMap.get(playerId);
      console.log(`${index + 1}. ${player?.fullName || 'Unknown'}: ${points} points`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkFailedMatches2();

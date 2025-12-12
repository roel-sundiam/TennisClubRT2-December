import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import Tournament from '../models/Tournament';
import { connectDatabase } from '../config/database';

dotenv.config();

async function removeDuplicatePoints() {
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

    // The duplicate records were created by our fix script at 5:42:45 PM
    // We need to remove those and keep the original ones from the Process Points button

    // Get all seeding points for this tournament created by our script (after 5:42 PM)
    const duplicatePoints = await SeedingPoint.find({
      tournamentId: tournament._id,
      description: /Won.*doubles match in/i, // Our script's description format
      createdAt: { $gte: new Date('2025-11-27T17:42:00') } // After 5:42 PM
    }).lean();

    console.log(`🔍 Found ${duplicatePoints.length} point records from the fix script\n`);

    if (duplicatePoints.length === 0) {
      console.log('✅ No duplicate records found');
      process.exit(0);
    }

    // Group by player to see which players were affected
    const playerIds = new Set(duplicatePoints.map(dp => dp.playerId?.toString()).filter(Boolean));
    console.log(`👥 Affected players: ${playerIds.size}\n`);

    // Show what will be deleted
    for (const dp of duplicatePoints) {
      const player = await Player.findById(dp.playerId).lean();
      console.log(`📌 Will delete: ${player?.fullName} - ${dp.points} pts - ${dp.description}`);
    }

    console.log('\n⚠️  Preparing to delete these records and adjust player stats...\n');

    // Delete the duplicate records and adjust player stats
    let deletedCount = 0;
    const playerAdjustments = new Map<string, { points: number, wins: number, matches: number }>();

    for (const dp of duplicatePoints) {
      const playerId = dp.playerId?.toString();
      if (!playerId) continue;

      // Track adjustments needed
      if (!playerAdjustments.has(playerId)) {
        playerAdjustments.set(playerId, { points: 0, wins: 0, matches: 0 });
      }
      const adj = playerAdjustments.get(playerId)!;
      adj.points += dp.points;
      adj.wins += dp.isWinner ? 1 : 0;
      adj.matches += 1;

      // Delete the seeding point record
      await SeedingPoint.findByIdAndDelete(dp._id);
      deletedCount++;
    }

    console.log(`✅ Deleted ${deletedCount} duplicate seeding point records\n`);

    // Adjust player stats
    console.log('🔄 Adjusting player stats:\n');
    for (const [playerId, adj] of playerAdjustments.entries()) {
      const player = await Player.findById(playerId);
      if (!player) continue;

      console.log(`Before: ${player.fullName}: ${player.seedPoints} pts, ${player.matchesWon} wins, ${player.matchesPlayed} matches`);

      player.seedPoints -= adj.points;
      player.matchesWon -= adj.wins;
      player.matchesPlayed -= adj.matches;
      await player.save();

      console.log(`After:  ${player.fullName}: ${player.seedPoints} pts, ${player.matchesWon} wins, ${player.matchesPlayed} matches\n`);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ COMPLETED - Duplicate records removed');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Deleted records: ${deletedCount}`);
    console.log(`Players adjusted: ${playerAdjustments.size}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Show updated rankings
    console.log('🏆 Updated Player Rankings:');
    const topPlayers = await Player.find()
      .sort({ seedPoints: -1 })
      .limit(15)
      .lean();

    topPlayers.forEach((player, index) => {
      console.log(`${index + 1}. ${player.fullName}: ${player.seedPoints} points (${player.matchesWon}W/${player.matchesPlayed}P)`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

removeDuplicatePoints();

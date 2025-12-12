import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import Tournament from '../models/Tournament';
import { connectDatabase } from '../config/database';

dotenv.config();

async function removeDuplicatesFromSecondBracket() {
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

    // The players affected by the duplicate processing
    const affectedPlayers = [
      'Keith Angela',
      'Pam Asuncion',
      'Andrea Henson',
      'Reianne Chavez',
      'CJ Yu',
      'Mishka Alcantara',
      'Hala Riva',
      'Pat Pineda',
      'Trina Sevilla',
      'Ruth Barrera',
      'Rose Cortez',
      'Tel Cruz'
    ];

    console.log('🔍 Finding duplicate seeding points...\n');

    // Get all seeding points for this tournament
    const allPoints = await SeedingPoint.find({
      tournamentId: tournament._id
    }).sort({ createdAt: 1 }).lean();

    console.log(`Total seeding points: ${allPoints.length}`);

    // Group by player and description
    const pointsByPlayerAndDesc = new Map<string, any[]>();

    allPoints.forEach(sp => {
      if (!sp.playerId) return;

      const playerId = sp.playerId.toString();
      const key = `${playerId}|${sp.description}`;

      if (!pointsByPlayerAndDesc.has(key)) {
        pointsByPlayerAndDesc.set(key, []);
      }
      pointsByPlayerAndDesc.get(key)!.push(sp);
    });

    // Find duplicates (same player, same description)
    const duplicatesToDelete: any[] = [];
    const playerAdjustments = new Map<string, { points: number, wins: number, matches: number }>();

    for (const [key, points] of pointsByPlayerAndDesc.entries()) {
      if (points.length > 1) {
        // Keep the first one (from Process Points button), delete the rest (from our manual script)
        const toDelete = points.slice(1);

        toDelete.forEach(sp => {
          duplicatesToDelete.push(sp);

          const playerId = sp.playerId!.toString();
          if (!playerAdjustments.has(playerId)) {
            playerAdjustments.set(playerId, { points: 0, wins: 0, matches: 0 });
          }
          const adj = playerAdjustments.get(playerId)!;
          adj.points += sp.points;
          adj.wins += sp.isWinner ? 1 : 0;
          adj.matches += 1;
        });
      }
    }

    console.log(`\n📊 Found ${duplicatesToDelete.length} duplicate seeding point records\n`);

    if (duplicatesToDelete.length === 0) {
      console.log('✅ No duplicates found!');
      process.exit(0);
    }

    // Get player names for logging
    const players = await Player.find({
      _id: { $in: Array.from(playerAdjustments.keys()) }
    }).lean();
    const playerMap = new Map(players.map(p => [p._id.toString(), p]));

    console.log('🗑️  Deleting duplicate records...');
    for (const sp of duplicatesToDelete) {
      await SeedingPoint.findByIdAndDelete(sp._id);
      const player = playerMap.get(sp.playerId.toString());
      console.log(`  ✅ Deleted: ${player?.fullName} - ${sp.points} pts - ${sp.description}`);
    }

    console.log('\n🔄 Adjusting player stats:\n');
    for (const [playerId, adj] of playerAdjustments.entries()) {
      const player = await Player.findById(playerId);
      if (!player) continue;

      console.log(`Before: ${player.fullName}: ${player.seedPoints} pts, ${player.matchesWon}W/${player.matchesPlayed}P`);

      player.seedPoints -= adj.points;
      player.matchesWon -= adj.wins;
      player.matchesPlayed -= adj.matches;
      await player.save();

      console.log(`After:  ${player.fullName}: ${player.seedPoints} pts, ${player.matchesWon}W/${player.matchesPlayed}P\n`);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ COMPLETED - Duplicates removed');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Deleted records: ${duplicatesToDelete.length}`);
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

removeDuplicatesFromSecondBracket();

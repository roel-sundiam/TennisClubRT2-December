import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import Tournament from '../models/Tournament';
import { connectDatabase } from '../config/database';

dotenv.config();

async function resetTournamentPoints() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Find the Rich Town 2 tournament
    const tournament = await Tournament.findOne({
      name: /2nd Rich Town 2/i
    });

    if (!tournament) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    console.log(`📋 Tournament: ${tournament.name}`);
    console.log(`🎾 Total Matches: ${tournament.matches.length}\n`);

    // Step 1: Delete ALL seeding points for this tournament
    console.log('🗑️  Deleting all seeding points for this tournament...');
    const deletedPoints = await SeedingPoint.deleteMany({
      tournamentId: tournament._id
    });
    console.log(`✅ Deleted ${deletedPoints.deletedCount} seeding point records\n`);

    // Step 2: Mark all matches as not processed
    console.log('🔄 Marking all matches as not processed...');
    tournament.matches.forEach((match: any) => {
      match.pointsProcessed = false;
    });
    await tournament.save();
    console.log(`✅ Reset ${tournament.matches.length} matches\n`);

    // Step 3: Reset all player stats to 0
    console.log('🔄 Resetting all player stats...');
    const resetResult = await Player.updateMany(
      {},
      {
        $set: {
          seedPoints: 0,
          matchesWon: 0,
          matchesPlayed: 0
        }
      }
    );
    console.log(`✅ Reset ${resetResult.modifiedCount} players\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ COMPLETED - Tournament points reset');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Seeding points deleted: ${deletedPoints.deletedCount}`);
    console.log(`Matches reset: ${tournament.matches.length}`);
    console.log(`Players reset: ${resetResult.modifiedCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('⚠️  Now click "Process Points" button ONCE in the UI to cleanly process all matches!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetTournamentPoints();

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import { connectDatabase } from '../config/database';

dotenv.config();

async function deleteAllTournamentsAndRankings() {
  try {
    console.log('🚀 Starting deletion process...\n');

    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Count before deletion
    const tournamentCount = await Tournament.countDocuments();
    const seedingPointsCount = await SeedingPoint.countDocuments();
    const playersWithPoints = await Player.countDocuments({ seedPoints: { $gt: 0 } });

    console.log('📊 Current state:');
    console.log(`  - Tournaments: ${tournamentCount}`);
    console.log(`  - Seeding Points: ${seedingPointsCount}`);
    console.log(`  - Players with points: ${playersWithPoints}`);
    console.log('');

    // Delete all tournaments
    console.log('🗑️  Deleting all tournaments...');
    const tournamentsDeleted = await Tournament.deleteMany({});
    console.log(`✅ Deleted ${tournamentsDeleted.deletedCount} tournaments`);

    // Delete all seeding points
    console.log('🗑️  Deleting all seeding points...');
    const seedingPointsDeleted = await SeedingPoint.deleteMany({});
    console.log(`✅ Deleted ${seedingPointsDeleted.deletedCount} seeding points`);

    // Reset all player stats
    console.log('🔄 Resetting all player statistics...');
    const playersUpdated = await Player.updateMany(
      {},
      {
        $set: {
          seedPoints: 0,
          matchesWon: 0,
          matchesPlayed: 0
        }
      }
    );
    console.log(`✅ Reset statistics for ${playersUpdated.modifiedCount} players`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ COMPLETED - All tournaments and rankings deleted');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`🗑️  Tournaments deleted: ${tournamentsDeleted.deletedCount}`);
    console.log(`🗑️  Seeding points deleted: ${seedingPointsDeleted.deletedCount}`);
    console.log(`🔄 Players reset: ${playersUpdated.modifiedCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteAllTournamentsAndRankings();

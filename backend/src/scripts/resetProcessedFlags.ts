import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import { connectDatabase } from '../config/database';

dotenv.config();

async function resetProcessedFlags() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    const tournament = await Tournament.findOne({
      name: /2nd Rich Town 2/i
    });

    if (!tournament) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    console.log(`📋 Tournament: ${tournament.name}\n`);
    console.log(`Resetting pointsProcessed flags for ${tournament.matches.length} matches...\n`);

    // Reset all pointsProcessed flags to false
    tournament.matches.forEach((match: any) => {
      match.pointsProcessed = false;
    });

    await tournament.save();

    console.log('✅ All pointsProcessed flags have been reset to false');
    console.log('The "Process Points" button should now be enabled.');
    console.log('Refresh the page and click "Process Points" to recalculate.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetProcessedFlags();

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import { connectDatabase } from '../config/database';

dotenv.config();

async function checkTournamentStatus() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    const tournament = await Tournament.findOne({
      name: /2nd Rich Town 2/i
    }).lean();

    if (!tournament) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    console.log(`📋 Tournament: ${tournament.name}\n`);

    const processedCount = tournament.matches.filter((m: any) => m.pointsProcessed).length;
    const unprocessedCount = tournament.matches.filter((m: any) => !m.pointsProcessed).length;

    console.log(`Total matches: ${tournament.matches.length}`);
    console.log(`Processed: ${processedCount}`);
    console.log(`Unprocessed: ${unprocessedCount}\n`);

    if (processedCount > 0) {
      console.log('⚠️ Some matches are marked as processed.');
      console.log('The "Process Points" button will be disabled.\n');
      console.log('Options:');
      console.log('1. Run resetTournamentPoints.ts to clear all points');
      console.log('2. Update a match (score/winner) in the UI to trigger the reset');
    } else {
      console.log('✅ All matches are unprocessed. Process Points button should be enabled.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTournamentStatus();

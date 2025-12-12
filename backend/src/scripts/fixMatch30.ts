import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import { connectDatabase } from '../config/database';

dotenv.config();

async function fixMatch30() {
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

    // Match 30 is the last match (index 29)
    const match = tournament.matches[29];

    console.log('Current Match 30 data:');
    console.log('  Score:', match.score);
    console.log('  Winner:', match.winner);
    console.log('\nCorrecting to:');
    console.log('  Score: 0-4 (Pam & Keith scored 0, CJ & Mishka scored 4)');
    console.log('  Winner: team2 (CJ & Mishka)\n');

    // Correct the match
    match.score = '0-4';
    match.winner = 'team2';

    await tournament.save();

    console.log('✅ Match 30 corrected!');
    console.log('\n⚠️  Run resetTournamentPoints.ts and processAllMatchesOnce.ts to recalculate all points!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixMatch30();

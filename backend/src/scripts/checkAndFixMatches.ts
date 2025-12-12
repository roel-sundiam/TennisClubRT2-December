import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import { connectDatabase } from '../config/database';

dotenv.config();

async function checkAndFixMatches() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Find the tournament
    const tournament = await Tournament.findOne({
      name: /2nd Rich Town 2/i
    });

    if (!tournament) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    console.log(`📋 Tournament: ${tournament.name}`);
    console.log(`🎾 Total matches: ${tournament.matches.length}\n`);

    // Find Rose, Tel, CJ, Mishka
    const rose = await Player.findOne({ fullName: /Rose Cortez/i }).lean();
    const tel = await Player.findOne({ fullName: /Tel Cruz/i }).lean();
    const cj = await Player.findOne({ fullName: /CJ Yu/i }).lean();
    const mishka = await Player.findOne({ fullName: /Mishka Alcantara/i }).lean();
    const trina = await Player.findOne({ fullName: /Trina Sevilla/i }).lean();
    const ruth = await Player.findOne({ fullName: /Ruth Barrera/i }).lean();
    const pam = await Player.findOne({ fullName: /Pam Asuncion/i }).lean();
    const keith = await Player.findOne({ fullName: /Keith Angela/i }).lean();

    if (!rose || !tel || !cj || !mishka) {
      console.log('❌ Could not find all players');
      process.exit(1);
    }

    console.log('🔍 Checking matches for Rose & Tel and CJ & Mishka:\n');

    // Check the last 15 matches (the ones we just added)
    const recentMatches = tournament.matches.slice(-15);
    let fixedCount = 0;

    for (let i = 0; i < recentMatches.length; i++) {
      const match = recentMatches[i];
      const matchIndex = tournament.matches.length - 15 + i;

      // Check if this is Trina & Ruth vs Rose & Tel match
      if (
        match.team1Player1?.toString() === trina?._id.toString() &&
        match.team1Player2?.toString() === ruth?._id.toString() &&
        match.team2Player1?.toString() === rose._id.toString() &&
        match.team2Player2?.toString() === tel._id.toString()
      ) {
        console.log(`Match ${matchIndex + 1}: Trina & Ruth vs Rose & Tel`);
        console.log(`  Current: Score ${match.score}, Winner: ${match.winner}`);

        // Should be: Trina & Ruth 3-4 Rose & Tel, Winner: team2 (Rose & Tel)
        if (match.score === '4-3' && match.winner === 'team1') {
          console.log('  ❌ INCORRECT - Trina & Ruth marked as winners');
          console.log('  ✅ FIXING - Rose & Tel should be winners (score should be 3-4)');

          tournament.matches[matchIndex].score = '3-4';
          tournament.matches[matchIndex].winner = 'team2';
          fixedCount++;
        }
      }

      // Check if this is Pam & Keith vs CJ & Mishka match
      if (
        match.team1Player1?.toString() === pam?._id.toString() &&
        match.team1Player2?.toString() === keith?._id.toString() &&
        match.team2Player1?.toString() === cj._id.toString() &&
        match.team2Player2?.toString() === mishka._id.toString()
      ) {
        console.log(`\nMatch ${matchIndex + 1}: Pam & Keith vs CJ & Mishka`);
        console.log(`  Current: Score ${match.score}, Winner: ${match.winner}`);

        // Should be: Pam & Keith 4-0 CJ & Mishka, Winner: team1 (Pam & Keith)
        if (match.score === '0-4' && match.winner === 'team2') {
          console.log('  ❌ INCORRECT - CJ & Mishka marked as winners');
          console.log('  ✅ FIXING - Pam & Keith should be winners (score should be 4-0)');

          tournament.matches[matchIndex].score = '4-0';
          tournament.matches[matchIndex].winner = 'team1';
          fixedCount++;
        }
      }
    }

    if (fixedCount > 0) {
      await tournament.save();
      console.log(`\n✅ Fixed ${fixedCount} matches and saved tournament`);
      console.log('\n⚠️  You will need to click "Process Points" again to recalculate rankings!');
    } else {
      console.log('\n✅ All matches look correct!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAndFixMatches();

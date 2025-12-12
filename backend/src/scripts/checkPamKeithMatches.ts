import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import { connectDatabase } from '../config/database';

dotenv.config();

async function checkPamKeithMatches() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Find Pam and Keith
    const pam = await Player.findOne({ fullName: /Pam Asuncion/i });
    const keith = await Player.findOne({ fullName: /Keith Angela/i });

    if (!pam || !keith) {
      console.log('❌ Pam or Keith not found');
      process.exit(1);
    }

    console.log(`Found: ${pam.fullName} (${pam._id})`);
    console.log(`Found: ${keith.fullName} (${keith._id})\n`);

    // Find the tournament
    const tournament = await Tournament.findOne({
      name: /2nd Rich Town 2/i
    }).lean();

    if (!tournament) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    console.log(`📋 Tournament: ${tournament.name}\n`);
    console.log('🔍 Finding all matches with Pam & Keith:\n');

    let matchNumber = 0;
    const pamKeithMatches: any[] = [];

    for (const match of tournament.matches) {
      matchNumber++;

      const pamId = (pam._id as any).toString();
      const keithId = (keith._id as any).toString();

      // Check if Pam and Keith are in this match
      const isPamKeithTeam1 =
        (match.team1Player1?.toString() === pamId && match.team1Player2?.toString() === keithId) ||
        (match.team1Player1?.toString() === keithId && match.team1Player2?.toString() === pamId);

      const isPamKeithTeam2 =
        (match.team2Player1?.toString() === pamId && match.team2Player2?.toString() === keithId) ||
        (match.team2Player1?.toString() === keithId && match.team2Player2?.toString() === pamId);

      if (isPamKeithTeam1 || isPamKeithTeam2) {
        const team1P1 = await Player.findById(match.team1Player1);
        const team1P2 = await Player.findById(match.team1Player2);
        const team2P1 = await Player.findById(match.team2Player1);
        const team2P2 = await Player.findById(match.team2Player2);

        const team1Names = `${team1P1?.fullName} & ${team1P2?.fullName}`;
        const team2Names = `${team2P1?.fullName} & ${team2P2?.fullName}`;

        const pamKeithTeam = isPamKeithTeam1 ? 'team1' : 'team2';
        const result = match.winner === pamKeithTeam ? 'WON ✅' : 'LOST ❌';

        console.log(`Match ${matchNumber}:`);
        console.log(`  Team 1: ${team1Names}`);
        console.log(`  Team 2: ${team2Names}`);
        console.log(`  Score: ${match.score}`);
        console.log(`  Winner: ${match.winner}`);
        console.log(`  Pam & Keith: ${pamKeithTeam.toUpperCase()} - ${result}\n`);

        pamKeithMatches.push({
          matchNumber,
          score: match.score,
          winner: match.winner,
          pamKeithTeam,
          result: match.winner === pamKeithTeam ? 'WIN' : 'LOSS'
        });
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`📊 Pam & Keith Summary:`);
    console.log('═══════════════════════════════════════════════════════════');
    const wins = pamKeithMatches.filter(m => m.result === 'WIN').length;
    const losses = pamKeithMatches.filter(m => m.result === 'LOSS').length;
    const expectedPoints = (wins * 4) + (losses * 3);

    console.log(`Matches played: ${pamKeithMatches.length}`);
    console.log(`Wins: ${wins}`);
    console.log(`Losses: ${losses}`);
    console.log(`Expected points (4 pts/win, 3 pts/loss): ${expectedPoints} points`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkPamKeithMatches();

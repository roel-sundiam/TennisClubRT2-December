import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import { connectDatabase } from '../config/database';

dotenv.config();

async function checkCJMishkaMatches() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Find CJ and Mishka
    const cj = await Player.findOne({ fullName: /CJ Yu/i });
    const mishka = await Player.findOne({ fullName: /Mishka Alcantara/i });

    if (!cj || !mishka) {
      console.log('❌ CJ or Mishka not found');
      process.exit(1);
    }

    console.log(`Found: ${cj.fullName} (${cj._id})`);
    console.log(`Found: ${mishka.fullName} (${mishka._id})\n`);

    // Find the tournament
    const tournament = await Tournament.findOne({
      name: /2nd Rich Town 2/i
    }).lean();

    if (!tournament) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    console.log(`📋 Tournament: ${tournament.name}\n`);
    console.log('🔍 Finding all matches with CJ & Mishka:\n');

    let matchNumber = 0;
    const cjMishkaMatches: any[] = [];

    for (const match of tournament.matches) {
      matchNumber++;

      // Check if CJ and Mishka are in this match
      const cjId = (cj._id as any).toString();
      const mishkaId = (mishka._id as any).toString();

      const isCJMishkaTeam1 =
        (match.team1Player1?.toString() === cjId && match.team1Player2?.toString() === mishkaId) ||
        (match.team1Player1?.toString() === mishkaId && match.team1Player2?.toString() === cjId);

      const isCJMishkaTeam2 =
        (match.team2Player1?.toString() === cjId && match.team2Player2?.toString() === mishkaId) ||
        (match.team2Player1?.toString() === mishkaId && match.team2Player2?.toString() === cjId);

      if (isCJMishkaTeam1 || isCJMishkaTeam2) {
        const team1P1 = await Player.findById(match.team1Player1);
        const team1P2 = await Player.findById(match.team1Player2);
        const team2P1 = await Player.findById(match.team2Player1);
        const team2P2 = await Player.findById(match.team2Player2);

        const team1Names = `${team1P1?.fullName} & ${team1P2?.fullName}`;
        const team2Names = `${team2P1?.fullName} & ${team2P2?.fullName}`;

        const cjMishkaTeam = isCJMishkaTeam1 ? 'team1' : 'team2';
        const result = match.winner === cjMishkaTeam ? 'WON ✅' : 'LOST ❌';

        console.log(`Match ${matchNumber}:`);
        console.log(`  Team 1: ${team1Names}`);
        console.log(`  Team 2: ${team2Names}`);
        console.log(`  Score: ${match.score}`);
        console.log(`  Winner: ${match.winner}`);
        console.log(`  CJ & Mishka: ${cjMishkaTeam.toUpperCase()} - ${result}`);
        console.log(`  Processed: ${match.pointsProcessed ? 'Yes' : 'No'}\n`);

        cjMishkaMatches.push({
          matchNumber,
          score: match.score,
          winner: match.winner,
          cjMishkaTeam,
          result: match.winner === cjMishkaTeam ? 'WIN' : 'LOSS'
        });
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`📊 CJ & Mishka Summary:`);
    console.log('═══════════════════════════════════════════════════════════');
    const wins = cjMishkaMatches.filter(m => m.result === 'WIN').length;
    const losses = cjMishkaMatches.filter(m => m.result === 'LOSS').length;
    const expectedPoints = (wins * 4) + (losses * 2);

    console.log(`Matches played: ${cjMishkaMatches.length}`);
    console.log(`Wins: ${wins}`);
    console.log(`Losses: ${losses}`);
    console.log(`Expected points (4 pts/win, 2 pts/loss): ${expectedPoints} points`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Check seeding points
    console.log('🎯 Seeding Points from database:');
    const cjPoints = await SeedingPoint.find({
      playerId: cj._id,
      tournamentId: tournament._id
    }).lean();

    const mishkaPoints = await SeedingPoint.find({
      playerId: mishka._id,
      tournamentId: tournament._id
    }).lean();

    console.log(`\nCJ Yu: ${cjPoints.length} seeding point records`);
    cjPoints.forEach((sp, i) => {
      console.log(`  ${i + 1}. ${sp.points} pts - ${sp.description} (${sp.isWinner ? 'WIN' : 'LOSS'})`);
    });
    const cjTotal = cjPoints.reduce((sum, sp) => sum + sp.points, 0);
    console.log(`  Total: ${cjTotal} points\n`);

    console.log(`Mishka Alcantara: ${mishkaPoints.length} seeding point records`);
    mishkaPoints.forEach((sp, i) => {
      console.log(`  ${i + 1}. ${sp.points} pts - ${sp.description} (${sp.isWinner ? 'WIN' : 'LOSS'})`);
    });
    const mishkaTotal = mishkaPoints.reduce((sum, sp) => sum + sp.points, 0);
    console.log(`  Total: ${mishkaTotal} points\n`);

    // Check player model stats
    console.log('👥 Player Model Stats:');
    const cjFromDB = await Player.findById(cj._id).lean();
    const mishkaFromDB = await Player.findById(mishka._id).lean();
    console.log(`CJ Yu: ${cjFromDB?.seedPoints} pts, ${cjFromDB?.matchesWon}W/${cjFromDB?.matchesPlayed}P`);
    console.log(`Mishka Alcantara: ${mishkaFromDB?.seedPoints} pts, ${mishkaFromDB?.matchesWon}W/${mishkaFromDB?.matchesPlayed}P`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkCJMishkaMatches();

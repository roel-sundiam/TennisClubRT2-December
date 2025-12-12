import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import { connectDatabase } from '../config/database';

dotenv.config();

async function checkRoseTel() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Find Rose and Tel
    const rose = await Player.findOne({ fullName: /Rose Cortez/i });
    const tel = await Player.findOne({ fullName: /Tel Cruz/i });

    if (!rose || !tel) {
      console.log('❌ Rose or Tel not found');
      process.exit(1);
    }

    console.log(`Found: ${rose.fullName} (${rose._id})`);
    console.log(`Found: ${tel.fullName} (${tel._id})\n`);

    // Find the tournament
    const tournament = await Tournament.findOne({
      name: /2nd Rich Town 2/i
    }).lean();

    if (!tournament) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    console.log(`📋 Tournament: ${tournament.name}\n`);
    console.log('🔍 Finding all matches with Rose & Tel:\n');

    let matchNumber = 0;
    const roseTelMatches: any[] = [];

    for (const match of tournament.matches) {
      matchNumber++;

      const roseId = (rose._id as any).toString();
      const telId = (tel._id as any).toString();

      // Check if Rose and Tel are in this match
      const isRoseTelTeam1 =
        (match.team1Player1?.toString() === roseId && match.team1Player2?.toString() === telId) ||
        (match.team1Player1?.toString() === telId && match.team1Player2?.toString() === roseId);

      const isRoseTelTeam2 =
        (match.team2Player1?.toString() === roseId && match.team2Player2?.toString() === telId) ||
        (match.team2Player1?.toString() === telId && match.team2Player2?.toString() === roseId);

      if (isRoseTelTeam1 || isRoseTelTeam2) {
        const team1P1 = await Player.findById(match.team1Player1);
        const team1P2 = await Player.findById(match.team1Player2);
        const team2P1 = await Player.findById(match.team2Player1);
        const team2P2 = await Player.findById(match.team2Player2);

        const team1Names = `${team1P1?.fullName} & ${team1P2?.fullName}`;
        const team2Names = `${team2P1?.fullName} & ${team2P2?.fullName}`;

        const roseTelTeam = isRoseTelTeam1 ? 'team1' : 'team2';
        const result = match.winner === roseTelTeam ? 'WON ✅' : 'LOST ❌';

        // Parse score
        const scoreParts = match.score.split('-').map((s: string) => parseInt(s.trim()));
        const team1Score = scoreParts[0] || 0;
        const team2Score = scoreParts[1] || 0;

        let roseTelGames = 0;
        if (roseTelTeam === 'team1') {
          roseTelGames = match.winner === 'team1' ? Math.max(team1Score, team2Score) : Math.min(team1Score, team2Score);
        } else {
          roseTelGames = match.winner === 'team2' ? Math.max(team1Score, team2Score) : Math.min(team1Score, team2Score);
        }

        console.log(`Match ${matchNumber}:`);
        console.log(`  Team 1: ${team1Names}`);
        console.log(`  Team 2: ${team2Names}`);
        console.log(`  Score: ${match.score}`);
        console.log(`  Winner: ${match.winner}`);
        console.log(`  Rose & Tel: ${roseTelTeam.toUpperCase()} - ${result}`);
        console.log(`  Points for Rose & Tel: ${roseTelGames}\n`);

        roseTelMatches.push({
          matchNumber,
          score: match.score,
          winner: match.winner,
          roseTelTeam,
          result: match.winner === roseTelTeam ? 'WIN' : 'LOSS',
          points: roseTelGames
        });
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`📊 Rose & Tel Summary:`);
    console.log('═══════════════════════════════════════════════════════════');
    const wins = roseTelMatches.filter(m => m.result === 'WIN').length;
    const losses = roseTelMatches.filter(m => m.result === 'LOSS').length;
    const totalPoints = roseTelMatches.reduce((sum, m) => sum + m.points, 0);

    console.log(`Matches played: ${roseTelMatches.length}`);
    console.log(`Wins: ${wins}`);
    console.log(`Losses: ${losses}`);
    console.log(`Expected points (based on games won): ${totalPoints} points`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get Rose's seeding points
    const rosePoints = await SeedingPoint.find({
      playerId: rose._id,
      tournamentId: tournament._id
    }).lean();

    console.log(`\n🎯 Rose Cortez - Seeding Points:`);
    let roseTotal = 0;
    rosePoints.forEach((sp, i) => {
      console.log(`  ${i + 1}. ${sp.points} pts - ${sp.description} (${sp.isWinner ? 'WIN' : 'LOSS'})`);
      roseTotal += sp.points;
    });
    console.log(`  Total: ${roseTotal} points`);

    // Get Tel's seeding points
    const telPoints = await SeedingPoint.find({
      playerId: tel._id,
      tournamentId: tournament._id
    }).lean();

    console.log(`\n🎯 Tel Cruz - Seeding Points:`);
    let telTotal = 0;
    telPoints.forEach((sp, i) => {
      console.log(`  ${i + 1}. ${sp.points} pts - ${sp.description} (${sp.isWinner ? 'WIN' : 'LOSS'})`);
      telTotal += sp.points;
    });
    console.log(`  Total: ${telTotal} points`);

    // Get Player model stats
    console.log('\n👥 Player Model Stats:');
    const roseFromDB = await Player.findById(rose._id).lean();
    const telFromDB = await Player.findById(tel._id).lean();
    console.log(`Rose Cortez: ${roseFromDB?.seedPoints} pts, ${roseFromDB?.matchesWon}W/${roseFromDB?.matchesPlayed}P`);
    console.log(`Tel Cruz: ${telFromDB?.seedPoints} pts, ${telFromDB?.matchesWon}W/${telFromDB?.matchesPlayed}P`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkRoseTel();

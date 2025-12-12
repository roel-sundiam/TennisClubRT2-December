import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import Tournament from '../models/Tournament';
import { connectDatabase } from '../config/database';

dotenv.config();

async function checkHelenPoints() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Find Helen Sundiam
    const helen = await Player.findOne({ fullName: /Helen Sundiam/i }).lean();

    if (!helen) {
      console.log('❌ Helen Sundiam not found');
      process.exit(1);
    }

    console.log(`👤 Player: ${helen.fullName}`);
    console.log(`🏆 Seed Points: ${helen.seedPoints}`);
    console.log(`✅ Matches Won: ${helen.matchesWon}`);
    console.log(`🎾 Matches Played: ${helen.matchesPlayed}\n`);

    // Get all seeding points for Helen
    const seedingPoints = await SeedingPoint.find({
      playerId: helen._id
    }).sort({ createdAt: 1 }).lean();

    console.log(`📊 Total Seeding Point Records: ${seedingPoints.length}\n`);

    // Group by tournament
    const pointsByTournament = new Map<string, any[]>();
    seedingPoints.forEach(sp => {
      const tournamentId = sp.tournamentId?.toString() || 'unknown';
      if (!pointsByTournament.has(tournamentId)) {
        pointsByTournament.set(tournamentId, []);
      }
      pointsByTournament.get(tournamentId)!.push(sp);
    });

    // Get tournament details
    const tournamentIds = Array.from(pointsByTournament.keys()).filter(id => id !== 'unknown');
    const tournaments = await Tournament.find({
      _id: { $in: tournamentIds }
    }).lean();

    const tournamentMap = new Map(tournaments.map(t => [t._id.toString(), t]));

    console.log('📋 Points by Tournament:\n');

    let totalPoints = 0;
    let totalWins = 0;
    let totalMatches = 0;

    for (const [tournamentId, points] of pointsByTournament.entries()) {
      const tournament = tournamentMap.get(tournamentId);
      const tournamentName = tournament?.name || 'Unknown Tournament';

      console.log(`\n🏆 ${tournamentName}`);
      console.log(`   Tournament ID: ${tournamentId}`);
      console.log(`   Total point records: ${points.length}`);

      const wins = points.filter(p => p.isWinner === true).length;
      const losses = points.filter(p => p.isWinner === false).length;
      const pointsSum = points.reduce((sum, p) => sum + p.points, 0);

      console.log(`   Wins: ${wins}`);
      console.log(`   Losses: ${losses}`);
      console.log(`   Total points from this tournament: ${pointsSum}`);

      totalPoints += pointsSum;
      totalWins += wins;
      totalMatches += points.length;

      // Show each point record
      points.forEach((sp, index) => {
        const date = new Date(sp.createdAt).toLocaleString();
        const winLoss = sp.isWinner ? 'WIN' : 'LOSS';
        console.log(`   ${index + 1}. [${date}] ${sp.points} pts - ${sp.description} (${winLoss})`);
      });
    }

    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total seeding point records: ${seedingPoints.length}`);
    console.log(`Total wins: ${totalWins}`);
    console.log(`Total matches (point records): ${totalMatches}`);
    console.log(`Calculated total points: ${totalPoints}`);
    console.log(`Player.seedPoints field: ${helen.seedPoints}`);
    console.log(`Player.matchesWon field: ${helen.matchesWon}`);
    console.log(`Player.matchesPlayed field: ${helen.matchesPlayed}`);
    console.log('═══════════════════════════════════════════════════════════');

    // Check if there are duplicates
    if (totalWins !== helen.matchesWon) {
      console.log(`\n⚠️  MISMATCH: Total wins (${totalWins}) doesn't match Player.matchesWon (${helen.matchesWon})`);
    }

    if (totalPoints !== helen.seedPoints) {
      console.log(`\n⚠️  MISMATCH: Calculated points (${totalPoints}) doesn't match Player.seedPoints (${helen.seedPoints})`);
    }

    // Check for duplicate records
    const descriptions = seedingPoints.map(sp => sp.description);
    const duplicates = descriptions.filter((desc, index) => descriptions.indexOf(desc) !== index);
    if (duplicates.length > 0) {
      console.log(`\n⚠️  WARNING: Found ${duplicates.length} duplicate descriptions:`);
      const uniqueDuplicates = [...new Set(duplicates)];
      uniqueDuplicates.forEach(dup => {
        const count = descriptions.filter(d => d === dup).length;
        console.log(`   - "${dup}" appears ${count} times`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkHelenPoints();

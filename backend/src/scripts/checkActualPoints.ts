import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import { connectDatabase } from '../config/database';

dotenv.config();

async function checkActualPoints() {
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

    // Find the tournament
    const tournament = await Tournament.findOne({
      name: /2nd Rich Town 2/i
    }).lean();

    if (!tournament) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    console.log(`📋 Tournament: ${tournament.name}\n`);

    // Get Pam's seeding points
    const pamPoints = await SeedingPoint.find({
      playerId: pam._id,
      tournamentId: tournament._id
    }).lean();

    console.log(`\n🎯 Pam Asuncion - Seeding Points:`);
    let pamTotal = 0;
    pamPoints.forEach((sp, i) => {
      console.log(`  ${i + 1}. ${sp.points} pts - ${sp.description} (${sp.isWinner ? 'WIN' : 'LOSS'})`);
      pamTotal += sp.points;
    });
    console.log(`  Total: ${pamTotal} points`);

    // Get Keith's seeding points
    const keithPoints = await SeedingPoint.find({
      playerId: keith._id,
      tournamentId: tournament._id
    }).lean();

    console.log(`\n🎯 Keith Angela - Seeding Points:`);
    let keithTotal = 0;
    keithPoints.forEach((sp, i) => {
      console.log(`  ${i + 1}. ${sp.points} pts - ${sp.description} (${sp.isWinner ? 'WIN' : 'LOSS'})`);
      keithTotal += sp.points;
    });
    console.log(`  Total: ${keithTotal} points`);

    // Get Player model stats
    console.log('\n👥 Player Model Stats:');
    const pamFromDB = await Player.findById(pam._id).lean();
    const keithFromDB = await Player.findById(keith._id).lean();
    console.log(`Pam Asuncion: ${pamFromDB?.seedPoints} pts, ${pamFromDB?.matchesWon}W/${pamFromDB?.matchesPlayed}P`);
    console.log(`Keith Angela: ${keithFromDB?.seedPoints} pts, ${keithFromDB?.matchesWon}W/${keithFromDB?.matchesPlayed}P`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkActualPoints();

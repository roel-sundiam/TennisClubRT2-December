import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import { connectDatabase } from '../config/database';

dotenv.config();

async function recalculatePlayerPoints() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Get all seeding points that have playerId
    const seedingPoints = await SeedingPoint.find({ playerId: { $exists: true, $ne: null } }).lean();
    console.log(`📊 Found ${seedingPoints.length} seeding points with playerId`);

    // Group by playerId and sum points
    const playerPointsMap = new Map<string, number>();

    seedingPoints.forEach(point => {
      const playerId = point.playerId!.toString();
      const currentTotal = playerPointsMap.get(playerId) || 0;
      playerPointsMap.set(playerId, currentTotal + point.points);
    });

    console.log(`\n👥 Found ${playerPointsMap.size} unique players with points`);

    // Update each player's seedPoints
    let updated = 0;
    for (const [playerId, totalPoints] of playerPointsMap.entries()) {
      const player = await Player.findById(playerId);
      if (player) {
        player.seedPoints = totalPoints;
        await player.save();
        console.log(`✅ Updated ${player.fullName}: ${totalPoints} points`);
        updated++;
      } else {
        console.log(`⚠️  Player ID ${playerId} not found`);
      }
    }

    console.log(`\n✅ Updated ${updated} players with their seed points`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

recalculatePlayerPoints();

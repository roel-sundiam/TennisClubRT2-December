import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Player from '../models/Player';
import { connectDatabase } from '../config/database';

dotenv.config();

async function checkPlayerPoints() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Count total players
    const totalPlayers = await Player.countDocuments();
    console.log(`📊 Total players: ${totalPlayers}`);

    // Count players with seed points
    const playersWithPoints = await Player.countDocuments({ seedPoints: { $gt: 0 } });
    console.log(`🏆 Players with seed points: ${playersWithPoints}`);

    // Get top 10 players by seed points
    const topPlayers = await Player.find()
      .sort({ seedPoints: -1 })
      .limit(10)
      .lean();

    console.log('\n🥇 Top 10 Players:');
    topPlayers.forEach((player, index) => {
      console.log(`${index + 1}. ${player.fullName}: ${player.seedPoints} points (${player.matchesWon}W/${player.matchesPlayed}P)`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkPlayerPoints();

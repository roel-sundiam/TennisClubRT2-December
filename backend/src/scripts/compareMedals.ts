import mongoose from 'mongoose';
import Player from '../models/Player';
import CalculatedRankingService from '../services/calculatedRankingService';
import dotenv from 'dotenv';

dotenv.config();

async function compareMedals() {
  await mongoose.connect(process.env.MONGODB_URI || '');

  // Get all players with medals from DB
  const playersWithMedals = await Player.find({
    medals: { $exists: true, $ne: [] }
  }).select('_id fullName medals gender');

  console.log('\n📊 Comparing Database vs API Medals:\n');
  console.log('Player Name           | DB Medals    | API Medals   | Match?');
  console.log('----------------------|--------------|--------------|-------');

  // Clear cache and get fresh rankings
  CalculatedRankingService.clearCache();
  const rankings = await CalculatedRankingService.calculateRankings();

  for (const player of playersWithMedals) {
    const playerId = player._id ? String(player._id) : '';
    const apiPlayer = rankings.rankings.find(r => r.playerId === playerId);

    const dbMedals = player.medals?.join(', ') || 'none';
    const apiMedals = apiPlayer?.medals?.join(', ') || 'NOT IN RANKINGS';
    const match = dbMedals === apiMedals ? '✅' : '❌';

    console.log(`${player.fullName.padEnd(21)} | ${dbMedals.padEnd(12)} | ${apiMedals.padEnd(12)} | ${match}`);

    if (!apiPlayer) {
      console.log(`   ⚠️  ${player.fullName} is not in the rankings (no tournament matches)`);
    }
  }

  console.log('\n📋 Summary:');
  console.log(`   Total players with medals in DB: ${playersWithMedals.length}`);
  console.log(`   Total players in rankings: ${rankings.rankings.length}`);

  const medalsInRankings = rankings.rankings.filter(r => r.medals && r.medals.length > 0);
  console.log(`   Players with medals in rankings: ${medalsInRankings.length}`);

  await mongoose.disconnect();
}

compareMedals().catch(console.error);

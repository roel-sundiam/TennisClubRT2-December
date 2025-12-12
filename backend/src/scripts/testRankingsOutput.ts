import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CalculatedRankingService from '../services/calculatedRankingService';

dotenv.config();

async function test() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB');

    // Clear cache to force fresh calculation
    CalculatedRankingService.clearCache();

    // Get rankings
    console.log('\n📊 Fetching rankings...');
    const stats = await CalculatedRankingService.calculateRankings({ limit: 3 });

    console.log('\n📋 Full response object:');
    console.log(JSON.stringify(stats, null, 2));

    console.log('\n👥 First 3 players:');
    stats.rankings.forEach((r, i) => {
      console.log(`\n${i + 1}. ${r.playerName}:`);
      console.log(`   playerId: ${r.playerId}`);
      console.log(`   gender: ${r.gender}`);
      console.log(`   medals: ${JSON.stringify(r.medals)}`);
      console.log(`   medals type: ${typeof r.medals}`);
      console.log(`   medals is array: ${Array.isArray(r.medals)}`);
      console.log(`   totalPoints: ${r.totalPoints}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

test();

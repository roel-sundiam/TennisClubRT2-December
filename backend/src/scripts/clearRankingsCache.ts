import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CalculatedRankingService from '../services/calculatedRankingService';

dotenv.config();

async function clearCache() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB');

    // Clear the cache
    CalculatedRankingService.clearCache();

    // Fetch fresh rankings to repopulate cache
    console.log('📊 Fetching fresh rankings...');
    const rankings = await CalculatedRankingService.calculateRankings();
    console.log(`✅ Cache refreshed with ${rankings.rankings.length} players`);

    // Check if medals array is present
    const playersWithMedals = rankings.rankings.filter(r => r.medals && r.medals.length > 0);
    console.log(`🏅 Players with medals: ${playersWithMedals.length}`);
    playersWithMedals.forEach(p => {
      console.log(`   ${p.playerName}: ${p.medals.join(', ')}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

clearCache();

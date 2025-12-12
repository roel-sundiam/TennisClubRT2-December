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
    console.log('\n📊 Fetching rankings with tie handling...');
    const stats = await CalculatedRankingService.calculateRankings({ limit: 10 });

    console.log('\n📋 Top 10 Rankings (showing ties):');
    console.log('Rank | Player Name           | Points | Wins | Matches');
    console.log('-----|----------------------|--------|------|--------');
    stats.rankings.forEach((r) => {
      const rankStr = r.rank.toString().padStart(4, ' ');
      const nameStr = r.playerName.padEnd(20, ' ');
      const pointsStr = r.totalPoints.toString().padStart(6, ' ');
      const winsStr = r.matchesWon.toString().padStart(4, ' ');
      const matchesStr = r.matchesPlayed.toString().padStart(6, ' ');
      console.log(`${rankStr} | ${nameStr} | ${pointsStr} | ${winsStr} | ${matchesStr}`);
    });

    // Check for ties
    const ties: any[] = [];
    for (let i = 1; i < stats.rankings.length; i++) {
      const curr = stats.rankings[i];
      const prev = stats.rankings[i - 1];
      if (curr && prev && curr.rank === prev.rank) {
        if (ties.length === 0 || ties[ties.length - 1]?.rank !== curr.rank) {
          ties.push({ rank: curr.rank, players: [prev.playerName, curr.playerName] });
        } else {
          ties[ties.length - 1]?.players.push(curr.playerName);
        }
      }
    }

    if (ties.length > 0) {
      console.log('\n🔗 Detected Ties:');
      ties.forEach(tie => {
        console.log(`   Rank ${tie.rank}: ${tie.players.join(', ')}`);
      });
    } else {
      console.log('\n✅ No ties detected in top 10');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

test();

import mongoose from 'mongoose';
import Player from '../models/Player';
import dotenv from 'dotenv';

dotenv.config();

async function removeNullMedals() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB');

    // Find all players with medals
    const players = await Player.find({ medals: { $exists: true, $ne: [] } });
    console.log(`📊 Found ${players.length} players with medals`);

    let totalNullsRemoved = 0;

    for (const player of players) {
      const beforeCount = player.medals.length;
      const originalMedals = [...player.medals];

      // Filter out null medals
      player.medals = player.medals.filter(medal => medal !== null && medal.type !== null);

      const afterCount = player.medals.length;
      const nullsRemoved = beforeCount - afterCount;

      if (nullsRemoved > 0) {
        await player.save();
        totalNullsRemoved += nullsRemoved;
        console.log(`🗑️  ${player.fullName}: Removed ${nullsRemoved} null medals (${beforeCount} → ${afterCount})`);
      }
    }

    console.log(`\n✅ Cleanup complete! Removed ${totalNullsRemoved} null medals from ${players.length} players`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

removeNullMedals();

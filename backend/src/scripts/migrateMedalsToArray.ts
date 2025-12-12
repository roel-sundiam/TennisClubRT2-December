import mongoose from 'mongoose';
import Player from '../models/Player';
import dotenv from 'dotenv';

dotenv.config();

async function migrateMedals() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB');

    // Find all players with old 'medal' field using direct MongoDB query
    const players = await Player.find({ medal: { $exists: true } }).lean();

    console.log(`📊 Found ${players.length} players with old medal field to migrate`);

    for (const player of players) {
      const oldMedal = (player as any).medal;
      console.log(`\n🔍 Processing ${player.fullName}:`);
      console.log(`   Old medal value: ${oldMedal}`);
      console.log(`   Current medals array: ${JSON.stringify((player as any).medals)}`);

      // Build new medals array
      let newMedals: ('gold' | 'silver' | 'bronze')[] = [];

      // Keep existing medals if they exist
      if ((player as any).medals && Array.isArray((player as any).medals)) {
        newMedals = [...(player as any).medals];
      }

      // Add old medal if it exists and not already in array
      if (oldMedal && ['gold', 'silver', 'bronze'].includes(oldMedal)) {
        if (!newMedals.includes(oldMedal as any)) {
          newMedals.push(oldMedal as 'gold' | 'silver' | 'bronze');
        }
      }

      // Use direct MongoDB update to ensure $unset works
      const result = await Player.collection.updateOne(
        { _id: player._id },
        {
          $set: { medals: newMedals },
          $unset: { medal: '' }
        }
      );

      console.log(`   ✅ Updated: medals = [${newMedals.join(', ')}], unset result = ${result.modifiedCount}`);
    }

    console.log('\n✅ Migration completed successfully');

    // Verify migration
    const remaining = await Player.find({ medal: { $exists: true } }).countDocuments();
    console.log(`📊 Verification: ${remaining} players still have old medal field (should be 0)`);

    const withMedals = await Player.find({ medals: { $exists: true, $ne: [] } }).countDocuments();
    console.log(`🏅 Players with medals array: ${withMedals}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateMedals();

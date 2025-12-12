import mongoose from 'mongoose';
import Player from '../models/Player';
import dotenv from 'dotenv';

dotenv.config();

async function checkMedals() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB');

    // Find Noreen Munoz
    const noreen = await Player.findOne({ fullName: 'Noreen Munoz' });
    if (noreen) {
      console.log('\n📊 Noreen Munoz:');
      console.log('   ID:', noreen._id);
      console.log('   Full Name:', noreen.fullName);
      console.log('   Medals (new field):', noreen.medals);
      console.log('   Medal (old field):', (noreen as any).medal);
      console.log('   Raw document:', JSON.stringify(noreen, null, 2));
    } else {
      console.log('❌ Noreen Munoz not found');
    }

    // Find Christine Cruz
    const christine = await Player.findOne({ fullName: 'Christine Cruz' });
    if (christine) {
      console.log('\n📊 Christine Cruz:');
      console.log('   ID:', christine._id);
      console.log('   Full Name:', christine.fullName);
      console.log('   Medals (new field):', christine.medals);
      console.log('   Medal (old field):', (christine as any).medal);
    } else {
      console.log('❌ Christine Cruz not found');
    }

    // Find all players with medals array
    const playersWithMedals = await Player.find({ medals: { $exists: true, $ne: [] } });
    console.log(`\n🏅 Players with medals array: ${playersWithMedals.length}`);
    playersWithMedals.forEach(p => {
      console.log(`   ${p.fullName}: ${p.medals?.join(', ')}`);
    });

    // Find all players with old medal field (should be 0 after migration)
    const playersWithOldMedal = await Player.find({ medal: { $exists: true } });
    console.log(`\n⚠️  Players with OLD medal field: ${playersWithOldMedal.length}`);
    playersWithOldMedal.forEach(p => {
      console.log(`   ${p.fullName}: ${(p as any).medal}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

checkMedals();

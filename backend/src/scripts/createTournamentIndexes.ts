import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import SeedingPoint from '../models/SeedingPoint';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function createTournamentIndexes() {
  try {
    console.log('🔧 Creating tournament unique indexes...\n');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Verify no duplicates exist
    console.log('🔍 Step 1: Verifying no duplicates exist...');

    const duplicateCheck = await SeedingPoint.aggregate([
      {
        $match: {
          tournamentId: { $exists: true },
          matchIndex: { $exists: true },
          playerId: { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            tournamentId: '$tournamentId',
            matchIndex: '$matchIndex',
            playerId: '$playerId'
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    if (duplicateCheck.length > 0) {
      console.error(`   ❌ Found ${duplicateCheck.length} duplicate groups!`);
      console.error('   Cannot create unique index while duplicates exist.');
      console.error('   Please run "npm run cleanup-duplicate-points" first.\n');
      process.exit(1);
    }

    console.log('   ✅ No duplicates found - safe to create unique index\n');

    // Step 2: Check if index already exists
    console.log('🔍 Step 2: Checking existing indexes...');

    const existingIndexes = await SeedingPoint.collection.getIndexes();
    const indexNames = Object.keys(existingIndexes);

    console.log(`   Current indexes: ${indexNames.join(', ')}`);

    if (indexNames.includes('unique_tournament_match_player')) {
      console.log('   ⚠️  Unique index already exists - skipping creation\n');
      console.log('✅ Index verification complete. No action needed.');
      return;
    }

    console.log('   ℹ️  Unique index does not exist - will create\n');

    // Step 3: Create the unique index
    console.log('🔧 Step 3: Creating unique compound index...');
    console.log('   Index: { tournamentId: 1, matchIndex: 1, playerId: 1 }');
    console.log('   Options: unique, sparse\n');

    try {
      await SeedingPoint.collection.createIndex(
        { tournamentId: 1, matchIndex: 1, playerId: 1 },
        {
          unique: true,
          sparse: true,
          name: 'unique_tournament_match_player'
        }
      );

      console.log('   ✅ Unique index created successfully\n');
    } catch (error: any) {
      if (error.code === 11000) {
        console.error('   ❌ Duplicate key error during index creation!');
        console.error('   This means duplicates exist that were not caught by the verification.');
        console.error('   Please run "npm run cleanup-duplicate-points" and try again.\n');
      } else {
        console.error('   ❌ Error creating index:', error.message);
      }
      throw error;
    }

    // Step 4: Verify index was created
    console.log('✔️  Step 4: Verifying index creation...');

    const updatedIndexes = await SeedingPoint.collection.getIndexes();
    const hasUniqueIndex = 'unique_tournament_match_player' in updatedIndexes;

    if (hasUniqueIndex) {
      console.log('   ✅ Index verified: unique_tournament_match_player exists\n');
    } else {
      console.error('   ❌ Index verification failed - index not found\n');
      process.exit(1);
    }

    // Step 5: Test with sample duplicate attempt
    console.log('🧪 Step 5: Testing unique constraint...');

    // Find an existing tournament point
    const samplePoint = await SeedingPoint.findOne({
      tournamentId: { $exists: true },
      matchIndex: { $exists: true },
      playerId: { $exists: true }
    });

    if (samplePoint) {
      console.log('   Attempting to create duplicate point record...');

      try {
        const duplicatePoint = new SeedingPoint({
          tournamentId: samplePoint.tournamentId,
          matchIndex: samplePoint.matchIndex,
          playerId: samplePoint.playerId,
          points: 10,
          description: 'Test duplicate',
          source: 'tournament'
        });

        await duplicatePoint.save();

        // If we get here, the index didn't work!
        console.error('   ❌ TEST FAILED: Duplicate was allowed! Index is not working.\n');
        await SeedingPoint.deleteOne({ _id: duplicatePoint._id });
        process.exit(1);

      } catch (error: any) {
        if (error.code === 11000) {
          console.log('   ✅ TEST PASSED: Duplicate was correctly rejected (Error code 11000)\n');
        } else {
          console.error('   ⚠️  Unexpected error during test:', error.message);
          console.error('   The index may still be working, but test was inconclusive.\n');
        }
      }
    } else {
      console.log('   ℹ️  No existing tournament points found to test with');
      console.log('   Skipping duplicate test\n');
    }

    // Summary
    console.log('='.repeat(80));
    console.log('INDEX CREATION SUMMARY');
    console.log('='.repeat(80));
    console.log('✅ Unique index created: unique_tournament_match_player');
    console.log('✅ Index fields: { tournamentId, matchIndex, playerId }');
    console.log('✅ Options: unique, sparse');
    console.log('✅ Duplicate prevention: ACTIVE');
    console.log('='.repeat(80));

    console.log('\n✅ Index migration complete!');
    console.log('   The database now prevents duplicate tournament point awards.');
    console.log('   Next step: Update the code in seedingService.ts to handle idempotency.');

  } catch (error) {
    console.error('❌ Error during index creation:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the migration
createTournamentIndexes()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

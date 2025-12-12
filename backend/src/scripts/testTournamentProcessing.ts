import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import SeedingService from '../services/seedingService';
import DataValidationService from '../services/dataValidationService';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function addResult(testName: string, passed: boolean, message: string, details?: any) {
  results.push({ testName, passed, message, details });
  if (passed) {
    console.log(`✅ ${testName}: ${message}`);
  } else {
    console.error(`❌ ${testName}: ${message}`);
    if (details) {
      console.error('   Details:', JSON.stringify(details, null, 2));
    }
  }
}

async function testTournamentProcessing() {
  try {
    console.log('🧪 Starting tournament processing integration tests...\n');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get test players
    const players = await Player.find({}).limit(10);
    if (players.length < 4) {
      throw new Error('Need at least 4 players in database for testing');
    }

    console.log(`Found ${players.length} players for testing\n`);

    // Test 1: Create test tournament
    console.log('📊 Test 1: Creating test tournament...');
    const testTournament = new Tournament({
      name: `Test Tournament ${Date.now()}`,
      date: new Date(),
      location: 'Test Location',
      tier: '100',
      format: 'singles',
      scoringType: 'game-based',
      status: 'completed',
      matches: [
        {
          player1: players[0]._id,
          player2: players[1]._id,
          winner: players[0]._id,
          score: '6-4',
          round: 'Round 1',
          matchType: 'singles',
          pointsProcessed: false
        },
        {
          player1: players[2]._id,
          player2: players[3]._id,
          winner: players[2]._id,
          score: '6-3',
          round: 'Round 1',
          matchType: 'singles',
          pointsProcessed: false
        }
      ]
    });

    await testTournament.save();
    addResult('Create Tournament', true, `Created tournament: ${testTournament.name}`);

    // Save original player stats
    const originalStats = new Map();
    for (const player of players.slice(0, 4)) {
      originalStats.set(player._id.toString(), {
        seedPoints: player.seedPoints || 0,
        matchesWon: player.matchesWon || 0,
        matchesPlayed: player.matchesPlayed || 0
      });
    }

    // Test 2: Process tournament points (first time)
    console.log('\n📊 Test 2: Processing tournament points (first time)...');
    await SeedingService.processTournamentPoints(testTournament._id.toString());

    const pointsAfterFirst = await SeedingPoint.find({
      tournamentId: testTournament._id
    });

    addResult(
      'First Processing',
      pointsAfterFirst.length === 4, // 2 matches * 2 players each
      `Created ${pointsAfterFirst.length} point records`,
      { expected: 4, actual: pointsAfterFirst.length }
    );

    // Test 3: Idempotency - Process same tournament again
    console.log('\n📊 Test 3: Testing idempotency (processing again)...');
    await SeedingService.processTournamentPoints(testTournament._id.toString());

    const pointsAfterSecond = await SeedingPoint.find({
      tournamentId: testTournament._id
    });

    addResult(
      'Idempotency Check',
      pointsAfterSecond.length === pointsAfterFirst.length,
      `No duplicate points created (${pointsAfterSecond.length} records)`,
      {
        firstProcessing: pointsAfterFirst.length,
        secondProcessing: pointsAfterSecond.length,
        duplicatesCreated: pointsAfterSecond.length - pointsAfterFirst.length
      }
    );

    // Test 4: Validate player stats match SeedingPoints
    console.log('\n📊 Test 4: Validating player stats...');
    const validation = await DataValidationService.validateAllPlayers();
    const testPlayerValidations = validation.results.filter(r =>
      [players[0]._id.toString(), players[1]._id.toString(),
       players[2]._id.toString(), players[3]._id.toString()].includes(r.playerId)
    );

    const allValid = testPlayerValidations.every(v => !v.mismatch);
    addResult(
      'Stats Validation',
      allValid,
      allValid ? 'All player stats match SeedingPoints' : 'Some mismatches found',
      testPlayerValidations.filter(v => v.mismatch)
    );

    // Test 5: Update tournament (should auto-reverse and reprocess)
    console.log('\n📊 Test 5: Testing tournament update with auto-reversal...');
    const tournamentToUpdate = await Tournament.findById(testTournament._id);
    if (!tournamentToUpdate) {
      throw new Error('Tournament not found');
    }

    // Modify a score
    tournamentToUpdate.matches[0].score = '7-5';
    await tournamentToUpdate.save();

    // Verify points were reversed and marked
    const reversedPoints = await SeedingPoint.find({
      tournamentId: testTournament._id,
      reversedAt: { $exists: true }
    });

    addResult(
      'Auto-Reversal on Update',
      reversedPoints.length === 4,
      `${reversedPoints.length} points marked as reversed`,
      { expected: 4, actual: reversedPoints.length }
    );

    // Process points again with new data
    await SeedingService.processTournamentPoints(testTournament._id.toString());

    const pointsAfterUpdate = await SeedingPoint.find({
      tournamentId: testTournament._id,
      reversedAt: { $exists: false }
    });

    addResult(
      'Reprocessing After Update',
      pointsAfterUpdate.length === 4,
      `${pointsAfterUpdate.length} new point records created`,
      { expected: 4, actual: pointsAfterUpdate.length }
    );

    // Test 6: Delete tournament (should reverse all points)
    console.log('\n📊 Test 6: Testing tournament deletion with point reversal...');
    const reversalResult = await SeedingService.reverseTournamentPoints(testTournament._id.toString());

    addResult(
      'Point Reversal',
      reversalResult.reversed === 4 && reversalResult.errors === 0,
      `Reversed ${reversalResult.reversed} points with ${reversalResult.errors} errors`,
      reversalResult
    );

    // Verify player stats are back to original or close to it
    const playersAfterReversal = await Player.find({
      _id: { $in: players.slice(0, 4).map(p => p._id) }
    });

    const statsMatch = playersAfterReversal.every(player => {
      const original = originalStats.get(player._id.toString());
      const current = {
        seedPoints: player.seedPoints || 0,
        matchesWon: player.matchesWon || 0,
        matchesPlayed: player.matchesPlayed || 0
      };

      return original.seedPoints === current.seedPoints &&
             original.matchesWon === current.matchesWon &&
             original.matchesPlayed === current.matchesPlayed;
    });

    addResult(
      'Stats After Reversal',
      statsMatch,
      statsMatch ? 'Player stats restored to original values' : 'Some stats not restored',
      playersAfterReversal.map(p => ({
        player: p.fullName,
        original: originalStats.get(p._id.toString()),
        current: {
          seedPoints: p.seedPoints || 0,
          matchesWon: p.matchesWon || 0,
          matchesPlayed: p.matchesPlayed || 0
        }
      }))
    );

    // Test 7: Validation service auto-repair
    console.log('\n📊 Test 7: Testing validation service auto-repair...');

    // Create a test tournament with some matches processed
    const tournament2 = new Tournament({
      name: `Test Tournament 2 ${Date.now()}`,
      date: new Date(),
      location: 'Test Location',
      tier: '100',
      format: 'singles',
      scoringType: 'game-based',
      status: 'completed',
      matches: [
        {
          player1: players[4]._id,
          player2: players[5]._id,
          winner: players[4]._id,
          score: '6-2',
          round: 'Round 1',
          matchType: 'singles',
          pointsProcessed: false
        }
      ]
    });
    await tournament2.save();
    await SeedingService.processTournamentPoints(tournament2._id.toString());

    // Run validation
    const validationReport = await DataValidationService.validateAllPlayers();
    const hasAnyMismatches = validationReport.mismatchPlayers > 0;

    if (hasAnyMismatches) {
      // Test auto-repair
      const repairResult = await DataValidationService.repairAllMismatches();
      addResult(
        'Auto-Repair',
        repairResult.repaired > 0 || repairResult.errors === 0,
        `Repaired ${repairResult.repaired} players, ${repairResult.errors} errors`
      );
    } else {
      addResult(
        'Auto-Repair',
        true,
        'No mismatches to repair - validation passed'
      );
    }

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await Tournament.deleteMany({
      name: { $regex: /^Test Tournament/ }
    });
    await SeedingPoint.deleteMany({
      description: { $regex: /Test Tournament/ }
    });
    console.log('✅ Test data cleaned up\n');

    // Summary
    console.log('='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);
    console.log('='.repeat(80));

    if (failed > 0) {
      console.log('\nFailed Tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  ❌ ${r.testName}: ${r.message}`);
      });
    }

    console.log('\n✅ All integration tests complete!');
    console.log(passed === total ? '🎉 All tests passed!' : '⚠️  Some tests failed');

    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('❌ Fatal error during tests:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the tests
testTournamentProcessing()
  .then(() => {
    console.log('\n✅ Test suite completed successfully');
  })
  .catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });

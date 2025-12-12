import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import SeedingPoint from '../models/SeedingPoint';
import Player from '../models/Player';
import Tournament from '../models/Tournament';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface DuplicateGroup {
  tournamentId: string;
  matchIndex: number;
  playerId: string;
  records: Array<{
    id: string;
    points: number;
    createdAt: Date;
    isWinner: boolean;
  }>;
}

interface PlayerAdjustment {
  playerId: string;
  playerName: string;
  before: {
    seedPoints: number;
    matchesWon: number;
    matchesPlayed: number;
  };
  after: {
    seedPoints: number;
    matchesWon: number;
    matchesPlayed: number;
  };
  recordsDeleted: number;
}

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function cleanupDuplicatePoints() {
  try {
    console.log('🧹 Starting duplicate points cleanup...\n');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Create timestamped backup
    console.log('📦 Step 1: Creating backup...');

    const backupData = {
      backupDate: new Date().toISOString(),
      seedingPoints: await SeedingPoint.find({}),
      players: await Player.find({}),
      tournaments: await Tournament.find({})
    };

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupPath = path.resolve(__dirname, `../../backups/pre-cleanup-backup_${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`   ✅ Backup saved: ${backupPath}\n`);

    // Step 2: Find all duplicate groups
    console.log('🔍 Step 2: Finding duplicate SeedingPoint records...');

    const seedingPoints = await SeedingPoint.find({
      tournamentId: { $exists: true },
      matchIndex: { $exists: true },
      playerId: { $exists: true }
    }).sort({ createdAt: 1 });

    console.log(`   Total tournament SeedingPoint records: ${seedingPoints.length}`);

    // Group by (tournamentId, matchIndex, playerId)
    const groupMap = new Map<string, DuplicateGroup>();

    for (const point of seedingPoints) {
      const key = `${point.tournamentId}_${point.matchIndex}_${point.playerId}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          tournamentId: point.tournamentId as string,
          matchIndex: point.matchIndex as number,
          playerId: point.playerId as string,
          records: []
        });
      }

      groupMap.get(key)!.records.push({
        id: point._id.toString(),
        points: point.points,
        createdAt: point.createdAt,
        isWinner: point.isWinner || false
      });
    }

    // Find duplicates (count > 1)
    const duplicates = Array.from(groupMap.values()).filter(g => g.records.length > 1);
    const totalDuplicateRecords = duplicates.reduce((sum, d) => sum + (d.records.length - 1), 0);

    console.log(`   Found ${duplicates.length} duplicate groups`);
    console.log(`   Total duplicate records to delete: ${totalDuplicateRecords}\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found! Database is clean.');
      return;
    }

    // Confirm before proceeding
    console.log('⚠️  WARNING: This will DELETE duplicate records and UPDATE player stats.');
    const confirmed = await askConfirmation('Do you want to proceed?');

    if (!confirmed) {
      console.log('❌ Cleanup cancelled by user.');
      return;
    }

    console.log('\n🧹 Step 3: Removing duplicate records...');

    const recordsToDelete: string[] = [];
    const affectedPlayers = new Set<string>();

    for (const dup of duplicates) {
      // Sort by createdAt to keep the oldest (first processing)
      const sorted = dup.records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      // Keep first record, delete the rest
      const toKeep = sorted[0];
      const toDelete = sorted.slice(1);

      console.log(`   Tournament ${dup.tournamentId.substring(0, 8)}..., Match ${dup.matchIndex}, Player ${dup.playerId.substring(0, 8)}...:`);
      console.log(`     Keeping:  Record from ${toKeep.createdAt.toISOString()} (${toKeep.points} pts)`);
      console.log(`     Deleting: ${toDelete.length} duplicate(s)`);

      toDelete.forEach(record => {
        recordsToDelete.push(record.id);
      });

      affectedPlayers.add(dup.playerId);
    }

    // Delete duplicate records
    const deleteResult = await SeedingPoint.deleteMany({
      _id: { $in: recordsToDelete }
    });

    console.log(`   ✅ Deleted ${deleteResult.deletedCount} duplicate records\n`);

    // Step 4: Recalculate player stats
    console.log('🔢 Step 4: Recalculating player stats from remaining SeedingPoints...');

    const adjustments: PlayerAdjustment[] = [];

    for (const playerId of affectedPlayers) {
      const player = await Player.findById(playerId);
      if (!player) {
        console.warn(`   ⚠️  Player ${playerId} not found, skipping`);
        continue;
      }

      // Save original stats
      const before = {
        seedPoints: player.seedPoints || 0,
        matchesWon: player.matchesWon || 0,
        matchesPlayed: player.matchesPlayed || 0
      };

      // Get all remaining non-reversed tournament SeedingPoints for this player
      const playerPoints = await SeedingPoint.find({
        playerId: player._id,
        tournamentId: { $exists: true },
        matchIndex: { $exists: true },
        reversedAt: { $exists: false }
      });

      // Calculate stats from unique matches
      const uniqueMatches = new Map<string, any>();

      for (const point of playerPoints) {
        const matchKey = `${point.tournamentId}_${point.matchIndex}`;

        // Only count each match once
        if (!uniqueMatches.has(matchKey)) {
          uniqueMatches.set(matchKey, {
            points: point.points,
            isWinner: point.isWinner || false
          });
        }
      }

      // Calculate correct stats
      const correctStats = {
        seedPoints: Array.from(uniqueMatches.values()).reduce((sum, m) => sum + m.points, 0),
        matchesWon: Array.from(uniqueMatches.values()).filter(m => m.isWinner).length,
        matchesPlayed: uniqueMatches.size
      };

      // Update player with correct stats
      player.seedPoints = correctStats.seedPoints;
      player.matchesWon = correctStats.matchesWon;
      player.matchesPlayed = correctStats.matchesPlayed;
      await player.save();

      adjustments.push({
        playerId: player._id.toString(),
        playerName: player.fullName,
        before,
        after: correctStats,
        recordsDeleted: duplicates.filter(d => d.playerId === playerId).reduce((sum, d) => sum + (d.records.length - 1), 0)
      });

      const changed = before.seedPoints !== correctStats.seedPoints ||
                     before.matchesWon !== correctStats.matchesWon ||
                     before.matchesPlayed !== correctStats.matchesPlayed;

      if (changed) {
        console.log(`   ${player.fullName}:`);
        console.log(`     Before: ${before.seedPoints} pts, ${before.matchesWon}/${before.matchesPlayed} W/L`);
        console.log(`     After:  ${correctStats.seedPoints} pts, ${correctStats.matchesWon}/${correctStats.matchesPlayed} W/L`);
        console.log(`     Deleted: ${adjustments[adjustments.length - 1].recordsDeleted} duplicate(s)`);
      }
    }

    console.log(`   ✅ Recalculated stats for ${adjustments.length} players\n`);

    // Step 5: Verify data integrity
    console.log('✔️  Step 5: Verifying data integrity...');

    const allPlayers = await Player.find({});
    let totalPoints = 0;
    let totalWins = 0;
    let totalPlayed = 0;

    for (const player of allPlayers) {
      totalPoints += player.seedPoints || 0;
      totalWins += player.matchesWon || 0;
      totalPlayed += player.matchesPlayed || 0;
    }

    // Verify against SeedingPoints
    const allPoints = await SeedingPoint.find({
      tournamentId: { $exists: true },
      reversedAt: { $exists: false }
    });

    const uniqueMatchesTotal = new Map<string, any>();
    for (const point of allPoints) {
      const matchKey = `${point.playerId}_${point.tournamentId}_${point.matchIndex}`;
      if (!uniqueMatches.has(matchKey)) {
        uniqueMatchesTotal.set(matchKey, {
          points: point.points,
          isWinner: point.isWinner || false
        });
      }
    }

    const expectedPoints = Array.from(uniqueMatchesTotal.values()).reduce((sum, m) => sum + m.points, 0);

    console.log(`   Total points in system: ${totalPoints}`);
    console.log(`   Expected from SeedingPoints: ${expectedPoints}`);
    console.log(`   Match: ${totalPoints === expectedPoints ? '✅' : '❌'}\n`);

    // Step 6: Generate reconciliation report
    console.log('📊 Step 6: Generating reconciliation report...');

    const reportData = {
      cleanupDate: new Date().toISOString(),
      summary: {
        duplicateGroupsFound: duplicates.length,
        recordsDeleted: deleteResult.deletedCount,
        playersAffected: adjustments.length,
        backupLocation: backupPath
      },
      adjustments: adjustments.map(adj => ({
        playerId: adj.playerId,
        playerName: adj.playerName,
        beforePoints: adj.before.seedPoints,
        afterPoints: adj.after.seedPoints,
        pointsDiff: adj.after.seedPoints - adj.before.seedPoints,
        beforeWins: adj.before.matchesWon,
        afterWins: adj.after.matchesWon,
        winsDiff: adj.after.matchesWon - adj.before.matchesWon,
        beforePlayed: adj.before.matchesPlayed,
        afterPlayed: adj.after.matchesPlayed,
        playedDiff: adj.after.matchesPlayed - adj.before.matchesPlayed,
        recordsDeleted: adj.recordsDeleted
      }))
    };

    const reportPath = path.resolve(__dirname, `../../backups/cleanup-report_${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`   ✅ Saved reconciliation report: ${reportPath}\n`);

    // Summary
    console.log('='.repeat(80));
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(80));
    console.log(`Duplicate Groups Found:       ${duplicates.length}`);
    console.log(`Records Deleted:              ${deleteResult.deletedCount}`);
    console.log(`Players Affected:             ${adjustments.length}`);
    console.log(`Total Points in System:       ${totalPoints}`);
    console.log(`Data Integrity Check:         ${totalPoints === expectedPoints ? '✅ PASS' : '❌ FAIL'}`);
    console.log('='.repeat(80));
    console.log(`\nBackup Location:  ${backupPath}`);
    console.log(`Report Location:  ${reportPath}`);

    console.log('\n✅ Cleanup complete! The database is now ready for the unique index.');
    console.log('   Next step: Run "npm run create-tournament-indexes" to add the unique constraint.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupDuplicatePoints()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

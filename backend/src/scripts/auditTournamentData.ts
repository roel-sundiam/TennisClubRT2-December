import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import SeedingPoint from '../models/SeedingPoint';
import Player from '../models/Player';
import Tournament from '../models/Tournament';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface DuplicateGroup {
  tournamentId: string;
  matchIndex: number;
  playerId: string;
  count: number;
  points: number[];
  createdAts: Date[];
  recordIds: string[];
}

interface PlayerMismatch {
  playerId: string;
  playerName: string;
  expected: {
    seedPoints: number;
    matchesWon: number;
    matchesPlayed: number;
  };
  actual: {
    seedPoints: number;
    matchesWon: number;
    matchesPlayed: number;
  };
  differences: {
    seedPoints: number;
    matchesWon: number;
    matchesPlayed: number;
  };
  duplicateCount: number;
}

async function auditTournamentData() {
  try {
    console.log('🔍 Starting tournament data audit...\n');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Find duplicate SeedingPoint records
    console.log('📊 Step 1: Analyzing SeedingPoint records for duplicates...');

    const seedingPoints = await SeedingPoint.find({
      tournamentId: { $exists: true },
      matchIndex: { $exists: true },
      playerId: { $exists: true }
    }).sort({ createdAt: 1 });

    console.log(`   Total tournament-related SeedingPoint records: ${seedingPoints.length}`);

    // Group by (tournamentId, matchIndex, playerId)
    const groupMap = new Map<string, DuplicateGroup>();

    for (const point of seedingPoints) {
      const key = `${point.tournamentId}_${point.matchIndex}_${point.playerId}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          tournamentId: point.tournamentId as string,
          matchIndex: point.matchIndex as number,
          playerId: point.playerId as string,
          count: 0,
          points: [],
          createdAts: [],
          recordIds: []
        });
      }

      const group = groupMap.get(key)!;
      group.count++;
      group.points.push(point.points);
      group.createdAts.push(point.createdAt);
      group.recordIds.push(point._id.toString());
    }

    // Find duplicates (count > 1)
    const duplicates = Array.from(groupMap.values()).filter(g => g.count > 1);
    console.log(`   Found ${duplicates.length} duplicate groups\n`);

    if (duplicates.length > 0) {
      console.log('   Top 10 duplicate groups:');
      duplicates.slice(0, 10).forEach((dup, idx) => {
        console.log(`   ${idx + 1}. Tournament: ${dup.tournamentId.substring(0, 8)}..., Match: ${dup.matchIndex}, Player: ${dup.playerId.substring(0, 8)}..., Count: ${dup.count}`);
      });
      console.log();
    }

    // Step 2: Calculate expected vs actual stats for each player
    console.log('📊 Step 2: Comparing Player stats with SeedingPoint data...');

    const players = await Player.find({});
    console.log(`   Total players in system: ${players.length}`);

    const mismatches: PlayerMismatch[] = [];
    let validCount = 0;

    for (const player of players) {
      // Get all non-reversed tournament SeedingPoints for this player
      const playerPoints = await SeedingPoint.find({
        playerId: player._id,
        tournamentId: { $exists: true },
        matchIndex: { $exists: true },
        reversedAt: { $exists: false }
      });

      if (playerPoints.length === 0) {
        // Player has no tournament points, should have 0 stats
        if (player.seedPoints === 0 && player.matchesWon === 0 && player.matchesPlayed === 0) {
          validCount++;
          continue;
        }
      }

      // Calculate expected stats from unique matches
      const uniqueMatches = new Map<string, any>();
      let totalPoints = 0;

      for (const point of playerPoints) {
        const matchKey = `${point.tournamentId}_${point.matchIndex}`;

        // Only count each match once
        if (!uniqueMatches.has(matchKey)) {
          uniqueMatches.set(matchKey, {
            points: point.points,
            isWinner: point.isWinner
          });
        }

        // Sum all points (includes duplicates for now)
        totalPoints += point.points;
      }

      // Expected stats from unique matches
      const expectedMatchesPlayed = uniqueMatches.size;
      const expectedMatchesWon = Array.from(uniqueMatches.values()).filter(m => m.isWinner).length;
      const expectedPoints = Array.from(uniqueMatches.values()).reduce((sum, m) => sum + m.points, 0);

      // Actual stats from Player model
      const actualPoints = player.seedPoints || 0;
      const actualMatchesWon = player.matchesWon || 0;
      const actualMatchesPlayed = player.matchesPlayed || 0;

      // Check for mismatches
      const hasMismatch =
        expectedPoints !== actualPoints ||
        expectedMatchesWon !== actualMatchesWon ||
        expectedMatchesPlayed !== actualMatchesPlayed;

      if (hasMismatch) {
        // Count duplicates affecting this player
        const playerDuplicateKeys = Array.from(groupMap.values())
          .filter(g => g.playerId === player._id.toString() && g.count > 1);

        mismatches.push({
          playerId: player._id.toString(),
          playerName: player.fullName,
          expected: {
            seedPoints: expectedPoints,
            matchesWon: expectedMatchesWon,
            matchesPlayed: expectedMatchesPlayed
          },
          actual: {
            seedPoints: actualPoints,
            matchesWon: actualMatchesWon,
            matchesPlayed: actualMatchesPlayed
          },
          differences: {
            seedPoints: actualPoints - expectedPoints,
            matchesWon: actualMatchesWon - expectedMatchesWon,
            matchesPlayed: actualMatchesPlayed - expectedMatchesPlayed
          },
          duplicateCount: playerDuplicateKeys.reduce((sum, k) => sum + (k.count - 1), 0)
        });
      } else {
        validCount++;
      }
    }

    console.log(`   Players with correct stats: ${validCount}`);
    console.log(`   Players with mismatched stats: ${mismatches.length}\n`);

    // Step 3: Generate detailed report
    console.log('📊 Step 3: Generating audit report...');

    const reportData = {
      auditDate: new Date().toISOString(),
      summary: {
        totalPlayers: players.length,
        playersWithCorrectStats: validCount,
        playersWithMismatchedStats: mismatches.length,
        totalSeedingPoints: seedingPoints.length,
        duplicateGroups: duplicates.length,
        totalDuplicateRecords: duplicates.reduce((sum, d) => sum + (d.count - 1), 0)
      },
      duplicates: duplicates.map(d => ({
        tournamentId: d.tournamentId,
        matchIndex: d.matchIndex,
        playerId: d.playerId,
        duplicateCount: d.count,
        points: d.points,
        createdAts: d.createdAts.map(d => d.toISOString()),
        recordIds: d.recordIds
      })),
      mismatches: mismatches.map(m => ({
        playerId: m.playerId,
        playerName: m.playerName,
        expectedSeedPoints: m.expected.seedPoints,
        actualSeedPoints: m.actual.seedPoints,
        pointsDifference: m.differences.seedPoints,
        expectedMatchesWon: m.expected.matchesWon,
        actualMatchesWon: m.actual.matchesWon,
        winsDifference: m.differences.matchesWon,
        expectedMatchesPlayed: m.expected.matchesPlayed,
        actualMatchesPlayed: m.actual.matchesPlayed,
        playedDifference: m.differences.matchesPlayed,
        duplicateCount: m.duplicateCount
      }))
    };

    // Save report as JSON
    const reportPath = path.resolve(__dirname, '../../backups/audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`   ✅ Saved detailed JSON report: ${reportPath}`);

    // Save report as CSV for easier viewing
    const csvPath = path.resolve(__dirname, '../../backups/audit-report.csv');
    const csvLines = [
      'Player ID,Player Name,Expected Points,Actual Points,Diff Points,Expected Wins,Actual Wins,Diff Wins,Expected Played,Actual Played,Diff Played,Duplicate Count',
      ...mismatches.map(m =>
        `${m.playerId},${m.playerName},${m.expected.seedPoints},${m.actual.seedPoints},${m.differences.seedPoints},${m.expected.matchesWon},${m.actual.matchesWon},${m.differences.matchesWon},${m.expected.matchesPlayed},${m.actual.matchesPlayed},${m.differences.matchesPlayed},${m.duplicateCount}`
      )
    ];
    fs.writeFileSync(csvPath, csvLines.join('\n'));
    console.log(`   ✅ Saved CSV report: ${csvPath}\n`);

    // Step 4: Create database backup
    console.log('📦 Step 4: Creating database backup...');

    const backupData = {
      backupDate: new Date().toISOString(),
      seedingPoints: await SeedingPoint.find({}),
      players: await Player.find({}),
      tournaments: await Tournament.find({})
    };

    const backupPath = path.resolve(__dirname, `../../backups/pre-cleanup-backup_${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`   ✅ Saved database backup: ${backupPath}\n`);

    // Step 5: Summary
    console.log('=' .repeat(80));
    console.log('AUDIT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Players:                    ${players.length}`);
    console.log(`Players with Correct Stats:       ${validCount} (${((validCount / players.length) * 100).toFixed(1)}%)`);
    console.log(`Players with Mismatched Stats:    ${mismatches.length} (${((mismatches.length / players.length) * 100).toFixed(1)}%)`);
    console.log(`Total SeedingPoint Records:       ${seedingPoints.length}`);
    console.log(`Duplicate Groups Found:           ${duplicates.length}`);
    console.log(`Extra Duplicate Records:          ${duplicates.reduce((sum, d) => sum + (d.count - 1), 0)}`);
    console.log('='.repeat(80));

    if (mismatches.length > 0) {
      console.log('\nTop 10 Players with Largest Mismatches:');
      const sortedMismatches = [...mismatches].sort((a, b) =>
        Math.abs(b.differences.seedPoints) - Math.abs(a.differences.seedPoints)
      );
      sortedMismatches.slice(0, 10).forEach((m, idx) => {
        console.log(`${idx + 1}. ${m.playerName}`);
        console.log(`   Expected: ${m.expected.seedPoints} pts, ${m.expected.matchesWon}/${m.expected.matchesPlayed} W/L`);
        console.log(`   Actual:   ${m.actual.seedPoints} pts, ${m.actual.matchesWon}/${m.actual.matchesPlayed} W/L`);
        console.log(`   Diff:     ${m.differences.seedPoints > 0 ? '+' : ''}${m.differences.seedPoints} pts, ${m.differences.matchesWon > 0 ? '+' : ''}${m.differences.matchesWon} wins, ${m.differences.matchesPlayed > 0 ? '+' : ''}${m.differences.matchesPlayed} played`);
        console.log(`   Duplicates: ${m.duplicateCount}`);
      });
    }

    console.log('\n✅ Audit complete! Review the reports before running cleanup.');
    console.log(`   JSON Report: ${reportPath}`);
    console.log(`   CSV Report:  ${csvPath}`);
    console.log(`   Backup:      ${backupPath}`);

  } catch (error) {
    console.error('❌ Error during audit:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the audit
auditTournamentData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

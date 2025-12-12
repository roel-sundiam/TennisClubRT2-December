import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Player from '../models/Player';
import Tournament from '../models/Tournament';
import SeedingPoint from '../models/SeedingPoint';
import { connectDatabase } from '../config/database';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

interface MigrationStats {
  usersConverted: number;
  tournamentsUpdated: number;
  seedingPointsUpdated: number;
  errors: string[];
}

/**
 * Migration script to convert Users to Players for tournament system
 *
 * This script:
 * 1. Creates Player records from all active Users
 * 2. Updates all Tournament match references (player1, player2, team1Player1, etc.)
 * 3. Migrates SeedingPoint records to reference players
 * 4. Creates a mapping file for rollback if needed
 */
async function migrateUsersToPlayers(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    usersConverted: 0,
    tournamentsUpdated: 0,
    seedingPointsUpdated: 0,
    errors: []
  };

  const userToPlayerMap = new Map<string, string>();

  try {
    console.log('🚀 Starting User to Player migration...\n');

    // Step 1: Create Player records from all active Users
    console.log('📋 Step 1: Converting Users to Players...');
    const users = await User.find({
      isActive: true,
      isApproved: true,
      role: { $in: ['member', 'admin', 'superadmin'] }
    });

    console.log(`   Found ${users.length} active users to convert`);

    for (const user of users) {
      try {
        // Check if player already exists with this linkedUserId
        const existingPlayer = await Player.findOne({ linkedUserId: user._id.toString() });

        if (existingPlayer) {
          console.log(`   ⏭️  Skipping ${user.fullName} - Player already exists`);
          userToPlayerMap.set(user._id.toString(), (existingPlayer._id as any).toString());
          continue;
        }

        const player = new Player({
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          gender: user.gender,
          seedPoints: user.seedPoints || 0,
          matchesWon: user.matchesWon || 0,
          matchesPlayed: user.matchesPlayed || 0,
          linkedUserId: user._id.toString(),
          isActive: true
        });

        await player.save();
        userToPlayerMap.set(user._id.toString(), (player._id as any).toString());
        stats.usersConverted++;

        console.log(`   ✅ Created Player for ${user.fullName} (User ID: ${user._id} → Player ID: ${player._id})`);
      } catch (error: any) {
        const errorMsg = `Failed to create player for user ${user._id}: ${error.message}`;
        console.error(`   ❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    console.log(`\n   📊 Converted ${stats.usersConverted} users to players\n`);

    // Step 2: Update all Tournament match references
    console.log('📋 Step 2: Updating Tournament match references...');
    const tournaments = await Tournament.find();
    console.log(`   Found ${tournaments.length} tournaments to check`);

    for (const tournament of tournaments) {
      let updated = false;

      for (const match of tournament.matches) {
        // Singles players
        if (match.player1 && userToPlayerMap.has(match.player1)) {
          match.player1 = userToPlayerMap.get(match.player1)!;
          updated = true;
        }
        if (match.player2 && userToPlayerMap.has(match.player2)) {
          match.player2 = userToPlayerMap.get(match.player2)!;
          updated = true;
        }

        // Doubles players
        if (match.team1Player1 && userToPlayerMap.has(match.team1Player1)) {
          match.team1Player1 = userToPlayerMap.get(match.team1Player1)!;
          updated = true;
        }
        if (match.team1Player2 && userToPlayerMap.has(match.team1Player2)) {
          match.team1Player2 = userToPlayerMap.get(match.team1Player2)!;
          updated = true;
        }
        if (match.team2Player1 && userToPlayerMap.has(match.team2Player1)) {
          match.team2Player1 = userToPlayerMap.get(match.team2Player1)!;
          updated = true;
        }
        if (match.team2Player2 && userToPlayerMap.has(match.team2Player2)) {
          match.team2Player2 = userToPlayerMap.get(match.team2Player2)!;
          updated = true;
        }

        // Winner (singles only - for doubles, winner is "team1" or "team2")
        if (match.matchType === 'singles' && match.winner && userToPlayerMap.has(match.winner)) {
          match.winner = userToPlayerMap.get(match.winner)!;
          updated = true;
        }
      }

      if (updated) {
        try {
          await tournament.save();
          stats.tournamentsUpdated++;
          console.log(`   ✅ Updated tournament: ${tournament.name} (${tournament.matches.length} matches)`);
        } catch (error: any) {
          const errorMsg = `Failed to update tournament ${tournament._id}: ${error.message}`;
          console.error(`   ❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }
    }

    console.log(`\n   📊 Updated ${stats.tournamentsUpdated} tournaments\n`);

    // Step 3: Migrate SeedingPoint records
    console.log('📋 Step 3: Migrating SeedingPoint records...');
    const seedingPoints = await SeedingPoint.find({
      source: 'tournament',
      userId: { $exists: true, $ne: null }
    });
    console.log(`   Found ${seedingPoints.length} tournament seeding points to migrate`);

    for (const point of seedingPoints) {
      if (point.userId && userToPlayerMap.has(point.userId)) {
        try {
          point.playerId = userToPlayerMap.get(point.userId)!;
          await point.save();
          stats.seedingPointsUpdated++;

          if (stats.seedingPointsUpdated % 10 === 0) {
            console.log(`   ⏳ Migrated ${stats.seedingPointsUpdated} seeding points...`);
          }
        } catch (error: any) {
          const errorMsg = `Failed to migrate seeding point ${point._id}: ${error.message}`;
          console.error(`   ❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }
    }

    console.log(`\n   📊 Migrated ${stats.seedingPointsUpdated} seeding points\n`);

    // Step 4: Save mapping for rollback
    console.log('📋 Step 4: Saving migration mapping...');
    const mappingFilePath = path.join(__dirname, '../../backups/user-to-player-migration-map.json');
    const mappingData = {
      timestamp: new Date().toISOString(),
      totalMappings: userToPlayerMap.size,
      mappings: Array.from(userToPlayerMap.entries()).map(([userId, playerId]) => ({
        userId,
        playerId
      }))
    };

    // Ensure backups directory exists
    await fs.mkdir(path.join(__dirname, '../../backups'), { recursive: true });
    await fs.writeFile(mappingFilePath, JSON.stringify(mappingData, null, 2));
    console.log(`   ✅ Mapping saved to: ${mappingFilePath}\n`);

    // Final summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📊 Users converted to Players: ${stats.usersConverted}`);
    console.log(`🏆 Tournaments updated: ${stats.tournamentsUpdated}`);
    console.log(`📈 Seeding points migrated: ${stats.seedingPointsUpdated}`);
    console.log(`❌ Errors encountered: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  ERRORS:');
      stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    return stats;

  } catch (error: any) {
    console.error('\n❌ FATAL ERROR during migration:', error);
    stats.errors.push(`Fatal error: ${error.message}`);
    throw error;
  }
}

/**
 * Rollback function to reverse the migration
 * WARNING: Only use this if migration needs to be reversed
 */
async function rollbackMigration(): Promise<void> {
  console.log('⚠️  Starting migration rollback...\n');

  try {
    // Load mapping file
    const mappingFilePath = path.join(__dirname, '../../backups/user-to-player-migration-map.json');
    const mappingContent = await fs.readFile(mappingFilePath, 'utf-8');
    const mappingData = JSON.parse(mappingContent);

    const playerToUserMap = new Map<string, string>();
    mappingData.mappings.forEach((m: any) => {
      playerToUserMap.set(m.playerId, m.userId);
    });

    console.log(`📋 Loaded ${playerToUserMap.size} mappings from backup\n`);

    // Reverse tournaments
    console.log('Reversing tournament updates...');
    const tournaments = await Tournament.find();
    let tournamentsReversed = 0;

    for (const tournament of tournaments) {
      let updated = false;

      for (const match of tournament.matches) {
        if (match.player1 && playerToUserMap.has(match.player1)) {
          match.player1 = playerToUserMap.get(match.player1)!;
          updated = true;
        }
        if (match.player2 && playerToUserMap.has(match.player2)) {
          match.player2 = playerToUserMap.get(match.player2)!;
          updated = true;
        }
        if (match.team1Player1 && playerToUserMap.has(match.team1Player1)) {
          match.team1Player1 = playerToUserMap.get(match.team1Player1)!;
          updated = true;
        }
        if (match.team1Player2 && playerToUserMap.has(match.team1Player2)) {
          match.team1Player2 = playerToUserMap.get(match.team1Player2)!;
          updated = true;
        }
        if (match.team2Player1 && playerToUserMap.has(match.team2Player1)) {
          match.team2Player1 = playerToUserMap.get(match.team2Player1)!;
          updated = true;
        }
        if (match.team2Player2 && playerToUserMap.has(match.team2Player2)) {
          match.team2Player2 = playerToUserMap.get(match.team2Player2)!;
          updated = true;
        }
        if (match.matchType === 'singles' && match.winner && playerToUserMap.has(match.winner)) {
          match.winner = playerToUserMap.get(match.winner)!;
          updated = true;
        }
      }

      if (updated) {
        await tournament.save();
        tournamentsReversed++;
      }
    }

    console.log(`✅ Reversed ${tournamentsReversed} tournaments\n`);

    // Reverse seeding points
    console.log('Reversing seeding points...');
    const seedingPoints = await SeedingPoint.find({ playerId: { $exists: true, $ne: null } });
    let pointsReversed = 0;

    for (const point of seedingPoints) {
      if (point.playerId && playerToUserMap.has(point.playerId)) {
        point.userId = playerToUserMap.get(point.playerId)!;
        point.playerId = undefined;
        await point.save();
        pointsReversed++;
      }
    }

    console.log(`✅ Reversed ${pointsReversed} seeding points\n`);

    console.log('⚠️  NOTE: Player records were NOT deleted. Delete manually if needed.\n');
    console.log('✅ Rollback completed successfully\n');

  } catch (error: any) {
    console.error('❌ Error during rollback:', error);
    throw error;
  }
}

// Main execution
const run = async () => {
  try {
    // Check for rollback flag
    const isRollback = process.argv.includes('--rollback');

    await connectDatabase();
    console.log('✅ Connected to database\n');

    if (isRollback) {
      await rollbackMigration();
    } else {
      await migrateUsersToPlayers();
    }

    console.log('✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

run();

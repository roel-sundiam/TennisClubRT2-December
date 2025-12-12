import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import { connectDatabase } from '../config/database';

dotenv.config();

async function fixFailedMatches() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Find the Rich Town 2 tournament
    const tournament = await Tournament.findOne({
      name: /2nd Rich Town 2/i
    }).sort({ _id: -1 });

    if (!tournament) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    console.log(`📋 Tournament: ${tournament.name}\n`);

    // Find unprocessed matches
    const unprocessedMatches = tournament.matches.filter((match: any) => !match.pointsProcessed);

    if (unprocessedMatches.length === 0) {
      console.log('✅ All matches already processed!');
      process.exit(0);
    }

    console.log(`🔧 Processing ${unprocessedMatches.length} failed matches...\n`);

    let processed = 0;
    let errors = 0;

    for (let i = 0; i < unprocessedMatches.length; i++) {
      const match = unprocessedMatches[i];
      console.log(`\nMatch ${i + 1}:`);

      try {
        if (match.matchType === 'doubles') {
          // Get all 4 players
          const team1Player1 = await Player.findById(match.team1Player1);
          const team1Player2 = await Player.findById(match.team1Player2);
          const team2Player1 = await Player.findById(match.team2Player1);
          const team2Player2 = await Player.findById(match.team2Player2);

          if (!team1Player1 || !team1Player2 || !team2Player1 || !team2Player2) {
            console.log('  ❌ One or more players not found');
            errors++;
            continue;
          }

          console.log(`  Team 1: ${team1Player1.fullName} & ${team1Player2.fullName}`);
          console.log(`  Team 2: ${team2Player1.fullName} & ${team2Player2.fullName}`);
          console.log(`  Score: ${match.score}`);
          console.log(`  Winner: ${match.winner}`);

          // Determine winners and losers
          const team1Players = [team1Player1, team1Player2];
          const team2Players = [team2Player1, team2Player2];
          const winners = match.winner === 'team1' ? team1Players : team2Players;
          const losers = match.winner === 'team1' ? team2Players : team1Players;

          // Award points: winners get 5 points each, losers get 3 points each
          const winnerPoints = 5;
          const loserPoints = 3;

          // Award points to winners
          for (const player of winners) {
            const seedingPoint = new SeedingPoint({
              playerId: player._id,
              tournamentId: tournament._id,
              points: winnerPoints,
              description: `Won ${match.round} doubles match in ${tournament.name}`,
              source: 'tournament',
              isWinner: true
            });
            await seedingPoint.save();

            player.seedPoints += winnerPoints;
            player.matchesWon += 1;
            player.matchesPlayed += 1;
            await player.save();

            console.log(`  ✅ ${player.fullName}: +${winnerPoints} points (WIN)`);
          }

          // Award points to losers
          for (const player of losers) {
            const seedingPoint = new SeedingPoint({
              playerId: player._id,
              tournamentId: tournament._id,
              points: loserPoints,
              description: `Lost ${match.round} doubles match in ${tournament.name}`,
              source: 'tournament',
              isWinner: false
            });
            await seedingPoint.save();

            player.seedPoints += loserPoints;
            player.matchesPlayed += 1;
            await player.save();

            console.log(`  ✅ ${player.fullName}: +${loserPoints} points (LOSS)`);
          }

          // Mark match as processed
          match.pointsProcessed = true;
          processed++;

        } else {
          console.log('  ⚠️ Skipping singles match (not implemented in this script)');
        }
      } catch (error) {
        console.log(`  ❌ Error processing match: ${error}`);
        errors++;
      }
    }

    // Save tournament with updated pointsProcessed flags
    await tournament.save();

    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('✅ COMPLETED - Failed matches processed');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Successfully processed: ${processed}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Show updated rankings
    console.log('🏆 Updated Player Rankings:');
    const topPlayers = await Player.find()
      .sort({ seedPoints: -1 })
      .limit(15)
      .lean();

    topPlayers.forEach((player, index) => {
      console.log(`${index + 1}. ${player.fullName}: ${player.seedPoints} points`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixFailedMatches();

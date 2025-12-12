import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';
import { connectDatabase } from '../config/database';

dotenv.config();

async function processAllMatchesOnce() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Find the tournament
    const tournament = await Tournament.findOne({
      name: /2nd Rich Town 2/i
    });

    if (!tournament) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    console.log(`📋 Tournament: ${tournament.name}`);
    console.log(`🎾 Total Matches: ${tournament.matches.length}\n`);

    // Check if any matches are already processed
    const alreadyProcessed = tournament.matches.filter((m: any) => m.pointsProcessed).length;
    if (alreadyProcessed > 0) {
      console.log(`⚠️  WARNING: ${alreadyProcessed} matches are already marked as processed!`);
      console.log('Run resetTournamentPoints.ts first to start fresh.\n');
      process.exit(1);
    }

    console.log('🔧 Processing all 30 matches...\n');

    let processed = 0;
    let errors = 0;

    for (let i = 0; i < tournament.matches.length; i++) {
      const match = tournament.matches[i];

      try {
        if (match.matchType === 'doubles') {
          // Get all 4 players
          const team1Player1 = await Player.findById(match.team1Player1);
          const team1Player2 = await Player.findById(match.team1Player2);
          const team2Player1 = await Player.findById(match.team2Player1);
          const team2Player2 = await Player.findById(match.team2Player2);

          if (!team1Player1 || !team1Player2 || !team2Player1 || !team2Player2) {
            console.log(`  ❌ Match ${i + 1}: One or more players not found`);
            errors++;
            continue;
          }

          // Determine winners and losers
          const team1Players = [team1Player1, team1Player2];
          const team2Players = [team2Player1, team2Player2];
          const winners = match.winner === 'team1' ? team1Players : team2Players;
          const losers = match.winner === 'team1' ? team2Players : team1Players;

          // Parse score to determine points based on games won
          const scoreParts = match.score.split('-').map(s => parseInt(s.trim()));
          const team1Score = scoreParts[0] || 0;
          const team2Score = scoreParts[1] || 0;

          const winnerPoints = Math.max(team1Score, team2Score);
          const loserPoints = Math.min(team1Score, team2Score);

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
          }

          // Award points to losers (only if they scored games)
          if (loserPoints > 0) {
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
            }
          } else {
            // No points awarded, but still count match played
            for (const player of losers) {
              player.matchesPlayed += 1;
              await player.save();
            }
          }

          // Mark match as processed
          match.pointsProcessed = true;
          processed++;

          if ((i + 1) % 5 === 0) {
            console.log(`  ✅ Processed ${i + 1}/${tournament.matches.length} matches...`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Match ${i + 1}: Error - ${error}`);
        errors++;
      }
    }

    // Save tournament with updated pointsProcessed flags
    await tournament.save();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ COMPLETED - All matches processed');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Successfully processed: ${processed}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Show final rankings
    console.log('🏆 Final Player Rankings:\n');
    const topPlayers = await Player.find()
      .sort({ seedPoints: -1 })
      .limit(20)
      .lean();

    topPlayers.forEach((player, index) => {
      const winRate = player.matchesPlayed > 0
        ? Math.round((player.matchesWon / player.matchesPlayed) * 100)
        : 0;
      console.log(`${index + 1}. ${player.fullName}: ${player.seedPoints} pts (${player.matchesWon}W/${player.matchesPlayed}P - ${winRate}%)`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

processAllMatchesOnce();

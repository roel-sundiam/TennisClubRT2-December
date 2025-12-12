import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';

dotenv.config();

async function verifyAllPlayerMatches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB\n');

    // Get all players
    const players = await Player.find({}).lean();
    console.log(`Total players in database: ${players.length}\n`);

    // Get all tournaments
    const tournaments = await Tournament.find({}).lean();
    console.log(`Total tournaments: ${tournaments.length}\n`);

    // Track match counts per player
    const actualMatchCounts = new Map<string, { won: number, played: number, name: string }>();

    // Initialize all players
    players.forEach(player => {
      actualMatchCounts.set(player._id.toString(), {
        won: 0,
        played: 0,
        name: player.fullName || player.username || 'Unknown'
      });
    });

    // Count matches from tournaments
    for (const tournament of tournaments) {
      const matches = tournament.matches || [];

      for (const match of matches) {
        if (!match.pointsProcessed) continue; // Only count processed matches

        if (match.matchType === 'singles') {
          const player1Id = match.player1?.toString();
          const player2Id = match.player2?.toString();

          if (player1Id && actualMatchCounts.has(player1Id)) {
            actualMatchCounts.get(player1Id)!.played++;
            if (match.winner === 'player1') {
              actualMatchCounts.get(player1Id)!.won++;
            }
          }

          if (player2Id && actualMatchCounts.has(player2Id)) {
            actualMatchCounts.get(player2Id)!.played++;
            if (match.winner === 'player2') {
              actualMatchCounts.get(player2Id)!.won++;
            }
          }
        } else if (match.matchType === 'doubles') {
          const team1Player1Id = match.team1Player1?.toString();
          const team1Player2Id = match.team1Player2?.toString();
          const team2Player1Id = match.team2Player1?.toString();
          const team2Player2Id = match.team2Player2?.toString();

          const allPlayerIds = [team1Player1Id, team1Player2Id, team2Player1Id, team2Player2Id];

          for (const playerId of allPlayerIds) {
            if (playerId && actualMatchCounts.has(playerId)) {
              actualMatchCounts.get(playerId)!.played++;

              if (
                (match.winner === 'team1' && (playerId === team1Player1Id || playerId === team1Player2Id)) ||
                (match.winner === 'team2' && (playerId === team2Player1Id || playerId === team2Player2Id))
              ) {
                actualMatchCounts.get(playerId)!.won++;
              }
            }
          }
        }
      }
    }

    // Compare with database records
    console.log('=== Player Match Count Verification ===\n');

    const mismatches: any[] = [];
    const correct: any[] = [];

    for (const player of players) {
      const playerId = player._id.toString();
      const actual = actualMatchCounts.get(playerId);
      const recorded = {
        won: player.matchesWon || 0,
        played: player.matchesPlayed || 0
      };

      if (!actual) continue;

      const hasPlayedMatches = actual.played > 0 || recorded.played > 0;

      if (actual.played !== recorded.played || actual.won !== recorded.won) {
        mismatches.push({
          name: actual.name,
          recordedPlayed: recorded.played,
          actualPlayed: actual.played,
          recordedWon: recorded.won,
          actualWon: actual.won,
          playedDiff: actual.played - recorded.played,
          wonDiff: actual.won - recorded.won
        });
      } else if (hasPlayedMatches) {
        correct.push({
          name: actual.name,
          played: actual.played,
          won: actual.won
        });
      }
    }

    // Display mismatches
    if (mismatches.length > 0) {
      console.log(`⚠️  Found ${mismatches.length} players with mismatched stats:\n`);

      mismatches.sort((a, b) => Math.abs(b.playedDiff) - Math.abs(a.playedDiff));

      for (const mismatch of mismatches) {
        console.log(`${mismatch.name}:`);
        console.log(`  Matches Played: ${mismatch.recordedPlayed} (recorded) vs ${mismatch.actualPlayed} (actual) [Diff: ${mismatch.playedDiff > 0 ? '+' : ''}${mismatch.playedDiff}]`);
        console.log(`  Matches Won: ${mismatch.recordedWon} (recorded) vs ${mismatch.actualWon} (actual) [Diff: ${mismatch.wonDiff > 0 ? '+' : ''}${mismatch.wonDiff}]`);
        console.log('');
      }
    } else {
      console.log('✅ All players have correct match counts!\n');
    }

    // Display correct stats summary
    if (correct.length > 0) {
      console.log(`✅ ${correct.length} players with correct stats (who have played matches):\n`);
      correct.sort((a, b) => b.played - a.played);
      for (const player of correct.slice(0, 10)) {
        console.log(`  ${player.name}: ${player.won}W - ${player.played}P`);
      }
      if (correct.length > 10) {
        console.log(`  ... and ${correct.length - 10} more`);
      }
      console.log('');
    }

    // Summary
    console.log('=== Summary ===');
    console.log(`Total Players: ${players.length}`);
    console.log(`Players with Matches: ${mismatches.length + correct.length}`);
    console.log(`Correct: ${correct.length}`);
    console.log(`Mismatched: ${mismatches.length}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyAllPlayerMatches();

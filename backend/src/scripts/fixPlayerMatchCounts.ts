import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';

dotenv.config();

async function fixPlayerMatchCounts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB\n');

    // Get all players
    const players = await Player.find({}).lean();
    console.log(`Total players: ${players.length}\n`);

    // Get all tournaments
    const tournaments = await Tournament.find({}).lean();

    // Track match counts per player
    const matchCounts = new Map<string, { won: number, played: number, name: string }>();

    // Initialize all players
    players.forEach(player => {
      matchCounts.set(player._id.toString(), {
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

          if (player1Id && matchCounts.has(player1Id)) {
            matchCounts.get(player1Id)!.played++;
            if (match.winner === 'player1') {
              matchCounts.get(player1Id)!.won++;
            }
          }

          if (player2Id && matchCounts.has(player2Id)) {
            matchCounts.get(player2Id)!.played++;
            if (match.winner === 'player2') {
              matchCounts.get(player2Id)!.won++;
            }
          }
        } else if (match.matchType === 'doubles') {
          const team1Player1Id = match.team1Player1?.toString();
          const team1Player2Id = match.team1Player2?.toString();
          const team2Player1Id = match.team2Player1?.toString();
          const team2Player2Id = match.team2Player2?.toString();

          const allPlayerIds = [team1Player1Id, team1Player2Id, team2Player1Id, team2Player2Id];

          for (const playerId of allPlayerIds) {
            if (playerId && matchCounts.has(playerId)) {
              matchCounts.get(playerId)!.played++;

              if (
                (match.winner === 'team1' && (playerId === team1Player1Id || playerId === team1Player2Id)) ||
                (match.winner === 'team2' && (playerId === team2Player1Id || playerId === team2Player2Id))
              ) {
                matchCounts.get(playerId)!.won++;
              }
            }
          }
        }
      }
    }

    // Update all players
    console.log('=== Updating Player Match Counts ===\n');

    let updated = 0;
    const updates: any[] = [];

    for (const [playerId, counts] of matchCounts.entries()) {
      const player = await Player.findById(playerId);

      if (!player) continue;

      const oldPlayed = player.matchesPlayed || 0;
      const oldWon = player.matchesWon || 0;

      if (oldPlayed !== counts.played || oldWon !== counts.won) {
        player.matchesPlayed = counts.played;
        player.matchesWon = counts.won;
        await player.save();

        updates.push({
          name: counts.name,
          oldPlayed,
          newPlayed: counts.played,
          oldWon,
          newWon: counts.won
        });
        updated++;
      }
    }

    // Display updates
    if (updates.length > 0) {
      console.log(`✅ Updated ${updated} players:\n`);
      updates.forEach(update => {
        console.log(`${update.name}:`);
        console.log(`  Played: ${update.oldPlayed} → ${update.newPlayed}`);
        console.log(`  Won: ${update.oldWon} → ${update.newWon}`);
        console.log('');
      });
    } else {
      console.log('✅ All players already have correct match counts!');
    }

    console.log(`\n✅ Process complete. Updated ${updated} players.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixPlayerMatchCounts();

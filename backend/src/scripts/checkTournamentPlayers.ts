import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import { connectDatabase } from '../config/database';

dotenv.config();

async function checkTournamentPlayers() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Find tournament with "test 1" in name
    const tournaments = await Tournament.find({
      name: { $regex: /test.*1/i }
    }).lean();

    if (tournaments.length === 0) {
      console.log('❌ No tournament found with "test 1" in name');

      // Show all tournaments
      const allTournaments = await Tournament.find().select('name date').lean();
      console.log('\n📋 Available tournaments:');
      allTournaments.forEach(t => {
        console.log(`  - ${t.name} (${new Date(t.date).toLocaleDateString()})`);
      });

      process.exit(0);
    }

    const tournament = tournaments[0];
    console.log(`📋 Tournament: ${tournament.name}`);
    console.log(`📅 Date: ${new Date(tournament.date).toLocaleDateString()}`);
    console.log(`🎾 Total Matches: ${tournament.matches?.length || 0}\n`);

    if (!tournament.matches || tournament.matches.length === 0) {
      console.log('❌ No matches in this tournament');
      process.exit(0);
    }

    // Collect all player IDs from matches
    const playerIds = new Set<string>();

    tournament.matches.forEach((match: any) => {
      if (match.player1) playerIds.add(match.player1);
      if (match.player2) playerIds.add(match.player2);
      if (match.team1Player1) playerIds.add(match.team1Player1);
      if (match.team1Player2) playerIds.add(match.team1Player2);
      if (match.team2Player1) playerIds.add(match.team2Player1);
      if (match.team2Player2) playerIds.add(match.team2Player2);
    });

    console.log(`👥 Unique player IDs in tournament: ${playerIds.size}\n`);

    // Look up player names
    const players = await Player.find({
      _id: { $in: Array.from(playerIds) }
    }).lean();

    const playerMap = new Map(players.map(p => [p._id.toString(), p]));

    console.log('🎯 Players in tournament:');
    playerIds.forEach(id => {
      const player = playerMap.get(id.toString());
      if (player) {
        console.log(`  ✅ ${player.fullName} (ID: ${id}) - ${player.seedPoints} points`);
      } else {
        console.log(`  ❌ Player ID ${id} not found in Player collection`);
      }
    });

    // Check specifically for Christine Cruz and Noreen Munoz
    console.log('\n🔍 Searching for Christine Cruz and Noreen Munoz:');
    const christine = await Player.findOne({ fullName: /christine.*cruz/i }).lean();
    const noreen = await Player.findOne({ fullName: /noreen.*munoz/i }).lean();

    if (christine) {
      console.log(`  Christine Cruz: ID ${christine._id}, ${christine.seedPoints} points`);
      const inTournament = playerIds.has(christine._id.toString());
      console.log(`    In tournament: ${inTournament ? 'YES ✅' : 'NO ❌'}`);
    } else {
      console.log('  Christine Cruz: NOT FOUND in Player collection');
    }

    if (noreen) {
      console.log(`  Noreen Munoz: ID ${noreen._id}, ${noreen.seedPoints} points`);
      const inTournament = playerIds.has(noreen._id.toString());
      console.log(`    In tournament: ${inTournament ? 'YES ✅' : 'NO ❌'}`);
    } else {
      console.log('  Noreen Munoz: NOT FOUND in Player collection');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTournamentPlayers();

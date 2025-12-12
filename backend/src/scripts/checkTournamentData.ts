import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import { connectDatabase } from '../config/database';

dotenv.config();

async function checkTournamentData() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Get first tournament
    const tournament = await Tournament.findOne().lean();

    if (!tournament) {
      console.log('❌ No tournaments found in database');
      process.exit(0);
    }

    console.log('📋 Tournament:', tournament.name);
    console.log('📅 Date:', tournament.date);
    console.log('🎾 Matches:', tournament.matches?.length || 0);

    if (tournament.matches && tournament.matches.length > 0) {
      const firstMatch = tournament.matches[0];
      console.log('\n🔍 First Match:');
      console.log('  Type:', firstMatch.matchType);
      console.log('  Round:', firstMatch.round);

      if (firstMatch.matchType === 'singles') {
        console.log('  Player1 ID:', firstMatch.player1);
        console.log('  Player2 ID:', firstMatch.player2);

        // Try to find these IDs in Players collection
        const p1 = await Player.findById(firstMatch.player1);
        const p2 = await Player.findById(firstMatch.player2);

        console.log('  Player1 in DB:', p1 ? `✅ ${p1.fullName}` : '❌ NOT FOUND');
        console.log('  Player2 in DB:', p2 ? `✅ ${p2.fullName}` : '❌ NOT FOUND');
      } else {
        console.log('  Team1Player1 ID:', firstMatch.team1Player1);
        console.log('  Team1Player2 ID:', firstMatch.team1Player2);
        console.log('  Team2Player1 ID:', firstMatch.team2Player1);
        console.log('  Team2Player2 ID:', firstMatch.team2Player2);

        // Try to find these IDs in Players collection
        const t1p1 = await Player.findById(firstMatch.team1Player1);
        const t1p2 = await Player.findById(firstMatch.team1Player2);
        const t2p1 = await Player.findById(firstMatch.team2Player1);
        const t2p2 = await Player.findById(firstMatch.team2Player2);

        console.log('  Team1Player1 in DB:', t1p1 ? `✅ ${t1p1.fullName}` : '❌ NOT FOUND');
        console.log('  Team1Player2 in DB:', t1p2 ? `✅ ${t1p2.fullName}` : '❌ NOT FOUND');
        console.log('  Team2Player1 in DB:', t2p1 ? `✅ ${t2p1.fullName}` : '❌ NOT FOUND');
        console.log('  Team2Player2 in DB:', t2p2 ? `✅ ${t2p2.fullName}` : '❌ NOT FOUND');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTournamentData();

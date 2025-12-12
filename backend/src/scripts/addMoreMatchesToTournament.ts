import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import { connectDatabase } from '../config/database';

dotenv.config();

async function addMoreMatchesToTournament() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Find the Rich Town 2 tournament
    const tournament = await Tournament.findOne({
      name: /2nd Rich Town 2/i
    });

    if (!tournament) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    console.log(`📋 Tournament: ${tournament.name}`);
    console.log(`🎾 Current matches: ${tournament.matches.length}\n`);

    // Map screenshot names to full database names
    const playerNameMap: { [key: string]: string } = {
      'Pat': 'Pat Pineda',
      'Hala': 'Hala Riva',
      'Trina': 'Trina Sevilla',
      'Ruth': 'Ruth Barrera',
      'Andrea': 'Andrea Henson',
      'Reianne': 'Reianne Chavez',
      'Rose': 'Rose Cortez',
      'Tel': 'Tel Cruz',
      'Pam': 'Pam Asuncion',
      'Keith': 'Keith Angela',
      'CJ': 'CJ Yu',
      'Mishka': 'Mishka Alcantara'
    };

    console.log('🔍 Looking up players...');
    const players = await Player.find({
      fullName: { $in: Object.values(playerNameMap) }
    }).lean();

    // Create a map for easy lookup by short name
    const playerMap = new Map<string, any>();
    players.forEach(player => {
      const shortName = Object.keys(playerNameMap).find(
        key => playerNameMap[key] === player.fullName
      );
      if (shortName) {
        playerMap.set(shortName.toLowerCase(), player);
        console.log(`  ✅ Found: ${player.fullName} (${player._id})`);
      }
    });

    console.log('');

    // Helper function to get player ID
    const getPlayerId = (firstName: string): string => {
      const player = playerMap.get(firstName.toLowerCase());
      if (!player) {
        throw new Error(`Player not found: ${firstName}`);
      }
      return player._id.toString();
    };

    // Define all matches from the new tournament bracket
    const matches = [
      // Row 1: Pat & Hala matches
      { team1: ['Pat', 'Hala'], team2: ['Trina', 'Ruth'], score: '4-0', winner: 'team1' },
      { team1: ['Pat', 'Hala'], team2: ['Andrea', 'Reianne'], score: '3-4', winner: 'team2' },
      { team1: ['Pat', 'Hala'], team2: ['Rose', 'Tel'], score: '2-4', winner: 'team2' },
      { team1: ['Pat', 'Hala'], team2: ['Pam', 'Keith'], score: '3-4', winner: 'team2' },
      { team1: ['Pat', 'Hala'], team2: ['CJ', 'Mishka'], score: '1-4', winner: 'team2' },

      // Row 2: Trina & Ruth matches
      { team1: ['Trina', 'Ruth'], team2: ['Andrea', 'Reianne'], score: '0-4', winner: 'team2' },
      { team1: ['Trina', 'Ruth'], team2: ['Rose', 'Tel'], score: '4-3', winner: 'team1' },
      { team1: ['Trina', 'Ruth'], team2: ['Pam', 'Keith'], score: '2-4', winner: 'team2' },
      { team1: ['Trina', 'Ruth'], team2: ['CJ', 'Mishka'], score: '4-3', winner: 'team1' },

      // Row 3: Andrea & Reianne matches
      { team1: ['Andrea', 'Reianne'], team2: ['Rose', 'Tel'], score: '4-0', winner: 'team1' },
      { team1: ['Andrea', 'Reianne'], team2: ['Pam', 'Keith'], score: '3-4', winner: 'team2' },
      { team1: ['Andrea', 'Reianne'], team2: ['CJ', 'Mishka'], score: '2-4', winner: 'team2' },

      // Row 4: Rose & Tel matches
      { team1: ['Rose', 'Tel'], team2: ['Pam', 'Keith'], score: '0-4', winner: 'team2' },
      { team1: ['Rose', 'Tel'], team2: ['CJ', 'Mishka'], score: '0-4', winner: 'team2' },

      // Row 5: Pam & Keith matches
      { team1: ['Pam', 'Keith'], team2: ['CJ', 'Mishka'], score: '0-4', winner: 'team2' },
    ];

    console.log('📝 Adding matches to tournament...\n');

    // Convert matches to tournament format
    let addedCount = 0;
    for (const match of matches) {
      const team1Player1Id = getPlayerId(match.team1[0]);
      const team1Player2Id = getPlayerId(match.team1[1]);
      const team2Player1Id = getPlayerId(match.team2[0]);
      const team2Player2Id = getPlayerId(match.team2[1]);

      console.log(`✅ ${match.team1.join(' & ')} vs ${match.team2.join(' & ')} - ${match.score} - Winner: ${match.winner === 'team1' ? match.team1.join(' & ') : match.team2.join(' & ')}`);

      tournament.matches.push({
        matchType: 'doubles',
        team1Player1: team1Player1Id,
        team1Player2: team1Player2Id,
        team2Player1: team2Player1Id,
        team2Player2: team2Player2Id,
        score: match.score,
        winner: match.winner,
        round: 'Elimination',
        pointsProcessed: false
      } as any);

      addedCount++;
    }

    // Save the tournament with new matches
    await tournament.save();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Matches added successfully!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📋 Tournament: ${tournament.name}`);
    console.log(`➕ Matches added: ${addedCount}`);
    console.log(`🎾 Total matches now: ${tournament.matches.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('⚠️  Remember to click "Process Points" in the tournament management UI to calculate rankings for the new matches!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addMoreMatchesToTournament();

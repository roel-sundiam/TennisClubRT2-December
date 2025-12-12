import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import User from '../models/User';
import { connectDatabase } from '../config/database';

dotenv.config();

async function addRichTown2Tournament() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Get superadmin user for createdBy field
    const superadmin = await User.findOne({ role: 'superadmin' }).lean();
    if (!superadmin) {
      throw new Error('Superadmin user not found');
    }
    console.log(`👤 Using superadmin: ${superadmin._id}\n`);

    // Find all players - need to map screenshot names to full database names
    const playerNameMap: { [key: string]: string } = {
      'Daen': 'Daen Lim',
      'Cha': 'Cha Manabat',
      'Elyza': 'Elyza Manalac',
      'Helen': 'Helen Sundiam',
      'Noreen': 'Noreen Munoz',
      'Christine': 'Christine Cruz',
      'Antonnette': 'Antonnette Tayag',
      'Mika': 'Alyssa Mika Dianelo',
      'Pau': 'Paula Benilde Dungo',
      'Lea': 'Lea Nacu',
      'Tracy': 'Tracy Gomez-Talo',
      'Jhen': 'Jhen Cunanan'
    };

    console.log('🔍 Looking up players...');
    const players = await Player.find({
      fullName: { $in: Object.values(playerNameMap) }
    }).lean();

    // Create a map for easy lookup by short name
    const playerMap = new Map<string, any>();
    players.forEach(player => {
      // Find the short name that maps to this full name
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

    // Define all matches from the tournament bracket
    // Green cells with checkmarks are winners
    const matches = [
      // Row 1: Daen & Cha matches
      { team1: ['Daen', 'Cha'], team2: ['Elyza', 'Helen'], score: '0-4', winner: 'team2' },
      { team1: ['Daen', 'Cha'], team2: ['Noreen', 'Christine'], score: '2-4', winner: 'team2' },
      { team1: ['Daen', 'Cha'], team2: ['Antonnette', 'Mika'], score: '0-4', winner: 'team2' },
      { team1: ['Daen', 'Cha'], team2: ['Pau', 'Lea'], score: '1-4', winner: 'team2' },
      { team1: ['Daen', 'Cha'], team2: ['Tracy', 'Jhen'], score: '4-1', winner: 'team1' },

      // Row 2: Elyza & Helen matches (skip vs self)
      { team1: ['Elyza', 'Helen'], team2: ['Noreen', 'Christine'], score: '4-3', winner: 'team1' },
      { team1: ['Elyza', 'Helen'], team2: ['Antonnette', 'Mika'], score: '4-2', winner: 'team1' },
      { team1: ['Elyza', 'Helen'], team2: ['Pau', 'Lea'], score: '4-1', winner: 'team1' },
      { team1: ['Elyza', 'Helen'], team2: ['Tracy', 'Jhen'], score: '4-2', winner: 'team1' },

      // Row 3: Noreen & Christine matches
      { team1: ['Noreen', 'Christine'], team2: ['Antonnette', 'Mika'], score: '4-1', winner: 'team1' },
      { team1: ['Noreen', 'Christine'], team2: ['Pau', 'Lea'], score: '4-2', winner: 'team1' },
      { team1: ['Noreen', 'Christine'], team2: ['Tracy', 'Jhen'], score: '4-2', winner: 'team1' },

      // Row 4: Antonnette & Mika matches
      { team1: ['Antonnette', 'Mika'], team2: ['Pau', 'Lea'], score: '4-1', winner: 'team1' },
      { team1: ['Antonnette', 'Mika'], team2: ['Tracy', 'Jhen'], score: '4-1', winner: 'team1' },

      // Row 5: Pau & Lea matches
      { team1: ['Pau', 'Lea'], team2: ['Tracy', 'Jhen'], score: '2-4', winner: 'team2' },
    ];

    // Convert matches to tournament format
    const tournamentMatches = matches.map((match, index) => {
      const team1Player1Id = getPlayerId(match.team1[0]);
      const team1Player2Id = getPlayerId(match.team1[1]);
      const team2Player1Id = getPlayerId(match.team2[0]);
      const team2Player2Id = getPlayerId(match.team2[1]);

      console.log(`Match ${index + 1}: ${match.team1.join(' & ')} vs ${match.team2.join(' & ')} - Score: ${match.score} - Winner: ${match.winner === 'team1' ? match.team1.join(' & ') : match.team2.join(' & ')}`);

      return {
        matchType: 'doubles',
        team1Player1: team1Player1Id,
        team1Player2: team1Player2Id,
        team2Player1: team2Player1Id,
        team2Player2: team2Player2Id,
        score: match.score,
        winner: match.winner,
        round: 'Elimination',
        pointsProcessed: false
      };
    });

    // Create the tournament
    const tournament = new Tournament({
      name: '2nd Rich Town 2 Invitational Women\'s Doubles Tennis Tournament',
      date: new Date(), // Today's date
      status: 'completed',
      matches: tournamentMatches,
      createdBy: superadmin._id
    });

    await tournament.save();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Tournament created successfully!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📋 Tournament: ${tournament.name}`);
    console.log(`📅 Date: ${tournament.date.toLocaleDateString()}`);
    console.log(`🎾 Total Matches: ${tournament.matches.length}`);
    console.log(`🆔 Tournament ID: ${tournament._id}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('⚠️  Remember to click "Process Points" in the tournament management UI to calculate player rankings!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addRichTown2Tournament();

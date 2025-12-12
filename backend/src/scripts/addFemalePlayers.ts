import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Player from '../models/Player';
import { connectDatabase } from '../config/database';

dotenv.config();

const femalePlayers = [
  'Hala Riva',
  'Daen Lim',
  'Cha Manabat',
  'Noreen Munoz',
  'Christine Cruz',
  'Trina Sevilla',
  'Ruth Barrera',
  'Reianne Chavez',
  'Rose Cortez',
  'Tel Cruz',
  'Keith Angela',
  'Mishka Alcantara'
];

async function addFemalePlayers() {
  try {
    console.log('🚀 Starting to add female players...\n');

    await connectDatabase();
    console.log('✅ Connected to database\n');

    let added = 0;
    let skipped = 0;

    for (const fullName of femalePlayers) {
      try {
        // Check if player already exists
        const existingPlayer = await Player.findOne({ fullName });

        if (existingPlayer) {
          console.log(`⏭️  Skipping ${fullName} - already exists`);
          skipped++;
          continue;
        }

        // Create new player
        const player = new Player({
          fullName,
          gender: 'female',
          seedPoints: 0,
          matchesWon: 0,
          matchesPlayed: 0,
          isActive: true
        });

        await player.save();
        console.log(`✅ Added ${fullName}`);
        added++;

      } catch (error: any) {
        console.error(`❌ Failed to add ${fullName}:`, error.message);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ COMPLETED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Players added: ${added}`);
    console.log(`⏭️  Players skipped (already exist): ${skipped}`);
    console.log(`📊 Total players processed: ${femalePlayers.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addFemalePlayers();

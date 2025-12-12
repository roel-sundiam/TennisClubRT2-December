#!/usr/bin/env node

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

async function migrateTournamentsToCompleted() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    console.log(`📊 Connected to: ${db.databaseName}`);
    console.log('\n🔄 Migrating all draft tournaments to completed status...\n');

    // Find all tournaments with draft status
    const result = await db.collection('tournaments').updateMany(
      { status: 'draft' },
      { $set: { status: 'completed' } }
    );

    console.log(`✅ Migration complete!`);
    console.log(`   Tournaments updated: ${result.modifiedCount}`);
    console.log(`   Tournaments matched: ${result.matchedCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from database');
  }
}

migrateTournamentsToCompleted();

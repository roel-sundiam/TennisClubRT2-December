import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import { connectDatabase } from '../config/database';

dotenv.config();

async function removeCoinSystem() {
  try {
    await connectDatabase();
    console.log('🗑️  Starting coin system removal...');

    // 1. Drop CoinTransaction collection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const collections = await db.listCollections().toArray();
    const hasCoinTransactions = collections.some(c => c.name === 'cointransactions');

    if (hasCoinTransactions) {
      await db.dropCollection('cointransactions');
      console.log('✅ Dropped CoinTransaction collection');
    } else {
      console.log('ℹ️  CoinTransaction collection does not exist, skipping drop');
    }

    // 2. Remove coinBalance field from all users
    const result = await User.updateMany({}, { $unset: { coinBalance: "" } });
    console.log(`✅ Removed coinBalance from ${result.modifiedCount} users`);

    console.log('✅ Coin system removal complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

removeCoinSystem();

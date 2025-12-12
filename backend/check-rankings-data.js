require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkRankingsData() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    console.log('Connected to:', db.databaseName);
    console.log('\n=== CHECKING RANKINGS DATA ===\n');

    // Check players collection
    const playersCount = await db.collection('players').countDocuments();
    console.log(`Total players: ${playersCount}`);

    if (playersCount > 0) {
      const topPlayers = await db.collection('players')
        .find({})
        .sort({ seedPoints: -1 })
        .limit(5)
        .toArray();

      console.log('\nTop 5 players by seed points:');
      topPlayers.forEach((p, idx) => {
        console.log(`${idx + 1}. ${p.fullName} - ${p.seedPoints || 0} points`);
      });
    }

    // Check seeding points collection
    const seedingPointsCount = await db.collection('seedingpoints').countDocuments();
    console.log(`\nTotal seeding point records: ${seedingPointsCount}`);

    if (seedingPointsCount > 0) {
      const recentPoints = await db.collection('seedingpoints')
        .find({})
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray();

      console.log('\nMost recent seeding points:');
      recentPoints.forEach((sp, idx) => {
        console.log(`${idx + 1}. Player ID: ${sp.playerId || sp.userId} - ${sp.points} points`);
      });
    }

    // Check if players have required fields for rankings
    const playersWithPoints = await db.collection('players')
      .find({ seedPoints: { $gt: 0 } })
      .limit(5)
      .toArray();

    console.log(`\nPlayers with seed points > 0: ${playersWithPoints.length}`);

    // Check for any issues
    const playersWithoutNames = await db.collection('players')
      .countDocuments({ fullName: { $exists: false } });

    console.log(`\nPlayers without fullName: ${playersWithoutNames}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkRankingsData();

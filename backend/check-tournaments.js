require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkTournaments() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    console.log('Connected to:', db.databaseName);
    console.log('\n=== CHECKING TOURNAMENTS ===\n');

    // Get all tournaments
    const tournaments = await db.collection('tournaments')
      .find({})
      .toArray();

    console.log(`Total tournaments: ${tournaments.length}\n`);

    if (tournaments.length > 0) {
      console.log('Tournament status breakdown:');
      const statusCounts = {};
      tournaments.forEach(t => {
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      });

      Object.keys(statusCounts).forEach(status => {
        console.log(`  ${status}: ${statusCounts[status]}`);
      });

      console.log('\nFirst 3 tournaments:');
      tournaments.slice(0, 3).forEach((t, i) => {
        console.log(`\n${i + 1}. ${t.name}`);
        console.log(`   Status: ${t.status}`);
        console.log(`   Date: ${t.date}`);
        console.log(`   Matches: ${t.matches?.length || 0}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkTournaments();

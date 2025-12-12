require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkTournaments() {
  // Connect to PRODUCTION database (TennisClubRT2, not Test)
  const uri = process.env.MONGODB_URI.replace('TennisClubRT2_Test', 'TennisClubRT2');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    console.log('Connected to:', db.databaseName);
    console.log('\n=== CHECKING TOURNAMENTS IN PRODUCTION ===\n');

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

      console.log('\nAll tournaments:');
      tournaments.forEach((t, i) => {
        console.log(`\n${i + 1}. ${t.name}`);
        console.log(`   Status: ${t.status}`);
        console.log(`   Date: ${t.date}`);
        console.log(`   Matches: ${t.matches?.length || 0}`);
        console.log(`   ID: ${t._id}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkTournaments();

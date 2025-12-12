require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkTournaments() {
  const uri = process.env.MONGODB_URI; // Should be pointing to TennisClubRT2_Test
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    console.log('Connected to:', db.databaseName);
    console.log('\n=== CHECKING ALL TOURNAMENTS (ANY STATUS) ===\n');

    // Get ALL tournaments
    const allTournaments = await db.collection('tournaments')
      .find({})
      .toArray();

    console.log(`Total tournaments (all statuses): ${allTournaments.length}\n`);

    if (allTournaments.length > 0) {
      console.log('Tournament status breakdown:');
      const statusCounts = {};
      allTournaments.forEach(t => {
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      });

      Object.keys(statusCounts).forEach(status => {
        console.log(`  ${status}: ${statusCounts[status]}`);
      });

      console.log('\nAll tournaments:');
      allTournaments.forEach((t, i) => {
        console.log(`\n${i + 1}. ${t.name}`);
        console.log(`   Status: ${t.status}`);
        console.log(`   Date: ${t.date}`);
        console.log(`   Tier: ${t.tier || 'N/A'}`);
        console.log(`   Matches: ${t.matches?.length || 0}`);
        if (t.matches && t.matches.length > 0) {
          const processedMatches = t.matches.filter(m => m.pointsProcessed).length;
          console.log(`   Matches with points processed: ${processedMatches}/${t.matches.length}`);
        }
      });
    } else {
      console.log('❌ No tournaments found in the database!');
      console.log('\nLet me check the collection exists:');
      const collections = await db.listCollections().toArray();
      const tournamentCollection = collections.find(c => c.name === 'tournaments');
      if (tournamentCollection) {
        console.log('✅ tournaments collection exists');
      } else {
        console.log('❌ tournaments collection does NOT exist');
      }
    }

    // Also check completed tournaments specifically
    console.log('\n=== COMPLETED TOURNAMENTS ONLY ===\n');
    const completedTournaments = await db.collection('tournaments')
      .find({ status: 'completed' })
      .toArray();
    console.log(`Completed tournaments: ${completedTournaments.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkTournaments();

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function listDatabases() {
  const uri = process.env.MONGODB_URI.replace('TennisClubRT2_Test', 'TennisClubRT2');
  const client = new MongoClient(uri);

  try {
    await client.connect();

    console.log('=== LISTING ALL DATABASES ===\n');

    const adminDb = client.db().admin();
    const { databases } = await adminDb.listDatabases();

    databases.forEach(db => {
      console.log(`- ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    console.log('\n=== CHECKING TOURNAMENTS IN EACH TENNIS CLUB DATABASE ===\n');

    // Check TennisClubRT2
    const tennisDb = client.db('TennisClubRT2');
    const tournamentsCount = await tennisDb.collection('tournaments').countDocuments();
    console.log(`TennisClubRT2 - Tournaments: ${tournamentsCount}`);

    // Check TennisClubRT2_Test
    const testDb = client.db('TennisClubRT2_Test');
    const testTournamentsCount = await testDb.collection('tournaments').countDocuments();
    console.log(`TennisClubRT2_Test - Tournaments: ${testTournamentsCount}`);

    // Check for any other tennis-related databases
    for (const db of databases) {
      if (db.name.toLowerCase().includes('tennis') || db.name.toLowerCase().includes('app')) {
        const dbInstance = client.db(db.name);
        const count = await dbInstance.collection('tournaments').countDocuments();
        if (count > 0) {
          console.log(`\n✅ Found ${count} tournaments in: ${db.name}`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

listDatabases();

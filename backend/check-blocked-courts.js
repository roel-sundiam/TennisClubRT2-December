require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkBlockedCourts() {
  const prodUri = process.env.MONGODB_URI;
  const testUri = prodUri.replace('TennisClubRT2', 'TennisClubRT2_Test');

  const prodClient = new MongoClient(prodUri);
  const testClient = new MongoClient(testUri);

  try {
    await prodClient.connect();
    await testClient.connect();

    const prodDb = prodClient.db();
    const testDb = testClient.db();

    console.log('=== PRODUCTION DATABASE (TennisClubRT2) ===');
    const prodBlocked = await prodDb.collection('reservations')
      .find({ status: 'blocked' })
      .sort({ date: -1 })
      .limit(10)
      .toArray();

    console.log('Total blocked courts:', prodBlocked.length);
    if (prodBlocked.length > 0) {
      console.log('\nSample blocked court:');
      console.log(JSON.stringify(prodBlocked[0], null, 2));
    }

    console.log('\n=== TEST DATABASE (TennisClubRT2_Test) ===');
    const testBlocked = await testDb.collection('reservations')
      .find({ status: 'blocked' })
      .sort({ date: -1 })
      .limit(10)
      .toArray();

    console.log('Total blocked courts:', testBlocked.length);
    if (testBlocked.length > 0) {
      console.log('\nSample blocked court:');
      console.log(JSON.stringify(testBlocked[0], null, 2));
    }

    console.log('\n=== COMPARISON ===');
    console.log('Production blocked courts:', prodBlocked.length);
    console.log('Test blocked courts:', testBlocked.length);
    console.log('Match:', prodBlocked.length === testBlocked.length ? 'YES' : 'NO');

    // Check all reservation statuses in both
    console.log('\n=== ALL RESERVATION STATUSES ===');
    const prodStatuses = await prodDb.collection('reservations').distinct('status');
    const testStatuses = await testDb.collection('reservations').distinct('status');

    console.log('Production statuses:', prodStatuses);
    console.log('Test statuses:', testStatuses);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prodClient.close();
    await testClient.close();
  }
}

checkBlockedCourts();

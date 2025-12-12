require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkAllReservations() {
  const prodUri = process.env.MONGODB_URI;
  const testUri = prodUri.replace('TennisClubRT2', 'TennisClubRT2_Test');

  const prodClient = new MongoClient(prodUri);
  const testClient = new MongoClient(testUri);

  try {
    await prodClient.connect();
    await testClient.connect();

    const prodDb = prodClient.db();
    const testDb = testClient.db();

    // Check for December 10, 2025 reservations
    const targetDate = new Date('2025-12-10');
    console.log('Looking for date:', targetDate);

    console.log('\n=== PRODUCTION DATABASE (TennisClubRT2) ===');
    const prodReservations = await prodDb.collection('reservations')
      .find({
        date: {
          $gte: new Date('2025-12-10T00:00:00.000Z'),
          $lt: new Date('2025-12-11T00:00:00.000Z')
        }
      })
      .toArray();

    console.log('Total reservations on Dec 10, 2025:', prodReservations.length);
    if (prodReservations.length > 0) {
      prodReservations.forEach((res, idx) => {
        console.log(`\nReservation ${idx + 1}:`);
        console.log('  _id:', res._id);
        console.log('  date:', res.date);
        console.log('  timeSlot:', res.timeSlot);
        console.log('  duration:', res.duration);
        console.log('  status:', res.status);
        console.log('  blockReason:', res.blockReason);
        console.log('  blockNotes:', res.blockNotes);
      });
    }

    console.log('\n=== TEST DATABASE (TennisClubRT2_Test) ===');
    const testReservations = await testDb.collection('reservations')
      .find({
        date: {
          $gte: new Date('2025-12-10T00:00:00.000Z'),
          $lt: new Date('2025-12-11T00:00:00.000Z')
        }
      })
      .toArray();

    console.log('Total reservations on Dec 10, 2025:', testReservations.length);
    if (testReservations.length > 0) {
      testReservations.forEach((res, idx) => {
        console.log(`\nReservation ${idx + 1}:`);
        console.log('  _id:', res._id);
        console.log('  date:', res.date);
        console.log('  timeSlot:', res.timeSlot);
        console.log('  duration:', res.duration);
        console.log('  status:', res.status);
        console.log('  blockReason:', res.blockReason);
        console.log('  blockNotes:', res.blockNotes);
      });
    }

    // Check for ANY reservations with blockReason field
    console.log('\n=== CHECKING FOR ANY BLOCK REASONS ===');
    const prodWithBlockReason = await prodDb.collection('reservations')
      .find({ blockReason: { $exists: true } })
      .limit(5)
      .toArray();

    console.log('Production - Reservations with blockReason:', prodWithBlockReason.length);

    const testWithBlockReason = await testDb.collection('reservations')
      .find({ blockReason: { $exists: true } })
      .limit(5)
      .toArray();

    console.log('Test - Reservations with blockReason:', testWithBlockReason.length);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prodClient.close();
    await testClient.close();
  }
}

checkAllReservations();

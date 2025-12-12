require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

async function fixBlockedStatus() {
  // Connect to TEST database
  const uri = process.env.MONGODB_URI.replace('TennisClubRT2', 'TennisClubRT2_Test');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    console.log('Connected to: TennisClubRT2_Test');
    console.log('Finding reservations with blockReason but wrong status...\n');

    // Find all reservations that have blockReason but status is not 'blocked'
    const reservationsToFix = await db.collection('reservations')
      .find({
        blockReason: { $exists: true, $ne: null },
        status: { $ne: 'blocked' }
      })
      .toArray();

    console.log(`Found ${reservationsToFix.length} reservations to fix:\n`);

    if (reservationsToFix.length === 0) {
      console.log('No reservations need fixing!');
      return;
    }

    // Show what will be fixed
    for (const res of reservationsToFix) {
      console.log(`- ${res.date.toISOString().split('T')[0]} at ${res.timeSlot}:00`);
      console.log(`  Current status: ${res.status}`);
      console.log(`  Block reason: ${res.blockReason}`);
      console.log(`  Block notes: ${res.blockNotes || 'N/A'}`);
      console.log(`  Will change to: blocked\n`);
    }

    // Update all to status: 'blocked'
    const result = await db.collection('reservations').updateMany(
      {
        blockReason: { $exists: true, $ne: null },
        status: { $ne: 'blocked' }
      },
      {
        $set: { status: 'blocked' }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} reservation(s) to status='blocked'`);

    // Verify the fix
    const verified = await db.collection('reservations')
      .find({ status: 'blocked' })
      .toArray();

    console.log(`\n✅ Total blocked reservations now: ${verified.length}`);

    if (verified.length > 0) {
      console.log('\nBlocked reservations:');
      verified.forEach(v => {
        console.log(`- ${v.date.toISOString().split('T')[0]} ${v.timeSlot}:00-${v.endTimeSlot}:00 (${v.blockReason})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixBlockedStatus();

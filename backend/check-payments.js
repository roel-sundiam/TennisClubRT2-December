require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkPayments() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    console.log('Connected to:', db.databaseName);
    console.log('\n=== CHECKING PAYMENTS ===\n');

    // Get all payments
    const allPayments = await db.collection('payments').find({}).toArray();
    console.log(`Total payments: ${allPayments.length}\n`);

    if (allPayments.length > 0) {
      // Group by type/description
      const typeBreakdown = {};
      allPayments.forEach(p => {
        const key = p.type || (p.description?.includes('membership') ? 'membership' : 'other');
        typeBreakdown[key] = (typeBreakdown[key] || 0) + 1;
      });

      console.log('Payment breakdown:');
      Object.keys(typeBreakdown).forEach(type => {
        console.log(`  ${type}: ${typeBreakdown[type]}`);
      });

      // Check for membership payments specifically
      const membershipPayments = allPayments.filter(p =>
        p.type === 'membership' ||
        p.description?.toLowerCase().includes('membership')
      );

      console.log(`\nMembership payments: ${membershipPayments.length}`);

      if (membershipPayments.length > 0) {
        console.log('\nFirst 5 membership payments:');
        membershipPayments.slice(0, 5).forEach((p, idx) => {
          console.log(`\n${idx + 1}.`);
          console.log(`   ID: ${p._id}`);
          console.log(`   User ID: ${p.userId}`);
          console.log(`   Amount: ${p.amount}`);
          console.log(`   Description: ${p.description}`);
          console.log(`   Type: ${p.type || 'N/A'}`);
          console.log(`   Status: ${p.status}`);
          console.log(`   Date: ${p.createdAt || p.paymentDate}`);
        });
      }

      // Show first 10 payments of any type
      console.log('\n\nFirst 10 payments (any type):');
      allPayments.slice(0, 10).forEach((p, idx) => {
        console.log(`${idx + 1}. ${p.description} - ₱${p.amount} (${p.status}) - ${p.type || 'no type'}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkPayments();

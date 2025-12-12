require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkFinancialData() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    console.log('Connected to:', db.databaseName);
    console.log('\n=== CHECKING FINANCIAL DATA ===\n');

    // Check payments collection for membership-related payments
    const membershipPayments = await db.collection('payments')
      .find({
        $or: [
          { type: 'membership' },
          { description: { $regex: /membership/i } }
        ]
      })
      .toArray();

    console.log(`Payments with "membership" in type or description: ${membershipPayments.length}`);

    if (membershipPayments.length > 0) {
      console.log('\nMembership-related payments:');
      membershipPayments.forEach((p, i) => {
        console.log(`${i + 1}. ${p.description} - ₱${p.amount} (Type: ${p.type || 'undefined'})`);
      });
    }

    // Check for any payment with amount around 16000 or 2026
    const largePayments = await db.collection('payments')
      .find({ amount: { $gte: 1000 } })
      .sort({ amount: -1 })
      .limit(10)
      .toArray();

    console.log(`\n\nPayments >= ₱1000 (top 10):`);
    largePayments.forEach((p, i) => {
      console.log(`${i + 1}. ${p.description} - ₱${p.amount} - ${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A'}`);
    });

    // Check if there's a separate financial data collection or report
    const collections = await db.listCollections().toArray();
    const financialCollections = collections.filter(c =>
      c.name.toLowerCase().includes('financial') ||
      c.name.toLowerCase().includes('report')
    );

    console.log('\n\nFinancial-related collections:');
    financialCollections.forEach(c => {
      console.log(`- ${c.name}`);
    });

    // Check users collection for membership years paid
    const usersWithMembership = await db.collection('users')
      .find({ membershipYearsPaid: { $exists: true, $ne: [] } })
      .toArray();

    console.log(`\n\nUsers with membershipYearsPaid: ${usersWithMembership.length}`);

    if (usersWithMembership.length > 0) {
      console.log('\nSample users with membership years:');
      usersWithMembership.slice(0, 5).forEach((u, i) => {
        console.log(`${i + 1}. ${u.fullName} - Years: ${u.membershipYearsPaid?.join(', ')}`);
      });

      // Count how many paid for 2026
      const paid2026 = usersWithMembership.filter(u =>
        u.membershipYearsPaid?.includes(2026)
      );
      console.log(`\nUsers who paid for 2026: ${paid2026.length}`);

      if (paid2026.length > 0) {
        console.log('Total if each paid ₱1000: ₱' + (paid2026.length * 1000));
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkFinancialData();

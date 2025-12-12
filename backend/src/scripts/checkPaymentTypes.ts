import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payment from '../models/Payment';

dotenv.config();

async function checkPaymentTypes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Get all payments with status='record'
    const allRecordedPayments = await Payment.aggregate([
      {
        $match: {
          status: 'record',
          recordedAt: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$paymentType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    console.log('📊 All Recorded Payments by Type:');
    console.log('=====================================');
    let grandTotal = 0;
    allRecordedPayments.forEach(group => {
      const typeName = group._id || 'undefined';
      console.log(`\n${typeName}:`);
      console.log(`  Count: ${group.count}`);
      console.log(`  Total: ₱${group.totalAmount.toFixed(2)}`);
      grandTotal += group.totalAmount;
    });
    console.log(`\n-------------------------------------`);
    console.log(`Grand Total: ₱${grandTotal.toFixed(2)}`);
    console.log(`10% of Grand Total: ₱${(grandTotal * 0.10).toFixed(2)}`);

    // Show sample payments for each type
    console.log('\n\n📋 Sample Payments for Each Type:');
    console.log('=====================================');

    for (const group of allRecordedPayments) {
      const samples = await Payment.find({
        status: 'record',
        paymentType: group._id
      }).limit(3).select('description amount paymentType createdAt');

      const typeName = group._id || 'undefined';
      console.log(`\n${typeName} (showing ${Math.min(3, group.count)} of ${group.count}):`);
      samples.forEach(payment => {
        console.log(`  - ${payment.description}: ₱${payment.amount}`);
      });
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkPaymentTypes();

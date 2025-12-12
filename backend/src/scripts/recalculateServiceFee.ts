import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payment from '../models/Payment';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function recalculateServiceFee() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB');

    // Calculate total amount from court usage payments only (excluding membership fees)
    const result = await Payment.aggregate([
      {
        $match: {
          status: 'record',
          recordedAt: { $exists: true, $ne: null },
          paymentType: { $ne: 'membership_fee' }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const totalCourtReceipts = result[0]?.totalAmount || 0;
    console.log(`💰 Total Court Usage Receipts: ₱${totalCourtReceipts.toFixed(2)}`);

    // Calculate 10% App Service Fee
    const appServiceFee = totalCourtReceipts * 0.10;
    console.log(`💰 Calculated App Service Fee (10%): ₱${appServiceFee.toFixed(2)}`);

    // Read current financial report
    const dataPath = path.join(__dirname, '../../data/financial-report.json');
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    const financialData = JSON.parse(fileContent);

    // Update App Service Fee
    const appServiceFeeIndex = financialData.disbursementsExpenses.findIndex(
      (item: any) => item.description === 'App Service Fee'
    );

    const oldAmount = appServiceFeeIndex !== -1 ? financialData.disbursementsExpenses[appServiceFeeIndex].amount : 0;

    if (appServiceFeeIndex === -1) {
      financialData.disbursementsExpenses.push({
        description: 'App Service Fee',
        amount: appServiceFee
      });
    } else {
      financialData.disbursementsExpenses[appServiceFeeIndex].amount = appServiceFee;
    }

    // Recalculate total disbursements
    financialData.totalDisbursements = financialData.disbursementsExpenses.reduce(
      (sum: number, item: any) => sum + item.amount,
      0
    );

    // Recalculate net income and fund balance
    financialData.netIncome = financialData.totalReceipts - financialData.totalDisbursements;
    financialData.fundBalance = financialData.beginningBalance.amount + financialData.netIncome;
    financialData.lastUpdated = new Date().toISOString();

    // Write updated data
    fs.writeFileSync(dataPath, JSON.stringify(financialData, null, 2));

    console.log(`\n✅ Financial report updated successfully!`);
    console.log(`   Old App Service Fee: ₱${oldAmount.toFixed(2)}`);
    console.log(`   New App Service Fee: ₱${appServiceFee.toFixed(2)}`);
    console.log(`   Difference: ₱${(oldAmount - appServiceFee).toFixed(2)}`);
    console.log(`\n   New Total Disbursements: ₱${financialData.totalDisbursements.toFixed(2)}`);
    console.log(`   New Fund Balance: ₱${financialData.fundBalance.toFixed(2)}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

recalculateServiceFee();

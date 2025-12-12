import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Reservation from '../models/Reservation';
import Payment from '../models/Payment';
import Poll from '../models/Poll';
import { PageView, UserActivity, SessionInfo } from '../models/Analytics';
import Suggestion from '../models/Suggestion';

// Load environment variables
dotenv.config();

async function cleanTestData() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✅ Connected to MongoDB successfully');

    console.log('\n🧹 Starting database cleanup for testing...\n');

    // Clean Reservations
    console.log('📅 Cleaning reservations...');
    const reservationsResult = await Reservation.deleteMany({});
    console.log(`   ✅ Deleted ${reservationsResult.deletedCount} reservations`);

    // Clean Payments
    console.log('💳 Cleaning payments...');
    const paymentsResult = await Payment.deleteMany({});
    console.log(`   ✅ Deleted ${paymentsResult.deletedCount} payments`);

    // Clean Polls (including Open Play events)
    console.log('📊 Cleaning polls and Open Play events...');
    const pollsResult = await Poll.deleteMany({});
    console.log(`   ✅ Deleted ${pollsResult.deletedCount} polls/open play events`);

    // Clean Analytics
    console.log('📈 Cleaning analytics data...');
    const pageViewsResult = await PageView.deleteMany({});
    const userActivitiesResult = await UserActivity.deleteMany({});
    const sessionInfoResult = await SessionInfo.deleteMany({});
    const totalAnalyticsDeleted = pageViewsResult.deletedCount + userActivitiesResult.deletedCount + sessionInfoResult.deletedCount;
    console.log(`   ✅ Deleted ${totalAnalyticsDeleted} analytics records (${pageViewsResult.deletedCount} page views, ${userActivitiesResult.deletedCount} user activities, ${sessionInfoResult.deletedCount} sessions)`);

    // Clean Suggestions
    console.log('💡 Cleaning suggestions...');
    const suggestionsResult = await Suggestion.deleteMany({});
    console.log(`   ✅ Deleted ${suggestionsResult.deletedCount} suggestions`);

    console.log('\n🎉 Database cleanup completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • Reservations: ${reservationsResult.deletedCount} deleted`);
    console.log(`   • Payments: ${paymentsResult.deletedCount} deleted`);
    console.log(`   • Polls/Open Play: ${pollsResult.deletedCount} deleted`);
    console.log(`   • Analytics: ${totalAnalyticsDeleted} deleted`);
    console.log(`   • Suggestions: ${suggestionsResult.deletedCount} deleted`);
    console.log('\n✅ User accounts and system settings preserved');
    console.log('🚀 Ready for comprehensive testing!');

  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    process.exit(1);
  } finally {
    // Close the connection
    console.log('\n🔌 Closing database connection...');
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
}

// Run the cleanup
if (require.main === module) {
  console.log('🎯 Tennis Club RT2 - Database Test Data Cleanup');
  console.log('===============================================\n');
  
  console.log('⚠️  WARNING: This will delete all test data!');
  console.log('   • All reservations will be deleted');
  console.log('   • All payments will be deleted');
  console.log('   • All polls and Open Play events will be deleted');
  console.log('   • All coin transactions will be deleted');
  console.log('   • All analytics data will be deleted');
  console.log('   • All suggestions will be deleted');
  console.log('   • User accounts and system settings will be preserved\n');
  
  // Give a moment to read the warning
  setTimeout(() => {
    cleanTestData();
  }, 2000);
}

export default cleanTestData;
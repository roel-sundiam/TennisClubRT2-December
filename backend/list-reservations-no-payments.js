const mongoose = require('mongoose');
require('dotenv').config();

async function listReservationsWithoutPayments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Reservation = require('./dist/models/Reservation').default;
    const Payment = require('./dist/models/Payment').default;
    const User = require('./dist/models/User').default;

    // Find all non-cancelled reservations
    const reservations = await Reservation.find({
      status: { $ne: 'cancelled' }
    }).sort({ date: -1 });

    console.log(`📊 Total reservations (non-cancelled): ${reservations.length}\n`);

    let noPaymentCount = 0;
    const noPaymentList = [];

    for (const reservation of reservations) {
      // Check if any payments exist for this reservation
      const paymentsCount = await Payment.countDocuments({
        reservationId: reservation._id
      });

      if (paymentsCount === 0) {
        noPaymentCount++;

        // Get reserver info
        const reserver = await User.findById(reservation.userId);

        const reservationInfo = {
          reservationId: reservation._id.toString(),
          date: reservation.date,
          timeSlot: `${reservation.timeSlot}:00 - ${reservation.endTimeSlot || (reservation.timeSlot + 1)}:00`,
          status: reservation.status,
          paymentStatus: reservation.paymentStatus,
          totalFee: reservation.totalFee,
          reserver: reserver ? `${reserver.fullName} (@${reserver.username})` : 'Unknown',
          players: reservation.players || [],
          createdAt: reservation.createdAt
        };

        noPaymentList.push(reservationInfo);
      }
    }

    console.log(`\n🔍 RESERVATIONS WITHOUT PAYMENT RECORDS: ${noPaymentCount}\n`);

    if (noPaymentList.length === 0) {
      console.log('✅ All reservations have payment records!\n');
    } else {
      noPaymentList.forEach((res, index) => {
        console.log(`${index + 1}. ${res.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} | ${res.timeSlot} | ${res.reserver} | ₱${res.totalFee}`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Done!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listReservationsWithoutPayments();

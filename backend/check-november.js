const mongoose = require('mongoose');
require('dotenv').config();

// Define Reservation schema inline
const reservationSchema = new mongoose.Schema({
  date: Date,
  timeSlot: Number,
  status: String,
  paymentStatus: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const Reservation = mongoose.model('Reservation', reservationSchema);

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');

  // Get November 2025 reservations
  const startDate = new Date('2025-11-01T00:00:00Z');
  const endDate = new Date('2025-11-30T23:59:59Z');

  const reservations = await Reservation.find({
    date: { $gte: startDate, $lte: endDate }
  }).lean();

  console.log('\n=== NOVEMBER 2025 RESERVATIONS ===');
  console.log('Total found:', reservations.length);

  const statusCount = {};
  const paymentCount = {};
  const visibleCount = { visible: 0, hidden: 0 };

  reservations.forEach(r => {
    statusCount[r.status] = (statusCount[r.status] || 0) + 1;
    paymentCount[r.paymentStatus || 'missing'] = (paymentCount[r.paymentStatus || 'missing'] || 0) + 1;

    const isVisible = ['confirmed', 'pending', 'blocked', 'completed'].includes(r.status);
    if (isVisible) visibleCount.visible++;
    else visibleCount.hidden++;
  });

  console.log('\nReservation Status:', JSON.stringify(statusCount, null, 2));
  console.log('Payment Status:', JSON.stringify(paymentCount, null, 2));
  console.log('Visibility:', JSON.stringify(visibleCount, null, 2));

  console.log('\n=== VISIBLE RESERVATIONS IN NOVEMBER ===');
  const visible = reservations.filter(r => ['confirmed', 'pending', 'blocked', 'completed'].includes(r.status));
  console.log('Count:', visible.length);

  visible.slice(0, 10).forEach(r => {
    console.log(`${r.date.toISOString().split('T')[0]} - Slot ${r.timeSlot} - Status: ${r.status} - Payment: ${r.paymentStatus || 'MISSING'}`);
  });

  console.log('\n=== NO-SHOW RESERVATIONS IN NOVEMBER ===');
  const noShows = reservations.filter(r => r.status === 'no-show');
  console.log('Count:', noShows.length);

  noShows.forEach(r => {
    console.log(`${r.date.toISOString().split('T')[0]} - Slot ${r.timeSlot} - Payment: ${r.paymentStatus || 'MISSING'}`);
  });

  mongoose.connection.close();
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

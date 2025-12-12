import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tournament from '../models/Tournament';
import Player from '../models/Player';
import SeedingPoint from '../models/SeedingPoint';

dotenv.config();

async function checkTelCruzMatches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    // Find Tel Cruz
    const telCruz = await Player.findOne({ fullName: /Tel.*Cruz/i });
    if (!telCruz) {
      console.log('Tel Cruz not found');
      await mongoose.disconnect();
      return;
    }

    console.log('Tel Cruz ID:', telCruz._id.toString());
    console.log('Full Name:', telCruz.fullName);
    console.log('Matches Won:', telCruz.matchesWon);
    console.log('Matches Played:', telCruz.matchesPlayed);

    // Find all tournaments
    const tournaments = await Tournament.find({}).lean();
    console.log('\n=== Matches involving Tel Cruz ===\n');

    let totalMatches = 0;
    const allMatches: any[] = [];

    for (const tournament of tournaments) {
      const matches = tournament.matches || [];
      const telCruzMatches = matches.filter((match: any) => {
        const player1Id = match.player1?.toString();
        const player2Id = match.player2?.toString();
        const team1Player1Id = match.team1Player1?.toString();
        const team1Player2Id = match.team1Player2?.toString();
        const team2Player1Id = match.team2Player1?.toString();
        const team2Player2Id = match.team2Player2?.toString();

        const telId = telCruz._id.toString();

        return player1Id === telId || player2Id === telId ||
               team1Player1Id === telId || team1Player2Id === telId ||
               team2Player1Id === telId || team2Player2Id === telId;
      });

      if (telCruzMatches.length > 0) {
        console.log(`Tournament: ${tournament.name} (${tournament.date})`);
        console.log(`Matches: ${telCruzMatches.length}`);
        telCruzMatches.forEach((match: any, i: number) => {
          console.log(`  Match ${i + 1}: ${match.matchType} - ${match.round} - Winner: ${match.winner} - Processed: ${match.pointsProcessed}`);
          allMatches.push({
            tournament: tournament.name,
            matchType: match.matchType,
            round: match.round,
            winner: match.winner,
            processed: match.pointsProcessed
          });
        });
        totalMatches += telCruzMatches.length;
        console.log('');
      }
    }

    console.log(`\nTotal matches found in tournaments: ${totalMatches}`);
    console.log(`Matches Played on Player record: ${telCruz.matchesPlayed}`);

    // Check seeding points
    const seedingPoints = await SeedingPoint.find({ player: telCruz._id });
    console.log(`\nSeeding Points records: ${seedingPoints.length}`);
    seedingPoints.forEach((sp: any) => {
      console.log(`  Points: ${sp.points}, Tournament: ${sp.tournament}, Match: ${sp.match}`);
    });

    if (totalMatches !== telCruz.matchesPlayed) {
      console.log('\n⚠️  MISMATCH DETECTED!');
      console.log(`Expected: ${totalMatches}, Actual: ${telCruz.matchesPlayed}`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTelCruzMatches();

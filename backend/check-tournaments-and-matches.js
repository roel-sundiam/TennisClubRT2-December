require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkTournamentsAndMatches() {
  // Check BOTH databases
  const testUri = process.env.MONGODB_URI; // TennisClubRT2_Test
  const prodUri = testUri.replace('TennisClubRT2_Test', 'TennisClubRT2');

  const testClient = new MongoClient(testUri);
  const prodClient = new MongoClient(prodUri);

  try {
    await testClient.connect();
    await prodClient.connect();

    const testDb = testClient.db();
    const prodDb = prodClient.db();

    console.log('=== PRODUCTION DATABASE (TennisClubRT2) ===\n');
    await checkDatabase(prodDb);

    console.log('\n\n=== TEST DATABASE (TennisClubRT2_Test) ===\n');
    await checkDatabase(testDb);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await testClient.close();
    await prodClient.close();
  }
}

async function checkDatabase(db) {
  console.log(`Connected to: ${db.databaseName}`);

  // Check tournaments
  const tournaments = await db.collection('tournaments').find({}).toArray();
  console.log(`\nTournaments: ${tournaments.length}`);

  if (tournaments.length > 0) {
    console.log('\nTournament Details:');
    tournaments.forEach((t, i) => {
      console.log(`\n${i + 1}. ${t.name}`);
      console.log(`   ID: ${t._id}`);
      console.log(`   Status: ${t.status}`);
      console.log(`   Date: ${t.date}`);
      console.log(`   Tier: ${t.tier || 'N/A'}`);
      console.log(`   Total Matches: ${t.matches?.length || 0}`);

      if (t.matches && t.matches.length > 0) {
        const processedMatches = t.matches.filter(m => m.pointsProcessed).length;
        console.log(`   Matches with points processed: ${processedMatches}/${t.matches.length}`);

        // Show first match as example
        const firstMatch = t.matches[0];
        console.log(`   Sample Match:`);
        console.log(`     Type: ${firstMatch.matchType}`);
        if (firstMatch.matchType === 'singles') {
          console.log(`     Player 1: ${firstMatch.player1Name || firstMatch.player1}`);
          console.log(`     Player 2: ${firstMatch.player2Name || firstMatch.player2}`);
        } else {
          console.log(`     Team 1: ${firstMatch.team1Player1Name || firstMatch.team1Player1} & ${firstMatch.team1Player2Name || firstMatch.team1Player2}`);
          console.log(`     Team 2: ${firstMatch.team2Player1Name || firstMatch.team2Player1} & ${firstMatch.team2Player2Name || firstMatch.team2Player2}`);
        }
        console.log(`     Score: ${firstMatch.score}`);
        console.log(`     Winner: ${firstMatch.winner}`);
        console.log(`     Points Processed: ${firstMatch.pointsProcessed || false}`);
      }
    });
  }

  // Check seeding points
  const playersWithPoints = await db.collection('players')
    .find({ seedPoints: { $gt: 0 } })
    .sort({ seedPoints: -1 })
    .limit(10)
    .toArray();

  console.log(`\n\nPlayers with Seed Points: ${playersWithPoints.length}`);
  if (playersWithPoints.length > 0) {
    console.log('\nTop 10 Players by Seed Points:');
    playersWithPoints.forEach((p, i) => {
      console.log(`${i + 1}. ${p.fullName} - ${p.seedPoints} points (Wins: ${p.matchesWon || 0}, Played: ${p.matchesPlayed || 0})`);
    });
  }
}

checkTournamentsAndMatches();

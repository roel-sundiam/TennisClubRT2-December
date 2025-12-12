# Database Replication Guide

## Overview

This document explains how to replicate data from the **production database** (`TennisClubRT2`) to the **test database** (`TennisClubRT2_Test`).

## Quick Start

To replicate the production database to the test database, run:

```bash
cd backend
npm run replicate-to-test
```

## What This Script Does

The replication script performs the following operations:

1. **Connects to Production Database** (READ-ONLY)
   - Database: `TennisClubRT2`
   - Mode: Read-only (no changes will be made to production)

2. **Connects to Test Database** (WRITE)
   - Database: `TennisClubRT2_Test`
   - Mode: Read/Write (will be completely replaced)

3. **Deletes All Test Data**
   - Clears all existing data from each collection in the test database
   - Ensures a clean slate before copying

4. **Copies All Collections**
   - Reads all documents from each production collection
   - Writes them to the corresponding test collection
   - Maintains all document structure and data

5. **Copies All Indexes**
   - Replicates all custom indexes from production
   - Ensures test database has same performance characteristics

## Collections Replicated

The script replicates all collections, including:

- **Users** - User accounts and profiles
- **Reservations** - Court reservations
- **Payments** - Payment records
- **Expenses** - Financial expense records
- **CoinTransactions** - Coin balance history
- **SessionInfos** - User session data
- **PageViews** - Page view analytics
- **CourtUsageReports** - Court usage statistics
- **ChatRooms** - Chat room data
- **ChatMessages** - Chat messages
- **ChatParticipants** - Chat participants
- **UserActivities** - User activity logs
- **CreditTransactions** - Credit transaction history
- **PushSubscriptions** - Push notification subscriptions
- **Suggestions** - User suggestions
- **Polls** - Poll data
- **Tournaments** - Tournament data
- **SeedingPoints** - Tournament seeding points
- **TempReservations** - Temporary reservations

## Important Safety Notes

⚠️ **CRITICAL WARNINGS:**

1. **Production Database is NEVER Modified**
   - The script operates in READ-ONLY mode on production
   - No data is deleted or changed in production
   - Completely safe to run at any time

2. **Test Database is COMPLETELY REPLACED**
   - All existing test data will be DELETED
   - Test database will be a complete copy of production
   - Any test-specific data will be lost

3. **Use Cases**
   - ✅ Refreshing test environment with real data
   - ✅ Testing new features with production data
   - ✅ Debugging issues with production data structure
   - ❌ DO NOT use for production deployments
   - ❌ DO NOT run if you need to preserve test data

## When to Use This Script

**Good Times to Run:**
- Before testing new features
- After significant production data changes
- When test data becomes outdated or corrupted
- When you need realistic data for testing

**Bad Times to Run:**
- When you have important test data that needs to be preserved
- During active testing sessions (will interrupt tests)
- If you're not sure about the impact

## Script Output

Typical output shows:

```
🔄 Starting database replication...

📖 Connecting to PRODUCTION database (READ-ONLY)...
✅ Connected to production database
📝 Connecting to TEST database...
✅ Connected to test database

📦 Found 19 collections in production database

📋 Processing collection: reservations
   📥 Read 205 documents from production
   🗑️  Cleared existing data in test database
   ✅ Copied 205 documents to test database

...

✅ REPLICATION COMPLETE!
📊 Summary:
   - Collections replicated: 19
   - Total documents copied: 50,141

⚠️  IMPORTANT: Production database was NOT modified (read-only operation)
✅ Test database (TennisClubRT2_Test) now has a complete copy of production data
```

## Execution Time

- Typical execution time: 30-60 seconds
- Depends on amount of data in production database
- Large collections (like PageViews) may take longer

## Troubleshooting

### Connection Errors

If you see connection errors:
1. Check your internet connection
2. Verify MongoDB Atlas is accessible
3. Confirm credentials in the script are correct

### Permission Errors

If you see permission errors:
1. Verify you have read access to production database
2. Verify you have write access to test database
3. Check MongoDB Atlas user permissions

### Index Creation Warnings

You may see warnings like:
```
⚠️  Index already exists: index_name
```

This is normal and can be safely ignored. It means the index was already created in a previous run.

## Script Location

- **Source File**: `/backend/src/scripts/replicateToTestDatabase.ts`
- **Compiled File**: `/backend/dist/scripts/replicateToTestDatabase.js`
- **NPM Script**: Defined in `/backend/package.json`

## Technical Details

### Database URIs

The script uses hardcoded URIs:

```typescript
// Production (READ-ONLY)
const PRODUCTION_URI = 'mongodb+srv://admin:...@mydb.zxr9i5k.mongodb.net/TennisClubRT2...'

// Test (WRITE)
const TEST_URI = 'mongodb+srv://admin:...@mydb.zxr9i5k.mongodb.net/TennisClubRT2_Test...'
```

### Process

1. Creates separate connections to both databases
2. Lists all collections in production
3. For each collection:
   - Reads all documents
   - Deletes all documents in test collection
   - Inserts production documents into test collection
4. Copies all custom indexes
5. Closes both connections

## Maintenance

### Updating Connection Strings

If database credentials change:
1. Edit `/backend/src/scripts/replicateToTestDatabase.ts`
2. Update `PRODUCTION_URI` and/or `TEST_URI`
3. Rebuild TypeScript: `npm run build`

### Adding to CI/CD

To automate test data refresh in CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Refresh test database
  run: |
    cd backend
    npm run replicate-to-test
```

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main development guide
- [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) - UI/UX guidelines
- [TEST_CREDENTIALS.md](../TEST_CREDENTIALS.md) - Test account credentials

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review script output for error messages
3. Verify database connectivity
4. Contact the development team

---

**Last Updated**: November 27, 2025
**Script Version**: 1.0
**Maintained By**: Development Team

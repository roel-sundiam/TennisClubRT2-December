# Database Copy Script - User Guide

## Overview

This script copies all collections from your **production database** (`TennisClubRT2`) to your **test database** (`TennisClubRT2_Test`).

**Key Benefits:**
- Safe: Source database is READ-ONLY (never modified)
- Smart: Preserves test-specific collections
- Complete: Copies data + indexes
- Validated: Verifies data integrity after copy
- Fast: Uses batch operations for performance

---

## Quick Start

### 1. Verify Environment Setup

Before running, check your `.env` file points to the correct source database:

```bash
# Check current database in .env
cat .env | grep MONGODB_URI
```

You should see something like:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/TennisClubRT2?retryWrites=true&w=majority
```

**Important:** The database name in the URI should be `TennisClubRT2` (not `TennisClubRT2_Test`).

### 2. Preview the Copy (Recommended)

Always run a dry-run first to see what will be copied:

```bash
cd /mnt/c/Projects2/TennisClubRT2/backend
npm run copy-to-test:dry-run
```

This will show:
- List of collections to copy
- Number of documents per collection
- Number of indexes per collection
- Estimated time

### 3. Run the Copy

Once you've verified the dry-run output:

```bash
npm run copy-to-test
```

You'll be prompted to confirm:
```
⚠️  WARNING: This will replace data in the test database!
   Source: TennisClubRT2 (READ-ONLY)
   Destination: TennisClubRT2_Test (WILL BE MODIFIED)

Do you want to continue? (yes/no):
```

Type `yes` to proceed.

---

## Available Commands

### Standard Commands

```bash
# View help and all options
npm run copy-to-test -- --help

# Dry run (preview only, no actual copy)
npm run copy-to-test:dry-run

# Standard copy with confirmation prompt
npm run copy-to-test

# Force copy (skip confirmation)
npm run copy-to-test:force
```

### Advanced Options

```bash
# Copy specific collections only
npm run copy-to-test -- --collections users,players,reservations

# Exclude specific collections (preserve test-specific data)
npm run copy-to-test -- --exclude tournaments
npm run copy-to-test:no-tournaments  # Convenient shortcut

# Use larger batch size for faster processing (default: 1000)
npm run copy-to-test -- --batch-size 5000

# Combine options (dry-run for specific collections)
npm run copy-to-test -- --dry-run --collections users,payments
```

---

## How It Works

### Data Flow

```
TennisClubRT2 (Production)  →  TennisClubRT2_Test (Test)
    [READ ONLY]                    [WRITE ONLY]
```

### Copy Process

1. **Connect** to both databases
2. **Discover** collections in source database
3. **For each collection:**
   - Check if it exists in destination
   - If yes: Drop destination collection
   - Copy documents in batches (default: 1000/batch)
   - Copy all indexes
   - Show progress percentage
4. **Validate** all copies:
   - Count matching
   - Sample integrity checks
   - Index verification
5. **Generate** summary report

### Smart Collection Handling

**Collections in BOTH databases:**
- ✅ Dropped from test database
- ✅ Fresh data copied from production

**Collections ONLY in production:**
- ✅ Created in test database with data

**Collections ONLY in test database:**
- ✅ **PRESERVED** (not touched)

### Special Handling: Membership Payments

The `payments` collection receives special treatment to preserve annual membership fee data while updating court reservation payments from production.

**What happens:**

1. **Before dropping:** All payments with `type: 'membership'` are saved from test database
2. **During copy:** All payments from production are copied (court reservations, etc.)
3. **After copy:** Saved membership payments are restored to test database

**Why this matters:**

- 💳 Court reservation payments change frequently and should be updated from production
- 💰 Annual membership fee payments are test-specific and should be preserved
- ✅ Prevents losing membership payment data when running the copy script repeatedly

**Console output:**

```
📦 Processing: payments (1245 documents)
  💳 Special handling for payments collection...
  💾 Found 16 membership payments to preserve
  🗑️  Dropping existing payments collection...
  📊 Progress: 1245/1245 (100.0%)
  ♻️  Restoring 16 membership payments...
  ✅ Membership payments restored!
  📑 Created index: userId_1
  ✅ Created 5 indexes
```

**Technical details:**

- Payments with `type: 'membership'` are preserved
- Court reservation payments (no type field or other types) are replaced from production
- The final count includes both copied payments + preserved membership payments
- All document `_id` values are maintained to preserve referential integrity

---

## Understanding the Output

### During Copy

```
📦 Processing: users (150 documents)
  🗑️  Dropping existing collection in test database...
  📊 Progress: 150/150 (100.0%)
  ✅ Copied 150 documents
  📑 Created index: username_1
  📑 Created index: email_1
  ✅ Created 2 indexes

🔍 Validating: users
  ✅ Count match: 150 documents
  ✅ Sample integrity check passed (10 documents)
  ✅ Index count match: 3 indexes
  ✅ Validation passed for users
```

### Summary Report

```
============================================================
📊 DATABASE COPY SUMMARY
============================================================

Source: TennisClubRT2
Destination: TennisClubRT2_Test

Collections Processed: 17/17
Total Documents: 45,232
Total Indexes: 156
Total Time: 8.45s

------------------------------------------------------------
Collection Details:
------------------------------------------------------------
✅ users: 150 docs, 3 indexes (0.52s)
✅ players: 78 docs, 7 indexes (0.38s)
✅ reservations: 1245 docs, 19 indexes (1.23s)
...
============================================================

✅ Database copy completed successfully!
```

---

## Common Scenarios

### Scenario 1: Full Database Refresh

**Goal:** Replace all test data with fresh production data

```bash
# Step 1: Preview
npm run copy-to-test:dry-run

# Step 2: Execute
npm run copy-to-test
```

### Scenario 2: Copy Specific Collections

**Goal:** Update only users and payments tables

```bash
# Preview specific collections
npm run copy-to-test -- --dry-run --collections users,payments

# Copy only those collections
npm run copy-to-test -- --collections users,payments
```

### Scenario 3: Quick Copy (No Confirmation)

**Goal:** Automated script without user prompt

```bash
npm run copy-to-test:force
```

### Scenario 4: Large Database (Faster Copy)

**Goal:** Speed up copy for databases with large collections

```bash
# Use larger batch size
npm run copy-to-test -- --batch-size 5000
```

### Scenario 5: Preserve Tournament Data

**Goal:** Keep test tournament data and rankings while updating other collections

```bash
# Exclude tournaments collection
npm run copy-to-test:no-tournaments

# Or manually specify
npm run copy-to-test -- --exclude tournaments
```

**Why:** Since rankings are calculated from tournament matches, excluding tournaments preserves your test rankings data.

---

## Safety Features

### 1. Read-Only Source
The source database (`TennisClubRT2`) is **NEVER modified**. Only READ operations occur.

### 2. Confirmation Prompt
Unless using `--force`, you'll be asked to confirm before any writes.

### 3. Dry-Run Mode
Test the script without making any changes:
```bash
npm run copy-to-test:dry-run
```

### 4. Preserved Collections
Collections that exist ONLY in the test database are never touched.

### 5. Validation
After copying, the script validates:
- Document counts match
- Random sample of documents exist
- All indexes were created

---

## Troubleshooting

### Error: "MONGODB_URI environment variable is not set"

**Solution:** Create or update your `.env` file with `MONGODB_URI`

```bash
# Check if .env exists
ls -la /mnt/c/Projects2/TennisClubRT2/backend/.env

# If missing, copy from example
cp .env.example .env

# Edit and add your MongoDB URI
nano .env
```

### Error: "Connection failed"

**Possible causes:**
1. MongoDB Atlas IP whitelist doesn't include your IP
2. Incorrect credentials in MONGODB_URI
3. Network connectivity issues

**Solution:**
1. Check MongoDB Atlas dashboard → Network Access
2. Verify credentials in `.env`
3. Test connection: `npm run dev` (if backend connects, script will too)

### Wrong Source Database

If dry-run shows wrong source database:

```bash
# Check your .env
cat .env | grep MONGODB_URI

# Should show TennisClubRT2, not TennisClubRT2_Test
# If wrong, edit .env file
```

### Validation Failures

If validation shows mismatches:

```
❌ Count mismatch: users (source=150, dest=145)
```

**What this means:** Some documents may not have been copied

**Solutions:**
1. Run the copy again
2. Check for network interruptions during copy
3. Verify destination database has enough storage

### Slow Performance

If copy is taking too long:

**Solutions:**
1. Use larger batch size:
   ```bash
   npm run copy-to-test -- --batch-size 5000
   ```
2. Copy specific collections instead of all
3. Check network speed to MongoDB Atlas

---

## Technical Details

### Batch Processing

Documents are copied in configurable batches (default: 1000):

```typescript
// Default behavior
Batch 1: Documents 1-1000
Batch 2: Documents 1001-2000
Batch 3: Documents 2001-3000
...
```

**Benefits:**
- Lower memory usage
- Better error recovery
- Progress tracking

### Index Copying

All indexes are recreated, including:
- Simple indexes
- Compound indexes
- Unique constraints
- Sparse indexes
- TTL (Time-To-Live) indexes

**Note:** The built-in `_id_` index is skipped (MongoDB creates it automatically).

### Connection Management

The script creates two separate MongoDB connections:

```typescript
sourceClient  → TennisClubRT2      (Read-only operations)
destClient    → TennisClubRT2_Test (Write operations)
```

Both connections are properly closed after completion.

---

## Performance Expectations

### Typical Performance

- **Small Database** (< 10,000 docs): 5-15 seconds
- **Medium Database** (10,000-100,000 docs): 30 seconds - 2 minutes
- **Large Database** (> 100,000 docs): 2-10 minutes

**Factors affecting speed:**
- Number of documents
- Document size
- Number of indexes
- Network speed to MongoDB Atlas
- Batch size setting

### Progress Tracking

You'll see real-time progress:
```
📊 Progress: 5000/45232 (11.0%)
📊 Progress: 10000/45232 (22.1%)
📊 Progress: 15000/45232 (33.1%)
...
```

---

## Best Practices

### 1. Always Dry-Run First
```bash
npm run copy-to-test:dry-run
```

### 2. Verify Source Database
Check that `.env` points to production database before running.

### 3. Review the Output
Check the summary report for any errors or warnings.

### 4. Test After Copy
After copying, verify your test application works correctly with the new data.

### 5. Schedule Regular Copies
Consider running this weekly or monthly to keep test data fresh:

```bash
# Example cron job (Linux/Mac)
# Run every Sunday at 2 AM
0 2 * * 0 cd /path/to/backend && npm run copy-to-test:force
```

### 6. Backup First (Optional)
For extra safety, backup test database before overwriting:

```bash
# Backup test database first
npm run backup

# Then copy
npm run copy-to-test
```

---

## Command Reference

| Command | Description |
|---------|-------------|
| `npm run copy-to-test` | Standard copy with confirmation |
| `npm run copy-to-test:dry-run` | Preview without copying |
| `npm run copy-to-test:force` | Skip confirmation prompt |
| `npm run copy-to-test -- --help` | Show all options |
| `npm run copy-to-test -- --collections <list>` | Copy specific collections |
| `npm run copy-to-test -- --batch-size <size>` | Set batch size |

---

## FAQ

### Q: Will this delete my production database?
**A:** No. The production database (`TennisClubRT2`) is READ-ONLY. It cannot be modified by this script.

### Q: What happens to my test-specific collections?
**A:** They are preserved. Only collections that exist in production are affected.

### Q: Can I undo the copy?
**A:** Not automatically. If you need to revert, restore from a backup:
```bash
npm run restore
```

### Q: How long does it take?
**A:** Depends on database size. See [Performance Expectations](#performance-expectations) above.

### Q: Can I run this in production?
**A:** The script is safe, but it's designed for copying TO test environments. Never point your production app to a test database.

### Q: What if the script fails halfway?
**A:** Simply run it again. The script will:
1. Drop partially copied collections
2. Start fresh
3. Complete the copy

### Q: Does this copy user passwords?
**A:** Yes, it copies everything including hashed passwords. Test database will have same credentials as production.

### Q: Will this affect my running application?
**A:** No effect on production. Test applications will be temporarily unable to connect during the copy (1-5 minutes typically).

---

## Support

If you encounter issues:

1. Check [Troubleshooting](#troubleshooting) section
2. Review the error message and script output
3. Run dry-run to diagnose: `npm run copy-to-test:dry-run`
4. Check MongoDB Atlas dashboard for connection issues

---

## Script Location

**Script File:** `/mnt/c/Projects2/TennisClubRT2/backend/src/scripts/copyDatabaseToTest.ts`

**Package.json Scripts:** Lines 35-37 in `/mnt/c/Projects2/TennisClubRT2/backend/package.json`

---

## Version History

- **v1.0** (2025-12-08): Initial release
  - Full collection copy with indexes
  - Batch processing
  - Validation suite
  - Dry-run mode
  - Progress tracking

---

**Last Updated:** December 8, 2025

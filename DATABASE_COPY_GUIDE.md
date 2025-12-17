# Database Copy Guide

This guide explains how to copy data from the production database to the test database for safe testing and development.

## Overview

### Available Databases

The project uses three MongoDB databases:

- **TennisClubRT2** (Production) - Live production data
- **TennisClubRT2_Test** (Test) - Testing and development
- **AppDB** (Legacy) - Old database for reference

### Copy Script

The `copyDatabaseToTest.ts` script safely copies data from the production database to the test database:

- **Source**: Always READ-ONLY (currently active `MONGODB_URI` in `.env`)
- **Destination**: `{SourceName}_Test` (will be modified)
- **Special Handling**: Membership payments in test database are preserved
- **Includes**: All documents + indexes for performance parity

## Prerequisites

Before copying the database:

1. **Verify Current Database Connection**

   Check `backend/.env` to see which database is currently active:

   ```bash
   grep "^MONGODB_URI=" backend/.env
   ```

2. **Switch to Production Database (if needed)**

   To copy from production to test, ensure `.env` points to production.

   Edit `backend/.env` and modify **lines 3 and 6**:

   **Current state (Test database active):**

   ```bash
   Line 3:  # MONGODB_URI=mongodb+srv://...TennisClubRT2?...        # Production (commented)
   Line 6:  MONGODB_URI=mongodb+srv://...TennisClubRT2_Test?...     # Test (active)
   ```

   **Change to (Production database active):**

   ```bash
   Line 3:  MONGODB_URI=mongodb+srv://...TennisClubRT2?...          # Production (active)
   Line 6:  # MONGODB_URI=mongodb+srv://...TennisClubRT2_Test?...   # Test (commented)
   ```

   **Quick steps:**

   - Remove `#` from line 3 (uncomment production)
   - Add `#` to line 6 (comment out test)
   - Save the file

3. **Backend Must NOT Be Running**

   Stop the backend server before copying to avoid connection conflicts:

   ```bash
   # Stop any running backend processes
   npm run stop
   # Or manually kill the process
   ```

## Basic Usage

### 1. Preview What Will Be Copied (Dry Run)

**Always run a dry run first** to see what will be copied:

```bash
cd backend
npm run copy-to-test:dry-run
//npm run copy-to-test:dry-run -- --exclude tournaments,polls,resurfacingcontributions
```

This shows:

- Source and destination database names
- Collections to be copied
- Document counts for each collection
- Indexes that will be copied
- **No actual data is copied**

### 2. Copy All Data with Confirmation

Standard copy with safety confirmation prompt:

```bash
npm run copy-to-test
```

You'll be asked to confirm:

```
⚠️  WARNING: This will replace data in the test database!
   Source: TennisClubRT2 (READ-ONLY)
   Destination: TennisClubRT2_Test (WILL BE MODIFIED)

Do you want to continue? (yes/no):
```

### 3. Force Copy (Skip Confirmation)

For automation or when you're certain:

```bash
npm run copy-to-test:force
```

⚠️ **Use with caution!** This skips the confirmation prompt.

## Advanced Options

### Copy Specific Collections

Copy only the collections you need:

```bash
# Copy only users and players
npm run copy-to-test -- --collections users,players,reservations
// npm run copy-to-test -- --exclude tournaments,polls,resurfacingcontributions

# Dry run for specific collections
npm run copy-to-test -- --dry-run --collections payments,expenses
```

### Exclude Collections

Preserve test-specific data by excluding certain collections:

```bash
# Exclude tournaments (preserve test tournament data)
npm run copy-to-test -- --exclude tournaments,polls
// npm run copy-to-test -- --exclude tournaments,polls,resurfacingcontributions
# Convenient shortcut
npm run copy-to-test:no-tournaments
```

**Common exclusion scenarios:**

- `--exclude tournaments` - Keep test tournament data
- `--exclude polls` - Preserve test polls
- `--exclude chats,chatrooms` - Keep test chat data

### Adjust Performance

Use larger batch sizes for faster copying (uses more memory):

```bash
# Default batch size: 1000 documents
npm run copy-to-test -- --batch-size 5000

# Smaller batches for limited memory
npm run copy-to-test -- --batch-size 500
```

### Combined Options

```bash
# Dry run with specific collections
npm run copy-to-test -- --dry-run --collections users,payments

# Force copy excluding tournaments
npm run copy-to-test -- --force --exclude tournaments

# Fast copy with large batches
npm run copy-to-test -- --batch-size 5000 --force
```

## Command Reference

All available npm scripts:

```bash
# Show help and all options
npm run copy-to-test -- --help

# Dry run (preview only, no actual copy)
npm run copy-to-test:dry-run

# Standard copy with confirmation prompt
npm run copy-to-test

# Force copy (skip confirmation)
npm run copy-to-test:force

# Exclude tournaments (convenient shortcut)
npm run copy-to-test:no-tournaments
```

## Special Features

### 1. Membership Payment Preservation

The script has **special handling for the payments collection**:

1. **Before copying**: Saves all membership payments from test database

   ```
   💳 Special handling for payments collection...
   💾 Found 5 membership payments to preserve
   ```

2. **During copy**: Drops payments collection and copies from production

3. **After copying**: Restores the saved membership payments
   ```
   ♻️  Restoring 5 membership payments...
   ✅ Membership payments restored!
   ```

**Why?** This allows you to:

- Test membership payment features without affecting production data
- Keep test-specific membership records separate
- Update court usage payments from production while preserving test memberships

### 2. Automatic Validation

After copying, the script validates:

✅ **Document Count Match**

```
✅ Count match: 1,247 documents
```

✅ **Sample Integrity Check**

- Randomly samples 10 documents (or all if less than 10)
- Verifies each sampled document exists in destination

```
✅ Sample integrity check passed (10 documents)
```

✅ **Index Count Match**

```
✅ Index count match: 8 indexes
```

### 3. Detailed Progress Reporting

The script shows real-time progress:

```
📦 Processing: users (1,247 documents)
  🗑️  Dropping existing collection in test database...
  📊 Progress: 1000/1247 (80.2%)
  📊 Progress: 1247/1247 (100.0%)
  ✅ Copied 1247 documents
  📑 Created index: username_1
  📑 Created index: email_1
  ✅ Created 2 indexes
```

### 4. Comprehensive Summary Report

After completion:

```
============================================================
📊 DATABASE COPY SUMMARY
============================================================

Source: TennisClubRT2
Destination: TennisClubRT2_Test

Collections Processed: 15/15
Total Documents: 12,456
Total Indexes: 42
Total Time: 34.56s

------------------------------------------------------------
Collection Details:
------------------------------------------------------------
✅ users: 1247 docs, 2 indexes (3.21s)
✅ players: 1247 docs, 1 indexes (2.89s)
✅ reservations: 4532 docs, 4 indexes (12.45s)
✅ payments: 2891 docs, 3 indexes (8.12s)
...
============================================================

✅ Database copy completed successfully!
```

## Common Workflows

### Fresh Test Database from Production

Complete refresh of test database with all production data:

```bash
# 1. Switch to production database
cd backend
# Edit .env: Remove # from line 3, add # to line 6

# 2. Preview what will be copied
npm run copy-to-test:dry-run

# 3. Perform the copy
npm run copy-to-test

# 4. Switch back to test database for development
# Edit .env: Add # to line 3, remove # from line 6
```

### Update Specific Collections Only

Update just users and reservations from production:

```bash
# Must be connected to production database first
npm run copy-to-test -- --collections users,reservations --force
```

### Preserve Test-Specific Data

Copy production data but keep test tournaments:

```bash
npm run copy-to-test -- --exclude tournaments --force
```

### Testing the Copy Script Itself

Safe way to test the copy mechanism:

```bash
# From test database, create a double-test
# TennisClubRT2_Test → TennisClubRT2_Test_Test
npm run copy-to-test:dry-run
```

## Safety Features

### Read-Only Source

The source database is **NEVER modified**:

- Only SELECT/READ operations are performed
- All writes go to destination database only
- Safe to run on production database

### Confirmation Prompt

Standard copy requires explicit confirmation:

```
Do you want to continue? (yes/no): yes
```

Only `--force` flag skips this safety check.

### Database Name Validation

The script automatically:

- Extracts database name from `MONGODB_URI`
- Creates test database name: `{SourceName}_Test`
- Shows both names before copying

### Connection Verification

Before copying, the script verifies:

```
🔌 Connecting to databases...
✅ Connected to source: TennisClubRT2
✅ Connected to destination: TennisClubRT2_Test
```

## Troubleshooting

### Issue: Wrong Database Names

**Symptom:**

```
📊 Source Database: TennisClubRT2_Test
🧪 Test Database: TennisClubRT2_Test_Test
```

**Solution:**
Your `.env` is pointing to the test database. Switch to production first:

```bash
# Edit backend/.env
# Uncomment production URI, comment out test URI
MONGODB_URI=mongodb+srv://...TennisClubRT2?...
# MONGODB_URI=mongodb+srv://...TennisClubRT2_Test?...
```

### Issue: Connection Refused

**Symptom:**

```
❌ Connection failed: MongoNetworkError
```

**Solutions:**

1. Check internet connection
2. Verify MongoDB Atlas is accessible
3. Check IP whitelist in MongoDB Atlas (0.0.0.0/0 for development)
4. Ensure MONGODB_URI is correct in `.env`

### Issue: Backend Server Running

**Symptom:**

```
MongoServerError: cannot perform operation: a background operation is currently running
```

**Solution:**
Stop the backend server before copying:

```bash
# Find and kill the process
pkill -f "node.*server"
# Or use the stop script if available
npm run stop
```

### Issue: Collection Count Mismatch

**Symptom:**

```
❌ Count mismatch: source=1000, dest=998
```

**Possible Causes:**

1. Copy was interrupted
2. Background operations during copy
3. Database changes during copy process

**Solution:**

1. Stop all database connections
2. Run the copy again
3. Use `--force` to avoid interruption

### Issue: Out of Memory

**Symptom:**

```
JavaScript heap out of memory
```

**Solution:**
Reduce batch size:

```bash
npm run copy-to-test -- --batch-size 500
```

Or increase Node.js memory:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run copy-to-test
```

## Important Notes

### ⚠️ Data Replacement

The copy operation **replaces** data in the destination database:

- Existing collections are dropped before copying
- All documents are replaced with source data
- **Exception**: Membership payments are preserved (see Special Features)

### ⚠️ Verify Database Connection

**ALWAYS verify** which database you're connected to:

```bash
# Check .env
grep "^MONGODB_URI=" backend/.env

# Or run dry-run to see database names
npm run copy-to-test:dry-run
```

Look for this in the output:

```
📊 Source Database: TennisClubRT2
🧪 Test Database: TennisClubRT2_Test
```

### ⚠️ Production Safety

When copying from production:

1. Use `--dry-run` first to preview
2. Consider doing this during low-traffic periods
3. The source (production) is never modified
4. Consider database backups before major changes

### 📊 What Gets Copied

**Included:**

- ✅ All documents from selected collections
- ✅ All indexes (for performance parity)
- ✅ Collection-level configuration

**Not Included:**

- ❌ Database-level users/roles
- ❌ Database-level configuration
- ❌ Server settings
- ❌ Connection pool settings

### 🔄 Regular Updates

**Recommended workflow:**

1. Copy production to test when starting new features
2. Develop and test on test database
3. Keep test database for duration of feature development
4. Refresh test database periodically (weekly/monthly)

### 💾 Backup Recommendation

Before major operations, consider creating a backup:

```bash
# Backup current test database
npm run backup

# Then perform copy
npm run copy-to-test
```

See `BACKUP_README.md` for backup/restore procedures.

## Related Scripts

Other database management scripts:

```bash
# Create superadmin user
npm run create-superadmin

# Import members from Excel/CSV
npm run import-members

# Backup database
npm run backup
npm run backup:compress

# Restore database
npm run restore
npm run restore:dry-run

# Clear test data
npm run clean-test-data
npm run clear-reservations-payments
```

## Environment Variables Reference

Database URIs in `backend/.env`:

```bash
# Production database (default - for production deployment)
MONGODB_URI=mongodb+srv://admin:***@mydb.zxr9i5k.mongodb.net/TennisClubRT2?...

# Test database (for local development and testing)
# MONGODB_URI=mongodb+srv://admin:***@mydb.zxr9i5k.mongodb.net/TennisClubRT2_Test?...

# Test database URI (reference only, not used by copy script)
MONGODB_URI_TEST=mongodb+srv://admin:***@mydb.zxr9i5k.mongodb.net/TennisClubRT2_Test?...

# Legacy database (reference only)
MONGODB_URI_LEGACY=mongodb+srv://admin:***@mydb.zxr9i5k.mongodb.net/AppDB?...
```

**Note:** The copy script uses the active `MONGODB_URI` as the source and automatically creates the test database name by appending `_Test`.

## Quick Reference Card

```bash
# Must-do before copying
cd backend
grep "^MONGODB_URI=" .env    # Verify database
npm run copy-to-test:dry-run # Preview

# Standard workflows
npm run copy-to-test                    # Full copy with confirmation
npm run copy-to-test:force              # Full copy, no confirmation
npm run copy-to-test:no-tournaments     # Copy but keep test tournaments

# Advanced
npm run copy-to-test -- --collections users,payments,reservations
npm run copy-to-test -- --exclude tournaments,polls
npm run copy-to-test -- --batch-size 5000
npm run copy-to-test -- --help          # Show all options
```

---

**Last Updated:** December 17, 2025
**Script Location:** `backend/src/scripts/copyDatabaseToTest.ts`
**Package.json:** Lines 39-42

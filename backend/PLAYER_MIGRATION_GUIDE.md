# Player Migration Guide

This guide explains the migration from User-based tournaments to Player-based tournaments.

## What Changed?

### Before Migration
- Tournament players were selected from the **User table**
- Users had to be registered members of the system
- Tournament stats (seedPoints, matchesWon, matchesPlayed) were stored in User table

### After Migration
- Tournament players are selected from the **Player table**
- Players can be registered OR guests (non-system users)
- Tournament stats are stored in Player table
- **User table remains unchanged** for authentication, reservations, payments, etc.

## Running the Migration

### Prerequisites
1. **Backup your database** before running the migration
2. Ensure you're connected to the correct database (check your `.env` file)
3. Stop the application server to avoid conflicts

### Migration Command

```bash
cd backend
npm run migrate-players
```

### What the Migration Does

1. **Creates Player records** from all active, approved Users
   - Copies: fullName, email, phone, gender
   - Copies tournament stats: seedPoints, matchesWon, matchesPlayed
   - Links to original User via `linkedUserId` field

2. **Updates all Tournament matches**
   - Converts player references from User IDs to Player IDs
   - Updates: player1, player2, team1Player1, team1Player2, team2Player1, team2Player2
   - Updates winner field for singles matches

3. **Migrates SeedingPoint records**
   - Adds `playerId` field to existing tournament points
   - Keeps `userId` field for backward compatibility

4. **Creates a backup mapping file**
   - Saves to: `backend/backups/user-to-player-migration-map.json`
   - Used for rollback if needed

### Expected Output

```
🚀 Starting User to Player migration...

📋 Step 1: Converting Users to Players...
   Found 45 active users to convert
   ✅ Created Player for John Doe (User ID: 123... → Player ID: 456...)
   ✅ Created Player for Jane Smith (User ID: 789... → Player ID: abc...)
   ...
   📊 Converted 45 users to players

📋 Step 2: Updating Tournament match references...
   Found 12 tournaments to check
   ✅ Updated tournament: Summer Championship (8 matches)
   ✅ Updated tournament: Spring Open (12 matches)
   ...
   📊 Updated 12 tournaments

📋 Step 3: Migrating SeedingPoint records...
   Found 156 tournament seeding points to migrate
   ⏳ Migrated 10 seeding points...
   ⏳ Migrated 20 seeding points...
   ...
   📊 Migrated 156 seeding points

📋 Step 4: Saving migration mapping...
   ✅ Mapping saved to: /backend/backups/user-to-player-migration-map.json

═══════════════════════════════════════════════════════════
✅ MIGRATION COMPLETED SUCCESSFULLY
═══════════════════════════════════════════════════════════
📊 Users converted to Players: 45
🏆 Tournaments updated: 12
📈 Seeding points migrated: 156
❌ Errors encountered: 0
═══════════════════════════════════════════════════════════
```

## Rollback (If Needed)

If you need to reverse the migration:

```bash
cd backend
npm run migrate-players:rollback
```

**⚠️ WARNING:** Rollback will:
- Restore tournament references to User IDs
- Restore SeedingPoint references to User IDs
- **NOT delete** Player records (delete manually if needed)

## After Migration

### 1. Test the System

```bash
# Start the backend
cd backend
npm run dev

# Start the frontend
cd frontend
ng serve
```

### 2. Verify Tournament Management
- Navigate to `/admin/tournaments`
- Check that player dropdown shows all players
- Create a test tournament
- Verify player selection works
- Process tournament points
- Check rankings display correctly

### 3. Adding New Players

**Via Migration (converts existing users):**
```bash
npm run migrate-players
```

**Via Admin UI (future feature):**
- Navigate to `/admin/players` (to be implemented)
- Add new players manually

**Via API:**
```bash
POST /api/players
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "123-456-7890",
  "gender": "male"
}
```

## API Endpoints

### Players
- `GET /api/players` - List all players (with pagination, search)
- `GET /api/players/:id` - Get single player
- `POST /api/players` - Create new player (admin only)
- `PUT /api/players/:id` - Update player (admin only)
- `DELETE /api/players/:id` - Soft delete player (admin only)
- `GET /api/players/:id/stats` - Get player statistics and ranking

### Tournaments (unchanged)
- `GET /api/tournaments`
- `POST /api/tournaments`
- `PUT /api/tournaments/:id`
- `DELETE /api/tournaments/:id`
- `POST /api/tournaments/:id/process-points`

## Database Schema

### Player Model
```typescript
{
  fullName: string;           // Required
  email?: string;             // Optional, unique
  phone?: string;             // Optional
  gender?: 'male' | 'female' | 'other';

  // Tournament stats
  seedPoints: number;         // Default: 0
  matchesWon: number;         // Default: 0
  matchesPlayed: number;      // Default: 0

  // Optional link to User
  linkedUserId?: string;      // Reference to User._id

  isActive: boolean;          // Default: true
  createdAt: Date;
  updatedAt: Date;
}
```

### SeedingPoint Model (Updated)
```typescript
{
  userId?: string;            // Legacy field (backward compatibility)
  playerId?: string;          // NEW field for Player-based points
  points: number;
  description: string;
  source?: 'reservation' | 'open_play' | 'tournament';
  tournamentId?: string;
  matchIndex?: number;
  isWinner?: boolean;
  // ... other fields
}
```

## Troubleshooting

### Migration Errors

**Error: "User not found"**
- Some User IDs may be invalid or deleted
- Migration will skip and log these errors
- Check error summary at end of migration

**Error: "Duplicate email"**
- Player with same email already exists
- Migration will skip and log
- Manually resolve duplicates if needed

**Error: "Tournament not found"**
- Tournament may have been deleted
- Check database integrity before migration

### After Migration Issues

**Players not showing in dropdown**
```bash
# Check if players exist
mongo
> use tennisclub
> db.players.count()

# Check API response
curl http://localhost:3000/api/players
```

**Points not awarding correctly**
```bash
# Check SeedingPoint model
> db.seedingpoints.find({ tournamentId: "your-tournament-id" })

# Verify playerId is populated
```

**Rankings not updating**
```bash
# Test rankings endpoint
curl http://localhost:3000/api/seeding/rankings

# Should query Player model, not User model
```

## Best Practices

1. **Always backup before migration**
   ```bash
   npm run backup
   ```

2. **Test on staging first**
   - Run migration on test database
   - Verify functionality
   - Then run on production

3. **Keep mapping file**
   - Don't delete `user-to-player-migration-map.json`
   - Needed for rollback
   - Archive after confirming migration success

4. **Monitor errors**
   - Check migration error summary
   - Investigate any failures
   - Resolve before proceeding

5. **Verify data integrity**
   - Check player count matches user count
   - Verify tournament references updated
   - Confirm rankings display correctly

## Frequently Asked Questions

**Q: Will existing tournaments be affected?**
A: Yes, all existing tournaments will be updated to reference Players instead of Users. The migration handles this automatically.

**Q: What happens to users who aren't migrated?**
A: Only active, approved users with roles (member/admin/superadmin) are migrated. Inactive or unapproved users are skipped.

**Q: Can I add new players without corresponding users?**
A: Yes! That's the main benefit. Use the `/api/players` endpoint or future admin UI to add guest players.

**Q: What if I need to re-run the migration?**
A: The script checks for existing players with `linkedUserId` and skips them to avoid duplicates.

**Q: Will this affect login or reservations?**
A: No. User table remains unchanged. Login, reservations, payments, and all other features continue to work normally.

**Q: How do I link a Player back to their User account?**
A: Each Player has a `linkedUserId` field that references the original User._id. This is set automatically during migration.

## Support

If you encounter issues:
1. Check the error logs
2. Verify database connection
3. Review the migration mapping file
4. Run rollback if needed
5. Contact system administrator

---

**Last Updated:** 2025-11-27
**Migration Script Version:** 1.0.0

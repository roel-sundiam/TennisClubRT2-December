#!/usr/bin/env node

import dotenv from 'dotenv';
import { MongoClient, Db } from 'mongodb';
import * as readline from 'readline';

dotenv.config();

interface CopyArgs {
  collections?: string[];
  exclude?: string[];
  dryRun?: boolean;
  force?: boolean;
  batchSize?: number;
  help?: boolean;
}

interface CollectionStats {
  name: string;
  documentsCount: number;
  indexesCount: number;
  duration: number;
  success: boolean;
  error?: string;
}

class DatabaseCopyScript {
  private mongoUri: string;
  private sourceDatabaseName: string;
  private testDatabaseName: string;
  private testMongoUri: string;
  private sourceClient!: MongoClient;
  private destClient!: MongoClient;
  private sourceDb!: Db;
  private destDb!: Db;
  private batchSize: number = 1000;
  private isDryRun: boolean = false;
  private collectionStats: CollectionStats[] = [];

  constructor() {
    this.mongoUri = process.env.MONGODB_URI || '';

    if (!this.mongoUri) {
      console.error('❌ MONGODB_URI environment variable is not set');
      process.exit(1);
    }

    // Extract source database name
    this.sourceDatabaseName = this.extractDatabaseName(this.mongoUri);
    this.testDatabaseName = `${this.sourceDatabaseName}_Test`;

    // Create test database URI
    this.testMongoUri = this.modifyUriForTestDatabase(this.mongoUri, this.testDatabaseName);

    console.log(`📊 Source Database: ${this.sourceDatabaseName}`);
    console.log(`🧪 Test Database: ${this.testDatabaseName}`);
  }

  private extractDatabaseName(uri: string): string {
    try {
      const url = new URL(uri);
      const pathname = url.pathname;
      if (pathname && pathname.length > 1) {
        const dbName = pathname.substring(1).split('?')[0];
        return dbName || 'TennisClubRT2'; // Remove leading slash and query params
      }
      return 'TennisClubRT2';
    } catch (error) {
      console.warn('⚠️ Could not extract database name from URI, using default');
      return 'TennisClubRT2';
    }
  }

  private modifyUriForTestDatabase(uri: string, testDbName: string): string {
    try {
      const url = new URL(uri);
      const pathParts = url.pathname.split('?');
      url.pathname = '/' + testDbName;
      // Preserve query parameters if any
      if (pathParts.length > 1) {
        url.search = '?' + pathParts[1];
      }
      return url.toString();
    } catch (error) {
      console.error('❌ Error modifying URI for test database:', error);
      process.exit(1);
    }
  }

  private parseArgs(): CopyArgs {
    const args = process.argv.slice(2);
    const parsedArgs: CopyArgs = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--collections':
        case '-c':
          if (i + 1 < args.length) {
            const nextArg = args[i + 1];
            if (nextArg) {
              parsedArgs.collections = nextArg.split(',').map(c => c.trim());
              i++;
            }
          }
          break;
        case '--exclude':
        case '-e':
          if (i + 1 < args.length) {
            const nextArg = args[i + 1];
            if (nextArg) {
              parsedArgs.exclude = nextArg.split(',').map(c => c.trim());
              i++;
            }
          }
          break;
        case '--dry-run':
        case '-d':
          parsedArgs.dryRun = true;
          break;
        case '--force':
        case '-f':
          parsedArgs.force = true;
          break;
        case '--batch-size':
        case '-b':
          if (i + 1 < args.length) {
            const nextArg = args[i + 1];
            if (nextArg) {
              parsedArgs.batchSize = parseInt(nextArg, 10);
              i++;
            }
          }
          break;
        case '--help':
        case '-h':
          parsedArgs.help = true;
          break;
      }
    }

    return parsedArgs;
  }

  private showHelp(): void {
    console.log(`
🎾 Tennis Club RT2 - Database Copy to Test Tool

Usage: npm run copy-to-test [options]

Options:
  -c, --collections <list>    Copy specific collections (comma-separated)
                              Example: --collections users,players,reservations

  -e, --exclude <list>        Exclude specific collections from copying (comma-separated)
                              Example: --exclude tournaments,polls
                              Useful to preserve test-specific data

  -d, --dry-run              Preview what would be copied without actually copying
                              Shows collection names, document counts, and indexes

  -f, --force                Skip confirmation prompt
                              Use with caution!

  -b, --batch-size <size>    Set batch size for bulk inserts (default: 1000)
                              Larger batches = faster but more memory usage

  -h, --help                 Show this help message

Examples:
  npm run copy-to-test
  npm run copy-to-test -- --dry-run
  npm run copy-to-test -- --force
  npm run copy-to-test -- --collections users,players
  npm run copy-to-test -- --exclude tournaments
  npm run copy-to-test -- --batch-size 5000

Important Notes:
  - Source database (${this.sourceDatabaseName}) is READ-ONLY, never modified
  - Only test database (${this.testDatabaseName}) will be updated
  - Collections in test database that don't exist in source are preserved
  - Indexes are copied along with data for performance parity
  - Membership payments are automatically preserved in the payments collection
`);
  }

  private async confirmCopy(): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('\n⚠️  WARNING: This will replace data in the test database!');
      console.log(`   Source: ${this.sourceDatabaseName} (READ-ONLY)`);
      console.log(`   Destination: ${this.testDatabaseName} (WILL BE MODIFIED)\n`);

      rl.question('Do you want to continue? (yes/no): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
  }

  private async connect(): Promise<void> {
    try {
      console.log('\n🔌 Connecting to databases...');

      this.sourceClient = new MongoClient(this.mongoUri);
      this.destClient = new MongoClient(this.testMongoUri);

      await this.sourceClient.connect();
      console.log(`✅ Connected to source: ${this.sourceDatabaseName}`);

      await this.destClient.connect();
      console.log(`✅ Connected to destination: ${this.testDatabaseName}`);

      this.sourceDb = this.sourceClient.db();
      this.destDb = this.destClient.db();
    } catch (error) {
      console.error('❌ Connection failed:', error);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.sourceClient) {
        await this.sourceClient.close();
      }
      if (this.destClient) {
        await this.destClient.close();
      }
      console.log('\n🔌 Disconnected from databases');
    } catch (error) {
      console.error('⚠️ Error during disconnect:', error);
    }
  }

  private async getCollections(specificCollections?: string[], excludeCollections?: string[]): Promise<string[]> {
    const allCollections = await this.sourceDb.listCollections().toArray();
    let collections = allCollections
      .map(col => col.name)
      .filter(name => !name.startsWith('system.') && !name.includes('__'));

    if (specificCollections && specificCollections.length > 0) {
      collections = collections.filter(name => specificCollections.includes(name));

      // Warn about collections that don't exist
      const missing = specificCollections.filter(name => !collections.includes(name));
      if (missing.length > 0) {
        console.warn(`⚠️ Collections not found in source: ${missing.join(', ')}`);
      }
    }

    if (excludeCollections && excludeCollections.length > 0) {
      const beforeCount = collections.length;
      collections = collections.filter(name => !excludeCollections.includes(name));
      const excludedCount = beforeCount - collections.length;

      if (excludedCount > 0) {
        console.log(`🚫 Excluding ${excludedCount} collection(s): ${excludeCollections.join(', ')}`);
      }
    }

    return collections;
  }

  private async copyCollection(collectionName: string): Promise<CollectionStats> {
    const startTime = Date.now();
    const stats: CollectionStats = {
      name: collectionName,
      documentsCount: 0,
      indexesCount: 0,
      duration: 0,
      success: false
    };

    try {
      const sourceCollection = this.sourceDb.collection(collectionName);
      const destCollection = this.destDb.collection(collectionName);

      // Get total count for progress tracking
      const totalDocs = await sourceCollection.countDocuments();
      stats.documentsCount = totalDocs;

      console.log(`\n📦 Processing: ${collectionName} (${totalDocs} documents)`);

      if (this.isDryRun) {
        console.log(`  🔍 DRY RUN - Would copy ${totalDocs} documents`);
        const indexes = await sourceCollection.indexes();
        stats.indexesCount = indexes.length - 1; // Exclude _id_ index
        console.log(`  🔍 DRY RUN - Would copy ${stats.indexesCount} indexes`);
        stats.success = true;
        stats.duration = (Date.now() - startTime) / 1000;
        return stats;
      }

      // Special handling for payments collection - preserve membership payments
      if (collectionName === 'payments') {
        console.log(`  💳 Special handling for payments collection...`);

        // Save existing membership payments from test database
        const existingMembershipPayments = await destCollection.find({ type: 'membership' }).toArray();
        console.log(`  💾 Found ${existingMembershipPayments.length} membership payments to preserve`);

        // Drop the collection
        const destCollections = await this.destDb.listCollections({ name: collectionName }).toArray();
        if (destCollections.length > 0) {
          console.log(`  🗑️  Dropping existing payments collection...`);
          await destCollection.drop();
        }

        // Will restore membership payments after copying from source
        (this as any).savedMembershipPayments = existingMembershipPayments;
      } else {
        // Check if collection exists in destination and drop it
        const destCollections = await this.destDb.listCollections({ name: collectionName }).toArray();
        if (destCollections.length > 0) {
          console.log(`  🗑️  Dropping existing collection in test database...`);
          await destCollection.drop();
        }
      }

      // Copy documents in batches
      if (totalDocs > 0) {
        let copiedCount = 0;
        const batchSize = this.batchSize;

        while (copiedCount < totalDocs) {
          const batch = await sourceCollection
            .find({})
            .skip(copiedCount)
            .limit(batchSize)
            .toArray();

          if (batch.length > 0) {
            await destCollection.insertMany(batch, { ordered: false });
            copiedCount += batch.length;

            // Progress reporting
            const percentage = ((copiedCount / totalDocs) * 100).toFixed(1);
            console.log(`  📊 Progress: ${copiedCount}/${totalDocs} (${percentage}%)`);
          } else {
            break; // No more documents
          }
        }

        console.log(`  ✅ Copied ${copiedCount} documents`);
      } else {
        console.log(`  ℹ️  Collection is empty, skipping document copy`);
      }

      // Copy indexes
      const indexCount = await this.copyIndexes(collectionName);
      stats.indexesCount = indexCount;

      // Restore membership payments if this is the payments collection
      if (collectionName === 'payments' && (this as any).savedMembershipPayments) {
        const membershipPayments = (this as any).savedMembershipPayments;
        if (membershipPayments.length > 0) {
          console.log(`  ♻️  Restoring ${membershipPayments.length} membership payments...`);
          await destCollection.insertMany(membershipPayments, { ordered: false });
          console.log(`  ✅ Membership payments restored!`);
          stats.documentsCount += membershipPayments.length; // Update count
        }
        // Clean up saved data
        delete (this as any).savedMembershipPayments;
      }

      stats.success = true;
    } catch (error) {
      console.error(`  ❌ Error copying collection: ${error}`);
      stats.error = error instanceof Error ? error.message : String(error);
    }

    stats.duration = (Date.now() - startTime) / 1000;
    return stats;
  }

  private async copyIndexes(collectionName: string): Promise<number> {
    try {
      const sourceCollection = this.sourceDb.collection(collectionName);
      const destCollection = this.destDb.collection(collectionName);

      const indexes = await sourceCollection.indexes();
      let createdCount = 0;

      for (const index of indexes) {
        // Skip the default _id index (created automatically)
        if (index.name === '_id_') continue;

        const { key, name, unique, sparse, expireAfterSeconds, ...otherOptions } = index;

        const indexOptions: any = {
          name,
          ...otherOptions
        };

        if (unique !== undefined) indexOptions.unique = unique;
        if (sparse !== undefined) indexOptions.sparse = sparse;
        if (expireAfterSeconds !== undefined) indexOptions.expireAfterSeconds = expireAfterSeconds;

        await destCollection.createIndex(key, indexOptions);
        console.log(`  📑 Created index: ${name}`);
        createdCount++;
      }

      if (createdCount > 0) {
        console.log(`  ✅ Created ${createdCount} indexes`);
      }

      return createdCount;
    } catch (error) {
      console.error(`  ⚠️ Error copying indexes: ${error}`);
      return 0;
    }
  }

  private async validateCopy(collectionName: string): Promise<boolean> {
    try {
      console.log(`\n🔍 Validating: ${collectionName}`);

      const sourceCollection = this.sourceDb.collection(collectionName);
      const destCollection = this.destDb.collection(collectionName);

      // 1. Count validation
      const sourceCount = await sourceCollection.countDocuments();
      const destCount = await destCollection.countDocuments();

      if (sourceCount !== destCount) {
        console.error(`  ❌ Count mismatch: source=${sourceCount}, dest=${destCount}`);
        return false;
      }
      console.log(`  ✅ Count match: ${sourceCount} documents`);

      // 2. Sample integrity check (10 random documents or all if less)
      if (sourceCount > 0) {
        const sampleSize = Math.min(10, sourceCount);
        const randomDocs = await sourceCollection
          .aggregate([{ $sample: { size: sampleSize } }])
          .toArray();

        for (const doc of randomDocs) {
          const destDoc = await destCollection.findOne({ _id: doc._id });
          if (!destDoc) {
            console.error(`  ❌ Missing document in destination: ${doc._id}`);
            return false;
          }
        }
        console.log(`  ✅ Sample integrity check passed (${sampleSize} documents)`);
      }

      // 3. Index validation
      const sourceIndexes = await sourceCollection.indexes();
      const destIndexes = await destCollection.indexes();

      if (sourceIndexes.length !== destIndexes.length) {
        console.error(`  ❌ Index count mismatch: source=${sourceIndexes.length}, dest=${destIndexes.length}`);
        return false;
      }
      console.log(`  ✅ Index count match: ${sourceIndexes.length} indexes`);

      console.log(`  ✅ Validation passed for ${collectionName}`);
      return true;
    } catch (error) {
      console.error(`  ❌ Validation error: ${error}`);
      return false;
    }
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DATABASE COPY SUMMARY');
    console.log('='.repeat(60));

    console.log(`\nSource: ${this.sourceDatabaseName}`);
    console.log(`Destination: ${this.testDatabaseName}`);

    if (this.isDryRun) {
      console.log('\n🔍 DRY RUN MODE - No data was actually copied');
    }

    const successful = this.collectionStats.filter(s => s.success);
    const failed = this.collectionStats.filter(s => !s.success);

    console.log(`\nCollections Processed: ${successful.length}/${this.collectionStats.length}`);

    if (failed.length > 0) {
      console.log(`Failed Collections: ${failed.length}`);
    }

    const totalDocs = this.collectionStats.reduce((sum, s) => sum + s.documentsCount, 0);
    const totalIndexes = this.collectionStats.reduce((sum, s) => sum + s.indexesCount, 0);
    const totalTime = this.collectionStats.reduce((sum, s) => sum + s.duration, 0);

    console.log(`Total Documents: ${totalDocs.toLocaleString()}`);
    console.log(`Total Indexes: ${totalIndexes}`);
    console.log(`Total Time: ${totalTime.toFixed(2)}s`);

    console.log('\n' + '-'.repeat(60));
    console.log('Collection Details:');
    console.log('-'.repeat(60));

    for (const stat of this.collectionStats) {
      const status = stat.success ? '✅' : '❌';
      const duration = stat.duration.toFixed(2);
      console.log(`${status} ${stat.name}: ${stat.documentsCount} docs, ${stat.indexesCount} indexes (${duration}s)`);
      if (stat.error) {
        console.log(`   Error: ${stat.error}`);
      }
    }

    console.log('='.repeat(60));

    if (failed.length === 0 && !this.isDryRun) {
      console.log('\n✅ Database copy completed successfully!');
    } else if (this.isDryRun) {
      console.log('\n🔍 Dry run completed. Use --force to perform actual copy.');
    } else {
      console.log(`\n⚠️ Database copy completed with ${failed.length} error(s).`);
    }
  }

  async run(): Promise<void> {
    const args = this.parseArgs();

    if (args.help) {
      this.showHelp();
      return;
    }

    if (args.batchSize) {
      this.batchSize = args.batchSize;
      console.log(`📦 Batch size set to: ${this.batchSize}`);
    }

    this.isDryRun = args.dryRun || false;

    if (this.isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be copied');
    }

    try {
      // Connect to databases
      await this.connect();

      // Get collections to copy
      const collections = await this.getCollections(args.collections, args.exclude);

      if (collections.length === 0) {
        console.log('\n⚠️ No collections found to copy');
        return;
      }

      console.log(`\n📋 Collections to copy (${collections.length}):`);
      collections.forEach(name => console.log(`   - ${name}`));

      // Confirm copy (unless force flag or dry run)
      if (!this.isDryRun && !args.force) {
        const confirmed = await this.confirmCopy();
        if (!confirmed) {
          console.log('\n❌ Copy cancelled by user');
          return;
        }
      }

      console.log('\n🚀 Starting copy process...');
      const startTime = Date.now();

      // Copy each collection
      for (const collectionName of collections) {
        const stats = await this.copyCollection(collectionName);
        this.collectionStats.push(stats);
      }

      // Validate copies (only if not dry run)
      if (!this.isDryRun) {
        console.log('\n🔍 Starting validation...');
        for (const collectionName of collections) {
          await this.validateCopy(collectionName);
        }
      }

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n⏱️ Total operation time: ${totalTime}s`);

      // Generate summary report
      this.generateReport();

    } catch (error) {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Main execution
if (require.main === module) {
  const script = new DatabaseCopyScript();
  script.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default DatabaseCopyScript;

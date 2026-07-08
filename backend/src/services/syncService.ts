import { sheetsService } from './sheetsService';
import { webSocketService, FinancialUpdateEvent } from './websocketService';
import path from 'path';
import fs from 'fs';

export class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  private readonly JSON_FILE_PATH = path.join(__dirname, '../../data/financial-report.json');
  private lastSyncTime: Date | null = null;
  private isGoogleSheetsEnabled = false;

  constructor() {
    this.checkGoogleSheetsConfig();
  }

  /**
   * Check if Google Sheets is properly configured
   */
  private checkGoogleSheetsConfig(): void {
    const hasSpreadsheetId = process.env.GOOGLE_SHEETS_FINANCIAL_ID && 
                            process.env.GOOGLE_SHEETS_FINANCIAL_ID !== 'your-financial-spreadsheet-id-here';
    
    this.isGoogleSheetsEnabled = !!hasSpreadsheetId;
    
    if (this.isGoogleSheetsEnabled) {
      console.log('✅ Google Sheets sync enabled (using public CSV method)');
      console.log(`📊 Will sync every ${this.SYNC_INTERVAL_MS / 1000} seconds`);
      console.log(`🔗 Spreadsheet ID: ${process.env.GOOGLE_SHEETS_FINANCIAL_ID}`);
    } else {
      console.log('⚠️  Google Sheets sync disabled - using JSON file only');
      console.log('💡 To enable: Set GOOGLE_SHEETS_FINANCIAL_ID in your .env file');
    }
  }

  /**
   * Start the automatic sync process
   */
  public startSync(): void {
    if (!this.isGoogleSheetsEnabled) {
      console.log('📄 Google Sheets not configured - JSON file mode only');
      return;
    }

    // Perform initial sync
    this.performSync().then(() => {
      console.log('🔄 Initial sync completed');
    }).catch(error => {
      console.error('❌ Initial sync failed:', error.message);
    });

    // Set up recurring sync
    this.syncInterval = setInterval(() => {
      this.performSync().catch(error => {
        console.error('❌ Scheduled sync failed:', error.message);
      });
    }, this.SYNC_INTERVAL_MS);

    console.log('🔄 Google Sheets sync service started');
  }

  /**
   * Stop the sync process
   */
  public stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️  Google Sheets sync service stopped');
    }
  }

  /**
   * Perform a single sync operation
   */
  public async performSync(): Promise<boolean> {
    if (!this.isGoogleSheetsEnabled) {
      console.log('⚠️  Sync skipped - Google Sheets not configured');
      return false;
    }

    try {
      console.log('📥 Syncing from Google Sheets...');
      
      // Get fresh data from Google Sheets
      const sheetData = await sheetsService.getFinancialReportData();
      
      // Read current JSON file to compare
      const currentData = this.readCurrentJsonFile();
      
      // Check if data has changed
      const hasChanges = this.hasDataChanged(currentData, sheetData);
      
      if (hasChanges) {
        // Update the JSON file
        this.writeJsonFile(sheetData);
        this.lastSyncTime = new Date();
        
        console.log('✅ Sync completed - JSON file updated');
        console.log(`📊 Club: ${sheetData.clubName}`);
        console.log(`💰 Fund Balance: ₱${sheetData.fundBalance.toLocaleString()}`);
        console.log(`🕒 Last Updated: ${sheetData.lastUpdated}`);
        
        // Emit real-time update event if WebSocket is available
        if (webSocketService.isInitialized()) {
          const updateEvent: FinancialUpdateEvent = {
            type: 'financial_data_updated',
            data: sheetData,
            timestamp: new Date().toISOString(),
            message: `💰 Financial data updated! Fund Balance: ₱${sheetData.fundBalance.toLocaleString()}`
          };
          
          webSocketService.emitFinancialUpdate(updateEvent);
          console.log('📡 Real-time update broadcasted to clients');
        } else {
          console.log('⚠️  WebSocket not initialized - real-time update not sent');
        }
        
        return true;
      } else {
        console.log('📊 Sync completed - no changes detected');
        this.lastSyncTime = new Date();
        return false;
      }
      
    } catch (error: any) {
      console.error('❌ Sync failed:', error.message);
      return false;
    }
  }

  /**
   * Read the current JSON file
   */
  private readCurrentJsonFile(): any {
    try {
      if (fs.existsSync(this.JSON_FILE_PATH)) {
        const content = fs.readFileSync(this.JSON_FILE_PATH, 'utf8');
        return JSON.parse(content);
      }
      return null;
    } catch (error) {
      console.error('⚠️  Error reading JSON file:', error);
      return null;
    }
  }

  /**
   * Write data to JSON file
   */
  private writeJsonFile(data: any): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.JSON_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Ensure App Service Fee is preserved in disbursements
      let appServiceFee = 103.20; // Use the known correct amount
      const appServiceFeeIndex = data.disbursementsExpenses.findIndex(
        (item: any) => item.description === 'App Service Fee'
      );
      
      if (appServiceFeeIndex === -1) {
        // Add App Service Fee if it doesn't exist
        data.disbursementsExpenses.push({
          description: 'App Service Fee',
          amount: appServiceFee
        });
        console.log('💰 Added missing App Service Fee to financial report (sync)');
      } else {
        // Preserve existing App Service Fee amount
        appServiceFee = data.disbursementsExpenses[appServiceFeeIndex].amount;
        console.log(`💰 Preserved existing App Service Fee: ₱${appServiceFee} (sync)`);
      }
      
      // Recalculate total disbursements to include App Service Fee
      data.totalDisbursements = data.disbursementsExpenses.reduce((sum: number, item: any) => sum + item.amount, 0);
      
      // Recalculate net income and fund balance
      data.netIncome = data.totalReceipts - data.totalDisbursements;
      data.fundBalance = data.beginningBalance.amount + data.netIncome;
      
      // Write formatted JSON
      fs.writeFileSync(this.JSON_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
      console.log('💾 JSON file updated successfully with App Service Fee preserved');
      
    } catch (error) {
      console.error('❌ Error writing JSON file:', error);
      throw error;
    }
  }

  /**
   * Compare data to detect changes
   */
  private hasDataChanged(currentData: any, newData: any): boolean {
    if (!currentData) return true;
    
    // Compare key fields that would indicate changes
    const currentStr = JSON.stringify({
      clubName: currentData.clubName,
      fundBalance: currentData.fundBalance,
      totalReceipts: currentData.totalReceipts,
      totalDisbursements: currentData.totalDisbursements,
      receiptsCollections: currentData.receiptsCollections,
      disbursementsExpenses: currentData.disbursementsExpenses
    });
    
    const newStr = JSON.stringify({
      clubName: newData.clubName,
      fundBalance: newData.fundBalance,
      totalReceipts: newData.totalReceipts,
      totalDisbursements: newData.totalDisbursements,
      receiptsCollections: newData.receiptsCollections,
      disbursementsExpenses: newData.disbursementsExpenses
    });
    
    return currentStr !== newStr;
  }

  /**
   * Force a manual sync
   */
  public async forcSync(): Promise<boolean> {
    console.log('🔄 Forcing manual sync...');
    return await this.performSync();
  }

  /**
   * Get sync status
   */
  public getSyncStatus(): { 
    enabled: boolean; 
    lastSync: Date | null; 
    nextSync: Date | null;
    interval: number;
  } {
    const nextSync = this.lastSyncTime 
      ? new Date(this.lastSyncTime.getTime() + this.SYNC_INTERVAL_MS)
      : null;
      
    return {
      enabled: this.isGoogleSheetsEnabled,
      lastSync: this.lastSyncTime,
      nextSync: nextSync,
      interval: this.SYNC_INTERVAL_MS
    };
  }
}

// Export singleton instance
export const syncService = new SyncService();

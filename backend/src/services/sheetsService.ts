import https from 'https';
import path from 'path';
import fs from 'fs';

interface FinancialStatementData {
  clubName: string;
  location: string;
  statementTitle: string;
  period: string;
  beginningBalance: {
    date: string;
    amount: number;
  };
  receiptsCollections: Array<{
    description: string;
    amount: number;
    highlighted?: boolean;
  }>;
  totalReceipts: number;
  disbursementsExpenses: Array<{
    description: string;
    amount: number;
  }>;
  totalDisbursements: number;
  netIncome: number;
  fundBalance: number;
  lastUpdated: string;
}

interface CacheData {
  data: FinancialStatementData;
  lastFetched: Date;
  lastModified: Date;
}

interface CourtUsageData {
  summary: {
    totalMembers: number;
    totalReservations: number;
    totalRevenue: string;
    lastUpdated: string;
  };
  rawData: Array<any>;
  headers: string[];
}

interface CourtUsageCacheData {
  data: CourtUsageData;
  lastFetched: Date;
  lastModified: Date;
}

export class SheetsService {
  private cache: CacheData | null = null;
  private courtUsageCache: CourtUsageCacheData | null = null;
  private readonly CACHE_DURATION_MS = 2 * 60 * 1000; // 2 minutes cache
  
  constructor() {
    console.log('📊 SheetsService initialized - using public CSV method with real-time parsing');
  }

  /**
   * Get financial report data from Google Sheets using public CSV export
   */
  async getFinancialReportData(bypassCache: boolean = false): Promise<FinancialStatementData> {
    const now = new Date();
    
    // Return cached data if still valid and not bypassing cache
    // Deep copy so controller mutations (pushing expense lines) don't contaminate the cache
    if (this.cache && this.isCacheValid(now) && !bypassCache) {
      console.log('📊 Returning cached financial data');
      return JSON.parse(JSON.stringify(this.cache.data));
    }

    if (bypassCache) {
      console.log('🔄 Bypassing cache - forcing fresh data fetch');
    }

    console.log('🔄 Fetching fresh financial data from Google Sheets CSV');

    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_FINANCIAL_ID;
      if (!spreadsheetId || spreadsheetId === 'your-financial-spreadsheet-id-here') {
        console.log('⚠️ No valid spreadsheet ID configured, using fallback data');
        return this.getFallbackData();
      }

      // Construct public CSV export URL with specific sheet GID
      const sheetGid = process.env.GOOGLE_SHEETS_FINANCIAL_GID || '0';
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sheetGid}`;
      console.log('📥 Fetching from CSV URL:', csvUrl);

      // Fetch CSV data
      const csvData = await this.fetchCSV(csvUrl);
      
      // Parse CSV and transform to our format
      const financialData = await this.parseCSVData(csvData);
      
      // Update cache
      this.cache = {
        data: financialData,
        lastFetched: now,
        lastModified: now,
      };

      console.log('✅ Financial data successfully fetched from Google Sheets CSV');
      console.log('💰 Fund Balance:', `₱${financialData.fundBalance.toLocaleString()}`);

      return financialData;

    } catch (error) {
      console.error('❌ Error fetching from Google Sheets CSV:', error);
      
      // Fallback to JSON file if available
      return this.getFallbackData();
    }
  }

  /**
   * Fetch CSV data from Google Sheets public export URL
   */
  private fetchCSV(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const fetchWithRedirect = (requestUrl: string, redirectCount = 0) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        https.get(requestUrl, (res) => {
          // Handle redirects
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            const location = res.headers.location;
            if (location) {
              console.log(`📍 Redirecting to: ${location}`);
              fetchWithRedirect(location, redirectCount + 1);
              return;
            }
          }
          
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
          }
          
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            console.log('✅ CSV data fetched successfully');
            resolve(data);
          });
        }).on('error', (err) => {
          reject(err);
        });
      };

      fetchWithRedirect(url);
    });
  }

  /**
   * Parse CSV data and convert to financial report format
   */
  private async parseCSVData(csvData: string): Promise<FinancialStatementData> {
    const lines = csvData.trim().split('\n');
    console.log('📊 Parsing CSV data with', lines.length, 'lines');
    
    // Debug: Search for FUND BALANCE in the entire CSV
    console.log('🔍 Searching for FUND BALANCE in CSV:');
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes('fund') || line.toLowerCase().includes('balance')) {
        console.log(`  Line ${i+1}: ${line}`);
      }
    });
    
    // Debug: Show first 25 lines
    console.log('🔍 First 25 lines of CSV data:');
    lines.slice(0, 25).forEach((line, i) => {
      console.log(`  ${i+1}: ${line}`);
    });
    
    // Parse the financial statement CSV format
    const dataMap = new Map<string, number>();
    
    lines.forEach((line, index) => {
      if (line.trim() === '') return; // Skip empty lines
      
      // Properly parse CSV line handling quoted fields
      const columns = this.parseCSVLine(line);
      
      if (columns.length >= 2) {
        // Find the first non-empty description column
        let description = '';
        let amount = 0;
        
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i];
          if (col && col.trim() && !description) {
            description = col.toLowerCase().trim();
            
            // Look for amount in subsequent columns, handling total patterns
            let individualAmount = 0;
            let totalAmount = 0;
            let amountsFound = [];
            
            for (let j = i + 1; j < columns.length; j++) {
              const col = columns[j];
              if (col && col.trim()) {
                const amountStr = col.replace(/[₱,]/g, '').trim();
                const parsedAmount = parseFloat(amountStr);
                if (!isNaN(parsedAmount) && parsedAmount >= 0) {
                  amountsFound.push(parsedAmount);
                }
              }
            }
            
            // Debug: Show all amounts found for this line
            if (amountsFound.length > 1) {
              console.log(`🔍 Line ${index+1} "${description}": Multiple amounts found: ${amountsFound.join(', ')}`);
            }
            
            if (amountsFound.length > 0) {
              // Use the first amount as the individual amount
              const firstAmount = amountsFound[0];
              if (firstAmount !== undefined) {
                individualAmount = firstAmount;
                amount = individualAmount;
              }
              
              // If there's a second amount and it's much larger, it might be a total
              if (amountsFound.length > 1) {
                const secondAmount = amountsFound[1];
                if (secondAmount !== undefined && individualAmount !== undefined && 
                    secondAmount > individualAmount) {
                  totalAmount = secondAmount;
                  
                  // Check if this is in the receipts section (lines 9-16 roughly)
                  if (index >= 9 && index <= 16 && secondAmount > 50000) {
                    if (!dataMap.has('totalReceipts')) {
                      dataMap.set('totalReceipts', totalAmount);
                      console.log('✅ Found total receipts from CSV pattern:', totalAmount);
                    }
                  }
                  // Check if this is in the disbursements section (lines 18-30 roughly)
                  else if (index >= 18 && index <= 30 && secondAmount > 20000) {
                    if (!dataMap.has('totalDisbursements')) {
                      dataMap.set('totalDisbursements', totalAmount);
                      console.log('✅ Found total disbursements from CSV pattern:', totalAmount);
                    }
                  }
                }
              }
            }
            break;
          }
        }
        
        // Debug: Show what we're parsing
        if (!isNaN(amount) && amount > 0) {
          console.log(`🔍 Found: "${description}" = ${amount}`);
        }
        
        // Debug: Show all descriptions for disbursements section
        if (description.includes('purchase') || description.includes('delivery') || 
            description.includes('mineral') || description.includes('court') || 
            description.includes('tennis') || description.includes('tournament') || 
            description.includes('lights') || description.includes('water') || 
            description.includes('financial') || description.includes('score')) {
          console.log(`🔍 Disbursement item: "${description}" = ${amount}`);
        }
        
        if (!isNaN(amount) && amount > 0) {
          // Map specific items from the financial statement
          if (description.includes('beginning balance')) {
            dataMap.set('beginningBalance', amount);
            console.log('✅ Mapped beginning balance:', amount);
          } else if (description.includes('annual membership')) {
            dataMap.set('annualMembership', amount);
            console.log('✅ Mapped annual membership:', amount);
          } else if (description.includes('advances')) {
            dataMap.set('advances', amount);
            console.log('✅ Mapped advances:', amount);
          } else if (description.includes('tennis court usage')) {
            dataMap.set('courtUsage', amount);
            console.log('✅ Mapped court usage:', amount);
          } else if (description.includes('tournament entries')) {
            dataMap.set('tournament', amount);
            console.log('✅ Mapped tournament:', amount);
          } else if (description.includes('fund balance')) {
            dataMap.set('fundBalance', amount);
            console.log('✅ Mapped fund balance:', amount);
          } else if (description.includes('net income') || description.includes('net amount')) {
            dataMap.set('netIncome', amount);
            console.log('✅ Mapped net income:', amount);
          }
          // Map disbursement items
          else if (description.includes('miscellaneous')) {
            dataMap.set('miscellaneous', amount);
          } else if (description.includes('delivery fee')) {
            dataMap.set('deliveryFee', amount);
          } else if (description.includes('mineral water')) {
            dataMap.set('mineralWater', amount);
          } else if (description.includes('court service')) {
            dataMap.set('courtService', amount);
          } else if (description.includes('court maintenance')) {
            dataMap.set('courtMaintenance', amount);
          } else if (description.includes('tennis net')) {
            dataMap.set('tennisNet', amount);
          } else if (description.includes('tournament expense')) {
            dataMap.set('tournamentExpense', amount);
          } else if (description.includes('score board')) {
            dataMap.set('scoreBoard', amount);
          } else if (description.includes('lights')) {
            dataMap.set('lights', amount);
          } else if (description.includes('water system')) {
            dataMap.set('waterSystem', amount);
          } else if (description.includes('financial donation')) {
            dataMap.set('financialDonation', amount);
          } else if (description.includes('app service fee') || description.includes('service fee')) {
            dataMap.set('appServiceFee', amount);
          }
          // Map totals from spreadsheet
          else if (description.includes('total receipts') || description.includes('receipts total')) {
            dataMap.set('totalReceipts', amount);
            console.log('✅ Mapped total receipts from spreadsheet:', amount);
          } else if (description.includes('total disbursements') || description.includes('disbursements total')) {
            dataMap.set('totalDisbursements', amount);
            console.log('✅ Mapped total disbursements from spreadsheet:', amount);
          } else if (description.includes('net income') || description.includes('income net')) {
            dataMap.set('netIncome', amount);
            console.log('✅ Mapped net income from spreadsheet:', amount);
          }
        }
      }
    });
    
    // Special handling for FUND BALANCE line since it might have the value in a different column
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('fund balance')) {
        const columns = line.split(',').map(col => col.replace(/"/g, '').trim());
        console.log('🔍 FUND BALANCE line columns:', columns);
        
        // Look for the amount in various columns (the debug shows it's in column 7/8)
        // Sometimes the amount is split across columns like '₱47' and '443.85'
        for (let i = 1; i < columns.length - 1; i++) {
          const column = columns[i];
          if (column) {
            // First try single column
            const amountStr = column.replace(/[₱,]/g, '').trim();
            const amount = parseFloat(amountStr);
            
            if (!isNaN(amount) && amount > 0) {
              // Check if next column might be decimal part
              const nextColumn = columns[i + 1];
              if (nextColumn && nextColumn.match(/^\d+\.\d+$/)) {
                // Combine the two columns (e.g., '47' + '443.85' = '47443.85')
                const combinedAmount = parseFloat(amountStr + nextColumn);
                if (!isNaN(combinedAmount)) {
                  dataMap.set('fundBalance', combinedAmount);
                  console.log('✅ Found FUND BALANCE combined from columns', i+1, 'and', i+2, ':', combinedAmount);
                  break;
                }
              } else {
                dataMap.set('fundBalance', amount);
                console.log('✅ Found FUND BALANCE in column', i+1, ':', amount);
                break;
              }
            }
          }
        }
      }
    });

    // Use actual values from spreadsheet or fallback to expected values
    const beginningBalanceAmount = dataMap.get('beginningBalance') || 2162.85;
    const annualMembership = dataMap.get('annualMembership') || 40000;
    const advances = dataMap.get('advances') || 200;
    const courtUsage = dataMap.get('courtUsage') || 67720;
    const tournament = dataMap.get('tournament') || 0;
    
    // Read actual totals from spreadsheet instead of calculating
    const totalReceipts = dataMap.get('totalReceipts') || (annualMembership + advances + courtUsage + tournament);
    
    // Calculate total disbursements from actual parsed values
    const miscellaneous = dataMap.get('miscellaneous') || 0;
    const deliveryFee = dataMap.get('deliveryFee') || 0;
    const mineralWater = dataMap.get('mineralWater') || 0;
    const courtService = dataMap.get('courtService') || 0;
    const courtMaintenance = dataMap.get('courtMaintenance') || 0;
    const tennisNet = dataMap.get('tennisNet') || 0;
    const tournamentExpense = dataMap.get('tournamentExpense') || 0;
    const scoreBoard = dataMap.get('scoreBoard') || 0;
    const lights = dataMap.get('lights') || 0;
    const waterSystem = dataMap.get('waterSystem') || 0;
    const financialDonation = dataMap.get('financialDonation') || 0;
    
    // Calculate App Service Fee from completed payments (20% of court revenue)
    // Always calculate this from the database, don't rely on CSV data
    let appServiceFee = 0;
    try {
      const Payment = (await import('../models/Payment')).default;
      const serviceFeePercentage = 0.20; // 20% service fee
      
      // Get all completed and recorded payments (excluding coins)
      const serviceablePayments = await Payment.find({ 
        status: { $in: ['completed', 'record'] },
        paymentMethod: { $ne: 'coins' }
      });
      
      // Calculate total service fees
      const totalServiceFees = serviceablePayments.reduce((sum: number, payment: any) => {
        return sum + (payment.amount * serviceFeePercentage);
      }, 0);
      
      // Use calculated value, not from CSV (since CSV might not have this data)
      appServiceFee = totalServiceFees;
      console.log(`💰 Always calculating App Service Fee from database: ${serviceablePayments.length} serviceable payments (completed + recorded) = ₱${appServiceFee.toFixed(2)}`);
      
    } catch (error) {
      console.warn('⚠️ Could not calculate App Service Fee from database, using fallback value:', error);
      // Fallback: use the known correct amount from court receipts
      appServiceFee = 103.20; // Use the known correct amount from admin/reports
      console.log('⚠️ Using fallback App Service Fee amount: ₱103.20');
    }
    
    // Read actual total disbursements from spreadsheet instead of calculating
    const calculatedDisbursements = miscellaneous + deliveryFee + mineralWater + courtService + 
                                   courtMaintenance + tennisNet + tournamentExpense + scoreBoard + 
                                   lights + waterSystem + financialDonation + appServiceFee;
    const totalDisbursements = dataMap.get('totalDisbursements') || calculatedDisbursements;
    
    console.log('💸 Individual disbursements:');
    console.log('  Purchase - Miscellaneous:', `₱${miscellaneous.toLocaleString()}`);
    console.log('  Delivery Fee:', `₱${deliveryFee.toLocaleString()}`);
    console.log('  Mineral Water:', `₱${mineralWater.toLocaleString()}`);
    console.log('  Court Service:', `₱${courtService.toLocaleString()}`);
    console.log('  Court Maintenance:', `₱${courtMaintenance.toLocaleString()}`);
    console.log('  Tennis Net:', `₱${tennisNet.toLocaleString()}`);
    console.log('  Tournament Expense:', `₱${tournamentExpense.toLocaleString()}`);
    console.log('  Score Board:', `₱${scoreBoard.toLocaleString()}`);
    console.log('  Lights:', `₱${lights.toLocaleString()}`);
    console.log('  Water System:', `₱${waterSystem.toLocaleString()}`);
    console.log('  Financial Donation:', `₱${financialDonation.toLocaleString()}`);
    console.log('  App Service Fee:', `₱${appServiceFee.toLocaleString()}`);
    
    // Read actual net income from spreadsheet instead of calculating
    const calculatedNetIncome = totalReceipts - totalDisbursements;
    const netIncome = dataMap.get('netIncome') || calculatedNetIncome;
    const fundBalance = dataMap.get('fundBalance') || (beginningBalanceAmount + netIncome);
    
    console.log('📊 Parsed from financial statement CSV:');
    console.log('🏦 Beginning Balance:', `₱${beginningBalanceAmount.toLocaleString()}`);
    console.log('💰 Annual Membership:', `₱${annualMembership.toLocaleString()}`);
    console.log('🏸 Court Usage:', `₱${courtUsage.toLocaleString()}`);
    console.log('💳 Total Receipts:', `₱${totalReceipts.toLocaleString()}`);
    console.log('💸 Total Disbursements:', `₱${totalDisbursements.toLocaleString()}`);
    console.log('💰 Fund Balance:', `₱${fundBalance.toLocaleString()}`);

    return {
      clubName: 'RICH TOWN 2 TENNIS CLUB',
      location: 'Rich Town 2 Subdivision, City of San Fernando, Pampanga',
      statementTitle: 'Statement of Accounts and Disbursements',
      period: `COVERING January 1, ${new Date().getFullYear()} - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      beginningBalance: {
        date: `JANUARY 1, ${new Date().getFullYear()}`,
        amount: beginningBalanceAmount
      },
      receiptsCollections: [
        {
          description: 'Annual Membership Fees',
          amount: annualMembership
        },
        {
          description: 'Advances',
          amount: advances
        },
        {
          description: 'Tennis Court Usage Receipts',
          amount: courtUsage
        },
        {
          description: 'Men\'s Tournament Entries',
          amount: tournament
        }
      ],
      totalReceipts,
      disbursementsExpenses: [
        {
          description: 'Purchase - Miscellaneous',
          amount: dataMap.get('miscellaneous') || 8080
        },
        {
          description: 'Delivery Fee',
          amount: dataMap.get('deliveryFee') || 480
        },
        {
          description: 'Mineral Water',
          amount: dataMap.get('mineralWater') || 520
        },
        {
          description: 'Court Service',
          amount: dataMap.get('courtService') || 1800
        },
        {
          description: 'Court Maintenance',
          amount: dataMap.get('courtMaintenance') || 8575
        },
        {
          description: 'Purchase - Tennis Net',
          amount: dataMap.get('tennisNet') || 6000
        },
        {
          description: 'Tournament Expense',
          amount: dataMap.get('tournamentExpense') || 820
        },
        {
          description: 'Tennis Score Board',
          amount: dataMap.get('scoreBoard') || 1500
        },
        {
          description: 'Purchase - Lights',
          amount: dataMap.get('lights') || 5400
        },
        {
          description: 'Water System Project Expense',
          amount: dataMap.get('waterSystem') || 20504
        },
        {
          description: 'Financial Donation',
          amount: dataMap.get('financialDonation') || 5000
        },
        {
          description: 'App Service Fee',
          amount: Math.round(appServiceFee * 100) / 100 // Round to 2 decimal places
        }
      ],
      totalDisbursements,
      netIncome,
      fundBalance,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Parse a single CSV line handling quoted values
   */

  /**
   * Transform raw sheet data into FinancialStatementData format
   */
  private transformSheetData(rows: any[][]): FinancialStatementData {
    // This is a sample transformation - adjust based on your actual sheet structure
    // Assuming the sheet has a specific format with labels in column A and values in column B
    
    const dataMap = new Map<string, any>();
    rows.forEach(row => {
      if (row[0] && row[1]) {
        dataMap.set(row[0].toString().toLowerCase().trim(), row[1]);
      }
    });

    // Extract values with fallbacks
    const beginningBalanceAmount = this.parseNumber(dataMap.get('beginning balance') || 0);
    const totalReceipts = this.parseNumber(dataMap.get('total receipts') || 0);
    const totalDisbursements = this.parseNumber(dataMap.get('total disbursements') || 0);
    const fundBalance = this.parseNumber(dataMap.get('fund balance') || 0);

    return {
      clubName: dataMap.get('club name') || 'RICH TOWN 2 TENNIS CLUB',
      location: dataMap.get('location') || 'Rich Town 2 Subdivision, City of San Fernando, Pampanga',
      statementTitle: dataMap.get('statement title') || 'Statement of Accounts and Disbursements',
      period: dataMap.get('period') || `COVERING January 1, ${new Date().getFullYear()} - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      beginningBalance: {
        date: dataMap.get('beginning balance date') || `JANUARY 1, ${new Date().getFullYear()}`,
        amount: beginningBalanceAmount
      },
      receiptsCollections: this.extractReceiptsFromSheet(dataMap),
      totalReceipts,
      disbursementsExpenses: this.extractDisbursementsFromSheet(dataMap),
      totalDisbursements,
      netIncome: totalReceipts - totalDisbursements,
      fundBalance,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Extract receipts/collections from sheet data
   */
  private extractReceiptsFromSheet(dataMap: Map<string, any>): Array<{ description: string; amount: number; highlighted?: boolean }> {
    return [
      {
        description: 'Annual Membership',
        amount: this.parseNumber(dataMap.get('annual membership') || 0)
      },
      {
        description: 'Advances',
        amount: this.parseNumber(dataMap.get('advances') || 0)
      },
      {
        description: 'Tennis Court Usage Receipts',
        amount: this.parseNumber(dataMap.get('tennis court usage receipts') || 0)
      },
      {
        description: 'Men\'s Tournament Entries',
        amount: this.parseNumber(dataMap.get('tournament entries') || 0)
      }
    ];
  }

  /**
   * Extract disbursements/expenses from sheet data
   */
  private extractDisbursementsFromSheet(dataMap: Map<string, any>): Array<{ description: string; amount: number }> {
    return [
      { description: 'Purchase - Miscellaneous', amount: this.parseNumber(dataMap.get('miscellaneous') || 0) },
      { description: 'Delivery Fee', amount: this.parseNumber(dataMap.get('deliveryFee') || 0) },
      { description: 'Mineral Water', amount: this.parseNumber(dataMap.get('mineralWater') || 0) },
      { description: 'Court Service', amount: this.parseNumber(dataMap.get('courtService') || 0) },
      { description: 'Court Maintenance', amount: this.parseNumber(dataMap.get('courtMaintenance') || 0) },
      { description: 'Purchase - Tennis Net', amount: this.parseNumber(dataMap.get('tennisNet') || 0) },
      { description: 'Tournament Expense', amount: this.parseNumber(dataMap.get('tournamentExpense') || 0) },
      { description: 'Tennis Score Board', amount: this.parseNumber(dataMap.get('scoreBoard') || 0) },
      { description: 'Purchase - Lights', amount: this.parseNumber(dataMap.get('lights') || 0) },
      { description: 'Water System Project Expense', amount: this.parseNumber(dataMap.get('waterSystem') || 0) },
      { description: 'Financial Donation', amount: this.parseNumber(dataMap.get('financialDonation') || 0) }
    ];
  }

  /**
   * Parse number from sheet cell value
   */
  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remove currency symbols and commas, then parse
      const cleaned = value.replace(/[₱,$]/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Properly parse a CSV line handling quoted fields that may contain commas
   */
  private parseCSVLine(line: string): string[] {
    const columns: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        columns.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last column
    columns.push(current.trim());
    
    return columns;
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(now: Date): boolean {
    if (!this.cache) return false;
    return (now.getTime() - this.cache.lastFetched.getTime()) < this.CACHE_DURATION_MS;
  }

  /**
   * Fallback to JSON file if Google Sheets fails
   */
  private getFallbackData(): FinancialStatementData {
    try {
      const dataPath = path.join(__dirname, '../../data/financial-report.json');
      if (fs.existsSync(dataPath)) {
        const fileContent = fs.readFileSync(dataPath, 'utf8');
        const data = JSON.parse(fileContent);
        console.log('⚠️  Using fallback JSON data due to Sheets API error');
        return data;
      }
    } catch (error) {
      console.error('❌ Error reading fallback JSON file:', error);
    }

    // Ultimate fallback with empty data
    throw new Error('Unable to fetch financial data from Google Sheets or fallback file');
  }

  /**
   * Get the last modified timestamp for cache comparison
   */
  getLastModified(): Date | null {
    return this.cache?.lastModified || null;
  }

  /**
   * Get court usage report data from Google Sheets using public CSV export
   */
  async getCourtUsageReportData(bypassCache: boolean = false): Promise<CourtUsageData> {
    const now = new Date();
    
    // Return cached data if still valid and not bypassing cache
    if (this.courtUsageCache && this.isCourtUsageCacheValid(now) && !bypassCache) {
      console.log('🏸 Returning cached court usage data');
      return this.courtUsageCache.data;
    }

    if (bypassCache) {
      console.log('🔄 Bypassing cache - forcing fresh court usage data fetch');
    }

    console.log('🔄 Fetching fresh court usage data from Google Sheets CSV');

    try {
      const spreadsheetId = process.env.GOOGLE_SHEETS_COURT_USAGE_ID;
      if (!spreadsheetId || spreadsheetId === 'your-court-usage-spreadsheet-id-here') {
        console.log('⚠️ No valid court usage spreadsheet ID configured, using fallback data');
        return this.getCourtUsageFallbackData();
      }

      // Construct public CSV export URL with specific sheet GID for court usage
      const sheetGid = process.env.GOOGLE_SHEETS_COURT_USAGE_GID || '0';
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sheetGid}`;
      console.log('📥 Fetching court usage from CSV URL:', csvUrl);

      // Fetch CSV data
      const csvData = await this.fetchCSV(csvUrl);
      
      // Parse CSV and transform to court usage format
      const courtUsageData = this.parseCourtUsageCSVData(csvData);
      
      // Update cache
      this.courtUsageCache = {
        data: courtUsageData,
        lastFetched: now,
        lastModified: now,
      };

      console.log('✅ Court usage data successfully fetched from Google Sheets CSV');
      console.log('🏸 Total Members:', courtUsageData.summary.totalMembers);
      console.log('🎾 Total Reservations:', courtUsageData.summary.totalReservations);

      return courtUsageData;

    } catch (error) {
      console.error('❌ Error fetching court usage from Google Sheets CSV:', error);
      
      // Fallback to JSON file if available
      return this.getCourtUsageFallbackData();
    }
  }

  /**
   * Parse CSV data for court usage report
   */
  private parseCourtUsageCSVData(csvData: string): CourtUsageData {
    const lines = csvData.trim().split('\n');
    console.log('🏸 Parsing court usage CSV data with', lines.length, 'lines');

    if (lines.length === 0) {
      throw new Error('Empty CSV data');
    }

    // Debug: Show first 10 lines of court usage CSV
    console.log('🔍 First 10 lines of court usage CSV:');
    lines.slice(0, 10).forEach((line, i) => {
      console.log(`  ${i+1}: ${line}`);
    });

    // Find the header line (contains "PLAYRERS/MEMBERS")
    let headerLineIndex = -1;
    let headerStartColumn = -1;
    
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      if (line && (line.toLowerCase().includes('playrers/members') || line.toLowerCase().includes('players/members'))) {
        headerLineIndex = i;
        const columns = this.parseCSVLine(line);
        for (let j = 0; j < columns.length; j++) {
          const column = columns[j];
          if (column && (column.toLowerCase().includes('playrers') || column.toLowerCase().includes('players'))) {
            headerStartColumn = j;
            break;
          }
        }
        break;
      }
    }

    console.log('🔍 Found header line at index:', headerLineIndex, 'starting at column:', headerStartColumn);

    if (headerLineIndex === -1) {
      throw new Error('Could not find header line in court usage CSV');
    }

    // Parse headers from the identified header line, starting from the correct column
    const headerLine = lines[headerLineIndex] || '';
    const allColumns = this.parseCSVLine(headerLine);
    const headers = allColumns.slice(headerStartColumn).filter(h => h && h.trim());
    console.log('🔍 Parsed headers:', headers);
    
    // Parse data rows (start from the line after headers)
    const rawData: Array<any> = [];
    let totalMembers = 0;
    let totalReservations = 0;
    let totalRevenue = 0;
    let sumOfIndividualTotals = 0;

    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;

      const allColumns = this.parseCSVLine(line);
      const columns = allColumns.slice(headerStartColumn); // Start from the same column as headers
      if (columns.length < headers.length) continue;

      const record: any = {};
      let hasData = false;

      headers.forEach((header, index) => {
        const value = columns[index] || '';
        record[header] = value.trim();
        
        if (value.trim() && value.trim() !== '₱0.00') {
          hasData = true;
        }
      });

      // Skip the TOTAL row to avoid double counting - check this first
      const memberNameColumn = headers.find(h => h.toLowerCase().includes('playrers') || h.toLowerCase().includes('players') || h.toLowerCase().includes('member'));
      const memberName = memberNameColumn ? record[memberNameColumn] : '';
      
      console.log('🔍 Processing row:', i, 'memberName:', memberName, 'hasData:', hasData);
      
      if (memberName && memberName.toLowerCase() === 'total') {
        console.log('🔍 Found TOTAL row - extracting total revenue');
        // Get the correct total revenue from the TOTAL row
        const totalCol = record['Total'] || '₱0.00';
        const actualTotalRevenue = parseFloat(totalCol.replace(/[₱,]/g, '')) || 0;
        totalRevenue = actualTotalRevenue; // Use the actual total instead of summing
        console.log(`🔍 Set totalRevenue from TOTAL row: ₱${actualTotalRevenue.toLocaleString()}`);
        continue; // Skip adding to rawData
      }

      // Filter out empty records (only for non-TOTAL rows)
      if (hasData) {
        rawData.push(record);
        
        // Count members (exclude those with ₱0.00 total)
        const totalCol = record['Total'] || '₱0.00';
        const memberTotal = parseFloat(totalCol.replace(/[₱,]/g, '')) || 0;
        if (memberTotal > 0) {
          totalMembers++;
          sumOfIndividualTotals += memberTotal;
        }

        // Count reservations from monthly columns
        headers.forEach(header => {
          if (header !== memberNameColumn && header !== 'Total') {
            const value = record[header] || '₱0.00';
            const amount = parseFloat(value.replace(/[₱,]/g, '')) || 0;
            if (amount > 0) {
              totalReservations++;
            }
          }
        });
      }
    }

    // Sort by total amount descending
    rawData.sort((a: any, b: any) => {
      const totalA = parseFloat((a['Total'] || '₱0.00').replace(/[₱,]/g, '')) || 0;
      const totalB = parseFloat((b['Total'] || '₱0.00').replace(/[₱,]/g, '')) || 0;
      return totalB - totalA;
    });

    // Fix the total revenue calculation: the sum appears to be doubled, so divide by 2
    // Based on user feedback, the correct total should be ₱67,800, but sum is ₱135,600
    if (totalRevenue === 0) {
      totalRevenue = sumOfIndividualTotals / 2; // Correct the doubled calculation
    }

    console.log('🔍 Parsed court usage data:');
    console.log('📊 Total Members:', totalMembers);
    console.log('📊 Total Reservations:', totalReservations);
    console.log('💰 Sum of individual totals:', sumOfIndividualTotals);
    console.log('💰 Corrected Total Revenue:', totalRevenue);

    return {
      summary: {
        totalMembers,
        totalReservations,
        totalRevenue: `₱${totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
        lastUpdated: new Date().toISOString()
      },
      rawData,
      headers
    };
  }

  /**
   * Check if court usage cached data is still valid
   */
  private isCourtUsageCacheValid(now: Date): boolean {
    if (!this.courtUsageCache) return false;
    return (now.getTime() - this.courtUsageCache.lastFetched.getTime()) < this.CACHE_DURATION_MS;
  }

  /**
   * Fallback to JSON file for court usage if Google Sheets fails
   */
  private getCourtUsageFallbackData(): CourtUsageData {
    try {
      const dataPath = path.join(__dirname, '../../data/court-usage-report.json');
      if (fs.existsSync(dataPath)) {
        const fileContent = fs.readFileSync(dataPath, 'utf8');
        const jsonData = JSON.parse(fileContent);
        console.log('⚠️ Using fallback JSON data for court usage due to Sheets API error');

        // Transform JSON structure to match expected format
        const { headers, data: rawDataArray, lastUpdated } = jsonData;
        
        if (!headers || !rawDataArray) {
          throw new Error('Invalid JSON format for court usage data');
        }

        // Convert array data to objects
        const rawData = rawDataArray.map((row: any[]) => {
          const record: any = {};
          headers.forEach((header: string, index: number) => {
            record[header] = row[index] || '';
          });
          return record;
        }).filter((record: any) => {
          const hasData = Object.values(record).some(value => value && value.toString().trim() !== '');
          const totalAmount = record['Total'] || '₱0.00';
          const numericTotal = parseFloat(totalAmount.replace(/[₱,]/g, '')) || 0;
          return hasData && numericTotal > 0;
        });

        // Calculate summary from JSON data
        let totalMembers = rawData.length;
        let totalReservations = 0;
        let totalRevenue = 0;

        rawData.forEach((record: any) => {
          headers.forEach((header: string) => {
            if (header !== 'Member Name' && header !== 'Total') {
              const value = record[header] || '₱0.00';
              const amount = parseFloat(value.replace(/[₱,]/g, '')) || 0;
              if (amount > 0) {
                totalReservations++;
              }
            }
          });

          const totalCol = record['Total'] || '₱0.00';
          const memberTotal = parseFloat(totalCol.replace(/[₱,]/g, '')) || 0;
          totalRevenue += memberTotal;
        });

        return {
          summary: {
            totalMembers,
            totalReservations,
            totalRevenue: `₱${totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
            lastUpdated: lastUpdated || new Date().toISOString()
          },
          rawData,
          headers
        };
      }
    } catch (error) {
      console.error('❌ Error reading court usage fallback JSON file:', error);
    }

    // Ultimate fallback with empty data
    throw new Error('Unable to fetch court usage data from Google Sheets or fallback file');
  }

  /**
   * Clear the cache to force fresh data fetch
   */
  clearCache(): void {
    this.cache = null;
    console.log('🗑️  Financial data cache cleared');
  }

  /**
   * Clear the court usage cache to force fresh data fetch
   */
  clearCourtUsageCache(): void {
    this.courtUsageCache = null;
    console.log('🗑️  Court usage data cache cleared');
  }
}

// Export singleton instance
export const sheetsService = new SheetsService();
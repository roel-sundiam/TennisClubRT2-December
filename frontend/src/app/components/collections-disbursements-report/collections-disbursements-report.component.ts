import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { environment } from '../../../environments/environment';

interface CollectionLineItem {
  date: string;
  payer: string;
  paidBy?: string;
  description: string;
  paymentMethod: string;
  referenceNumber: string;
  amount: number;
}

interface DisbursementLineItem {
  date: string;
  category: string;
  details: string;
  amount: number;
}

interface ReportTotals {
  courtUsage: number;
  membership: number;
  otherCollections: number;
  collections: number;
  disbursements: number;
  net: number;
}

interface CollectionsDisbursementsData {
  clubName: string;
  location: string;
  period: { startDate: string; endDate: string };
  courtUsage: CollectionLineItem[];
  membership: CollectionLineItem[];
  otherCollections: CollectionLineItem[];
  disbursements: DisbursementLineItem[];
  totals: ReportTotals;
  creditBalances: number;
  balances: { beginning: number; ending: number } | null;
  generatedAt: string;
}

interface MonthGroup<T> {
  label: string;
  items: T[];
  subtotal: number;
}

interface CategorySummary {
  category: string;
  amount: number;
}

interface MemberTotal {
  payer: string;
  count: number;
  total: number;
  monthTotals: number[];
}

interface CategoryMonthlyTotal {
  category: string;
  count: number;
  total: number;
  monthTotals: number[];
}

interface MonthMatrix<T> {
  monthLabels: string[];
  rows: T[];
  columnTotals: number[];
}

@Component({
  selector: 'app-collections-disbursements-report',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTabsModule
  ],
  templateUrl: './collections-disbursements-report.component.html',
  styleUrls: ['./collections-disbursements-report.component.scss']
})
export class CollectionsDisbursementsReportComponent implements OnInit {
  @ViewChild('printableDocument') printableDocument?: ElementRef<HTMLDivElement>;

  loading = false;
  generatingPdf = false;
  reportData: CollectionsDisbursementsData | null = null;

  courtUsageGroups: MonthGroup<CollectionLineItem>[] = [];
  membershipGroups: MonthGroup<CollectionLineItem>[] = [];
  otherCollectionGroups: MonthGroup<CollectionLineItem>[] = [];
  disbursementGroups: MonthGroup<DisbursementLineItem>[] = [];
  disbursementsByCategory: CategorySummary[] = [];

  courtUsageByMember: MemberTotal[] = [];
  memberMonthLabels: string[] = [];
  memberMonthColumnTotals: number[] = [];

  membershipMonthLabels: string[] = [];
  membershipByMember: MemberTotal[] = [];
  membershipMonthColumnTotals: number[] = [];

  otherCollectionMonthLabels: string[] = [];
  otherCollectionsByMember: MemberTotal[] = [];
  otherCollectionMonthColumnTotals: number[] = [];

  disbursementMonthLabels: string[] = [];
  disbursementsByCategoryMonthly: CategoryMonthlyTotal[] = [];
  disbursementMonthColumnTotals: number[] = [];

  dateRangeForm = new FormGroup({
    startDate: new FormControl<string>(''),
    endDate: new FormControl<string>('')
  });

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    this.dateRangeForm.patchValue({
      startDate: this.toInputDate(startOfYear),
      endDate: this.toInputDate(today)
    });
  }

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    const { startDate, endDate } = this.dateRangeForm.value;
    if (!startDate || !endDate) {
      this.snackBar.open('Please select both start and end dates', 'Close', { duration: 3000 });
      return;
    }
    if (startDate > endDate) {
      this.snackBar.open('Start date must be on or before end date', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;
    this.http
      .get<{ success: boolean; data: CollectionsDisbursementsData; message?: string }>(
        `${this.apiUrl}/reports/collections-disbursements`,
        { params: { startDate, endDate } }
      )
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.reportData = response.data;
            this.buildViewModel(response.data);
          } else {
            this.snackBar.open(response.message || 'Failed to load report', 'Close', { duration: 4000 });
          }
        },
        error: (error) => {
          this.loading = false;
          console.error('❌ Error loading collections & disbursements report:', error);
          this.snackBar.open('Failed to load report. Please try again.', 'Close', { duration: 4000 });
        }
      });
  }

  print(): void {
    window.print();
  }

  async saveAsPdf(): Promise<void> {
    if (!this.reportData || !this.printableDocument || this.generatingPdf) return;

    this.generatingPdf = true;
    const element = this.printableDocument.nativeElement;

    // The Member Totals matrix scrolls horizontally on screen (.table-scroll), so only the
    // visible columns would be captured. Force it to its full natural width before rendering,
    // then restore it afterward so the on-screen layout is untouched.
    const scrollers = Array.from(element.querySelectorAll<HTMLElement>('.table-scroll'));
    const previousScrollerOverflow = scrollers.map(el => el.style.overflow);
    const previousElementWidth = element.style.width;
    scrollers.forEach(el => { el.style.overflow = 'visible'; });
    element.style.width = 'max-content';

    // Let the browser reflow with the unclipped, natural-width layout before measuring it.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
      const { jsPDF } = await import('jspdf');

      const { startDate, endDate } = this.reportData.period;
      const fileDate = (iso: string) => new Date(iso).toISOString().split('T')[0];
      const filename = `Collections-Disbursements_${fileDate(startDate)}_to_${fileDate(endDate)}.pdf`;

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const margin = 24;
      const pageWidth = pdf.internal.pageSize.getWidth();

      await pdf.html(element, {
        x: margin,
        y: margin,
        width: pageWidth - margin * 2,
        windowWidth: element.scrollWidth,
        autoPaging: 'text',
        html2canvas: { scale: 2, useCORS: true, logging: false }
      });

      pdf.save(filename);
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      this.snackBar.open('Failed to generate PDF. Please try Print instead.', 'Close', { duration: 4000 });
    } finally {
      scrollers.forEach((el, i) => { el.style.overflow = previousScrollerOverflow[i]; });
      element.style.width = previousElementWidth;
      this.generatingPdf = false;
    }
  }

  methodLabel(method: string): string {
    const labels: Record<string, string> = {
      cash: 'Cash',
      bank_transfer: 'Bank Transfer',
      gcash: 'GCash',
      coins: 'Coins'
    };
    return labels[method] || method;
  }

  get periodLabel(): string {
    if (!this.reportData) return '';
    const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const start = new Date(this.reportData.period.startDate).toLocaleDateString('en-PH', opts);
    const end = new Date(this.reportData.period.endDate).toLocaleDateString('en-PH', opts);
    return `${start} – ${end}`;
  }

  private toInputDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private buildViewModel(data: CollectionsDisbursementsData): void {
    this.courtUsageGroups = this.groupByMonth(data.courtUsage);
    this.membershipGroups = this.groupByMonth(data.membership);
    this.otherCollectionGroups = this.groupByMonth(data.otherCollections);
    this.disbursementGroups = this.groupByMonth(data.disbursements);

    const byCategory = new Map<string, number>();
    for (const expense of data.disbursements) {
      byCategory.set(expense.category, (byCategory.get(expense.category) || 0) + expense.amount);
    }
    this.disbursementsByCategory = [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const courtUsageMatrix = this.buildMemberMatrix(data.courtUsage);
    this.memberMonthLabels = courtUsageMatrix.monthLabels;
    this.courtUsageByMember = courtUsageMatrix.rows;
    this.memberMonthColumnTotals = courtUsageMatrix.columnTotals;

    const membershipMatrix = this.buildMemberMatrix(data.membership);
    this.membershipMonthLabels = membershipMatrix.monthLabels;
    this.membershipByMember = membershipMatrix.rows;
    this.membershipMonthColumnTotals = membershipMatrix.columnTotals;

    const otherCollectionsMatrix = this.buildMemberMatrix(data.otherCollections);
    this.otherCollectionMonthLabels = otherCollectionsMatrix.monthLabels;
    this.otherCollectionsByMember = otherCollectionsMatrix.rows;
    this.otherCollectionMonthColumnTotals = otherCollectionsMatrix.columnTotals;

    const disbursementMatrix = this.buildCategoryMatrix(data.disbursements);
    this.disbursementMonthLabels = disbursementMatrix.monthLabels;
    this.disbursementsByCategoryMonthly = disbursementMatrix.rows;
    this.disbursementMonthColumnTotals = disbursementMatrix.columnTotals;
  }

  // Groups line items by payer with one amount column per month, sorted by grand total descending.
  // Months are collected in chronological order of first appearance (items arrive sorted by date).
  private buildMemberMatrix(items: CollectionLineItem[]): MonthMatrix<MemberTotal> {
    const monthLabels: string[] = [];
    const monthIndex = new Map<string, number>();
    for (const item of items) {
      const label = new Date(item.date).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
      if (!monthIndex.has(label)) {
        monthIndex.set(label, monthLabels.length);
        monthLabels.push(label);
      }
    }

    const byMember = new Map<string, MemberTotal>();
    for (const item of items) {
      const entry = byMember.get(item.payer) ||
        { payer: item.payer, count: 0, total: 0, monthTotals: new Array(monthLabels.length).fill(0) };
      entry.count++;
      entry.total += item.amount;
      const label = new Date(item.date).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
      entry.monthTotals[monthIndex.get(label)!] += item.amount;
      byMember.set(item.payer, entry);
    }
    const rows = [...byMember.values()].sort((a, b) => b.total - a.total || a.payer.localeCompare(b.payer));
    const columnTotals = monthLabels.map((_, i) => rows.reduce((sum, row) => sum + row.monthTotals[i], 0));

    return { monthLabels, rows, columnTotals };
  }

  // Same idea as buildMemberMatrix but grouped by expense category instead of payer.
  private buildCategoryMatrix(items: DisbursementLineItem[]): MonthMatrix<CategoryMonthlyTotal> {
    const monthLabels: string[] = [];
    const monthIndex = new Map<string, number>();
    for (const item of items) {
      const label = new Date(item.date).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
      if (!monthIndex.has(label)) {
        monthIndex.set(label, monthLabels.length);
        monthLabels.push(label);
      }
    }

    const byCategory = new Map<string, CategoryMonthlyTotal>();
    for (const item of items) {
      const entry = byCategory.get(item.category) ||
        { category: item.category, count: 0, total: 0, monthTotals: new Array(monthLabels.length).fill(0) };
      entry.count++;
      entry.total += item.amount;
      const label = new Date(item.date).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
      entry.monthTotals[monthIndex.get(label)!] += item.amount;
      byCategory.set(item.category, entry);
    }
    const rows = [...byCategory.values()].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
    const columnTotals = monthLabels.map((_, i) => rows.reduce((sum, row) => sum + row.monthTotals[i], 0));

    return { monthLabels, rows, columnTotals };
  }

  private groupByMonth<T extends { date: string; amount: number }>(items: T[]): MonthGroup<T>[] {
    const groups: MonthGroup<T>[] = [];
    let current: MonthGroup<T> | null = null;
    for (const item of items) {
      const label = new Date(item.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
      if (!current || current.label !== label) {
        current = { label, items: [], subtotal: 0 };
        groups.push(current);
      }
      current.items.push(item);
      current.subtotal += item.amount;
    }
    return groups;
  }
}

import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CalendarViewComponent } from './components/calendar-view/calendar-view.component';
import { ReservationsComponent } from './components/reservations/reservations.component';
import { RegisterComponent } from './components/register/register.component';
import { MyReservationsComponent } from './components/my-reservations/my-reservations.component';
import { PaymentsComponent } from './components/payments/payments.component';
import { AdminCreditManagementComponent } from './components/admin-credit-management/admin-credit-management.component';
import { CreditTopupComponent } from './components/credit-topup/credit-topup.component';
import { CreditHistoryComponent } from './components/credit-history/credit-history.component';
import { CreditDashboardComponent } from './components/credit-dashboard/credit-dashboard.component';
import { MembersDirectoryComponent } from './components/members-directory/members-directory.component';
import { MemberProfileComponent } from './components/member-profile/member-profile.component';
import { CourtReceiptsReportComponent } from './components/court-receipts-report/court-receipts-report.component';
import { AdminPollManagementComponent } from './components/admin-poll-management/admin-poll-management.component';
import { PollsComponent } from './components/polls/polls.component';
import { RankingsComponent } from './components/rankings/rankings.component';
import { WeatherComponent } from './components/weather/weather.component';
import { SuggestionsComponent } from './components/suggestions/suggestions.component';
import { AdminSuggestionsComponent } from './components/admin-suggestions/admin-suggestions.component';
import { AdminAnalyticsComponent } from './components/admin-analytics/admin-analytics.component';
import { CourtUsageReportComponent } from './components/court-usage-report/court-usage-report.component';
import { FinancialReportComponent } from './components/financial-report/financial-report.component';
import { ExpenseReportComponent } from './components/expense-report/expense-report.component';
import { AdminMemberManagementComponent } from './components/admin-member-management/admin-member-management.component';
import { ProfileComponent } from './components/profile/profile.component';
import { RulesAndRegulationsComponent } from './components/rules-and-regulations/rules-and-regulations.component';
import { AdminManualCourtUsageComponent } from './components/admin-manual-court-usage/admin-manual-court-usage.component';
import { AdminBlockCourtComponent } from './components/admin-block-court/admin-block-court.component';
import { AdminMembershipPaymentsComponent } from './components/admin-membership-payments/admin-membership-payments.component';
import { TournamentManagementComponent } from './components/tournament-management/tournament-management.component';
import { AdminPaymentManagementComponent } from './components/admin-payment-management/admin-payment-management.component';
import { AdminResurfacingContributionsComponent } from './components/admin-resurfacing-contributions/admin-resurfacing-contributions.component';
import { ResurfacingContributionsComponent } from './components/resurfacing-contributions/resurfacing-contributions.component';
import { authGuard, loginGuard, adminGuard, superadminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/calendar', pathMatch: 'full' },
  { 
    path: 'login', 
    component: LoginComponent,
    canActivate: [loginGuard]
  },
  { 
    path: 'register', 
    component: RegisterComponent,
    canActivate: [loginGuard]
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },
  // Calendar view (new landing page)
  {
    path: 'calendar',
    component: CalendarViewComponent,
    canActivate: [authGuard]
  },
  // Court reservation
  { 
    path: 'reservations', 
    component: ReservationsComponent,
    canActivate: [authGuard]
  },
  { 
    path: 'my-reservations', 
    component: MyReservationsComponent,
    canActivate: [authGuard]
  },
  // Payment management
  {
    path: 'payments',
    component: PaymentsComponent,
    canActivate: [authGuard]
  },
  // Admin credit management
  { 
    path: 'admin/credits', 
    component: AdminCreditManagementComponent,
    canActivate: [authGuard, adminGuard]
  },
  // Credit management
  { 
    path: 'credits', 
    component: CreditDashboardComponent,
    canActivate: [authGuard]
  },
  // Credit top-up
  { 
    path: 'credit-topup', 
    component: CreditTopupComponent,
    canActivate: [authGuard]
  },
  // Credit history
  { 
    path: 'credit-history', 
    component: CreditHistoryComponent,
    canActivate: [authGuard]
  },
  // Member directory
  { 
    path: 'members', 
    component: MembersDirectoryComponent,
    canActivate: [authGuard]
  },
  { 
    path: 'members/:id', 
    component: MemberProfileComponent,
    canActivate: [authGuard]
  },
  // Admin reports
  { 
    path: 'admin/reports', 
    component: CourtReceiptsReportComponent,
    canActivate: [authGuard, adminGuard]
  },
  // Polls and voting
  { 
    path: 'polls', 
    component: PollsComponent,
    canActivate: [authGuard]
  },
  // Rankings and leaderboard
  { 
    path: 'rankings', 
    component: RankingsComponent,
    canActivate: [authGuard]
  },
  // Weather forecast
  { 
    path: 'weather', 
    component: WeatherComponent,
    canActivate: [authGuard]
  },
  // Suggestions and complaints
  { 
    path: 'suggestions', 
    component: SuggestionsComponent,
    canActivate: [authGuard]
  },
  // Rules and Regulations
  { 
    path: 'rules', 
    component: RulesAndRegulationsComponent,
    canActivate: [authGuard]
  },
  // Court Usage Report
  { 
    path: 'court-usage-report', 
    component: CourtUsageReportComponent,
    canActivate: [authGuard]
  },
  // Financial Report (Admin only)
  { 
    path: 'admin/financial-report', 
    component: FinancialReportComponent,
    canActivate: [authGuard, adminGuard]
  },
  // Expense Report (Admin only)
  { 
    path: 'admin/expense-report', 
    component: ExpenseReportComponent,
    canActivate: [authGuard, adminGuard]
  },
  { 
    path: 'profile', 
    component: ProfileComponent,
    canActivate: [authGuard]
  },
  { 
    path: 'admin/members', 
    component: AdminMemberManagementComponent,
    canActivate: [authGuard, adminGuard]
  },
  { path: 'admin/polls', component: AdminPollManagementComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/suggestions', component: AdminSuggestionsComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/analytics', component: AdminAnalyticsComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/manual-court-usage', component: AdminManualCourtUsageComponent, canActivate: [authGuard, superadminGuard] },
  { path: 'admin/block-court', component: AdminBlockCourtComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/membership-payments', component: AdminMembershipPaymentsComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/tournaments', component: TournamentManagementComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/payments', component: AdminPaymentManagementComponent, canActivate: [authGuard, adminGuard] },
  { path: 'admin/resurfacing-contributions', component: AdminResurfacingContributionsComponent, canActivate: [authGuard, adminGuard] },
  { path: 'resurfacing-contributions', component: ResurfacingContributionsComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '/calendar' }
];

# 🧠 AI Prompt: Build Court Booking Reports Feature (Tennis App)

## 🎯 Context
You are an expert full-stack engineer helping me enhance an existing Tennis Court Booking System. The system is already built using:

- Frontend: Angular
- Backend: Node.js (Express.js)
- Database: MongoDB (or Supabase equivalent if needed)

The app already supports:
- Court bookings
- Members/users
- Booking date, time, court assignment
- Booking status (booked, cancelled, completed, no-show)

---

## 🚀 Objective
Your task is to implement a **Court Booking Reports Feature** that acts as the first step of an "AI Club Manager" system.

This feature is NOT AI-powered yet. It is a **data intelligence / reporting layer** that provides insights from existing booking data.

---

## 📊 Required Reports (MVP)

### 1. Court Utilization Report
- Percentage usage per court
- Formula: booked time slots / total available time slots
- Grouped by day, week, and month

### 2. Peak Hours Report
- Identify busiest time slots (e.g. hourly buckets)
- Show top 3 peak hours per day or week

### 3. Booking Status Breakdown
- Count of:
  - booked
  - completed
  - cancelled
  - no-show

### 4. Court Popularity Ranking
- Rank courts by total usage
- Include percentage share

### 5. Weekly Trend Report
- Compare bookings week-over-week
- Show increase/decrease in usage

---

## 🧠 Backend Requirements (Node.js / Express)

Create a new module/service:

```
/club-insights
```

### Required API Endpoint:

```
GET /api/club-insights/reports
```

### Response Format:
```json
{
  "courtUtilization": [],
  "peakHours": [],
  "bookingStatusBreakdown": {},
  "courtRanking": [],
  "weeklyTrend": {}
}
```

### Notes:
- Use aggregation pipelines (MongoDB preferred)
- Optimize queries for performance
- Support filtering by date range:
  - startDate
  - endDate

---

## 📊 Frontend Requirements (Angular)

Create a new module:

```
/club-insights
```

### Page: Club Insights Dashboard

Include:

#### 1. Summary Cards
- Total bookings
- Active courts usage
- Cancellation rate

#### 2. Charts
- Court utilization (bar chart)
- Peak hours (line or heatmap)
- Booking status (pie chart)

#### 3. Ranking Table
- Court ranking by usage

#### 4. Weekly trend graph

Use any chart library (Chart.js, ApexCharts, etc.)

---

## 🧩 Data Assumptions
Each booking contains:

```ts
{
  courtId: string,
  memberId: string,
  reserveDate: Date,
  startTime: string,
  endTime: string,
  status: "booked" | "completed" | "cancelled" | "no-show"
}
```

---

## 🧠 Business Logic Notes
- Time should be grouped into hourly buckets (e.g. 6–7 AM, 7–8 AM)
- Utilization should consider time slots, not just number of bookings
- Ignore cancelled bookings in utilization calculations
- No-show should still count in booking history but flagged separately

---

## 🎯 Output Goal
At the end of this implementation, the system should be able to:

- Show meaningful court usage insights
- Identify peak demand hours
- Help club admins understand operational efficiency
- Serve as the foundation for a future AI Club Manager system

---

## 🚀 Important Constraint
Do NOT implement AI/ML models yet.
This is strictly a **data aggregation + reporting system**.

---

## 🔮 Future Expansion (Do not build yet)
This system will later be extended into:
- AI recommendations
- Predictive scheduling
- Smart booking suggestions
- Automated club optimization

---

## ✅ Success Criteria
- APIs return accurate aggregated data
- Angular dashboard displays clean charts
- System is scalable for future AI layer
- No performance issues on large booking datasets


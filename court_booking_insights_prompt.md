# 🧠 AI Prompt: Upgrade Court Booking Reports into Insights & Recommendations (Tennis Club Intelligence)

## 🎯 Context
You are an expert full-stack engineer working on an existing Tennis Court Booking System with:

- Frontend: Angular
- Backend: Node.js (Express.js)
- Database: MongoDB (or equivalent)

The system already has a working **Club Insights Report Dashboard** that includes:

- Total bookings
- Court utilization
- Cancellation rate
- No-show rate
- Peak hours
- Day-of-week rankings

This is currently a **descriptive analytics system (reports only)**.

---

## 🚀 Objective
Upgrade the existing Club Insights feature into an **Intelligence Layer** that adds:

1. 🧠 Insights (WHY things are happening)
2. 💡 Recommendations (WHAT should be done)

This is NOT AI/ML-based yet. It is a **rule-based intelligence system** built on top of existing aggregated data.

---

# 🧠 Phase 1: INSIGHTS LAYER (Interpretation of Data)

Enhance existing report output by generating insights based on rules.

## Required Insight Categories:

### 📊 1. Utilization Insights
- Detect low utilization (< 20%)
- Detect high utilization (> 80%)
- Identify underused courts

Example output:
- "Court utilization is below optimal levels, indicating unused capacity."

---

### ⚠️ 2. No-Show Insights
- Identify high no-show rate (> 25%)
- Detect patterns by day or time slot

Example output:
- "No-show rates are significantly higher on weekends."

---

### 📅 3. Demand Pattern Insights
- Identify peak vs low demand hours
- Detect imbalance across weekdays

Example output:
- "Tuesday shows consistently highest booking demand."

---

### ❌ 4. Cancellation Insights
- Identify abnormal cancellation rates
- Compare across days/time slots

Example output:
- "Afternoon bookings have higher cancellation probability."

---

# 💡 Phase 2: RECOMMENDATIONS LAYER (Action Suggestions)

Generate actionable suggestions based on insights.

## Required Recommendation Types:

### 🏟️ 1. Scheduling Optimization
- Suggest shifting Open Play sessions
- Suggest redistributing court usage

Example:
- "Move Open Play sessions to Wednesday evenings to balance demand."

---

### 📉 2. No-Show Reduction Actions
- Suggest confirmation systems
- Suggest reminder notifications

Example:
- "Enable booking confirmation for weekend slots to reduce no-shows."

---

### 📊 3. Utilization Optimization
- Suggest promotions for low-demand hours
- Suggest coaching sessions during off-peak times

Example:
- "Introduce discounted bookings during low-utilization hours (2–4 PM)."

---

### 🧑‍🏫 4. Engagement Recommendations
- Suggest open play creation
- Suggest beginner-friendly sessions if demand is low

Example:
- "Create beginner open play sessions on weekdays to increase court usage."

---

# ⚙️ Backend Requirements (Node.js / Express)

Extend existing endpoint:

```
GET /api/club-insights/reports
```

OR create new enhanced endpoint:

```
GET /api/club-insights/intelligence
```

---

## 📦 Response Format

```json
{
  "reports": {
    "courtUtilization": [],
    "peakHours": [],
    "bookingStatusBreakdown": {},
    "courtRanking": [],
    "weeklyTrend": {}
  },
  "insights": [
    "Court utilization is below optimal levels.",
    "No-show rates are higher on weekends."
  ],
  "recommendations": [
    "Move Open Play to Wednesday evenings.",
    "Enable confirmation for weekend bookings."
  ]
}
```

---

## 🧠 Implementation Rules (IMPORTANT)

- Do NOT use AI/ML models
- Use rule-based logic only
- Use thresholds:
  - Utilization < 20% = low
  - Utilization > 80% = high
  - No-show > 25% = critical
  - Cancellation > 20% = high risk

- Insights must be derived from aggregated data only
- Recommendations must map directly from detected insights

---

## 📊 Frontend (Angular) Requirements

Extend existing Club Insights dashboard:

### ➕ Add new sections:

#### 🧠 Insights Panel
- List of auto-generated insight cards

#### 💡 Recommendations Panel
- Actionable suggestion cards

### UI Behavior:
- Insights displayed in warning/info cards
- Recommendations displayed as actionable items
- Keep existing charts unchanged

---

## 🔮 Future Upgrade (DO NOT IMPLEMENT YET)
This system will later evolve into:
- AI-generated insights (LLM-based)
- Predictive scheduling
- Automated club optimization
- Smart booking assistant

---

## 🎯 Success Criteria

- Reports remain intact and accurate
- Insights are generated automatically from data rules
- Recommendations are clearly actionable
- No performance degradation
- System remains non-AI but feels intelligent

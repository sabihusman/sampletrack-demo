# SampleTrack v2.0 — Technical Specification Sheet

> Hospital Clinical Laboratory Sample Storage Management System  
> MBA Operations & Supply Chain Management — Class Presentation Demo  
> Generated: April 9, 2026

---

## 1. Executive Summary

SampleTrack simulates the end-to-end workflow of a hospital clinical laboratory's sample storage operation. It models **1,020 patient samples** across in-department racks and central cold storage, tracks multi-tier alert escalation, enforces capacity-driven retention overrides, dispatches simulated physician/department notifications, and provides a quantitative operations analytics layer using **Little's Law** and **Kingman's Equation (VUT formula)**.

The application integrates conceptually with **Epic Beaker** — the laboratory information system used by the real-world lab this demo is modeled after.

---

## 2. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React | 19.2.4 |
| Build Toolchain | Vite | 8.0.1 |
| CSS Framework | Tailwind CSS (via `@tailwindcss/vite`) | 4.2.2 |
| Data Visualization | Recharts | 3.8.1 |
| Iconography | Lucide React | 1.7.0 |
| Typography | DM Sans (body) + DM Mono (data) | Google Fonts CDN |
| Module Format | ES Modules | — |
| Language | JavaScript JSX | ES2022 |

**Architectural constraints:**

- Single-file component (`src/App.jsx`, 1,494 lines) — no external state management
- Pure client-side — no backend, no database, no localStorage
- Deterministic seed data via Mulberry32 PRNG (seed `42`)
- All state managed with React hooks: `useState`, `useMemo`, `useCallback`

---

## 3. Design System

### 3.1 Color Tokens

| Token | Hex | Role |
|---|---|---|
| Navy | `#0F1E35` | Sidebar background |
| Steel Blue | `#2563EB` | Primary accent, active states, CTAs |
| Border | `#E2E8F0` | Hairline dividers, card borders |
| Green | `#10B981` | Healthy / success states |
| Amber | `#F59E0B` | Warning tier (50–74% retention elapsed) |
| Orange | `#F97316` | Urgent tier (75–99% retention elapsed) |
| Red | `#EF4444` | Critical tier (100%+ elapsed), destructive actions |
| Text Primary | `#1E293B` | Body copy |
| Text Secondary | `#475569` | Labels, supporting text |
| Text Tertiary | `#94A3B8` | Placeholders, timestamps |

### 3.2 Typography

| Face | Family | Usage |
|---|---|---|
| DM Sans | 400 / 500 / 600 / 700 | Body text, labels, headings, badges |
| DM Mono | 400 / 500 | Sample IDs (`SMP-XXXX`), patient IDs (`PT-XXXXX`), timestamps, numeric values, analytics outputs |

### 3.3 Component Patterns

| Element | Style |
|---|---|
| Badges | 10px, uppercase, 0.05em letter-spacing, pill shape |
| Sidebar | Dark navy with `radial-gradient` dot-grid texture (16px grid) |
| Utilization Arc | SVG `<circle>` with animated `stroke-dashoffset`, 270-degree sweep |
| Capacity Bar | CSS-transitioned width + color (green/yellow/red) |
| Final-Call Cards | `pulse-red` keyframe glow animation (2s loop) |
| Toasts | `slide-in` from right, auto-dismiss after 3s |
| Tab Transitions | `fade-in` opacity 0.2s |

---

## 4. Data Architecture

### 4.1 Sample Schema

```
{
  id              string       "SMP-XXXX"  (sequential from SMP-1000)
  patientId       string       "PT-XXXXX"  (random 5-digit)
  rackId          string       "RACK-01" through "RACK-18"
  rackPosition    number       1–120 (unique per rack at seed time)
  scanError       boolean      ~5% true — flagged position discrepancy
  type            enum         blood | urine | tissue | csf | other
  department      enum         emergency | surgery | oncology | hematology | cardiology | pathology
  physician       string       One of 12 named physicians
  pendingTests    string[]     1–3 tests from type-specific menu
  priority        enum         stat | urgent | routine
  depositTime     Date         Timestamp of sample intake
  retentionHours  number       Active retention window (dynamically adjusted)
  location        enum         in-department | central-storage
  status          enum         active | destroyed
  destroyed       boolean
  destroyedAt     Date | null
  extensionCount  number       Manual +24h extensions applied
}
```

### 4.2 Notification Schema

```
{
  id              number       Auto-incrementing
  time            Date         Dispatch timestamp
  type            enum         destruction | final-call | urgent-alert | scheduled-alert |
                               destruction-warning | alert-escalation
  tier            enum         red | orange | yellow
  sampleId        string
  patientId       string
  physician       string       Notified physician name
  department      string       Department code
  deptLabel       string       Human-readable department name
  message         string       Full notification text
  channel         enum         page | epic-inbox | dashboard | page + epic-inbox
  read            boolean      UI read/unread state
}
```

---

## 5. Physical Storage Model

### 5.1 Rack Layout

| Zone | Rack IDs | Rack Count | Slots per Rack | Total Capacity |
|---|---|---|---|---|
| In-Department | RACK-01 — RACK-07 | 7 | 120 | **840** |
| Central Storage (refrigerator) | RACK-08 — RACK-18 | 11 | 120 | 1,320 (overflow, no hard cap modeled) |

### 5.2 Utilization Thresholds

| Utilization | Color | UI Behavior |
|---|---|---|
| < 67% | Green | Normal operations |
| 67–80% | Yellow | Capacity bar turns yellow |
| 80–90% | Red | **Warning banner** (dismissible): Routine retention cut to 24h, Urgent to 48h |
| > 90% | Red | **Critical banner** (persistent): Routine retention cut to 12h, Urgent to 24h |

### 5.3 Central Storage Characteristics

- Samples in racks 08–18 are flagged with a `🏢` icon throughout the UI
- Tooltip/note: "Retrieval requires leaving work area"
- Central storage alerts include an orange italic retrieval warning on alert cards
- Retrieval disrupts workflow — especially critical during understaffed shifts

---

## 6. Retention & Alert Engine

### 6.1 Base Retention Windows

| Priority | Window | Real-World Context |
|---|---|---|
| Stat | 168h (7 days) | Critical / time-sensitive orders |
| Urgent | 72h (3 days) | Elevated but not emergent |
| Routine | 48h (2 days) | Standard processing |

### 6.2 Capacity-Driven Overrides

Recalculated at intake **and** on every clock advance:

| In-Dept Utilization | Routine | Urgent | Stat |
|---|---|---|---|
| ≤ 80% | 48h | 72h | 168h (unchanged) |
| > 80% (> 672 filled) | **24h** | **48h** | 168h (unchanged) |
| > 90% (> 756 filled) | **12h** | **24h** | 168h (unchanged) |

### 6.3 Alert Tier Escalation

Calculated as: `elapsedPct = (hoursElapsed / retentionHours) * 100`

| Tier | Threshold | Color | Icon | Notification Action |
|---|---|---|---|---|
| None | < 50% | — | — | No action |
| Yellow | 50–74% | Amber | 🟡 | Department dashboard updated |
| Orange | 75–99% | Orange | 🟠 | Physician alerted via Epic Beaker inbox |
| Red | ≥ 100% | Red | 🔴 | Physician paged — final call |
| Auto-Destroy | Past deadline on +6h | — | — | Sample destroyed; physician paged + Epic inbox; test loss recorded |

---

## 7. Notification Dispatch System

### 7.1 Channel Matrix

| Channel | Symbol | Trigger | Urgency |
|---|---|---|---|
| Dashboard | 📊 | Sample crosses 50% retention | Low — passive awareness |
| Epic Inbox | 📨 | Sample crosses 75% retention | Medium — requires attention |
| Page | 📟 | Sample crosses 100% / final call | High — immediate response needed |
| Page + Epic Inbox | 📟📨 | Sample auto-destroyed | Critical — test loss event |

### 7.2 Generation Mechanics

- **Clock advance**: On each +6h click, every active sample is evaluated for tier crossings (comparing previous % vs new %)
- **Seed notifications**: ~17 pre-generated at load from existing overdue/urgent samples (PRNG seed `99`)
- **Buffer cap**: 500 notifications max (oldest dropped via FIFO)
- **Deferred dispatch**: Notifications generated inside `setSamples` updater, appended via `setTimeout(0)` to avoid nested state update issues

### 7.3 Notification Analytics (sidebar)

- **By Department**: Count of notifications per department
- **Most Notified Physicians**: Top 5 physicians ranked by notification volume
- **Channel Distribution**: Breakdown of page vs epic-inbox vs dashboard dispatches

---

## 8. Seed Data Specification

### 8.1 PRNG Configuration

| Parameter | Value |
|---|---|
| Algorithm | Mulberry32 |
| Sample seed | `42` |
| Notification seed | `99` |
| Behavior | Deterministic — identical output on every load |

### 8.2 Sample Volume

| Segment | Count | Location |
|---|---|---|
| In-Department Active | 640 | RACK-01 through RACK-07 |
| Central Storage Active | 260 | RACK-08 through RACK-18 |
| Destroyed (historical) | 120 | Mixed (40% central, 60% in-dept) |
| **Total Seeded** | **1,020** | — |

### 8.3 Distribution Targets

**By Department:**

| Department | Weight | ~Target Count |
|---|---|---|
| Emergency | 220 | Highest volume |
| Surgery | 180 | — |
| Oncology | 160 | — |
| Hematology | 160 | — |
| Cardiology | 160 | — |
| Pathology | 140 | Lowest volume |

**By Priority:** Stat 15% · Urgent 30% · Routine 55%

**By Type:** Blood 40% · Urine 25% · Tissue 15% · CSF 10% · Other 10%

**Temporal:** 75% deposited within last 96h (4 days), 25% in days 5–7

**Scan Errors:** ~5% of all samples flagged (`scanError: true`)

### 8.4 Test Menu by Sample Type

| Type | Available Tests |
|---|---|
| Blood | CBC, BMP, Coagulation Panel, Blood Culture, Troponin |
| Urine | Urinalysis, Culture & Sensitivity, Protein Panel |
| Tissue | Biopsy Analysis, Immunostaining, Frozen Section |
| CSF | Cell Count, Protein/Glucose, Culture, PCR Panel |
| Other | General Panel, Toxicology Screen |

Each sample is assigned 1–3 random tests from its type menu.

### 8.5 Physician Roster

Dr. Chen · Dr. Patel · Dr. Rodriguez · Dr. Kim · Dr. Johnson · Dr. Williams · Dr. Garcia · Dr. Martinez · Dr. Lee · Dr. Thompson · Dr. Davis · Dr. Wilson

---

## 9. Simulated Clock

| Property | Detail |
|---|---|
| State variable | `clockOffset` (integer, hours from real load time) |
| Increment | +6 hours per button press |
| Display format | `Sim Time: Apr 9, 2026  14:32` (header bar) |
| Calculation | `now = new Date(realNow + clockOffset * 3600000)` |

**On each advance (+6h):**

1. Count current in-department samples for utilization calculation
2. Recalculate effective retention for every active sample based on utilization tier
3. Compare previous alert % vs new alert % for each sample
4. Auto-destroy samples whose deadline falls before the new simulated time
5. Generate tier-crossing and destruction notifications
6. Append notifications to the dispatch log (deferred via `setTimeout(0)`)
7. Update `clockOffset` state to trigger re-render of all computed values

---

## 10. Operations Analytics Engine

### 10.1 Panel A — Editable System Parameters

| Parameter | Symbol | Default | Source |
|---|---|---|---|
| Arrival Rate | λ | 52.5 samples/hr | 1,260 samples/day ÷ 24 |
| Service Rate | μ | 55 samples/hr | Lab processing throughput |
| Arrival CV² | Cₐ² | 1.2 | Estimated arrival variability |
| Service CV² | Cₛ² | 0.9 | Estimated processing variability |
| In-Dept Capacity | — | 840 slots | 7 racks × 120 |

All parameters are editable via number inputs — outputs recalculate live.

### 10.2 Panel B — Little's Law

| Output | Formula | Interpretation |
|---|---|---|
| ρ (utilization) | λ / μ | System load factor |
| L (avg in system) | Current active count | Work-in-progress inventory |
| W (avg time in system) | L / λ | Average sample dwell time (hours) |
| Lq (avg queue/at-risk) | ρ² / (1 − ρ) | Samples in congestion state |
| Wq (avg wait time) | Lq / λ | Congestion-added delay (hours) |

### 10.3 Panel C — Kingman's Equation (VUT)

```
Tq = [(Cₐ² + Cₛ²) / 2] × [ρ / (1 − ρ)] × [1 / μ]
     ─────────────────     ──────────────     ─────
           V                     U               T
      (Variability)        (Utilization)     (Process Time)
```

- **Headline output**: Queue Wait Time displayed in hours (large numeric, color-coded)
- **Sensitivity chart**: Recharts `<LineChart>` plotting Tq vs ρ from 0.50 to 0.99
  - Demonstrates the **exponential blowup** above ρ = 0.80 — the core argument for intervention

### 10.4 Panel D — Scenario Comparison Table

| Scenario | ρ | Cₛ² | Tq (hrs) | Est. Retention Met | Notes |
|---|---|---|---|---|---|
| Current State | 0.95 | 0.9 | Calculated | Calculated | As-is operations |
| +1 Rack In-Dept | 0.87 | 0.9 | Calculated | Calculated | 960 slot capacity |
| Automated Retrieval | 0.95 | 0.4 | Calculated | Calculated | Reduced service variability |
| Both Interventions | 0.87 | 0.4 | Calculated | Calculated | Expanded + automated |

- "Automated Retrieval" models Cₛ² reduction from 0.9 → 0.4 (eliminating manual central storage search)
- Retention Met % derived from: `100 - (Tq / baseRetentionDays) * 100`
- Current State row highlighted red; Both Interventions row highlighted green

### 10.5 Panel E — Tiered Destruction Breakdown

- **BarChart**: Destructions by reason — Capacity Pressure / Expired / Manual
- **Table**: "High Fallout Samples" — top 8 department×type combos by destruction count with % share
- **Insight callout**: "Routine blood samples from Emergency account for a significant portion of early destructions"

---

## 11. Application Tabs (7 total)

### Tab 1: Dashboard

| Component | Content |
|---|---|
| Stat Cards (4) | In-Dept Active (with utilization %), Central Storage, In Alert (red/orange/yellow breakdown), Scan Errors |
| Capacity Bar | Animated fill with green→yellow→red color transitions |
| Department Chart | Grouped `<BarChart>`: in-dept vs central per department |
| Priority Chart | `<PieChart>` with stat/urgent/routine distribution |
| Alert Feed | Top 8 most urgent alerts with sample ID, priority badge, department, location flag, countdown |

### Tab 2: Inventory

| Component | Content |
|---|---|
| Filter Bar | Department, Priority, Type, Location, Scan Errors toggle, Text search (ID/Patient) |
| Data Table | 11 columns, sortable headers, 25 rows/page with pagination |
| Row Flags | Amber left border + ⚠️ for scan errors; 🏢 badge for central storage |
| Time Remaining | Color-coded: green (>50%), amber (25-50%), red (<25%) |
| Actions | ✓ Complete Test · ⏱ Extend +24h · 🗑 Destroy · 📍 Correct Scan |

### Tab 3: Alerts

| Component | Content |
|---|---|
| Three collapsible sections | 🔴 Final Call · 🟠 Urgent · 🟡 Schedule Retrieval |
| Badge counts | Per-tier sample counts |
| Alert Cards | Sample info, physician, department, pending test chips, countdown, action buttons |
| Central storage note | Orange italic: "Retrieval requires leaving work area — central storage" |
| Red-tier animation | `pulse-red` CSS glow on final-call cards |

### Tab 4: Intake

| Component | Content |
|---|---|
| Form | Patient ID, Sample Type, Department, Physician, Priority (radio), Pending Tests (toggle chips) |
| Auto-location | If utilization > 90%, auto-suggests Central Storage with "(in-dept full)" note |
| Preview Panel | Live-updating: assigned retention hours, location, selected tests |
| Submit | Toast: "Sample SMP-XXXX admitted to RACK-XX, Position XX" |

### Tab 5: Analytics

See Section 10 (five panels: Parameters, Little's Law, Kingman, Scenarios, Breakdown).

### Tab 6: Notifications

| Component | Content |
|---|---|
| Header Stats | Unread/total count, tier breakdown (critical/urgent/scheduled), "Mark all read" |
| Channel Guide | Callout explaining simulated dispatch channels (Page, Epic Inbox, Dashboard) |
| Feed (2/3 width) | Up to 100 cards shown; tier icon, sample→physician→dept routing, channel badge, timestamp, NEW tag |
| Sidebar (1/3 width) | Notifications by department, most notified physicians (top 5), channel distribution |
| Interactions | Click card to mark read; "Mark all read" bulk action |

### Tab 7: Destruction Log

| Component | Content |
|---|---|
| Summary Callout | Tests lost count, % from central storage, scan error contribution |
| Department Chart | `<BarChart>` with per-department colors |
| Table | Top 50 destroyed samples: ID, Dept, Type, Priority, Location, Pending Tests, Destroyed At |

---

## 12. User Actions Reference

| Action | Trigger | Effect |
|---|---|---|
| ⏩ +6 Hours | Header button | Advance sim clock; recalculate retention; auto-destroy overdue; generate notifications |
| ✓ Complete Test | Inventory/Alert row | Remove first pending test from sample |
| ⏱ Extend | Inventory/Alert row | Add 24h to retention; increment `extensionCount` |
| 🗑 Destroy | Inventory/Alert row | Mark sample destroyed at current sim time |
| 📍 Correct Scan | Inventory/Alert row (scan error samples only) | Clear `scanError` flag |
| Admit Sample | Intake form submit | Create new sample with auto-assigned rack/position/retention/location |
| Mark Read | Notification card click | Set `read: true` on single notification |
| Mark All Read | Notification header button | Set `read: true` on all notifications |
| Dismiss Banner | Yellow capacity banner X button | Hide 80–90% warning for session |

---

## 13. Capacity Banners

| Condition | Style | Message | Dismissible |
|---|---|---|---|
| 80% < util ≤ 90% | Yellow | "WARNING: In-department utilization at XX.X% — retention windows shortened. Routine: 24h, Urgent: 48h." | Yes |
| util > 90% | Red | "CRITICAL: In-department utilization at XX.X% — retention windows reduced. Routine: 12h, Urgent: 24h." | No |

---

## 14. Project File Structure

```
Operations and Management Ai App/
├── index.html               Entry point — Google Fonts preconnect + stylesheet links
├── package.json             Dependencies: react, react-dom, recharts, lucide-react
├── vite.config.js           Plugins: @vitejs/plugin-react, @tailwindcss/vite
├── TECH_SPEC.md             This document
├── src/
│   ├── main.jsx             ReactDOM.createRoot render to #root
│   ├── index.css            @import tailwindcss; DM Sans/Mono import; custom animations
│   └── App.jsx              Complete application (1,494 lines, single component)
├── .claude/
│   └── launch.json          Dev server config (npm run dev, port 5173)
└── public/
    └── favicon.svg
```

---

## 15. Recommended Demo Flow

| Step | Tab | What to Show | Talking Point |
|---|---|---|---|
| 1 | Dashboard | Load state — 76% util, 640 in-dept, 260 central | "This is a typical busy-day snapshot" |
| 2 | Dashboard | Stat cards, department chart | "Emergency and Surgery dominate volume" |
| 3 | Alerts | Red/orange/yellow sections | "440 samples are past deadline right now" |
| 4 | Alerts | Central storage retrieval notes | "Retrieval means leaving the bench — workflow disruption" |
| 5 | Analytics | Kingman sensitivity curve | "This is why >80% utilization breaks the system" |
| 6 | Analytics | Scenario comparison table | "+1 rack + automated retrieval = 89% retention compliance" |
| 7 | Header | Click +6 Hours × 3 | Watch samples auto-destroy, banner escalate to red |
| 8 | Notifications | View dispatch log | "Every physician was paged, every department notified" |
| 9 | Intake | Add a Stat blood sample | Show auto-location, retention preview |
| 10 | Destruction Log | Review aftermath | "XX tests lost this week, XX% from central storage" |

---

## 16. Development Commands

```bash
npm install          # Install all dependencies
npm run dev          # Start Vite dev server → http://localhost:5173
npm run build        # Production build → dist/
npm run preview      # Preview production build
npm run lint         # ESLint check
```

---

## 17. Key Formulas Quick Reference

| Name | Formula | Used In |
|---|---|---|
| Utilization | ρ = λ / μ | Analytics Panel B |
| Little's Law | L = λW | Analytics Panel B |
| Queue Length | Lq = ρ² / (1 − ρ) | Analytics Panel B |
| Kingman (VUT) | Tq = [(Cₐ² + Cₛ²)/2] × [ρ/(1−ρ)] × [1/μ] | Analytics Panel C |
| Elapsed % | (hoursElapsed / retentionHours) × 100 | Alert tier engine |
| Capacity Util | inDeptCount / 840 × 100 | Retention overrides, banners |

---

*SampleTrack v2.0 — Technical Specification Sheet*  
*Last updated: April 9, 2026*

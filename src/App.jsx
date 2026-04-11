import { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Activity, Bell, AlertTriangle, Package, Clock, FlaskConical,
  Trash2, CheckCircle, Search, ChevronDown, ChevronRight, Plus,
  Timer, MapPin, BarChart3, ClipboardList, FileWarning, Building2,
  Crosshair, ArrowRight, TrendingUp, ScanLine, X, MessageSquare, Send,
  Play, ChevronLeft, RefreshCw,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────
const IN_DEPT_CAPACITY = 840;
const RACK_CAPACITY = 120;
const IN_DEPT_RACKS = 7;
const CENTRAL_RACKS = 11;

const DEPARTMENTS = ["emergency", "surgery", "oncology", "hematology", "cardiology", "pathology"];
const DEPT_WEIGHTS = [220, 180, 160, 160, 160, 140];
const DEPT_LABELS = { emergency: "Emergency", surgery: "Surgery", oncology: "Oncology", hematology: "Hematology", cardiology: "Cardiology", pathology: "Pathology" };
const TYPES = ["blood", "urine", "tissue", "csf", "other"];
const TYPE_WEIGHTS = [40, 25, 15, 10, 10];
const PRIORITIES = ["stat", "urgent", "routine"];
const PRIORITY_WEIGHTS = [15, 30, 55];
const PHYSICIANS = ["Dr. Chen", "Dr. Patel", "Dr. Rodriguez", "Dr. Kim", "Dr. Johnson", "Dr. Williams", "Dr. Garcia", "Dr. Martinez", "Dr. Lee", "Dr. Thompson", "Dr. Davis", "Dr. Wilson"];

const TEST_MENU = {
  blood: ["CBC", "BMP", "Coagulation Panel", "Blood Culture", "Troponin"],
  urine: ["Urinalysis", "Culture & Sensitivity", "Protein Panel"],
  tissue: ["Biopsy Analysis", "Immunostaining", "Frozen Section"],
  csf: ["Cell Count", "Protein/Glucose", "Culture", "PCR Panel"],
  other: ["General Panel", "Toxicology Screen"],
};

const RETENTION_BASE = { stat: 168, urgent: 72, routine: 48 };

const COLORS = {
  navy: "#0F1E35", accent: "#2563EB", border: "#E2E8F0", white: "#FFFFFF",
  bg: "#F8FAFC", green: "#10B981", yellow: "#F59E0B", orange: "#F97316",
  red: "#EF4444", gray: "#94A3B8", darkGray: "#475569", text: "#1E293B",
};

const PIE_COLORS = ["#EF4444", "#F97316", "#2563EB"];
const DEPT_COLORS = ["#EF4444", "#F97316", "#8B5CF6", "#2563EB", "#EC4899", "#10B981"];

// ─── PRNG ───────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(rng, items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ─── Seed Generator ─────────────────────────────────────────────────────────
function generateSamples(now) {
  const rng = mulberry32(42);
  const samples = [];
  const totalActive = 900;
  const totalDestroyed = 120;
  const total = totalActive + totalDestroyed;

  const rackPositions = {};
  for (let i = 1; i <= 18; i++) rackPositions[i] = new Set();

  function getNextPosition(rackNum) {
    const used = rackPositions[rackNum];
    for (let p = 1; p <= RACK_CAPACITY; p++) {
      if (!used.has(p)) { used.add(p); return p; }
    }
    return Math.floor(rng() * RACK_CAPACITY) + 1;
  }

  for (let i = 0; i < total; i++) {
    const isDestroyed = i >= totalActive;
    const isInDept = !isDestroyed && i < 640;
    const location = isInDept ? "in-department" : (isDestroyed ? (rng() < 0.4 ? "central-storage" : "in-department") : "central-storage");

    let rackNum;
    if (isDestroyed) {
      rackNum = location === "central-storage"
        ? IN_DEPT_RACKS + Math.floor(rng() * CENTRAL_RACKS) + 1
        : Math.floor(rng() * IN_DEPT_RACKS) + 1;
    } else if (isInDept) {
      rackNum = Math.floor(rng() * IN_DEPT_RACKS) + 1;
    } else {
      rackNum = IN_DEPT_RACKS + Math.floor(rng() * CENTRAL_RACKS) + 1;
    }
    const rackId = `RACK-${String(rackNum).padStart(2, "0")}`;
    const rackPosition = getNextPosition(rackNum);

    const type = weightedPick(rng, TYPES, TYPE_WEIGHTS);
    const dept = weightedPick(rng, DEPARTMENTS, DEPT_WEIGHTS);
    const priority = weightedPick(rng, PRIORITIES, PRIORITY_WEIGHTS);
    const physician = PHYSICIANS[Math.floor(rng() * PHYSICIANS.length)];

    const hoursAgo = rng() < 0.75 ? rng() * 96 : 96 + rng() * 72;
    const depositTime = new Date(now.getTime() - hoursAgo * 3600000);
    const retentionHours = RETENTION_BASE[priority];

    const availableTests = TEST_MENU[type] || TEST_MENU.other;
    const numTests = 1 + Math.floor(rng() * Math.min(3, availableTests.length));
    const shuffled = [...availableTests].sort(() => rng() - 0.5);
    const pendingTests = shuffled.slice(0, numTests);

    const scanError = rng() < 0.05;
    const id = `SMP-${String(1000 + i).padStart(4, "0")}`;
    const patientId = `PT-${String(10000 + Math.floor(rng() * 89999)).padStart(5, "0")}`;

    let status = "active";
    let destroyed = false;
    let destroyedAt = null;

    let destructionReason = null;
    if (isDestroyed) {
      destroyed = true;
      status = "destroyed";
      const destroyHoursAgo = Math.max(0, hoursAgo - retentionHours + rng() * 12);
      destroyedAt = new Date(now.getTime() - destroyHoursAgo * 3600000);
      // Assign reason: if held >= full base retention, it expired naturally; otherwise capacity pressure
      const hoursHeld = (destroyedAt - depositTime) / 3600000;
      destructionReason = hoursHeld >= RETENTION_BASE[priority] ? "expired" : "capacity-pressure";
    }

    samples.push({
      id, patientId, rackId, rackPosition, scanError,
      type, department: dept, physician, pendingTests,
      priority, depositTime, retentionHours, location,
      status, destroyed, destroyedAt, destructionReason, extensionCount: 0,
    });
  }
  return samples;
}

// ─── Utility Functions ──────────────────────────────────────────────────────
function getRetentionHours(priority, inDeptCount) {
  const util = inDeptCount / IN_DEPT_CAPACITY;
  if (util > 0.95) {
    if (priority === "routine") return 8;
    if (priority === "urgent") return 18;
    if (priority === "stat") return 96;
  }
  if (util > 0.9) {
    if (priority === "routine") return 12;
    if (priority === "urgent") return 24;
  } else if (util > 0.8) {
    if (priority === "routine") return 24;
    if (priority === "urgent") return 48;
  }
  return RETENTION_BASE[priority];
}

function getDeadline(s) {
  return new Date(s.depositTime.getTime() + s.retentionHours * 3600000);
}

function getElapsedPct(s, now) {
  return ((now - s.depositTime) / 3600000 / s.retentionHours) * 100;
}

function getAlertTier(pct) {
  if (pct >= 100) return "red";
  if (pct >= 75) return "orange";
  if (pct >= 50) return "yellow";
  return "none";
}

function getRemainingStr(s, now) {
  const diffMs = getDeadline(s) - now;
  if (diffMs <= 0) return "OVERDUE";
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function formatDate(d) {
  if (!d) return "\u2014";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDateShort(d) {
  if (!d) return "\u2014";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    "  " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function badgeCount(n) { return n > 99 ? "99+" : String(n); }

// ─── Sub-Components ─────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "15" }}>
          <Icon size={20} style={{ color }} />
        </div>
        <div>
          <div className="text-2xl font-bold font-mono" style={{ color: COLORS.text }}>{value}</div>
          <div className="text-xs font-medium" style={{ color: COLORS.darkGray }}>{label}</div>
          {sub && <div className="text-[10px]" style={{ color: COLORS.gray }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const c = { stat: "#EF4444", urgent: "#F97316", routine: "#2563EB" };
  const bg = { stat: "#FEF2F2", urgent: "#FFF7ED", routine: "#EFF6FF" };
  return <span className="badge" style={{ color: c[priority], backgroundColor: bg[priority] }}>{priority}</span>;
}

function TypeBadge({ type }) {
  return <span className="badge" style={{ color: COLORS.darkGray, backgroundColor: "#F1F5F9" }}>{type}</span>;
}

function CapacityBar({ used, total }) {
  const pct = (used / total) * 100;
  let color = COLORS.green;
  if (pct > 80) color = COLORS.red;
  else if (pct > 67) color = COLORS.yellow;
  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: COLORS.darkGray }}>In-Department Capacity</span>
        <span className="text-xs font-mono font-medium" style={{ color }}>{used} / {total} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#E2E8F0" }}>
        <div className="cap-bar-fill h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function UtilArc({ used, total, centralCount }) {
  const pct = Math.min((used / total) * 100, 100);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (pct / 100) * circ * 0.75;
  let color = COLORS.green;
  if (pct > 80) color = COLORS.red;
  else if (pct > 67) color = COLORS.yellow;
  return (
    <div className="flex flex-col items-center px-4 py-3">
      <svg width="88" height="70" viewBox="0 0 88 70">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.1)"
          strokeWidth="6" strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          strokeLinecap="round" transform="rotate(135 44 44)" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color}
          strokeWidth="6" strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          strokeDashoffset={dashOffset} strokeLinecap="round"
          transform="rotate(135 44 44)" className="util-arc" />
        <text x="44" y="40" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="DM Mono">{used}</text>
        <text x="44" y="54" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="DM Sans">/ {total} slots</text>
      </svg>
      <div className="flex items-center gap-1 mt-1">
        <Building2 size={12} style={{ color: "rgba(255,255,255,0.5)" }} />
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>Central: {centralCount}</span>
      </div>
    </div>
  );
}

function Toast({ message, onClose }) {
  return (
    <div className="fixed top-4 right-4 z-50 toast-enter">
      <div className="bg-white rounded-lg shadow-lg border px-4 py-3 flex items-center gap-3" style={{ borderColor: COLORS.green, maxWidth: 400 }}>
        <CheckCircle size={18} style={{ color: COLORS.green }} />
        <span className="text-sm" style={{ color: COLORS.text }}>{message}</span>
        <button onClick={onClose} className="ml-2 cursor-pointer"><X size={14} /></button>
      </div>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────────────────
export default function App() {
  const [realNow] = useState(() => new Date());
  const [clockOffset, setClockOffset] = useState(0);
  const now = useMemo(() => new Date(realNow.getTime() + clockOffset * 3600000), [clockOffset, realNow]);

  const [samples, setSamples] = useState(() => generateSamples(realNow));
  const [activeTab, setActiveTab] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [showCaseBrief, setShowCaseBrief] = useState(true);
  const [sweepCount, setSweepCount] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(0);

  const [invFilters, setInvFilters] = useState({
    department: "all", priority: "all", type: "all",
    location: "all", status: "all", scanOnly: false, search: "",
  });
  const [invSort, setInvSort] = useState({ key: "riskScore", dir: "desc" });
  const [invPage, setInvPage] = useState(0);
  const [alertCollapsed, setAlertCollapsed] = useState({ red: false, orange: false, yellow: false });

  const [intakeForm, setIntakeForm] = useState({
    patientId: "", type: "blood", department: "emergency",
    physician: PHYSICIANS[0], priority: "routine", tests: [],
  });

  const [analyticsParams, setAnalyticsParams] = useState({
    lambda: 52.5, mu: 55, ca2: 1.2, cs2: 0.9, capacity: 840, staffMultiplier: 1.0,
  });

  const [notifications, setNotifications] = useState(() => {
    // Seed some initial notifications from existing alert states
    const seedNow = new Date();
    const rng = mulberry32(99);
    const initial = [];
    const seedSamples = generateSamples(seedNow);
    const active = seedSamples.filter(s => !s.destroyed);
    let id = 1;
    // Add notifications for some existing red-tier samples
    active.forEach(s => {
      const pct = getElapsedPct(s, seedNow);
      if (pct >= 100 && rng() < 0.15 && initial.length < 12) {
        initial.push({
          id: id++, time: new Date(seedNow.getTime() - rng() * 7200000),
          type: "destruction-warning", tier: "red",
          sampleId: s.id, patientId: s.patientId,
          physician: s.physician, department: s.department,
          deptLabel: DEPT_LABELS[s.department],
          message: `FINAL CALL: ${s.id} (${s.patientId}) overdue \u2014 ${s.pendingTests.length} test(s) pending. Scheduled for destruction.`,
          channel: "page", read: false,
        });
      } else if (pct >= 75 && pct < 100 && rng() < 0.1 && initial.length < 18) {
        initial.push({
          id: id++, time: new Date(seedNow.getTime() - rng() * 3600000),
          type: "alert-escalation", tier: "orange",
          sampleId: s.id, patientId: s.patientId,
          physician: s.physician, department: s.department,
          deptLabel: DEPT_LABELS[s.department],
          message: `URGENT: ${s.id} (${s.patientId}) at ${pct.toFixed(0)}% retention \u2014 notify ${s.physician}, ${DEPT_LABELS[s.department]}.`,
          channel: "epic-inbox", read: false,
        });
      }
    });
    return initial.sort((a, b) => b.time - a.time);
  });
  const [notifNextId, setNotifNextId] = useState(100);

  // ─── Computed ──────────────────────────────────────────────────────────
  const activeSamples = useMemo(() => samples.filter(s => !s.destroyed), [samples]);
  const inDeptSamples = useMemo(() => activeSamples.filter(s => s.location === "in-department"), [activeSamples]);
  const centralSamples = useMemo(() => activeSamples.filter(s => s.location === "central-storage"), [activeSamples]);
  const destroyedSamples = useMemo(() => samples.filter(s => s.destroyed), [samples]);
  const inDeptCount = inDeptSamples.length;
  const centralCount = centralSamples.length;
  const utilPct = (inDeptCount / IN_DEPT_CAPACITY) * 100;
  const scanErrorCount = useMemo(() => activeSamples.filter(s => s.scanError).length, [activeSamples]);

  // ─── Case Brief Stats (Change 1) ─────────────────────────────────────
  const caseBriefStats = useMemo(() => {
    const earlyDestroyed = destroyedSamples.filter(s => {
      if (!s.destroyedAt || !s.depositTime) return false;
      const hoursHeld = (s.destroyedAt - s.depositTime) / 3600000;
      return hoursHeld < 72;
    });
    const earlyCount = earlyDestroyed.length;
    const testsLost = earlyDestroyed.reduce((sum, s) => sum + s.pendingTests.length, 0);
    const routineCount = earlyDestroyed.filter(s => s.priority === "routine").length;
    const routinePct = earlyCount > 0 ? ((routineCount / earlyCount) * 100).toFixed(0) : 0;
    return { earlyCount, testsLost, routinePct };
  }, [destroyedSamples]);

  const alertSamples = useMemo(() => {
    return activeSamples
      .map(s => ({ ...s, pct: getElapsedPct(s, now), tier: getAlertTier(getElapsedPct(s, now)) }))
      .filter(s => s.tier !== "none")
      .sort((a, b) => b.pct - a.pct);
  }, [activeSamples, now]);

  const alertCounts = useMemo(() => ({
    red: alertSamples.filter(s => s.tier === "red").length,
    orange: alertSamples.filter(s => s.tier === "orange").length,
    yellow: alertSamples.filter(s => s.tier === "yellow").length,
  }), [alertSamples]);

  // ─── Actions ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const advanceClock = useCallback(() => {
    setSamples(prevSamples => {
      const prevNow = new Date(realNow.getTime() + clockOffset * 3600000);
      const futureNow = new Date(realNow.getTime() + (clockOffset + 6) * 3600000);
      const newNotifs = [];
      const updatedMap = {};

      // ── PHASE 1: Expiry Sweep ──────────────────────────────────────────
      // Destroy samples that exceeded their FULL (un-shortened) base retention.
      // This runs BEFORE capacity-pressure logic so freed slots reduce utilization.
      let swept = 0;
      prevSamples.forEach(s => {
        if (s.destroyed) { updatedMap[s.id] = s; return; }
        const baseRetention = RETENTION_BASE[s.priority];
        const elapsed = (futureNow - s.depositTime) / 3600000;
        if (elapsed >= baseRetention) {
          swept++;
          updatedMap[s.id] = { ...s, status: "destroyed", destroyed: true, destroyedAt: futureNow, destructionReason: "expired" };
        }
      });

      // ── PHASE 2: Capacity-pressure retention overrides + alert tier crossings ──
      // Recalculate in-dept count AFTER expiry sweep
      const inDeptAfterSweep = prevSamples.filter(x => !x.destroyed && !updatedMap[x.id]?.destroyed && x.location === "in-department").length;
      const pastDeadline = [];

      // Track tier crossings: red = per-sample, orange/yellow = aggregated per-department
      const orangeByDept = {};
      const yellowByDept = {};

      prevSamples.forEach(s => {
        if (updatedMap[s.id]) return; // already swept or was already destroyed
        const newRetention = getRetentionHours(s.priority, inDeptAfterSweep);
        const deadline = new Date(s.depositTime.getTime() + newRetention * 3600000);
        const prevPct = ((prevNow - s.depositTime) / 3600000 / s.retentionHours) * 100;
        const newPct = ((futureNow - s.depositTime) / 3600000 / newRetention) * 100;

        if (futureNow >= deadline) {
          pastDeadline.push({ ...s, retentionHours: newRetention });
        } else {
          if (prevPct < 100 && newPct >= 100) {
            // Red tier — keep per-sample (critical, needs individual physician page)
            newNotifs.push({
              type: "final-call", tier: "red",
              sampleId: s.id, patientId: s.patientId,
              physician: s.physician, department: s.department,
              deptLabel: DEPT_LABELS[s.department],
              message: `FINAL CALL: ${s.id} (${s.patientId}) past deadline — ${s.pendingTests.length} test(s) pending. Paging ${s.physician}.`,
              channel: "page",
            });
          } else if (prevPct < 75 && newPct >= 75) {
            // Orange tier — aggregate by department
            const dl = DEPT_LABELS[s.department];
            orangeByDept[dl] = (orangeByDept[dl] || 0) + 1;
          } else if (prevPct < 50 && newPct >= 50) {
            // Yellow tier — aggregate by department
            const dl = DEPT_LABELS[s.department];
            yellowByDept[dl] = (yellowByDept[dl] || 0) + 1;
          }
          updatedMap[s.id] = { ...s, retentionHours: newRetention };
        }
      });

      // Emit aggregated orange notifications (one per department)
      Object.entries(orangeByDept).forEach(([dept, count]) => {
        newNotifs.push({
          type: "urgent-alert", tier: "orange",
          sampleId: `${count} samples`, patientId: "",
          physician: "", department: dept, deptLabel: dept,
          message: `URGENT: ${count} sample(s) in ${dept} crossed 75% retention — physicians notified via Epic Beaker inbox.`,
          channel: "epic-inbox",
        });
      });

      // Emit aggregated yellow notifications (one per department)
      Object.entries(yellowByDept).forEach(([dept, count]) => {
        newNotifs.push({
          type: "scheduled-alert", tier: "yellow",
          sampleId: `${count} samples`, patientId: "",
          physician: "", department: dept, deptLabel: dept,
          message: `REMINDER: ${count} sample(s) in ${dept} at 50% retention — department dashboard updated.`,
          channel: "dashboard",
        });
      });

      // Sort past-deadline: routine first (oldest depositTime first), then urgent, then stat
      const prioOrder = { routine: 0, urgent: 1, stat: 2 };
      pastDeadline.sort((a, b) => {
        const pa = prioOrder[a.priority] ?? 1;
        const pb = prioOrder[b.priority] ?? 1;
        if (pa !== pb) return pa - pb;
        return a.depositTime - b.depositTime;
      });

      // Mark capacity-pressure destructions in sorted order
      const destroyedByDept = {};
      pastDeadline.forEach(s => {
        updatedMap[s.id] = { ...s, status: "destroyed", destroyed: true, destroyedAt: futureNow, destructionReason: "capacity-pressure" };
        const dl = DEPT_LABELS[s.department];
        if (!destroyedByDept[dl]) destroyedByDept[dl] = { count: 0, testsLost: 0 };
        destroyedByDept[dl].count++;
        destroyedByDept[dl].testsLost += s.pendingTests.length;
      });

      // Emit aggregated destruction notifications (one per department)
      Object.entries(destroyedByDept).forEach(([dept, { count, testsLost }]) => {
        newNotifs.push({
          type: "destruction", tier: "red",
          sampleId: `${count} samples`, patientId: "",
          physician: "", department: dept, deptLabel: dept,
          message: `DESTROYED: ${count} sample(s) in ${dept} — ${testsLost} test(s) lost. Department and physicians notified.`,
          channel: "page + epic-inbox",
        });
      });

      const updated = prevSamples.map(s => updatedMap[s.id] || s);

      // Update sweep count for dashboard display
      setTimeout(() => setSweepCount(swept), 0);

      if (newNotifs.length > 0) {
        setTimeout(() => {
          setNotifNextId(prevId => {
            const stamped = newNotifs.map((n, i) => ({
              ...n, id: prevId + i, time: futureNow, read: false,
            }));
            setNotifications(prev => [...stamped, ...prev].slice(0, 200));
            return prevId + newNotifs.length;
          });
        }, 0);
      }

      return updated;
    });
    setClockOffset(prev => prev + 6);
  }, [realNow, clockOffset]);

  const completeTest = useCallback((sampleId, testName) => {
    setSamples(prev => prev.map(s =>
      s.id === sampleId ? { ...s, pendingTests: s.pendingTests.filter(t => t !== testName) } : s
    ));
    showToast(`Test "${testName}" completed for ${sampleId}`);
  }, [showToast]);

  const extendSample = useCallback((sampleId) => {
    setSamples(prev => prev.map(s =>
      s.id === sampleId ? { ...s, retentionHours: s.retentionHours + 24, extensionCount: s.extensionCount + 1 } : s
    ));
    showToast(`${sampleId} extended by 24 hours`);
  }, [showToast]);

  const destroySample = useCallback((sampleId) => {
    setSamples(prev => prev.map(s =>
      s.id === sampleId ? { ...s, status: "destroyed", destroyed: true, destroyedAt: now, destructionReason: "manual" } : s
    ));
    showToast(`${sampleId} destroyed`);
  }, [now, showToast]);

  const correctScan = useCallback((sampleId) => {
    setSamples(prev => prev.map(s =>
      s.id === sampleId ? { ...s, scanError: false } : s
    ));
    showToast(`Scan error corrected for ${sampleId}`);
  }, [showToast]);

  const addSample = useCallback(() => {
    const form = intakeForm;
    if (!form.patientId.trim()) return;
    const loc = inDeptCount >= IN_DEPT_CAPACITY * 0.9 ? "central-storage" : "in-department";
    const rackNum = loc === "in-department"
      ? Math.floor(Math.random() * IN_DEPT_RACKS) + 1
      : IN_DEPT_RACKS + Math.floor(Math.random() * CENTRAL_RACKS) + 1;
    const rackId = `RACK-${String(rackNum).padStart(2, "0")}`;
    const pos = Math.floor(Math.random() * RACK_CAPACITY) + 1;
    const retention = getRetentionHours(form.priority, inDeptCount);
    const newSample = {
      id: `SMP-${String(2000 + samples.length).padStart(4, "0")}`,
      patientId: form.patientId, rackId, rackPosition: pos, scanError: false,
      type: form.type, department: form.department,
      physician: form.physician, pendingTests: [...form.tests],
      priority: form.priority, depositTime: now,
      retentionHours: retention, location: loc,
      status: "active", destroyed: false, destroyedAt: null, destructionReason: null, extensionCount: 0,
    };
    setSamples(prev => [newSample, ...prev]);
    showToast(`Sample ${newSample.id} admitted to ${rackId}, Position ${pos}`);
    setIntakeForm({ patientId: "", type: "blood", department: "emergency", physician: PHYSICIANS[0], priority: "routine", tests: [] });
  }, [intakeForm, inDeptCount, samples.length, now, showToast]);

  // ─── Demo Mode (Change 6) ────────────────────────────────────────────
  const DEMO_STEPS = [
    { label: "The Problem", action: () => setShowCaseBrief(true) },
    { label: "Scale of Failure", action: () => setActiveTab("dashboard") },
    { label: "What's At Risk Right Now", action: () => setActiveTab("alerts") },
    { label: "Why It Happens", action: () => setActiveTab("analytics") },
    { label: "Watch It Break", action: () => { setActiveTab("dashboard"); advanceClock(); } },
    { label: "Watch It Break More", action: () => { advanceClock(); } },
    { label: "Watch It Break More", action: () => { advanceClock(); } },
    { label: "Notification Cascade", action: () => setActiveTab("notifications") },
    { label: "What Fixes It", action: () => setActiveTab("analytics") },
    { label: "The Aftermath", action: () => setActiveTab("destruction") },
  ];

  const goToDemoStep = useCallback((step) => {
    const clamped = Math.max(0, Math.min(step, DEMO_STEPS.length - 1));
    setDemoStep(clamped);
    DEMO_STEPS[clamped].action();
  }, [advanceClock]);

  // ─── Tab definitions ──────────────────────────────────────────────────
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "alerts", label: "Alerts", icon: Bell },
    { id: "intake", label: "Intake", icon: Plus },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "notifications", label: "Notifications", icon: MessageSquare },
    { id: "destruction", label: "Destruction Log", icon: Trash2 },
  ];

  // ─── RENDER: Dashboard ────────────────────────────────────────────────
  function renderDashboard() {
    const deptData = DEPARTMENTS.map(d => ({
      name: DEPT_LABELS[d],
      inDept: inDeptSamples.filter(s => s.department === d).length,
      central: centralSamples.filter(s => s.department === d).length,
    }));
    const prioData = PRIORITIES.map(p => ({
      name: p.charAt(0).toUpperCase() + p.slice(1),
      value: activeSamples.filter(s => s.priority === p).length,
    }));
    const recentAlerts = alertSamples.slice(0, 8);

    return (
      <div className="tab-content space-y-5">
        <div className="grid grid-cols-5 gap-4">
          <StatCard icon={Package} label="In-Dept Active" value={inDeptCount} sub={`${utilPct.toFixed(1)}% capacity`} color={COLORS.accent} />
          <StatCard icon={Building2} label="Central Storage" value={centralCount} sub="Retrieval required" color={COLORS.orange} />
          <StatCard icon={AlertTriangle} label="In Alert" value={alertCounts.red + alertCounts.orange + alertCounts.yellow}
            sub={`${alertCounts.red} final · ${alertCounts.orange} urgent · ${alertCounts.yellow} sched`} color={COLORS.red} />
          <StatCard icon={ScanLine} label="Scan Errors" value={scanErrorCount} sub="Position discrepancies" color={COLORS.yellow} />
          <StatCard icon={RefreshCw} label="Swept This Cycle" value={sweepCount} sub="Expiry sweep cleared" color={COLORS.green} />
        </div>

        <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
          <CapacityBar used={inDeptCount} total={IN_DEPT_CAPACITY} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.text }}>Samples by Department</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="inDept" name="In-Dept" fill={COLORS.accent} radius={[3, 3, 0, 0]} />
                <Bar dataKey="central" name="Central" fill={COLORS.orange} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.text }}>Priority Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={prioData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {prioData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.text }}>Recent Alerts</h3>
          <div className="space-y-2">
            {recentAlerts.map(s => {
              const tierColor = { red: COLORS.red, orange: COLORS.orange, yellow: COLORS.yellow }[s.tier];
              return (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-md"
                  style={{ backgroundColor: tierColor + "08", borderLeft: `3px solid ${tierColor}` }}>
                  <span className="font-mono text-xs font-medium" style={{ color: COLORS.text }}>{s.id}</span>
                  <PriorityBadge priority={s.priority} />
                  <span className="text-xs" style={{ color: COLORS.darkGray }}>{DEPT_LABELS[s.department]}</span>
                  {s.location === "central-storage" && <span title="Central storage">{"\uD83C\uDFE2"}</span>}
                  <span className="ml-auto font-mono text-xs font-medium" style={{ color: tierColor }}>
                    {getRemainingStr(s, now)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Inventory ────────────────────────────────────────────────
  function renderInventory() {
    let filtered = activeSamples;
    const f = invFilters;
    if (f.department !== "all") filtered = filtered.filter(s => s.department === f.department);
    if (f.priority !== "all") filtered = filtered.filter(s => s.priority === f.priority);
    if (f.type !== "all") filtered = filtered.filter(s => s.type === f.type);
    if (f.location !== "all") filtered = filtered.filter(s => s.location === f.location);
    if (f.scanOnly) filtered = filtered.filter(s => s.scanError);
    if (f.search) {
      const q = f.search.toLowerCase();
      filtered = filtered.filter(s => s.id.toLowerCase().includes(q) || s.patientId.toLowerCase().includes(q));
    }

    filtered = [...filtered].sort((a, b) => {
      const k = invSort.key;
      let va, vb;
      if (k === "riskScore") {
        const pctA = getElapsedPct(a, now);
        const pctB = getElapsedPct(b, now);
        va = (pctA / 100) * (a.location === "central-storage" ? 1.3 : 1.0) * (analyticsParams.staffMultiplier < 0.8 ? 1.2 : 1.0);
        vb = (pctB / 100) * (b.location === "central-storage" ? 1.3 : 1.0) * (analyticsParams.staffMultiplier < 0.8 ? 1.2 : 1.0);
      } else {
        va = a[k]; vb = b[k];
      }
      if (va instanceof Date) { va = va.getTime(); vb = vb.getTime(); }
      if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return invSort.dir === "asc" ? -1 : 1;
      if (va > vb) return invSort.dir === "asc" ? 1 : -1;
      return 0;
    });

    const pageSize = 25;
    const totalPages = Math.ceil(filtered.length / pageSize);
    const page = filtered.slice(invPage * pageSize, (invPage + 1) * pageSize);

    function sortBy(key) {
      setInvSort(prev => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));
    }

    const selCls = "text-xs px-2 py-1.5 rounded border bg-white cursor-pointer";

    return (
      <div className="tab-content space-y-4">
        <div className="bg-white rounded-lg p-3 border flex flex-wrap items-center gap-3" style={{ borderColor: COLORS.border }}>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded border" style={{ borderColor: COLORS.border }}>
            <Search size={14} style={{ color: COLORS.gray }} />
            <input type="text" placeholder="Search ID..." value={f.search}
              onChange={e => { setInvFilters(p => ({ ...p, search: e.target.value })); setInvPage(0); }}
              className="text-xs outline-none w-28" />
          </div>
          <select className={selCls} style={{ borderColor: COLORS.border }} value={f.department}
            onChange={e => { setInvFilters(p => ({ ...p, department: e.target.value })); setInvPage(0); }}>
            <option value="all">All Depts</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
          </select>
          <select className={selCls} style={{ borderColor: COLORS.border }} value={f.priority}
            onChange={e => { setInvFilters(p => ({ ...p, priority: e.target.value })); setInvPage(0); }}>
            <option value="all">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <select className={selCls} style={{ borderColor: COLORS.border }} value={f.type}
            onChange={e => { setInvFilters(p => ({ ...p, type: e.target.value })); setInvPage(0); }}>
            <option value="all">All Types</option>
            {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <select className={selCls} style={{ borderColor: COLORS.border }} value={f.location}
            onChange={e => { setInvFilters(p => ({ ...p, location: e.target.value })); setInvPage(0); }}>
            <option value="all">All Locations</option>
            <option value="in-department">In-Department</option>
            <option value="central-storage">Central Storage</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={f.scanOnly}
              onChange={e => { setInvFilters(p => ({ ...p, scanOnly: e.target.checked })); setInvPage(0); }} />
            <FileWarning size={13} style={{ color: COLORS.yellow }} /> Scan Errors
          </label>
          <span className="ml-auto text-xs font-mono" style={{ color: COLORS.gray }}>{filtered.length} results</span>
        </div>

        <div className="bg-white rounded-lg border overflow-auto" style={{ borderColor: COLORS.border }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: COLORS.border, backgroundColor: "#F8FAFC" }}>
                {[
                  { key: "id", label: "Sample ID" }, { key: "rackId", label: "Rack-Pos" },
                  { key: "patientId", label: "Patient" }, { key: "type", label: "Type" },
                  { key: "department", label: "Dept" }, { key: "priority", label: "Priority" },
                  { key: "location", label: "Location" }, { key: "depositTime", label: "Deposit" },
                  { key: null, label: "Remaining" }, { key: "riskScore", label: "Risk" },
                  { key: null, label: "Tests" }, { key: null, label: "Actions" },
                ].map(col => (
                  <th key={col.label} className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                    style={{ color: COLORS.darkGray, cursor: col.key ? "pointer" : "default" }}
                    onClick={() => col.key && sortBy(col.key)}>
                    {col.label}{invSort.key === col.key && <span className="ml-1">{invSort.dir === "asc" ? "\u2191" : "\u2193"}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.map(s => {
                const pct = getElapsedPct(s, now);
                const elapsedPct = pct;
                const remColor = pct >= 75 ? COLORS.red : pct >= 50 ? COLORS.yellow : COLORS.green;
                const riskScore = (elapsedPct / 100) * (s.location === "central-storage" ? 1.3 : 1.0) * (analyticsParams.staffMultiplier < 0.8 ? 1.2 : 1.0);
                let riskLabel, riskColor;
                if (riskScore >= 1.0) { riskLabel = "Critical"; riskColor = COLORS.red; }
                else if (riskScore >= 0.75) { riskLabel = "High"; riskColor = COLORS.orange; }
                else if (riskScore >= 0.5) { riskLabel = "Med"; riskColor = COLORS.yellow; }
                else { riskLabel = "Low"; riskColor = COLORS.green; }
                return (
                  <tr key={s.id} className="sample-row border-b"
                    style={{ borderColor: COLORS.border, borderLeft: s.scanError ? `3px solid ${COLORS.yellow}` : undefined }}>
                    <td className="px-3 py-2 font-mono font-medium" style={{ color: COLORS.text }}>{s.id}</td>
                    <td className="px-3 py-2 font-mono">
                      {s.rackId}-{s.rackPosition}{s.scanError && <span className="ml-1" title="Scan discrepancy">{"\u26A0\uFE0F"}</span>}
                    </td>
                    <td className="px-3 py-2 font-mono">{s.patientId}</td>
                    <td className="px-3 py-2"><TypeBadge type={s.type} /></td>
                    <td className="px-3 py-2">{DEPT_LABELS[s.department]}</td>
                    <td className="px-3 py-2"><PriorityBadge priority={s.priority} /></td>
                    <td className="px-3 py-2">
                      {s.location === "central-storage"
                        ? <span className="flex items-center gap-1" title="Retrieval requires leaving work area">{"\uD83C\uDFE2"} <span className="text-[10px]" style={{ color: COLORS.orange }}>Central</span></span>
                        : <span className="text-[10px]" style={{ color: COLORS.green }}>In-Dept</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px]">{formatDate(s.depositTime)}</td>
                    <td className="px-3 py-2 font-mono font-medium" style={{ color: remColor }}>{getRemainingStr(s, now)}</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ backgroundColor: riskColor + "18", color: riskColor }}>
                        {riskLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {s.pendingTests.slice(0, 2).map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F1F5F9", color: COLORS.darkGray }}>{t}</span>
                        ))}
                        {s.pendingTests.length > 2 && <span className="text-[10px]" style={{ color: COLORS.gray }}>+{s.pendingTests.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {s.pendingTests.length > 0 && (
                          <button onClick={() => completeTest(s.id, s.pendingTests[0])}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer border"
                            style={{ borderColor: COLORS.green, color: COLORS.green }} title={`Complete: ${s.pendingTests[0]}`}>{"\u2713"}</button>
                        )}
                        <button onClick={() => extendSample(s.id)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer border"
                          style={{ borderColor: COLORS.accent, color: COLORS.accent }} title="Extend 24h">{"\u23F1"}</button>
                        <button onClick={() => destroySample(s.id)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer border"
                          style={{ borderColor: COLORS.red, color: COLORS.red }} title="Destroy">{"\uD83D\uDDD1"}</button>
                        {s.scanError && (
                          <button onClick={() => correctScan(s.id)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer border"
                            style={{ borderColor: COLORS.yellow, color: COLORS.yellow }} title="Correct scan">{"\uD83D\uDCCD"}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: COLORS.gray }}>Page {invPage + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={invPage === 0} onClick={() => setInvPage(p => p - 1)}
              className="px-3 py-1 text-xs rounded border cursor-pointer disabled:opacity-40" style={{ borderColor: COLORS.border }}>Prev</button>
            <button disabled={invPage >= totalPages - 1} onClick={() => setInvPage(p => p + 1)}
              className="px-3 py-1 text-xs rounded border cursor-pointer disabled:opacity-40" style={{ borderColor: COLORS.border }}>Next</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Alerts ───────────────────────────────────────────────────
  function renderAlerts() {
    const tiers = [
      { key: "red", label: "Final Call", color: COLORS.red, icon: "\uD83D\uDD34" },
      { key: "orange", label: "Urgent", color: COLORS.orange, icon: "\uD83D\uDFE0" },
      { key: "yellow", label: "Schedule Retrieval", color: COLORS.yellow, icon: "\uD83D\uDFE1" },
    ];

    return (
      <div className="tab-content space-y-4">
        {tiers.map(tier => {
          const items = alertSamples.filter(s => s.tier === tier.key);
          const collapsed = alertCollapsed[tier.key];
          return (
            <div key={tier.key} className="bg-white rounded-lg border" style={{ borderColor: COLORS.border }}>
              <button className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setAlertCollapsed(p => ({ ...p, [tier.key]: !p[tier.key] }))}>
                {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <span className="text-sm font-semibold">{tier.icon} {tier.label}</span>
                <span className="badge ml-1" style={{ backgroundColor: tier.color + "15", color: tier.color }}>{items.length}</span>
              </button>
              {!collapsed && (
                <div className="px-4 pb-4 space-y-3">
                  {items.slice(0, 20).map(s => (
                    <div key={s.id} className={`rounded-lg p-3 border ${tier.key === "red" ? "pulse-red" : ""}`}
                      style={{ borderColor: tier.color + "40", backgroundColor: tier.color + "05" }}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-medium">{s.id}</span>
                        <PriorityBadge priority={s.priority} />
                        <span className="text-xs" style={{ color: COLORS.darkGray }}>{DEPT_LABELS[s.department]}</span>
                        <span className="text-xs" style={{ color: COLORS.gray }}>{s.physician}</span>
                        {s.location === "central-storage" && <span>{"\uD83C\uDFE2"}</span>}
                        <span className="ml-auto font-mono text-sm font-bold" style={{ color: tier.color }}>{getRemainingStr(s, now)}</span>
                      </div>
                      {s.location === "central-storage" && (
                        <div className="text-xs italic mb-2" style={{ color: COLORS.orange }}>
                          Retrieval requires leaving work area — central storage
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {s.pendingTests.map(t => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: COLORS.accent + "12", color: COLORS.accent }}>{t}</span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        {s.pendingTests.length > 0 && (
                          <button onClick={() => completeTest(s.id, s.pendingTests[0])}
                            className="px-2 py-1 text-[10px] rounded font-medium cursor-pointer"
                            style={{ backgroundColor: COLORS.green + "15", color: COLORS.green }}>{"\u2713"} Test Done</button>
                        )}
                        <button onClick={() => extendSample(s.id)}
                          className="px-2 py-1 text-[10px] rounded font-medium cursor-pointer"
                          style={{ backgroundColor: COLORS.accent + "15", color: COLORS.accent }}>{"\u23F1"} Extend</button>
                        <button onClick={() => destroySample(s.id)}
                          className="px-2 py-1 text-[10px] rounded font-medium cursor-pointer"
                          style={{ backgroundColor: COLORS.red + "15", color: COLORS.red }}>{"\uD83D\uDDD1"} Destroy</button>
                        {s.scanError && (
                          <button onClick={() => correctScan(s.id)}
                            className="px-2 py-1 text-[10px] rounded font-medium cursor-pointer"
                            style={{ backgroundColor: COLORS.yellow + "15", color: COLORS.yellow }}>{"\uD83D\uDCCD"} Correct Scan</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length > 20 && <div className="text-xs text-center" style={{ color: COLORS.gray }}>+{items.length - 20} more</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ─── RENDER: Intake ───────────────────────────────────────────────────
  function renderIntake() {
    const availTests = TEST_MENU[intakeForm.type] || TEST_MENU.other;
    const suggestedLoc = inDeptCount >= IN_DEPT_CAPACITY * 0.9 ? "Central Storage" : "In-Department";
    const assignedRetention = getRetentionHours(intakeForm.priority, inDeptCount);

    return (
      <div className="tab-content">
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-5 border space-y-4" style={{ borderColor: COLORS.border }}>
            <h3 className="text-sm font-semibold" style={{ color: COLORS.text }}>New Sample Intake</h3>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>Patient ID</label>
              <input type="text" placeholder="PT-XXXXX" value={intakeForm.patientId}
                onChange={e => setIntakeForm(p => ({ ...p, patientId: e.target.value }))}
                className="w-full px-3 py-2 rounded border text-sm font-mono outline-none focus:ring-1 focus:ring-blue-400"
                style={{ borderColor: COLORS.border }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>Sample Type</label>
                <select value={intakeForm.type}
                  onChange={e => setIntakeForm(p => ({ ...p, type: e.target.value, tests: [] }))}
                  className="w-full px-3 py-2 rounded border text-sm cursor-pointer outline-none" style={{ borderColor: COLORS.border }}>
                  {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>Department</label>
                <select value={intakeForm.department}
                  onChange={e => setIntakeForm(p => ({ ...p, department: e.target.value }))}
                  className="w-full px-3 py-2 rounded border text-sm cursor-pointer outline-none" style={{ borderColor: COLORS.border }}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>Physician</label>
              <select value={intakeForm.physician}
                onChange={e => setIntakeForm(p => ({ ...p, physician: e.target.value }))}
                className="w-full px-3 py-2 rounded border text-sm cursor-pointer outline-none" style={{ borderColor: COLORS.border }}>
                {PHYSICIANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>Priority</label>
              <div className="flex gap-3">
                {PRIORITIES.map(p => (
                  <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="priority" value={p} checked={intakeForm.priority === p}
                      onChange={e => setIntakeForm(prev => ({ ...prev, priority: e.target.value }))} />
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: COLORS.darkGray }}>Pending Tests</label>
              <div className="flex flex-wrap gap-2">
                {availTests.map(t => (
                  <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border"
                    style={{
                      borderColor: intakeForm.tests.includes(t) ? COLORS.accent : COLORS.border,
                      backgroundColor: intakeForm.tests.includes(t) ? COLORS.accent + "10" : "transparent",
                    }}>
                    <input type="checkbox" checked={intakeForm.tests.includes(t)}
                      onChange={e => {
                        setIntakeForm(prev => ({
                          ...prev, tests: e.target.checked ? [...prev.tests, t] : prev.tests.filter(x => x !== t),
                        }));
                      }} className="hidden" />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={addSample}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer"
              style={{ backgroundColor: COLORS.accent }}>Admit Sample</button>
          </div>

          <div className="bg-white rounded-lg p-5 border" style={{ borderColor: COLORS.border }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.text }}>Intake Preview</h3>
            <div className="space-y-3">
              {[
                ["Patient", intakeForm.patientId || "\u2014", true],
                ["Type", intakeForm.type],
                ["Department", DEPT_LABELS[intakeForm.department]],
              ].map(([label, val, mono]) => (
                <div key={label} className="flex justify-between py-2 border-b" style={{ borderColor: COLORS.border }}>
                  <span className="text-xs" style={{ color: COLORS.gray }}>{label}</span>
                  <span className={`text-xs font-medium ${mono ? "font-mono" : ""}`}>{val}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 border-b" style={{ borderColor: COLORS.border }}>
                <span className="text-xs" style={{ color: COLORS.gray }}>Priority</span>
                <PriorityBadge priority={intakeForm.priority} />
              </div>
              <div className="flex justify-between py-2 border-b" style={{ borderColor: COLORS.border }}>
                <span className="text-xs" style={{ color: COLORS.gray }}>Assigned Retention</span>
                <span className="text-xs font-mono font-bold" style={{ color: COLORS.accent }}>{assignedRetention}h</span>
              </div>
              <div className="flex justify-between py-2 border-b" style={{ borderColor: COLORS.border }}>
                <span className="text-xs" style={{ color: COLORS.gray }}>Location</span>
                <span className="text-xs font-medium" style={{ color: suggestedLoc === "Central Storage" ? COLORS.orange : COLORS.green }}>
                  {suggestedLoc}{suggestedLoc === "Central Storage" && " (in-dept full)"}
                </span>
              </div>
              <div className="py-2">
                <span className="text-xs block mb-1.5" style={{ color: COLORS.gray }}>Tests ({intakeForm.tests.length})</span>
                <div className="flex flex-wrap gap-1.5">
                  {intakeForm.tests.length === 0
                    ? <span className="text-xs italic" style={{ color: COLORS.gray }}>No tests selected</span>
                    : intakeForm.tests.map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: COLORS.accent + "12", color: COLORS.accent }}>{t}</span>
                      ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Analytics ────────────────────────────────────────────────
  function renderAnalytics() {
    const { lambda, mu, ca2, cs2, staffMultiplier } = analyticsParams;
    const effectiveMu = mu * staffMultiplier;
    const effectiveCs2 = Math.min(2.0, cs2 + Math.max(0, (1.0 - staffMultiplier) / 0.1) * 0.15);
    const rho = lambda / effectiveMu;
    const L = activeSamples.length;
    const W = L / lambda;
    const Lq = rho > 0 && rho < 1 ? (rho * rho) / (1 - rho) : 999;
    const Wq = Lq / lambda;
    const Tq = rho > 0 && rho < 1 ? ((ca2 + effectiveCs2) / 2) * (rho / (1 - rho)) * (1 / effectiveMu) : 999;

    const sensitivityData = [];
    for (let r = 0.5; r <= 0.99; r += 0.02) {
      const tq = ((ca2 + effectiveCs2) / 2) * (r / (1 - r)) * (1 / effectiveMu);
      sensitivityData.push({ rho: r.toFixed(2), Tq: parseFloat(tq.toFixed(2)) });
    }

    const autoCs2 = 0.4;
    const scenarios = [
      { name: "Current State", rho: 0.95, cs2Used: effectiveCs2, desc: "As-is operations" },
      { name: "+1 Rack In-Dept", rho: 0.87, cs2Used: effectiveCs2, desc: "960 slot capacity" },
      { name: "Automated Retrieval", rho: 0.95, cs2Used: autoCs2, desc: "Reduced service variability" },
      { name: "Both Interventions", rho: 0.87, cs2Used: autoCs2, desc: "Expanded + automated" },
      { name: "Smart Queue Policy", rho: 0.95, cs2Used: effectiveCs2, desc: "Routine-first destruction — no capital cost" },
      { name: "Expiry Sweep", rho: 0.95, cs2Used: effectiveCs2, desc: "Proactive expired sample clearance — μ×1.05", muOverride: effectiveMu * 1.05 },
    ];
    const scenarioData = scenarios.map(s => {
      const muForScenario = s.muOverride || effectiveMu;
      const tq = ((ca2 + s.cs2Used) / 2) * (s.rho / (1 - s.rho)) * (1 / muForScenario);
      const retMet = Math.max(0, Math.min(100, 100 - (tq / (RETENTION_BASE.routine / 24)) * 100));
      return { ...s, tq: tq.toFixed(1), retMet: retMet.toFixed(0) };
    });

    const capPressureCount = destroyedSamples.filter(s => s.destructionReason === "capacity-pressure").length;
    const expiredCount = destroyedSamples.filter(s => s.destructionReason === "expired").length;
    const manualCount = destroyedSamples.filter(s => s.destructionReason === "manual").length;
    const noReasonCount = destroyedSamples.filter(s => !s.destructionReason).length;
    // Samples without a reason (seed data that predates the field) — split heuristically
    const adjCapPressure = capPressureCount + Math.round(noReasonCount * 0.6);
    const adjExpired = expiredCount + Math.round(noReasonCount * 0.35);
    const adjManual = manualCount + (noReasonCount - Math.round(noReasonCount * 0.6) - Math.round(noReasonCount * 0.35));
    const destructionData = [
      { name: "Capacity Pressure", value: adjCapPressure },
      { name: "Expired", value: adjExpired },
      { name: "Manual", value: adjManual },
    ];
    const totalDestr = Math.max(destroyedSamples.length, 1);
    const capPressurePct = ((adjCapPressure / totalDestr) * 100).toFixed(0);
    const expiredPct = ((adjExpired / totalDestr) * 100).toFixed(0);

    const falloutByDeptType = {};
    destroyedSamples.forEach(s => {
      const key = `${DEPT_LABELS[s.department]} \u2014 ${s.type}`;
      falloutByDeptType[key] = (falloutByDeptType[key] || 0) + 1;
    });
    const highFallout = Object.entries(falloutByDeptType)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, count]) => ({ name, count, pct: ((count / Math.max(destroyedSamples.length, 1)) * 100).toFixed(1) }));

    const inputCls = "w-20 px-2 py-1 rounded border text-xs font-mono text-center outline-none focus:ring-1 focus:ring-blue-400";

    return (
      <div className="tab-content space-y-5">
        <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.text }}>
            <Activity size={16} style={{ color: COLORS.accent }} /> System Parameters
          </h3>
          <div className="flex flex-wrap items-center gap-5">
            {[
              { label: "\u03BB (arrival rate)", key: "lambda", unit: "samples/hr" },
              { label: "\u03BC (service rate)", key: "mu", unit: "samples/hr" },
              { label: "C\u2090\u00B2 (arrival CV\u00B2)", key: "ca2", unit: "" },
              { label: "C\u209B\u00B2 (service CV\u00B2)", key: "cs2", unit: "" },
            ].map(p => (
              <div key={p.key} className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: COLORS.darkGray }}>{p.label}</span>
                <input type="number" step="0.1" className={inputCls} style={{ borderColor: COLORS.border }}
                  value={analyticsParams[p.key]}
                  onChange={e => setAnalyticsParams(prev => ({ ...prev, [p.key]: parseFloat(e.target.value) || 0 }))} />
                {p.unit && <span className="text-[10px]" style={{ color: COLORS.gray }}>{p.unit}</span>}
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: COLORS.darkGray }}>s (staff multiplier)</span>
              <input type="range" min="0.5" max="1.0" step="0.1"
                value={analyticsParams.staffMultiplier}
                onChange={e => setAnalyticsParams(prev => ({ ...prev, staffMultiplier: parseFloat(e.target.value) }))}
                style={{ width: 80 }} />
              <input type="number" step="0.1" min="0.5" max="1.0" className={inputCls} style={{ borderColor: COLORS.border }}
                value={analyticsParams.staffMultiplier}
                onChange={e => setAnalyticsParams(prev => ({ ...prev, staffMultiplier: Math.min(1.0, Math.max(0.5, parseFloat(e.target.value) || 0.5)) }))} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.text }}>Little's Law (L = \u03BBW)</h3>
            <div className="space-y-2">
              {[
                { label: "\u03C1 (utilization)", value: rho.toFixed(3), warn: rho > 0.9 },
                { label: "L (avg in system)", value: L },
                { label: "W (avg time in system)", value: `${W.toFixed(1)} hrs` },
                { label: "Lq (avg waiting/at-risk)", value: Lq > 900 ? "\u221E" : Lq.toFixed(1) },
                { label: "Wq (avg wait time)", value: Wq > 900 ? "\u221E" : `${Wq.toFixed(1)} hrs` },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-1.5 border-b" style={{ borderColor: COLORS.border }}>
                  <span className="text-xs" style={{ color: COLORS.darkGray }}>{row.label}</span>
                  <span className="text-xs font-mono font-bold" style={{ color: row.warn ? COLORS.red : COLORS.text }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: COLORS.text }}>Kingman's Equation (VUT)</h3>
            <div className="text-xs font-mono mb-1 px-3 py-2 rounded" style={{ backgroundColor: "#F8FAFC", color: COLORS.darkGray }}>
              Tq = (C\u2090\u00B2 + C\u209B\u00B2)/2 \u00D7 \u03C1/(1-\u03C1) \u00D7 1/\u03BC
            </div>
            <div className="text-center py-3">
              <div className="text-3xl font-bold font-mono" style={{ color: Tq > 2 ? COLORS.red : COLORS.accent }}>
                {Tq > 900 ? "\u221E" : Tq.toFixed(2)}
              </div>
              <div className="text-xs" style={{ color: COLORS.gray }}>Queue Wait Time (hours)</div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={sensitivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="rho" tick={{ fontSize: 10 }}
                  label={{ value: "\u03C1 (utilization)", position: "insideBottom", offset: -2, fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }}
                  label={{ value: "Tq (hrs)", angle: -90, position: "insideLeft", fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v} hrs`, "Tq"]} />
                <Line type="monotone" dataKey="Tq" stroke={COLORS.red} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.text }}>Scenario Comparison</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: COLORS.border, backgroundColor: "#F8FAFC" }}>
                <th className="px-3 py-2 text-left font-semibold">Scenario</th>
                <th className="px-3 py-2 text-center font-semibold">{"\u03C1"}</th>
                <th className="px-3 py-2 text-center font-semibold">Tq (hrs)</th>
                <th className="px-3 py-2 text-center font-semibold">Est. Retention Met</th>
                <th className="px-3 py-2 text-left font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {scenarioData.map((s, i) => (
                <tr key={i} className="border-b" style={{
                  borderColor: COLORS.border,
                  backgroundColor: i === 5 ? COLORS.green + "06" : i === 4 ? COLORS.accent + "08" : i === 0 ? COLORS.red + "05" : i === 3 ? COLORS.green + "08" : undefined,
                }}>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 text-center font-mono">{s.rho}</td>
                  <td className="px-3 py-2 text-center font-mono font-bold"
                    style={{ color: parseFloat(s.tq) > 3 ? COLORS.red : COLORS.green }}>{s.tq}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="font-mono font-bold" style={{ color: parseInt(s.retMet) > 70 ? COLORS.green : COLORS.red }}>{s.retMet}%</span>
                  </td>
                  <td className="px-3 py-2" style={{ color: COLORS.gray }}>{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.text }}>Destructions by Reason</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={destructionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS.red} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.text }}>High Fallout Samples</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: COLORS.border }}>
                  <th className="py-1.5 text-left font-semibold">Dept \u2014 Type</th>
                  <th className="py-1.5 text-center font-semibold">Count</th>
                  <th className="py-1.5 text-center font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {highFallout.map((row, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: COLORS.border }}>
                    <td className="py-1.5">{row.name}</td>
                    <td className="py-1.5 text-center font-mono">{row.count}</td>
                    <td className="py-1.5 text-center font-mono" style={{ color: parseFloat(row.pct) > 15 ? COLORS.red : COLORS.darkGray }}>{row.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-[10px] italic px-2 py-1.5 rounded" style={{ backgroundColor: COLORS.yellow + "10", color: COLORS.darkGray }}>
              {parseInt(capPressurePct) > parseInt(expiredPct)
                ? `Capacity pressure accounts for ${capPressurePct}% of all destructions — confirming that the queueing model is the right frame for intervention.`
                : `Most destructions are clinically appropriate expirations (${expiredPct}%). The capacity constraint is less severe than expected.`}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Notifications ─────────────────────────────────────────────
  function renderNotifications() {
    const unreadCount = notifications.filter(n => !n.read).length;
    const tierIcon = { red: "\uD83D\uDD34", orange: "\uD83D\uDFE0", yellow: "\uD83D\uDFE1" };
    const tierColor = { red: COLORS.red, orange: COLORS.orange, yellow: COLORS.yellow };
    const channelLabel = { "page": "\uD83D\uDCDF Paged", "epic-inbox": "\uD83D\uDCE8 Epic Inbox", "dashboard": "\uD83D\uDCCA Dashboard", "page + epic-inbox": "\uD83D\uDCDF\uD83D\uDCE8 Paged + Inbox" };

    const markAllRead = () => {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const markRead = (id) => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    // Stats
    const byTier = { red: 0, orange: 0, yellow: 0 };
    const byDept = {};
    const byPhysician = {};
    notifications.forEach(n => {
      byTier[n.tier] = (byTier[n.tier] || 0) + 1;
      byDept[n.deptLabel] = (byDept[n.deptLabel] || 0) + 1;
      byPhysician[n.physician] = (byPhysician[n.physician] || 0) + 1;
    });
    const topPhysicians = Object.entries(byPhysician).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return (
      <div className="tab-content space-y-5">
        {/* Header with stats */}
        <div className="flex items-center gap-4">
          <div className="bg-white rounded-lg p-4 border flex-1" style={{ borderColor: COLORS.border }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: COLORS.text }}>
                <Send size={16} style={{ color: COLORS.accent }} /> Notification Dispatch Log
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono" style={{ color: COLORS.gray }}>
                  {unreadCount} unread \u00b7 {notifications.length} total
                </span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead}
                    className="text-[10px] px-2 py-1 rounded font-medium cursor-pointer"
                    style={{ backgroundColor: COLORS.accent + "12", color: COLORS.accent }}>
                    Mark all read
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-4">
              {["red", "orange", "yellow"].map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <span>{tierIcon[t]}</span>
                  <span className="text-xs font-mono font-bold" style={{ color: tierColor[t] }}>{byTier[t] || 0}</span>
                  <span className="text-[10px]" style={{ color: COLORS.gray }}>
                    {t === "red" ? "critical" : t === "orange" ? "urgent" : "scheduled"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How it works callout */}
        <div className="rounded-lg p-3 border" style={{ backgroundColor: COLORS.accent + "06", borderColor: COLORS.accent + "25" }}>
          <div className="text-xs font-semibold mb-1" style={{ color: COLORS.accent }}>Simulated Notification Channels</div>
          <div className="text-[10px] leading-relaxed" style={{ color: COLORS.darkGray }}>
            <span className="font-medium">{"\uD83D\uDCDF"} Page</span> — Physician paged for final-call / destruction (real-time, critical).{" "}
            <span className="font-medium">{"\uD83D\uDCE8"} Epic Inbox</span> — Alert sent to physician's Epic Beaker inbox (urgent tier).{" "}
            <span className="font-medium">{"\uD83D\uDCCA"} Dashboard</span> — Department dashboard updated with scheduled retrieval reminders.{" "}
            In production, these would integrate with Epic's notification API, pager systems, and department displays.
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Main notification feed */}
          <div className="col-span-2 space-y-2">
            {notifications.length === 0 && (
              <div className="bg-white rounded-lg p-8 border text-center" style={{ borderColor: COLORS.border }}>
                <MessageSquare size={32} style={{ color: COLORS.gray, margin: "0 auto 8px" }} />
                <div className="text-sm" style={{ color: COLORS.gray }}>No notifications yet. Advance the clock to generate alerts.</div>
              </div>
            )}
            {notifications.slice(0, 100).map(n => (
              <div key={n.id}
                className="bg-white rounded-lg p-3 border cursor-pointer transition-all"
                style={{
                  borderColor: !n.read ? tierColor[n.tier] + "50" : COLORS.border,
                  borderLeft: `3px solid ${tierColor[n.tier]}`,
                  backgroundColor: !n.read ? tierColor[n.tier] + "04" : COLORS.white,
                  opacity: n.read ? 0.7 : 1,
                }}
                onClick={() => markRead(n.id)}>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">{tierIcon[n.tier]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] font-medium" style={{ color: COLORS.text }}>{n.sampleId}</span>
                      <span className="text-[10px]" style={{ color: COLORS.gray }}>{"\u2192"}</span>
                      <span className="text-[10px] font-medium" style={{ color: COLORS.darkGray }}>{n.physician}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F1F5F9", color: COLORS.darkGray }}>
                        {n.deptLabel}
                      </span>
                      <span className="ml-auto text-[10px] font-mono" style={{ color: COLORS.gray }}>{formatDate(n.time)}</span>
                    </div>
                    <div className="text-xs" style={{ color: COLORS.text }}>{n.message}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: tierColor[n.tier] + "10", color: tierColor[n.tier] }}>
                        {channelLabel[n.channel] || n.channel}
                      </span>
                      {!n.read && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: COLORS.accent + "15", color: COLORS.accent }}>NEW</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right sidebar — stats */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
              <h4 className="text-xs font-semibold mb-2" style={{ color: COLORS.text }}>Notifications by Department</h4>
              {Object.entries(byDept).sort((a, b) => b[1] - a[1]).map(([dept, count]) => (
                <div key={dept} className="flex justify-between py-1 border-b" style={{ borderColor: COLORS.border }}>
                  <span className="text-[10px]">{dept}</span>
                  <span className="text-[10px] font-mono font-bold">{count}</span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
              <h4 className="text-xs font-semibold mb-2" style={{ color: COLORS.text }}>Most Notified Physicians</h4>
              {topPhysicians.map(([name, count]) => (
                <div key={name} className="flex justify-between py-1 border-b" style={{ borderColor: COLORS.border }}>
                  <span className="text-[10px]">{name}</span>
                  <span className="text-[10px] font-mono font-bold">{count}</span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
              <h4 className="text-xs font-semibold mb-2" style={{ color: COLORS.text }}>Channel Distribution</h4>
              {Object.entries(
                notifications.reduce((acc, n) => { acc[n.channel] = (acc[n.channel] || 0) + 1; return acc; }, {})
              ).sort((a, b) => b[1] - a[1]).map(([ch, count]) => (
                <div key={ch} className="flex justify-between py-1 border-b" style={{ borderColor: COLORS.border }}>
                  <span className="text-[10px]">{channelLabel[ch] || ch}</span>
                  <span className="text-[10px] font-mono font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Destruction Log ──────────────────────────────────────────
  function renderDestructionLog() {
    const sorted = [...destroyedSamples].sort((a, b) => (b.destroyedAt || 0) - (a.destroyedAt || 0));
    const pendingTestsLost = destroyedSamples.reduce((sum, s) => sum + s.pendingTests.length, 0);
    const fromCentral = destroyedSamples.filter(s => s.location === "central-storage").length;
    const scanErrContrib = destroyedSamples.filter(s => s.scanError).length;

    const deptDestructions = DEPARTMENTS.map(d => ({
      name: DEPT_LABELS[d],
      count: destroyedSamples.filter(s => s.department === d).length,
    }));

    return (
      <div className="tab-content space-y-5">
        <div className="rounded-lg p-4 border-l-4" style={{ backgroundColor: COLORS.red + "08", borderColor: COLORS.red }}>
          <div className="flex items-center gap-6">
            <div>
              <span className="text-2xl font-bold font-mono" style={{ color: COLORS.red }}>{pendingTestsLost}</span>
              <span className="text-xs ml-1.5" style={{ color: COLORS.darkGray }}>tests lost</span>
            </div>
            <div className="w-px h-8" style={{ backgroundColor: COLORS.border }} />
            <div>
              <span className="text-2xl font-bold font-mono" style={{ color: COLORS.orange }}>
                {destroyedSamples.length > 0 ? ((fromCentral / destroyedSamples.length) * 100).toFixed(0) : 0}%
              </span>
              <span className="text-xs ml-1.5" style={{ color: COLORS.darkGray }}>from central storage</span>
            </div>
            <div className="w-px h-8" style={{ backgroundColor: COLORS.border }} />
            <div>
              <span className="text-2xl font-bold font-mono" style={{ color: COLORS.yellow }}>{scanErrContrib}</span>
              <span className="text-xs ml-1.5" style={{ color: COLORS.darkGray }}>scan errors contributed to retrieval failures</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border" style={{ borderColor: COLORS.border }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: COLORS.text }}>Destructions by Department</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptDestructions}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Destroyed" radius={[4, 4, 0, 0]}>
                {deptDestructions.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border overflow-auto" style={{ borderColor: COLORS.border }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: COLORS.border, backgroundColor: "#F8FAFC" }}>
                {["Sample ID", "Dept", "Type", "Priority", "Location", "Reason", "Tests Pending", "Destroyed At"].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: COLORS.darkGray }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 50).map(s => (
                <tr key={s.id} className="sample-row border-b" style={{ borderColor: COLORS.border }}>
                  <td className="px-3 py-2 font-mono font-medium">{s.id}</td>
                  <td className="px-3 py-2">{DEPT_LABELS[s.department]}</td>
                  <td className="px-3 py-2"><TypeBadge type={s.type} /></td>
                  <td className="px-3 py-2"><PriorityBadge priority={s.priority} /></td>
                  <td className="px-3 py-2">{s.location === "central-storage" ? <span>{"\uD83C\uDFE2"} Central</span> : <span>In-Dept</span>}</td>
                  <td className="px-3 py-2">
                    {s.destructionReason === "capacity-pressure" ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: COLORS.red + "15", color: COLORS.red }}>Capacity pressure</span>
                    ) : s.destructionReason === "expired" ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: COLORS.gray + "20", color: COLORS.darkGray }}>Expired</span>
                    ) : s.destructionReason === "manual" ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: COLORS.yellow + "15", color: COLORS.yellow }}>Manual</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#F1F5F9", color: COLORS.gray }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {s.pendingTests.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: COLORS.red + "10", color: COLORS.red }}>{t}</span>
                      ))}
                      {s.pendingTests.length === 0 && <span style={{ color: COLORS.gray }}>None</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono">{formatDate(s.destroyedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── MAIN RENDER ──────────────────────────────────────────────────────
  const showBanner80 = utilPct > 80 && utilPct <= 90 && !dismissedBanner;
  const showBanner90 = utilPct > 90 && utilPct <= 95;
  const showBanner95 = utilPct > 95;

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Case Brief Modal (Change 1) */}
      {showCaseBrief && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: COLORS.navy }}>
          <div className="max-w-lg w-full text-center px-8 py-12" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <FlaskConical size={40} style={{ color: COLORS.accent, margin: "0 auto 16px" }} />
            <h1 className="text-3xl font-bold text-white mb-2">SampleTrack</h1>
            <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.5)" }}>
              Lab Sample Retention & Operations Management
            </p>
            <div className="grid grid-cols-3 gap-6 mb-10">
              <div className="rounded-lg p-4" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-3xl font-bold font-mono text-white">{caseBriefStats.earlyCount}</div>
                <div className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Samples destroyed before 72h</div>
              </div>
              <div className="rounded-lg p-4" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-3xl font-bold font-mono text-white">{caseBriefStats.testsLost}</div>
                <div className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Pending tests lost</div>
              </div>
              <div className="rounded-lg p-4" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-3xl font-bold font-mono text-white">{caseBriefStats.routinePct}%</div>
                <div className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Were routine priority</div>
              </div>
            </div>
            <button
              onClick={() => setShowCaseBrief(false)}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-bold text-white cursor-pointer"
              style={{ backgroundColor: COLORS.accent }}>
              <Play size={16} /> Begin Demo
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 flex flex-col dot-grid" style={{ backgroundColor: COLORS.navy }}>
        <div className="px-4 pt-5 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2">
            <FlaskConical size={20} style={{ color: COLORS.accent }} />
            <span className="text-base font-bold text-white tracking-tight">SampleTrack</span>
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Epic Beaker Integration</div>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm cursor-pointer transition-colors"
                style={{
                  backgroundColor: active ? "rgba(37,99,235,0.15)" : "transparent",
                  color: active ? "#93BBFF" : "rgba(255,255,255,0.55)",
                  fontWeight: active ? 600 : 400,
                }}>
                <Icon size={16} />
                {tab.label}
                {tab.id === "alerts" && (alertCounts.red + alertCounts.orange + alertCounts.yellow) > 0 && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-mono"
                    style={{ backgroundColor: COLORS.red, color: "white" }}>
                    {badgeCount(alertCounts.red + alertCounts.orange + alertCounts.yellow)}
                  </span>
                )}
                {tab.id === "notifications" && notifications.filter(n => !n.read).length > 0 && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-mono"
                    style={{ backgroundColor: COLORS.accent, color: "white" }}>
                    {badgeCount(notifications.filter(n => !n.read).length)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <UtilArc used={inDeptCount} total={IN_DEPT_CAPACITY} centralCount={centralCount} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: "#F0F4F8" }}>
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b" style={{ borderColor: COLORS.border }}>
          <h1 className="text-lg font-bold" style={{ color: COLORS.text }}>
            {tabs.find(t => t.id === activeTab)?.label}
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-xs font-mono px-3 py-1.5 rounded" style={{ backgroundColor: "#F8FAFC", color: COLORS.darkGray }}>
              Sim Time: {formatDateShort(now)}
            </div>
            <button onClick={advanceClock}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer text-white"
              style={{ backgroundColor: COLORS.accent }}>
              <Timer size={14} /> {"\u23E9"} +6 Hours
            </button>
            <button
              onClick={() => { setDemoMode(prev => !prev); if (!demoMode) { setDemoStep(0); } }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: demoMode ? COLORS.accent : "transparent",
                color: demoMode ? "white" : COLORS.accent,
                border: `1px solid ${COLORS.accent}`,
              }}>
              <Play size={14} /> {demoMode ? "Exit Demo" : "Demo Mode"}
            </button>
          </div>
        </div>

        {/* Demo Mode Banner (Change 6) */}
        {demoMode && (
          <div className="flex items-center gap-3 px-6 py-2 border-b" style={{ backgroundColor: COLORS.accent + "10", borderColor: COLORS.accent + "30" }}>
            <button
              onClick={() => goToDemoStep(demoStep - 1)}
              disabled={demoStep === 0}
              className="p-1 rounded cursor-pointer disabled:opacity-30"
              style={{ color: COLORS.accent }}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold" style={{ color: COLORS.accent }}>
              Step {demoStep + 1}/{DEMO_STEPS.length}: {DEMO_STEPS[demoStep].label}
            </span>
            <button
              onClick={() => goToDemoStep(demoStep + 1)}
              disabled={demoStep === DEMO_STEPS.length - 1}
              className="p-1 rounded cursor-pointer disabled:opacity-30"
              style={{ color: COLORS.accent }}>
              <ChevronRight size={16} />
            </button>
            <div className="flex-1" />
            <div className="flex gap-1">
              {DEMO_STEPS.map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: i <= demoStep ? COLORS.accent : COLORS.accent + "30" }} />
              ))}
            </div>
          </div>
        )}

        {/* 95% utilization banner (Change 4) */}
        {showBanner95 && (
          <div className="mx-6 mt-3 px-4 py-2.5 rounded-lg flex items-center gap-2"
            style={{ backgroundColor: "#991B1B" + "18", border: `1px solid #991B1B` }}>
            <AlertTriangle size={16} style={{ color: "#991B1B" }} />
            <span className="text-xs font-semibold" style={{ color: "#991B1B" }}>
              CRITICAL SURGE: All retention windows reduced. Stat: 96h, Urgent: 18h, Routine: 8h.
            </span>
          </div>
        )}
        {showBanner90 && (
          <div className="mx-6 mt-3 px-4 py-2.5 rounded-lg flex items-center gap-2"
            style={{ backgroundColor: COLORS.red + "12", border: `1px solid ${COLORS.red}40` }}>
            <AlertTriangle size={16} style={{ color: COLORS.red }} />
            <span className="text-xs font-semibold" style={{ color: COLORS.red }}>
              CRITICAL: In-department utilization at {utilPct.toFixed(1)}% — retention windows reduced. Routine: 12h, Urgent: 24h.
            </span>
          </div>
        )}
        {showBanner80 && (
          <div className="mx-6 mt-3 px-4 py-2.5 rounded-lg flex items-center gap-2"
            style={{ backgroundColor: COLORS.yellow + "12", border: `1px solid ${COLORS.yellow}40` }}>
            <AlertTriangle size={16} style={{ color: COLORS.yellow }} />
            <span className="text-xs font-semibold" style={{ color: COLORS.yellow }}>
              WARNING: In-department utilization at {utilPct.toFixed(1)}% — retention windows shortened. Routine: 24h, Urgent: 48h.
            </span>
            <button onClick={() => setDismissedBanner(true)} className="ml-auto cursor-pointer">
              <X size={14} style={{ color: COLORS.yellow }} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "inventory" && renderInventory()}
          {activeTab === "alerts" && renderAlerts()}
          {activeTab === "intake" && renderIntake()}
          {activeTab === "analytics" && renderAnalytics()}
          {activeTab === "notifications" && renderNotifications()}
          {activeTab === "destruction" && renderDestructionLog()}
        </div>
      </div>
    </div>
  );
}

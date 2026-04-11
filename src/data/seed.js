// Seeded random number generator (Mulberry32)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

const DEPARTMENTS = ['Pathology', 'Hematology', 'Oncology', 'Cardiology', 'Emergency', 'Surgery'];
const SAMPLE_TYPES = ['Blood', 'Urine', 'Tissue', 'CSF', 'Other'];
const PRIORITIES = ['Stat', 'Urgent', 'Routine'];
const TEST_OPTIONS = [
  'CBC', 'BMP', 'Lipid Panel', 'TSH', 'Culture', 'PCR', 'Biopsy', 'Coagulation',
  'Urinalysis', 'Tumor Markers', 'Hormone Panel', 'Electrolytes', 'LFT', 'KFT',
];

const PHYSICIAN_NAMES = [
  'Dr. Ahmed', 'Dr. Patel', 'Dr. Chen', 'Dr. Williams', 'Dr. Garcia',
  'Dr. Kim', 'Dr. Okafor', 'Dr. Martinez', 'Dr. Thompson', 'Dr. Singh',
];

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function pickMultiple(arr, min = 1, max = 3) {
  const count = min + Math.floor(rand() * (max - min + 1));
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, count);
}

// Retention hours by priority (base values)
const BASE_RETENTION = {
  Stat: 168,    // 7 days
  Urgent: 96,   // 4 days
  Routine: 48,  // 2 days
};

// With overcrowding pressure, retention shrinks
function calcRetentionHours(priority, utilizationPct) {
  let base = BASE_RETENTION[priority];
  if (utilizationPct > 90) {
    if (priority === 'Routine') base = 12;
    else if (priority === 'Urgent') base = 36;
  } else if (utilizationPct > 80) {
    if (priority === 'Routine') base = 24;
    else if (priority === 'Urgent') base = 60;
  }
  return base;
}

let sampleCounter = 1000;
function genSampleId() {
  return `SMP-${++sampleCounter}`;
}

function genPatientId() {
  const num = Math.floor(rand() * 90000) + 10000;
  return `PT-${num}`;
}

// NOW is the reference point
const NOW_OFFSET = 0; // hours from "real now"

export function generateSeedData() {
  const now = Date.now();
  const samples = [];

  // Generate 150 samples spread across departments and time
  for (let i = 0; i < 150; i++) {
    const department = pick(DEPARTMENTS);
    const sampleType = pick(SAMPLE_TYPES);
    const priority = rand() < 0.15 ? 'Stat' : rand() < 0.35 ? 'Urgent' : 'Routine';
    const physician = pick(PHYSICIAN_NAMES);

    // Deposit time: between 0 and 72 hours ago
    const hoursAgo = rand() * 72;
    const depositTime = now - hoursAgo * 3600000;

    // Retention based on approximate 75% utilization (realistic)
    const retentionHours = calcRetentionHours(priority, 75);
    const deadline = depositTime + retentionHours * 3600000;

    const allTests = pickMultiple(TEST_OPTIONS, 1, 4);
    // Some tests already complete
    const completedCount = Math.floor(rand() * allTests.length);
    const completedTests = allTests.slice(0, completedCount);
    const pendingTests = allTests.slice(completedCount);

    const timeRemaining = deadline - now;
    let status = 'Active';
    if (timeRemaining <= 0) {
      // Overdue — mark as pending destruction
      status = rand() < 0.3 ? 'Destroyed' : 'Critical';
    }

    samples.push({
      id: genSampleId(),
      patientId: genPatientId(),
      type: sampleType,
      department,
      priority,
      physician,
      depositTime,
      retentionHours,
      deadline,
      pendingTests,
      completedTests,
      status,
      notes: '',
    });
  }

  return samples;
}

export const ALL_TESTS = TEST_OPTIONS;
export const ALL_DEPARTMENTS = DEPARTMENTS;
export const ALL_SAMPLE_TYPES = SAMPLE_TYPES;
export const ALL_PRIORITIES = PRIORITIES;
export const ALL_PHYSICIANS = PHYSICIAN_NAMES;
export { calcRetentionHours, BASE_RETENTION };
export { mulberry32 };

import { useState } from 'react';
import { ALL_DEPARTMENTS, ALL_SAMPLE_TYPES, ALL_PRIORITIES, ALL_TESTS, calcRetentionHours } from '../data/seed';
import { PlusCircle, X } from 'lucide-react';

let counter = 2000;

export default function IntakeForm({ samples, onAdd, currentTime }) {
  const [form, setForm] = useState({
    patientId: '',
    type: 'Blood',
    department: 'Pathology',
    physician: '',
    pendingTests: [],
    priority: 'Routine',
  });
  const [submitted, setSubmitted] = useState(false);

  const utilization = samples.filter(s => s.status !== 'Destroyed').length / 200;
  const retentionHours = calcRetentionHours(form.priority, utilization * 100);

  const toggleTest = (test) => {
    setForm(f => ({
      ...f,
      pendingTests: f.pendingTests.includes(test)
        ? f.pendingTests.filter(t => t !== test)
        : [...f.pendingTests, test],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.patientId.trim() || !form.physician.trim()) return;
    if (samples.filter(s => s.status !== 'Destroyed').length >= 200) {
      alert('Storage at capacity. Cannot admit new samples.');
      return;
    }

    const now = currentTime;
    const sample = {
      id: `SMP-${++counter}`,
      patientId: form.patientId.trim().toUpperCase(),
      type: form.type,
      department: form.department,
      physician: form.physician.trim(),
      priority: form.priority,
      depositTime: now,
      retentionHours,
      deadline: now + retentionHours * 3600000,
      pendingTests: form.pendingTests.length ? form.pendingTests : ['CBC'],
      completedTests: [],
      status: 'Active',
      notes: '',
    };

    onAdd(sample);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setForm({ patientId: '', type: 'Blood', department: 'Pathology', physician: '', pendingTests: [], priority: 'Routine' });
  };

  const priorityColors = { Stat: 'bg-red-100 text-red-700 border-red-300', Urgent: 'bg-yellow-100 text-yellow-700 border-yellow-300', Routine: 'bg-blue-100 text-blue-700 border-blue-300' };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Sample Intake</h2>
          <p className="text-sm text-slate-500">Register a new sample for storage</p>
        </div>
        {submitted && (
          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-lg border border-emerald-200">
            ✓ Sample admitted
          </span>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-5">
        {/* Patient ID */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Patient ID *</label>
          <input
            type="text"
            value={form.patientId}
            onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))}
            placeholder="e.g. PT-12345"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Physician */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Ordering Physician *</label>
          <input
            type="text"
            value={form.physician}
            onChange={e => setForm(f => ({ ...f, physician: e.target.value }))}
            placeholder="e.g. Dr. Ahmed"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Sample Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Sample Type</label>
          <select
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {ALL_SAMPLE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Department */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Originating Department</label>
          <select
            value={form.department}
            onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {ALL_DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        {/* Priority */}
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Priority Level</label>
          <div className="flex gap-3">
            {ALL_PRIORITIES.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setForm(f => ({ ...f, priority: p }))}
                className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${form.priority === p ? priorityColors[p] + ' ring-2 ring-offset-1 ring-current/30' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Auto-retention at current load: <span className="font-semibold text-slate-700">{retentionHours} hours</span>
            {utilization > 0.8 && <span className="ml-2 text-orange-600 font-semibold">(Reduced — high storage pressure)</span>}
          </p>
        </div>

        {/* Tests */}
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Pending Tests</label>
          <div className="flex flex-wrap gap-2">
            {ALL_TESTS.map(test => (
              <button
                key={test}
                type="button"
                onClick={() => toggleTest(test)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.pendingTests.includes(test) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300'}`}
              >
                {form.pendingTests.includes(test) && <span className="mr-1">✓</span>}
                {test}
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2 flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            <PlusCircle size={16} />
            Admit Sample
          </button>
        </div>
      </form>
    </div>
  );
}

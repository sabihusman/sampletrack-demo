import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, CheckCircle, Clock, Trash2, Search, Filter } from 'lucide-react';
import { ALL_DEPARTMENTS, ALL_PRIORITIES, ALL_SAMPLE_TYPES } from '../data/seed';

function formatTimeRemaining(ms) {
  if (ms <= 0) return { label: 'OVERDUE', color: 'text-red-600 font-bold' };
  const hours = ms / 3600000;
  if (hours < 2) return { label: `${Math.floor(ms / 60000)}m`, color: 'text-red-600 font-bold' };
  if (hours < 12) return { label: `${hours.toFixed(1)}h`, color: 'text-orange-600 font-semibold' };
  if (hours < 24) return { label: `${hours.toFixed(0)}h`, color: 'text-yellow-600 font-semibold' };
  const days = hours / 24;
  return { label: `${days.toFixed(1)}d`, color: 'text-slate-600' };
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const PRIORITY_BADGE = {
  Stat: 'bg-red-100 text-red-700',
  Urgent: 'bg-yellow-100 text-yellow-700',
  Routine: 'bg-blue-100 text-blue-700',
};

const STATUS_BADGE = {
  Active: 'bg-emerald-100 text-emerald-700',
  Critical: 'bg-red-100 text-red-700',
  Destroyed: 'bg-slate-100 text-slate-500',
  Extended: 'bg-purple-100 text-purple-700',
};

export default function SampleTable({ samples, currentTime, onCompleteTest, onExtend, onDestroy }) {
  const [sortCol, setSortCol] = useState('deadline');
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterStatus, setFilterStatus] = useState('Active');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    return samples
      .filter(s => {
        if (filterDept !== 'All' && s.department !== filterDept) return false;
        if (filterPriority !== 'All' && s.priority !== filterPriority) return false;
        if (filterStatus !== 'All' && s.status !== filterStatus) return false;
        if (search) {
          const q = search.toLowerCase();
          return s.id.toLowerCase().includes(q) || s.patientId.toLowerCase().includes(q) || s.physician.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        let av = a[sortCol], bv = b[sortCol];
        if (sortCol === 'timeRemaining') { av = a.deadline - currentTime; bv = b.deadline - currentTime; }
        if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        return sortDir === 'asc' ? av - bv : bv - av;
      });
  }, [samples, filterDept, filterPriority, filterStatus, search, sortCol, sortDir, currentTime]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronUp size={12} className="text-slate-300" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-blue-500" /> : <ChevronDown size={12} className="text-blue-500" />;
  };

  const Th = ({ col, children }) => (
    <th
      onClick={() => handleSort(col)}
      className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
    >
      <span className="flex items-center gap-1">{children} <SortIcon col={col} /></span>
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Active Sample Inventory</h2>
            <p className="text-sm text-slate-500">{filtered.length} samples matching filters</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search ID, patient, physician..."
              className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(0); }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="All">All Departments</option>
            {ALL_DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(0); }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="All">All Priorities</option>
            {ALL_PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="All">All Statuses</option>
            <option>Active</option>
            <option>Critical</option>
            <option>Extended</option>
            <option>Destroyed</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <Th col="id">Sample ID</Th>
              <Th col="patientId">Patient</Th>
              <Th col="type">Type</Th>
              <Th col="department">Department</Th>
              <Th col="priority">Priority</Th>
              <Th col="depositTime">Admitted</Th>
              <Th col="deadline">Deadline</Th>
              <Th col="timeRemaining">Remaining</Th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Tests</th>
              <Th col="status">Status</Th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paged.map(s => {
              const remaining = s.deadline - currentTime;
              const { label, color } = formatTimeRemaining(remaining);
              const rowBg = s.status === 'Destroyed' ? 'bg-slate-50 opacity-60' : remaining <= 0 ? 'bg-red-50' : remaining < 3600000 * 6 ? 'bg-orange-50' : '';
              return (
                <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${rowBg}`}>
                  <td className="px-3 py-3 font-mono text-xs text-slate-700 font-semibold whitespace-nowrap">{s.id}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{s.patientId}</td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{s.type}</td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{s.department}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${PRIORITY_BADGE[s.priority]}`}>{s.priority}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(s.depositTime)}</td>
                  <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(s.deadline)}</td>
                  <td className={`px-3 py-3 whitespace-nowrap text-sm ${color}`}>{label}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1 max-w-36">
                      {s.pendingTests.length === 0
                        ? <span className="text-xs text-slate-400">All complete</span>
                        : s.pendingTests.slice(0, 3).map(t => (
                          <span key={t} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{t}</span>
                        ))}
                      {s.pendingTests.length > 3 && <span className="text-xs text-slate-400">+{s.pendingTests.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_BADGE[s.status] || STATUS_BADGE.Active}`}>{s.status}</span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {s.status !== 'Destroyed' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => onCompleteTest(s.id)}
                          title="Mark next test complete"
                          className="p-1.5 rounded-md hover:bg-emerald-100 text-emerald-600 transition-colors"
                        >
                          <CheckCircle size={14} />
                        </button>
                        <button
                          onClick={() => onExtend(s.id)}
                          title="Extend hold by 12h"
                          className="p-1.5 rounded-md hover:bg-purple-100 text-purple-600 transition-colors"
                        >
                          <Clock size={14} />
                        </button>
                        <button
                          onClick={() => onDestroy(s.id)}
                          title="Confirm destruction"
                          className="p-1.5 rounded-md hover:bg-red-100 text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {paged.length === 0 && (
          <div className="py-12 text-center text-slate-400">No samples match the current filters.</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

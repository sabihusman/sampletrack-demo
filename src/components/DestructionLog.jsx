import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ALL_DEPARTMENTS } from '../data/seed';

function formatDate(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getChartData(destroyed) {
  const byDept = {};
  ALL_DEPARTMENTS.forEach(d => { byDept[d] = { department: d, total: 0, withPending: 0 }; });

  destroyed.forEach(s => {
    if (!byDept[s.department]) byDept[s.department] = { department: s.department, total: 0, withPending: 0 };
    byDept[s.department].total++;
    if (s.pendingTests.length > 0) byDept[s.department].withPending++;
  });

  return Object.values(byDept).filter(d => d.total > 0);
}

export default function DestructionLog({ destroyed }) {
  const chartData = getChartData(destroyed);
  const totalLostTests = destroyed.reduce((acc, s) => acc + s.pendingTests.length, 0);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Destroyed</p>
          <p className="text-4xl font-bold text-slate-800">{destroyed.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Lost Pending Tests</p>
          <p className="text-4xl font-bold text-red-600">{totalLostTests}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Destruction Rate</p>
          <p className="text-4xl font-bold text-orange-600">
            {destroyed.length > 0 ? Math.round((destroyed.filter(s => s.pendingTests.length > 0).length / destroyed.length) * 100) : 0}%
          </p>
          <p className="text-xs text-slate-400 mt-1">destroyed with pending tests</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-800 mb-1">Destruction by Department</h3>
        <p className="text-sm text-slate-500 mb-5">Total destroyed vs. destroyed with pending tests outstanding</p>
        {chartData.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No destroyed samples yet. Use "Confirm Destruction" in the inventory table.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="department" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                labelStyle={{ fontWeight: 600, color: '#1e293b' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" name="Total Destroyed" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="withPending" name="With Pending Tests" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Destruction Log</h3>
          <p className="text-sm text-slate-500">{destroyed.length} samples destroyed</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Sample ID', 'Patient', 'Type', 'Department', 'Priority', 'Admitted', 'Destroyed At', 'Pending Tests Lost', 'Physician'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {destroyed.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">No samples have been destroyed yet.</td></tr>
              )}
              {destroyed.slice().reverse().map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-700">{s.id}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-600">{s.patientId}</td>
                  <td className="px-3 py-3 text-slate-600">{s.type}</td>
                  <td className="px-3 py-3 text-slate-600">{s.department}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${s.priority === 'Stat' ? 'bg-red-100 text-red-700' : s.priority === 'Urgent' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                      {s.priority}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(s.depositTime)}</td>
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{s.destroyedAt ? formatDate(s.destroyedAt) : '—'}</td>
                  <td className="px-3 py-3">
                    {s.pendingTests.length === 0
                      ? <span className="text-xs text-emerald-600">None</span>
                      : <div className="flex flex-wrap gap-1">
                          {s.pendingTests.map(t => <span key={t} className="px-1.5 py-0.5 bg-red-50 text-red-700 text-xs rounded border border-red-100">{t}</span>)}
                        </div>
                    }
                  </td>
                  <td className="px-3 py-3 text-slate-600 text-xs">{s.physician}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

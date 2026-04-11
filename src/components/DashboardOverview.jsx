import { Activity, AlertTriangle, Clock, Package, Users } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import CapacityBar from './CapacityBar';
import StatCard from './StatCard';
import { ALL_DEPARTMENTS } from '../data/seed';

const PRIORITY_COLORS = { Stat: '#ef4444', Urgent: '#f59e0b', Routine: '#3b82f6' };
const DEPT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function DashboardOverview({ samples, currentTime }) {
  const active = samples.filter(s => s.status !== 'Destroyed');
  const used = active.length;
  const total = 200;
  const utilization = used / total;

  const criticalSamples = active.filter(s => (s.deadline - currentTime) < 3600000 * 6 || s.status === 'Critical');
  const statCount = active.filter(s => s.priority === 'Stat').length;
  const urgentCount = active.filter(s => s.priority === 'Urgent').length;
  const routineCount = active.filter(s => s.priority === 'Routine').length;

  const priorityData = [
    { name: 'Stat', value: statCount },
    { name: 'Urgent', value: urgentCount },
    { name: 'Routine', value: routineCount },
  ].filter(d => d.value > 0);

  const deptData = ALL_DEPARTMENTS.map(dept => ({
    department: dept,
    count: active.filter(s => s.department === dept).length,
  })).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-5">
      {/* Capacity bar */}
      <CapacityBar used={used} total={total} />

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Active Samples"
          value={used}
          sub={`${total - used} slots available`}
          icon={Package}
          color="blue"
        />
        <StatCard
          label="Critical / Expiring"
          value={criticalSamples.length}
          sub="Expiring within 6 hours"
          icon={AlertTriangle}
          color={criticalSamples.length > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Stat Priority"
          value={statCount}
          sub="Highest retention priority"
          icon={Activity}
          color="red"
        />
        <StatCard
          label="Avg Retention Used"
          value={(() => {
            if (active.length === 0) return '—';
            const avg = active.reduce((sum, s) => sum + (currentTime - s.depositTime) / s.retentionHours / 3600000, 0) / active.length;
            return `${(avg * 100).toFixed(0)}%`;
          })()}
          sub="Of retention window elapsed"
          icon={Clock}
          color="yellow"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-5">
        {/* Priority breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-slate-800 mb-1">Priority Distribution</h3>
          <p className="text-sm text-slate-500 mb-4">Active samples by priority tier</p>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie data={priorityData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {priorityData.map((entry) => (
                    <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {[{ name: 'Stat', count: statCount, color: 'bg-red-500' }, { name: 'Urgent', count: urgentCount, color: 'bg-yellow-400' }, { name: 'Routine', count: routineCount, color: 'bg-blue-500' }].map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-slate-600">{item.name}</span>
                  <span className="text-sm font-bold text-slate-800 ml-auto pl-4">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Department breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-slate-800 mb-1">Samples by Department</h3>
          <p className="text-sm text-slate-500 mb-4">Active sample count per department</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={deptData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="department" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              <Bar dataKey="count" name="Samples" radius={[4, 4, 0, 0]}>
                {deptData.map((entry, index) => (
                  <Cell key={entry.department} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Overcrowding warning banners */}
      {utilization > 0.9 && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-5 py-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-red-800">CRITICAL OVERCROWDING — Storage above 90%</p>
            <p className="text-sm text-red-700 mt-0.5">Only Stat-priority samples receive full retention. Urgent and Routine windows have been automatically reduced. Immediate department notifications recommended.</p>
          </div>
        </div>
      )}
      {utilization > 0.8 && utilization <= 0.9 && (
        <div className="rounded-xl border border-orange-300 bg-orange-50 px-5 py-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-orange-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-orange-800">HIGH STORAGE PRESSURE — Storage above 80%</p>
            <p className="text-sm text-orange-700 mt-0.5">Routine sample retention windows have been automatically reduced to 24h. Departments should plan retrieval of pending samples immediately.</p>
          </div>
        </div>
      )}
    </div>
  );
}

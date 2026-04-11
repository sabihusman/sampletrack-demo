import { AlertTriangle, AlertOctagon, Bell, CheckCircle } from 'lucide-react';

function getAlerts(samples, currentTime) {
  const alerts = [];
  samples.forEach(s => {
    if (s.status === 'Destroyed') return;
    const total = s.retentionHours * 3600000;
    const elapsed = currentTime - s.depositTime;
    const pct = elapsed / total;

    if (pct >= 1) {
      alerts.push({ level: 'critical', sample: s, pct, message: 'FINAL CALL — Immediate retrieval or destruction required' });
    } else if (pct >= 0.75) {
      alerts.push({ level: 'urgent', sample: s, pct, message: 'Urgent — Test or lose sample' });
    } else if (pct >= 0.5) {
      alerts.push({ level: 'warning', sample: s, pct, message: 'Schedule retrieval soon' });
    }
  });

  // Sort: critical first
  const order = { critical: 0, urgent: 1, warning: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

const LEVEL_STYLE = {
  critical: {
    bg: 'bg-red-50 border-red-200',
    icon: <AlertOctagon size={16} className="text-red-600 flex-shrink-0" />,
    badge: 'bg-red-100 text-red-700',
    title: 'text-red-800',
    bar: 'bg-red-500',
  },
  urgent: {
    bg: 'bg-orange-50 border-orange-200',
    icon: <AlertTriangle size={16} className="text-orange-500 flex-shrink-0" />,
    badge: 'bg-orange-100 text-orange-700',
    title: 'text-orange-800',
    bar: 'bg-orange-400',
  },
  warning: {
    bg: 'bg-yellow-50 border-yellow-200',
    icon: <Bell size={16} className="text-yellow-600 flex-shrink-0" />,
    badge: 'bg-yellow-100 text-yellow-700',
    title: 'text-yellow-800',
    bar: 'bg-yellow-400',
  },
};

function formatHoursRemaining(sample, currentTime) {
  const ms = sample.deadline - currentTime;
  if (ms <= 0) return 'Overdue';
  const h = ms / 3600000;
  if (h < 1) return `${Math.floor(ms / 60000)}m remaining`;
  return `${h.toFixed(1)}h remaining`;
}

export default function AlertPanel({ samples, currentTime }) {
  const alerts = getAlerts(samples, currentTime);
  const critCount = alerts.filter(a => a.level === 'critical').length;
  const urgCount = alerts.filter(a => a.level === 'urgent').length;
  const warnCount = alerts.filter(a => a.level === 'warning').length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Alert Feed</h2>
          <p className="text-sm text-slate-500">Real-time retention notifications</p>
        </div>
        <div className="flex gap-2">
          {critCount > 0 && <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">{critCount} Critical</span>}
          {urgCount > 0 && <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">{urgCount} Urgent</span>}
          {warnCount > 0 && <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">{warnCount} Warning</span>}
          {alerts.length === 0 && <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1"><CheckCircle size={12} />All Clear</span>}
        </div>
      </div>

      <div className="p-4 space-y-2.5 max-h-[500px] overflow-y-auto">
        {alerts.length === 0 && (
          <div className="py-10 text-center text-slate-400">
            <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-sm">No active alerts</p>
          </div>
        )}
        {alerts.map((a, i) => {
          const style = LEVEL_STYLE[a.level];
          const pctDisplay = Math.min(a.pct * 100, 100).toFixed(0);
          return (
            <div key={`${a.sample.id}-${i}`} className={`rounded-lg border p-3.5 ${style.bg}`}>
              <div className="flex items-start gap-2.5">
                {style.icon}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${style.badge} whitespace-nowrap`}>
                        {a.level.toUpperCase()}
                      </span>
                      <span className={`text-sm font-semibold truncate ${style.title}`}>{a.sample.id}</span>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">{formatHoursRemaining(a.sample, currentTime)}</span>
                  </div>
                  <p className="text-xs text-slate-700 mb-1.5">{a.message}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600 mb-2">
                    <span><span className="text-slate-400">Dept:</span> {a.sample.department}</span>
                    <span><span className="text-slate-400">Patient:</span> {a.sample.patientId}</span>
                    <span><span className="text-slate-400">Type:</span> {a.sample.type}</span>
                    <span><span className="text-slate-400">Priority:</span> {a.sample.priority}</span>
                  </div>
                  {a.sample.pendingTests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      <span className="text-xs text-slate-500 mr-1">Pending:</span>
                      {a.sample.pendingTests.map(t => (
                        <span key={t} className="px-1.5 py-0.5 bg-white border border-slate-200 text-xs text-slate-600 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                  <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full ${style.bar}`} style={{ width: `${pctDisplay}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{pctDisplay}% of retention window elapsed</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

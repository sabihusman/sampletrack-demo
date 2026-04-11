export default function CapacityBar({ used, total }) {
  const pct = Math.min((used / total) * 100, 100);
  const color = pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-emerald-500';
  const textColor = pct >= 80 ? 'text-red-600' : pct >= 60 ? 'text-yellow-600' : 'text-emerald-600';
  const bgLight = pct >= 80 ? 'bg-red-50' : pct >= 60 ? 'bg-yellow-50' : 'bg-emerald-50';
  const label = pct >= 80 ? 'CRITICAL' : pct >= 60 ? 'WARNING' : 'NORMAL';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Storage Capacity</p>
          <p className="text-2xl font-bold text-slate-800 mt-0.5">{used} <span className="text-slate-400 text-lg font-normal">/ {total} slots</span></p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${bgLight} ${textColor} border border-current/20`}>
          {label}
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
        <div
          className={`h-4 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-500">
        <span>{pct.toFixed(1)}% utilized</span>
        <span>{total - used} slots free</span>
      </div>
    </div>
  );
}

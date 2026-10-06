import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useWorkspace } from '../context/WorkspaceContext';
import { money, monthLabel, num, todayISO } from '../utils/format';
import { Card, PageHeader, PageLoader, cx } from '../components/ui';

const WEEKDAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function Calendar() {
  const { month, monthId, version } = useWorkspace();
  const navigate = useNavigate();
  const { data, loading } = useAsync(() => api.get(`/months/${monthId}/calculation`), [monthId, version]);
  if (loading && !data) return <PageLoader />;
  // Week starts on Saturday, as is common in Bangladesh.
  const firstDow = (new Date(month.year, month.month - 1, 1).getDay() + 1) % 7;
  const cells = [...Array(firstDow).fill(null), ...data.daily];
  const today = todayISO();
  const maxSpend = Math.max(1, ...data.daily.map((d) => d.total));
  return (
    <>
      <PageHeader title="Calendar" subtitle={monthLabel(month.year, month.month)} />
      <Card padded={false}>
        <div className="grid grid-cols-7 border-b border-slate-100 text-center text-xs font-medium text-slate-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) =>
            d ? (
              <button
                key={d.date}
                type="button"
                onClick={() => navigate(`/day/${d.date}`)}
                className={cx('relative flex min-h-[72px] flex-col items-start gap-0.5 border-b border-r border-slate-100 p-1.5 text-left transition hover:bg-brand-50/50 sm:min-h-[96px] sm:p-2', d.date === today && 'bg-brand-50')}
              >
                <span className={cx('num text-xs font-semibold', d.date === today ? 'text-brand-700' : 'text-slate-700')}>{Number(d.date.slice(8))}</span>
                {d.rawMeals > 0 && <span className="num text-[11px] text-slate-600">{num(d.rawMeals + (d.guestMeals || 0))} meals</span>}
                {d.total > 0 && (
                  <span className="num hidden text-[11px] font-medium text-slate-800 sm:block">{money(d.total)}</span>
                )}
                {d.total > 0 && <span className="mt-auto h-1 rounded-full bg-[#2a78d6]" style={{ width: `${Math.max(12, (d.total / maxSpend) * 100)}%` }} />}
                {d.bazarCount > 0 && <CheckCircle2 className="absolute right-1.5 top-1.5 size-3.5 text-emerald-600" aria-label="Bazar done" />}
              </button>
            ) : (
              <div key={`e${i}`} className="border-b border-r border-slate-100 bg-slate-50/50" />
            )
          )}
        </div>
      </Card>
      <p className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="size-3.5 text-emerald-600" /> Bazar done
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1 w-5 rounded-full bg-[#2a78d6]" /> Spending (relative)
        </span>
        <span>Tap a day for details.</span>
      </p>
    </>
  );
}

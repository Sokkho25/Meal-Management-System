import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCheck, ChevronLeft, ChevronRight, Copy, Plus, Trash2, UserPlus, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useWorkspace } from '../context/WorkspaceContext';
import { useQuickAction } from '../context/QuickActions';
import { addDays, defaultDate, fmtDay, memberName, monthBounds, num } from '../utils/format';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, IconButton, PageHeader, PageLoader, Segmented, Tabs, useConfirm, cx } from '../components/ui';

export default function Meals() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'day';
  return (
    <>
      <PageHeader title="Meals" subtitle="Record who ate, day by day." />
      <Tabs
        value={tab}
        onChange={(v) => setParams({ tab: v })}
        tabs={[
          { value: 'day', label: 'Daily entry' },
          { value: 'month', label: 'Monthly sheet' },
          { value: 'summary', label: 'Summary' },
        ]}
      />
      {tab === 'day' && <DayEntry initialDate={params.get('date')} />}
      {tab === 'month' && <MonthSheet />}
      {tab === 'summary' && <Summary />}
    </>
  );
}

function DayEntry({ initialDate }) {
  const ws = useWorkspace();
  const { month, monthId, isClosed, version } = ws;
  const openForm = useQuickAction();
  const confirm = useConfirm();
  const bounds = monthBounds(month.year, month.month);
  const [date, setDate] = useState(initialDate && initialDate >= bounds.start && initialDate <= bounds.end ? initialDate : defaultDate(month.year, month.month));
  const day = useAsync(() => api.get(`/months/${monthId}/meals/day/${date}`), [monthId, date, version]);
  const guests = useAsync(() => api.get(`/months/${monthId}/guests`, { from: date, to: date, limit: 100 }), [monthId, date, version]);
  const [counts, setCounts] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (day.data) setCounts(Object.fromEntries(day.data.rows.map((r) => [r.member._id, { ...r.counts }])));
  }, [day.data]);

  const types = month.mealTypes;
  const rows = day.data?.rows || [];
  const original = useMemo(() => Object.fromEntries(rows.map((r) => [r.member._id, r.counts])), [rows]);
  const dirtyIds = rows.filter((r) => JSON.stringify(clean(counts[r.member._id])) !== JSON.stringify(clean(original[r.member._id]))).map((r) => r.member._id);

  const setCell = (mid, key, value) => setCounts((c) => ({ ...c, [mid]: { ...(c[mid] || {}), [key]: Math.max(0, Math.min(20, value)) } }));
  const setAll = (value) =>
    setCounts((c) => {
      const next = { ...c };
      rows.filter((r) => r.present && r.canEdit).forEach((r) => (next[r.member._id] = Object.fromEntries(types.map((t) => [t.key, value]))));
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      const d = await api.put(`/months/${monthId}/meals/day/${date}`, { entries: dirtyIds.map((id) => ({ member: id, counts: clean(counts[id]) })) });
      toast.success(`Saved meals for ${d.changed} member${d.changed === 1 ? '' : 's'}`);
      ws.bump();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyPrev = async () => {
    const from = addDays(date, -1);
    if (dirtyIds.length && !(await confirm({ title: 'Discard unsaved changes?', message: 'Copying will replace the unsaved changes on this day.' }))) return;
    try {
      const d = await api.post(`/months/${monthId}/meals/copy`, { from, to: date });
      toast.success(`Copied ${fmtDay(from)} (${d.changed} updated)${d.skipped.length ? `, skipped ${d.skipped.join(', ')}` : ''}`);
      ws.bump();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removeGuest = async (g) => {
    if (!(await confirm({ title: 'Remove guest meal?', message: `${g.count} meal(s) for ${g.guestName || 'guest'}.`, danger: true, confirmText: 'Remove' }))) return;
    try {
      await api.del(`/months/${monthId}/guests/${g._id}`);
      ws.bump();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const dayTotals = types.map((t) => rows.reduce((s, r) => s + (Number(counts[r.member._id]?.[t.key]) || 0), 0));
  const guestTotal = (guests.data?.items || []).reduce((s, g) => s + g.count, 0);

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between gap-2 p-2">
        <IconButton icon={ChevronLeft} label="Previous day" disabled={date <= bounds.start} onClick={() => setDate(addDays(date, -1))} />
        <label className="relative flex cursor-pointer flex-col items-center">
          <span className="text-sm font-semibold text-slate-900">{fmtDay(date)}</span>
          <span className="text-xs text-slate-500">Tap to pick a date</span>
          <input type="date" className="absolute inset-0 cursor-pointer opacity-0" min={bounds.start} max={bounds.end} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <IconButton icon={ChevronRight} label="Next day" disabled={date >= bounds.end} onClick={() => setDate(addDays(date, 1))} />
      </div>

      {!isClosed && (
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Button variant="secondary" size="sm" icon={CheckCheck} onClick={() => setAll(1)}>
            All present
          </Button>
          <Button variant="secondary" size="sm" icon={XCircle} onClick={() => setAll(0)}>
            All absent
          </Button>
          <Button variant="secondary" size="sm" icon={Copy} onClick={copyPrev} disabled={date <= bounds.start}>
            Copy previous day
          </Button>
          <Button variant="secondary" size="sm" icon={UserPlus} onClick={() => openForm('guest', { date })}>
            Add guest
          </Button>
        </div>
      )}

      {day.error ? (
        <ErrorState error={day.error} onRetry={day.reload} />
      ) : day.loading && !day.data ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title="No members on this day" description="Members appear here between their joining and leaving dates." />
        </Card>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="table-base table-tight">
              <thead>
                <tr>
                  <th>Member</th>
                  {types.map((t) => (
                    <th key={t.key} className="text-center">
                      {t.label}
                      {month.settings.mealMode === 'weighted' && t.weight !== 1 && <span className="ml-1 font-normal normal-case text-slate-400">×{t.weight}</span>}
                    </th>
                  ))}
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const mc = counts[r.member._id] || {};
                  const total = types.reduce((s, t) => s + (Number(mc[t.key]) || 0), 0);
                  const editable = r.canEdit && r.present && !isClosed;
                  return (
                    <tr key={r.member._id} className={cx(dirtyIds.includes(r.member._id) && 'bg-amber-50/50')}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="hidden sm:inline-flex">
                            <Avatar name={r.member.fullName} src={r.member.photoUrl} size="sm" />
                          </span>
                          <span className="max-w-[7rem] truncate font-medium text-slate-800 sm:max-w-none">{memberName(r.member)}</span>
                          {!r.present && <Badge tone="amber">Not a member today</Badge>}
                        </div>
                      </td>
                      {types.map((t) => (
                        <td key={t.key} className="text-center">
                          <MealCell value={Number(mc[t.key]) || 0} disabled={!editable} onChange={(v) => setCell(r.member._id, t.key, v)} />
                        </td>
                      ))}
                      <td className="num text-right font-semibold">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 text-sm font-semibold">
                  <td className="px-4 py-3">Day total</td>
                  {dayTotals.map((v, i) => (
                    <td key={i} className="num px-4 py-3 text-center">
                      {v}
                    </td>
                  ))}
                  <td className="num px-4 py-3 text-right">
                    {dayTotals.reduce((s, v) => s + v, 0)}
                    {guestTotal > 0 && <span className="block text-xs font-normal text-slate-500">+{guestTotal} guest</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {(guests.data?.items || []).length > 0 && (
        <Card title="Guest meals" padded={false}>
          <ul className="divide-y divide-slate-100">
            {guests.data.items.map((g) => (
              <li key={g._id} className="flex items-center justify-between px-4 py-2.5 text-sm sm:px-5">
                <span>
                  <span className="font-medium">{g.guestName || 'Guest'}</span> · {g.count} {types.find((t) => t.key === g.mealType)?.label.toLowerCase()} · host {memberName(g.host)}
                </span>
                {!isClosed && <IconButton icon={Trash2} label="Remove guest meal" onClick={() => removeGuest(g)} />}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {dirtyIds.length > 0 && (
        <div className="safe-bottom fixed inset-x-0 bottom-16 z-20 border-t border-amber-200 bg-amber-50/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-64">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <span className="text-sm text-amber-900">
              {dirtyIds.length} unsaved change{dirtyIds.length > 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => day.reload()}>
                Discard
              </Button>
              <Button size="sm" loading={saving} onClick={save}>
                Save meals
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const clean = (c) => Object.fromEntries(Object.entries(c || {}).filter(([, v]) => Number(v) > 0).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, Number(v)]));

function MealCell({ value, onChange, disabled }) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value > 0 ? 0 : 1)}
        aria-label={value ? 'Mark absent' : 'Mark present'}
        className={cx(
          'num grid size-9 place-items-center rounded-xl sm:size-10 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed',
          value > 0 ? 'bg-brand-600 text-white shadow-sm' : 'border border-dashed border-slate-300 text-slate-300 hover:border-slate-400',
          disabled && value > 0 && 'bg-brand-300'
        )}
      >
        {value > 0 ? value : '0'}
      </button>
      {!disabled && value > 0 && (
        <button type="button" aria-label="Add one more" onClick={() => onChange(value + 1)} className="grid size-6 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function MonthSheet() {
  const { month, monthId, members, version } = useWorkspace();
  const { data, loading } = useAsync(() => api.get(`/months/${monthId}/meals`), [monthId, version]);
  const [mode, setMode] = useState('total');
  if (loading && !data) return <PageLoader />;
  const { days } = monthBounds(month.year, month.month);
  const dates = Array.from({ length: days }, (_, i) => i + 1);
  const map = {};
  for (const e of data.items) {
    const d = Number(e.date.slice(8));
    map[`${e.member}:${d}`] = mode === 'total' ? Object.values(e.counts).reduce((s, v) => s + v, 0) : e.counts[mode] || 0;
  }
  return (
    <Card padded={false} title="Monthly meal sheet" action={<Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'total', label: 'All' }, ...month.mealTypes.map((t) => ({ value: t.key, label: t.label }))]} />}>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold text-slate-500">Member</th>
              {dates.map((d) => (
                <th key={d} className="num w-8 px-1 py-2 text-center font-medium text-slate-400">
                  {d}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold text-slate-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const total = dates.reduce((s, d) => s + (map[`${m._id}:${d}`] || 0), 0);
              return (
                <tr key={m._id} className="border-t border-slate-100">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-slate-700">{memberName(m)}</td>
                  {dates.map((d) => {
                    const v = map[`${m._id}:${d}`] || 0;
                    return (
                      <td key={d} className="px-0.5 py-1 text-center">
                        <span className={cx('num grid size-7 place-items-center rounded-md', v ? 'bg-brand-100 font-semibold text-brand-900' : 'text-slate-300')}>{v || '·'}</span>
                      </td>
                    );
                  })}
                  <td className="num px-3 py-2 text-right font-semibold">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Summary() {
  const { monthId, version } = useWorkspace();
  const { data, loading } = useAsync(() => api.get(`/months/${monthId}/calculation`), [monthId, version]);
  if (loading && !data) return <PageLoader />;
  const c = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(c.mealTypeTotals).map(([k, t]) => (
          <div key={k} className="card p-4">
            <p className="text-xs text-slate-500">{t.label}</p>
            <p className="num text-xl font-semibold">{t.count}</p>
            {c.settings.mealMode === 'weighted' && <p className="text-xs text-slate-500">= {num(t.weighted)} weighted</p>}
          </div>
        ))}
        <div className="card bg-brand-50 p-4">
          <p className="text-xs text-brand-800">Total meals</p>
          <p className="num text-xl font-semibold text-brand-900">{num(c.totals.totalMeals)}</p>
        </div>
      </div>
      <Card padded={false} title="Member-wise meals">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Member</th>
                {c.mealTypes.map((t) => (
                  <th key={t.key} className="text-right">
                    {t.label}
                  </th>
                ))}
                <th className="text-right">Guest</th>
                <th className="text-right">Meals</th>
                <th className="text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {c.members.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium">{memberName(m)}</td>
                  {c.mealTypes.map((t) => (
                    <td key={t.key} className="num text-right">
                      {m.mealsByType[t.key] || 0}
                    </td>
                  ))}
                  <td className="num text-right">{num(m.guestMeals)}</td>
                  <td className="num text-right font-semibold">{num(m.meals)}</td>
                  <td className="num text-right text-slate-500">{m.mealPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

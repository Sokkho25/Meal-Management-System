import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pencil, UtensilsCrossed } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useWorkspace } from '../context/WorkspaceContext';
import { addDays, fmtDate, memberName, money, monthBounds, num } from '../utils/format';
import { Button, Card, EmptyState, ErrorState, IconButton, PageHeader, PageLoader } from '../components/ui';

export default function DayView() {
  const { date } = useParams();
  const { month, monthId, version } = useWorkspace();
  const navigate = useNavigate();
  const bounds = monthBounds(month.year, month.month);
  const { data, loading, error, reload } = useAsync(() => api.get(`/months/${monthId}/daily/${date}`), [monthId, date, version]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <PageLoader />;
  const s = data.summary;
  const ate = data.meals.filter((m) => Object.values(m.counts).some((v) => v > 0));
  return (
    <>
      <PageHeader
        title={fmtDate(date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        actions={
          <>
            <IconButton icon={ChevronLeft} label="Previous day" disabled={date <= bounds.start} onClick={() => navigate(`/day/${addDays(date, -1)}`)} />
            <IconButton icon={ChevronRight} label="Next day" disabled={date >= bounds.end} onClick={() => navigate(`/day/${addDays(date, 1)}`)} />
            <Link to={`/meals?date=${date}`}>
              <Button variant="secondary" icon={Pencil} size="sm">
                Edit meals
              </Button>
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.mealTypes.map((t) => (
          <div key={t.key} className="card p-4">
            <p className="text-xs text-slate-500">{t.label}</p>
            <p className="num text-xl font-semibold">{s.mealsByType[t.key] || 0}</p>
          </div>
        ))}
        <div className="card p-4">
          <p className="text-xs text-slate-500">Total meals</p>
          <p className="num text-xl font-semibold">{num(s.rawMeals)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Bazar</p>
          <p className="num text-xl font-semibold">{money(s.bazar)}</p>
        </div>
        <div className="card bg-brand-50 p-4">
          <p className="text-xs text-brand-800">Total spending</p>
          <p className="num text-xl font-semibold text-brand-900">{money(s.total)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Who ate" padded={false}>
          {ate.length === 0 && data.guests.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} title="No meals recorded" />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Member</th>
                  {data.mealTypes.map((t) => (
                    <th key={t.key} className="text-center">
                      {t.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ate.map((m) => (
                  <tr key={m.member._id}>
                    <td className="font-medium">{memberName(m.member)}</td>
                    {data.mealTypes.map((t) => (
                      <td key={t.key} className="num text-center">
                        {m.counts[t.key] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.guests.map((g) => (
                  <tr key={g._id} className="text-slate-500">
                    <td>
                      {g.guestName || 'Guest'} <span className="text-xs">(guest of {g.host?.fullName})</span>
                    </td>
                    {data.mealTypes.map((t) => (
                      <td key={t.key} className="num text-center">
                        {g.mealType === t.key ? g.count : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="What was purchased" padded={false}>
          {data.bazar.length === 0 && data.expenses.length === 0 ? (
            <EmptyState title="No purchases" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.bazar.map((b) => (
                <li key={b._id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{b.itemName}</span>{' '}
                    <span className="text-xs text-slate-500">
                      {num(b.quantity)} {b.unit} · {b.paidFrom === 'fund' ? 'Mess fund' : b.purchasers.map((p) => memberName(p.member)).join(' + ')}
                    </span>
                  </span>
                  <span className="num font-medium">{money(b.isRefund ? -b.totalPrice : b.totalPrice)}</span>
                </li>
              ))}
              {data.expenses.map((e) => (
                <li key={e._id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{e.title}</span> <span className="text-xs text-slate-500">{e.category} · {e.paidBy ? e.paidBy.fullName : 'Mess fund'}</span>
                  </span>
                  <span className="num font-medium">{money(e.isRefund ? -e.amount : e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {(data.contributions.length > 0 || data.plans.length > 0) && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {data.contributions.length > 0 && (
            <Card title="Deposits" padded={false}>
              <ul className="divide-y divide-slate-100">
                {data.contributions.map((c) => (
                  <li key={c._id} className="flex justify-between px-4 py-2.5 text-sm">
                    <span>{c.member?.fullName}</span>
                    <span className="num font-medium">{money(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {data.plans.length > 0 && (
            <Card title="Meal plan">
              <ul className="space-y-1 text-sm">
                {data.plans.map((p) => (
                  <li key={p._id}>
                    <span className="font-medium">{data.mealTypes.find((t) => t.key === p.mealType)?.label}:</span> {p.menu}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

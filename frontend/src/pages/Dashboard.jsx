import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Banknote, Calculator, ChartPie, PiggyBank, Receipt, ShoppingBasket, Users, UtensilsCrossed, Wallet } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useWorkspace } from '../context/WorkspaceContext';
import { useQuickAction } from '../context/QuickActions';
import { fmtDate, fmtDay, memberName, money, monthLabel, monthShort, num } from '../utils/format';
import { Avatar, BalanceBadge, Button, Card, EmptyState, ErrorState, PageHeader, Progress, Skeleton, StatCard, cx } from '../components/ui';
import { ExpenseDonut, GroupedBars, SERIES, SimpleBars, TYPE_COLORS } from '../components/charts';
import { CashModal, MealRateModal, MemberBreakdownModal } from '../components/Breakdowns';

export default function Dashboard() {
  const { month, monthId, version, household, isAdmin } = useWorkspace();
  const open = useQuickAction();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.get(`/months/${monthId}/dashboard`), [monthId, version]);
  const [modal, setModal] = useState(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <DashboardSkeleton />;
  const { calculation: c, recentBazar, trend, today, notifications } = data;
  const t = c.totals;
  const todayRow = today && c.daily.find((d) => d.date === today);
  const noMembers = c.members.length === 0;

  const expenseData = [
    { key: 'food', label: 'Food', value: t.food, color: TYPE_COLORS.food },
    { key: 'household', label: 'Household', value: t.household, color: TYPE_COLORS.household },
    { key: 'utility', label: 'Utilities', value: t.utility, color: TYPE_COLORS.utility },
    { key: 'other', label: 'Other', value: t.other, color: TYPE_COLORS.other },
  ];
  const lastDay = today || c.period.end;
  const daily = c.daily.filter((d) => d.date <= lastDay).map((d) => ({ name: d.date.slice(8), Spending: d.total, date: d.date }));

  return (
    <>
      <PageHeader
        title={monthLabel(month.year, month.month)}
        subtitle={`${month.name || household?.name}${month.address ? ` · ${month.address}` : ''}`}
        actions={
          <>
            <Button variant="secondary" icon={UtensilsCrossed} onClick={() => open('meal')} className="hidden sm:inline-flex">
              Add meal
            </Button>
            <Button icon={ShoppingBasket} onClick={() => open('bazar')} className="hidden sm:inline-flex">
              Add bazar
            </Button>
          </>
        }
      />

      {noMembers && isAdmin && (
        <Card className="mb-5">
          <EmptyState icon={Users} title="Add your members first" description="Everyone who eats or pays this month should be a member." action={<Button onClick={() => navigate('/members')}>Go to members</Button>} />
        </Card>
      )}

      {notifications.length > 0 && (
        <div className="mb-5 space-y-2">
          {notifications.slice(0, 3).map((n) => (
            <Link key={n.key} to={n.link || '#'} className={cx('flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm', n.level === 'danger' ? 'border-rose-200 bg-rose-50 text-rose-900' : n.level === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-sky-200 bg-sky-50 text-sky-900')}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium">{n.title}</span> {n.body && <span className="opacity-80">{n.body}</span>}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} tone="slate" label="Members" value={t.activeMembers} hint={t.members !== t.activeMembers ? `${t.members} total` : 'Active this month'} onClick={() => navigate('/members')} />
        <StatCard icon={UtensilsCrossed} tone="brand" label="Total meals" value={num(t.totalMeals)} hint={t.guestMeals ? `incl. ${t.guestMeals} guest` : 'This month'} onClick={() => navigate('/meals')} />
        <StatCard icon={Calculator} tone="violet" label="Meal rate" value={money(t.mealRate, { decimals: 2 })} hint="Tap to see how" onClick={() => setModal({ kind: 'rate' })} />
        <StatCard icon={PiggyBank} tone={t.cashInHand < 0 ? 'rose' : 'sky'} label="Cash in hand" value={money(t.cashInHand)} hint="Tap for breakdown" onClick={() => setModal({ kind: 'cash' })} />
        <StatCard icon={ShoppingBasket} tone="amber" label="Food expense" value={money(t.food)} hint={`Bazar ${money(t.bazar)}`} onClick={() => navigate('/bazar')} />
        <StatCard icon={Receipt} tone="slate" label="Other expense" value={money(t.nonFood)} hint="Household, utilities, other" onClick={() => navigate('/expenses')} />
        <StatCard icon={Banknote} tone="slate" label="Total expense" value={money(t.totalExpense)} />
        <StatCard icon={Wallet} tone="brand" label="Total deposits" value={money(t.deposits)} hint={t.personalPurchases ? `+ ${money(t.personalPurchases)} paid by members` : undefined} onClick={() => navigate('/contributions')} />
      </div>

      {c.budget.length > 0 && (
        <Card title="Budget" className="mt-5" action={isAdmin && <Link to="/settings?tab=budget" className="text-xs font-medium text-brand-700">Edit</Link>}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.budget.map((b) => (
              <div key={b.label}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="font-medium text-slate-700">{b.label}</span>
                  <span className="num text-xs text-slate-500">
                    {money(b.used)} / {money(b.budget)}
                  </span>
                </div>
                <Progress value={b.percent} />
                <p className={cx('mt-1 text-xs', b.remaining < 0 ? 'text-rose-600' : 'text-slate-500')}>{b.remaining < 0 ? `Over by ${money(-b.remaining)}` : `${money(b.remaining)} left · ${b.percent}% used`}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <Card title="Expense breakdown" className="lg:col-span-2">
          <ExpenseDonut data={expenseData} />
        </Card>
        <Card title="Daily spending" subtitle="Bazar + other expenses per day" className="lg:col-span-3">
          <SimpleBars data={daily} dataKey="Spending" name="Spending" color={SERIES[0]} />
        </Card>
      </div>

      {today && (
        <Card title={`Today · ${fmtDay(today)}`} className="mt-5" action={<Link to={`/day/${today}`} className="flex items-center gap-1 text-xs font-medium text-brand-700">Details <ArrowRight className="size-3.5" /></Link>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {c.mealTypes.map((mt) => (
              <div key={mt.key} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{mt.label}</p>
                <p className="num text-lg font-semibold">{todayRow?.mealsByType[mt.key] || 0}</p>
              </div>
            ))}
            <div className="rounded-xl bg-brand-50 p-3">
              <p className="text-xs text-brand-800">Today's spending</p>
              <p className="num text-lg font-semibold text-brand-900">{money(todayRow?.total || 0)}</p>
            </div>
          </div>
        </Card>
      )}

      <Card
        title="Member settlement"
        subtitle="Tap a member to see the full calculation"
        className="mt-5"
        padded={false}
        action={<Link to="/reports" className="text-xs font-medium text-brand-700">Full report</Link>}
      >
        {c.members.length === 0 ? (
          <EmptyState title="No members yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {c.members.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setModal({ kind: 'member', member: m })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:px-5">
                  <Avatar name={m.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{memberName(m)}</p>
                    <p className="num text-xs text-slate-500">
                      {num(m.meals)} meals · uses {money(m.payable)} · paid {money(m.totalCredit)}
                    </p>
                  </div>
                  <BalanceBadge balance={m.balance} status={m.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Meal distribution" subtitle="Meals per member">
          <SimpleBars horizontal data={c.members.map((m) => ({ name: memberName(m), Meals: m.meals }))} dataKey="Meals" name="Meals" color={SERIES[2]} formatter={(v) => num(v)} height={200} />
        </Card>
        <Card title="Member balance" subtitle="What each member paid vs. what they used">
          <GroupedBars
            data={c.members.map((m) => ({ name: memberName(m), paid: m.totalCredit, used: m.payable }))}
            series={[
              { key: 'paid', label: 'Paid', color: SERIES[0] },
              { key: 'used', label: 'Used', color: SERIES[1] },
            ]}
          />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Monthly trend" subtitle="Total expense by month">
          <SimpleBars data={trend.map((x) => ({ name: monthShort(x.year, x.month), Expense: x.totalExpense }))} dataKey="Expense" name="Total expense" color={SERIES[0]} height={220} />
        </Card>
        <Card title="Recent bazar" padded={false} action={<Link to="/bazar" className="text-xs font-medium text-brand-700">View all</Link>}>
          {recentBazar.length === 0 ? (
            <EmptyState icon={ShoppingBasket} title="No bazar yet" action={<Button size="sm" onClick={() => open('bazar')}>Add bazar</Button>} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentBazar.map((b) => (
                <li key={b._id} className="flex items-center justify-between px-4 py-2.5 text-sm sm:px-5">
                  <div>
                    <p className="font-medium text-slate-800">{b.itemName}</p>
                    <p className="text-xs text-slate-500">
                      {fmtDate(b.date, { day: '2-digit', month: 'short' })} · {b.category}
                    </p>
                  </div>
                  <span className="num font-medium">{money(b.isRefund ? -b.totalPrice : b.totalPrice)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {c.warnings.length > 0 && isAdmin && (
        <Card title="Calculation checks" className="mt-5">
          <ul className="space-y-1.5 text-sm text-amber-800">
            {c.warnings.map((w, i) => (
              <li key={i} className="flex gap-2">
                <ChartPie className="mt-0.5 size-4 shrink-0" /> {w.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {modal?.kind === 'member' && <MemberBreakdownModal member={modal.member} onClose={() => setModal(null)} />}
      {modal?.kind === 'rate' && <MealRateModal calc={c} onClose={() => setModal(null)} />}
      {modal?.kind === 'cash' && <CashModal calc={c} onClose={() => setModal(null)} />}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

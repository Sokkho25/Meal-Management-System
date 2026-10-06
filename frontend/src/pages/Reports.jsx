import { useState } from 'react';
import toast from 'react-hot-toast';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useWorkspace } from '../context/WorkspaceContext';
import { fmtDate, money, num, typeLabel } from '../utils/format';
import { BalanceBadge, Button, Card, ErrorState, PageHeader, PageLoader, Select } from '../components/ui';
import { ExpenseDonut, SERIES, SimpleBars, TYPE_COLORS } from '../components/charts';
import { MealRateModal, MemberBreakdownModal } from '../components/Breakdowns';

export default function Reports() {
  const { monthId, version } = useWorkspace();
  const { data: r, loading, error, reload } = useAsync(() => api.get(`/months/${monthId}/reports`), [monthId, version]);
  const calc = useAsync(() => api.get(`/months/${monthId}/calculation`), [monthId, version]);
  const [csvSection, setCsvSection] = useState('settlement');
  const [busy, setBusy] = useState(null);
  const [modal, setModal] = useState(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !r) return <PageLoader />;
  const f = r.financial;

  const downloadCsv = async () => {
    setBusy('csv');
    try {
      const res = await api.raw(`/months/${monthId}/reports/export.csv`, { section: csvSection });
      const blob = await res.blob();
      const name = (res.headers.get('Content-Disposition') || '').match(/filename="(.+)"/)?.[1] || 'report.csv';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    setBusy('pdf');
    try {
      const { exportReportPdf } = await import('../utils/pdf');
      exportReportPdf(r);
    } catch (err) {
      toast.error(err.message || 'Could not create PDF');
    } finally {
      setBusy(null);
    }
  };

  const memberMap = Object.fromEntries((calc.data?.members || []).map((m) => [m.id, m]));

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={r.title}
        actions={
          <>
            <Button variant="secondary" icon={FileText} loading={busy === 'pdf'} onClick={downloadPdf}>
              Export PDF
            </Button>
            <div className="flex items-center gap-1">
              <Select
                value={csvSection}
                onChange={(e) => setCsvSection(e.target.value)}
                aria-label="CSV section"
                options={[
                  { value: 'settlement', label: 'Settlement' },
                  { value: 'meals', label: 'Meals' },
                  { value: 'bazar', label: 'Bazar items' },
                  { value: 'expenses', label: 'Expenses' },
                  { value: 'contributions', label: 'Deposits' },
                ]}
              />
              <Button variant="secondary" icon={FileSpreadsheet} loading={busy === 'csv'} onClick={downloadCsv}>
                CSV
              </Button>
            </div>
          </>
        }
      />

      {r.month.status === 'closed' && <p className="mb-4 rounded-xl bg-slate-100 px-4 py-2.5 text-sm text-slate-600">This month is closed; figures come from the snapshot taken at closing.</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Financial summary">
          <dl className="divide-y divide-slate-100 text-sm">
            {[
              ['Starting balance', f.startingBalance],
              ['Carried from last month', f.carryBalance],
              ['Total deposits', f.deposits],
              ['Paid by members directly', f.personalPurchases],
              ['Food expense', f.food],
              ['Household expense', f.household],
              ['Utility expense', f.utility],
              ['Other expense', f.other],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2">
                <dt className="text-slate-600">{k}</dt>
                <dd className="num">{money(v)}</dd>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold">
              <dt>Total expenses</dt>
              <dd className="num">{money(f.totalExpense)}</dd>
            </div>
            <div className="flex justify-between py-2 font-semibold">
              <dt>Remaining cash in hand</dt>
              <dd className="num">{money(f.cashInHand)}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Where the money went">
          <ExpenseDonut
            data={['food', 'household', 'utility', 'other'].map((k) => ({ key: k, label: typeLabel(k), value: f[k], color: TYPE_COLORS[k] }))}
          />
        </Card>
      </div>

      <Card title="Meal summary" className="mt-5" padded={false} action={calc.data && <button type="button" className="text-xs font-medium text-brand-700" onClick={() => setModal({ kind: 'rate' })}>How is the rate calculated?</button>}>
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 text-center">
          <div className="p-4">
            <p className="text-xs text-slate-500">Total meals</p>
            <p className="num text-lg font-semibold">{num(r.meals.totalMeals)}</p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Meal-based cost</p>
            <p className="num text-lg font-semibold">{money(r.meals.mealRateExpense)}</p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Meal rate</p>
            <p className="num text-lg font-semibold">{money(r.meals.mealRate, { decimals: 2 })}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Member</th>
                {Object.entries(r.meals.byType).map(([k, t]) => (
                  <th key={k} className="text-right">
                    {t.label}
                  </th>
                ))}
                <th className="text-right">Meals</th>
                <th className="text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {r.meals.members.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium">{m.fullName}</td>
                  {Object.keys(r.meals.byType).map((k) => (
                    <td key={k} className="num text-right">
                      {m.mealsByType[k] || 0}
                    </td>
                  ))}
                  <td className="num text-right font-semibold">{num(m.meals)}</td>
                  <td className="num text-right text-slate-500">{m.mealPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Bazar by category">
          <SimpleBars horizontal data={r.bazar.byCategory.filter((c) => c.amount > 0).map((c) => ({ name: c.category, Amount: c.amount }))} dataKey="Amount" name="Amount" color={SERIES[0]} height={160} />
        </Card>
        <Card title="Purchases by member">
          <SimpleBars horizontal data={r.bazar.byPurchaser.map((p) => ({ name: p.name, Amount: p.amount }))} dataKey="Amount" name="Bought" color={SERIES[2]} height={160} />
        </Card>
      </div>

      <Card title="Most expensive items" className="mt-5" padded={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Category</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {r.bazar.topItems.map((b, i) => (
                <tr key={i}>
                  <td>{fmtDate(b.date, { day: '2-digit', month: 'short' })}</td>
                  <td className="font-medium">{b.itemName}</td>
                  <td>{b.category}</td>
                  <td className="num text-right">
                    {num(b.quantity)} {b.unit}
                  </td>
                  <td className="num text-right font-semibold">{money(b.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Settlement summary" subtitle="Tap a row for the full calculation" className="mt-5" padded={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Member</th>
                <th className="text-right">Meals</th>
                <th className="text-right">Meal cost</th>
                <th className="text-right">Shared</th>
                <th className="text-right">Payable</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Result</th>
              </tr>
            </thead>
            <tbody>
              {r.settlement.members.map((m) => (
                <tr key={m.id} className="cursor-pointer" onClick={() => memberMap[m.id] && setModal({ kind: 'member', member: memberMap[m.id] })}>
                  <td className="font-medium">{m.fullName}</td>
                  <td className="num text-right">{num(m.meals)}</td>
                  <td className="num text-right">{money(m.mealCost)}</td>
                  <td className="num text-right">{money(m.sharedTotal)}</td>
                  <td className="num text-right font-semibold">{money(m.payable)}</td>
                  <td className="num text-right">{money(m.totalCredit)}</td>
                  <td className="text-right">
                    <BalanceBadge balance={m.balance} status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 border-t border-slate-100 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-rose-700">Owes money</p>
            {r.settlement.owes.length ? r.settlement.owes.map((o) => <p key={o.fullName}>{o.fullName} · {money(o.amount)}</p>) : <p className="text-slate-400">Nobody</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-emerald-700">Gets money back</p>
            {r.settlement.getsBack.length ? r.settlement.getsBack.map((o) => <p key={o.fullName}>{o.fullName} · {money(o.amount)}</p>) : <p className="text-slate-400">Nobody</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Settled</p>
            {r.settlement.settled.length ? <p>{r.settlement.settled.join(', ')}</p> : <p className="text-slate-400">Nobody</p>}
          </div>
        </div>
      </Card>
      {r.warnings.length > 0 && (
        <Card title="Calculation notes" className="mt-5">
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
            {r.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </Card>
      )}
      {modal?.kind === 'member' && <MemberBreakdownModal member={modal.member} onClose={() => setModal(null)} />}
      {modal?.kind === 'rate' && <MealRateModal calc={calc.data} onClose={() => setModal(null)} />}
    </>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, Lock, LockOpen } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useWorkspace } from '../context/WorkspaceContext';
import { money, monthLabel, num } from '../utils/format';
import { BalanceBadge, Button, Card, ErrorState, PageHeader, PageLoader, StatCard, useConfirm } from '../components/ui';

export default function CloseMonth() {
  const ws = useWorkspace();
  const { month, monthId, isAdmin, version } = ws;
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(() => api.get(`/months/${monthId}/close-preview`), [monthId, version], { enabled: isAdmin });
  if (!isAdmin) return <ErrorState error={{ message: 'Only an admin can close or reopen a month.' }} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <PageLoader />;
  const t = data.totals;
  const closed = month.status === 'closed';
  const label = monthLabel(month.year, month.month);

  const act = async () => {
    const ok = await confirm(
      closed
        ? { title: `Reopen ${label}?`, message: 'Records become editable again. Remember to close it again when you are done.', confirmText: 'Reopen' }
        : { title: `Close ${label}?`, message: 'Editing will be locked and a final snapshot of all figures will be saved. An admin can reopen it later.', confirmText: 'Close month' }
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(`/months/${monthId}/${closed ? 'reopen' : 'close'}`);
      toast.success(closed ? 'Month reopened' : 'Month closed');
      await ws.refreshMonth();
      await ws.refreshMonths();
      if (!closed) navigate('/history');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={closed ? `${label} is closed` : `Close ${label}`}
        subtitle={closed ? 'Records are locked. Reopen to make corrections.' : 'Review the final figures before locking the month.'}
        actions={
          <Button variant={closed ? 'secondary' : 'primary'} icon={closed ? LockOpen : Lock} loading={busy} onClick={act}>
            {closed ? 'Reopen month' : 'Close month'}
          </Button>
        }
      />
      {data.warnings.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" /> Check before closing
          </p>
          <ul className="list-disc pl-5">
            {data.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Members" value={t.members} />
        <StatCard label="Total meals" value={num(t.totalMeals)} />
        <StatCard label="Food cost" value={money(t.food)} />
        <StatCard label="Household + other" value={money(t.nonFood)} />
        <StatCard label="Total expenses" value={money(t.totalExpense)} />
        <StatCard label="Total deposits" value={money(t.deposits)} />
        <StatCard label="Meal rate" value={money(t.mealRate, { decimals: 2 })} />
        <StatCard label="Outstanding dues" value={money(t.totalDue)} />
      </div>
      <Card title="Member balances" className="mt-5" padded={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Member</th>
                <th className="text-right">Meals</th>
                <th className="text-right">Payable</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium">{m.fullName}</td>
                  <td className="num text-right">{num(m.meals)}</td>
                  <td className="num text-right">{money(m.payable)}</td>
                  <td className="num text-right">{money(m.totalCredit)}</td>
                  <td className="text-right">
                    <BalanceBadge balance={m.balance} status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {!closed && (
        <p className="mt-4 text-sm text-slate-500">
          Cash in hand at close: <strong className="num">{money(t.cashInHand)}</strong>. When you create next month, this and each member's balance can be carried forward (Settings → Calculation rules).
        </p>
      )}
    </>
  );
}

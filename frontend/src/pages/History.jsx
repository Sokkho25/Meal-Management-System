import { useNavigate } from 'react-router-dom';
import { History as HistoryIcon, Lock } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useWorkspace } from '../context/WorkspaceContext';
import { money, monthLabel, monthShort, num } from '../utils/format';
import { Badge, Card, EmptyState, PageHeader, PageLoader } from '../components/ui';
import { SERIES, SimpleBars } from '../components/charts';

export default function History() {
  const { householdId, selectMonth, monthId, version } = useWorkspace();
  const navigate = useNavigate();
  const { data, loading } = useAsync(() => api.get(`/households/${householdId}/history`), [householdId, version]);
  if (loading && !data) return <PageLoader />;
  const rows = data.history;
  const open = async (id) => {
    if (id !== monthId) await selectMonth(id);
    navigate('/dashboard');
  };
  return (
    <>
      <PageHeader title="Monthly history" subtitle="Every month is kept separately. Open any month to view it." />
      {rows.length > 1 && (
        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          <Card title="Total expense by month">
            <SimpleBars data={[...rows].reverse().map((r) => ({ name: monthShort(r.year, r.month), Expense: r.totalExpense }))} dataKey="Expense" name="Total expense" color={SERIES[0]} height={200} />
          </Card>
          <Card title="Meal rate by month">
            <SimpleBars data={[...rows].reverse().map((r) => ({ name: monthShort(r.year, r.month), Rate: r.mealRate }))} dataKey="Rate" name="Meal rate" color={SERIES[2]} height={200} formatter={(v) => money(v, { decimals: 2 })} />
          </Card>
        </div>
      )}
      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState icon={HistoryIcon} title="No months yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="text-right">Members</th>
                  <th className="text-right">Meals</th>
                  <th className="text-right">Expense</th>
                  <th className="text-right">Meal rate</th>
                  <th className="text-right">Cash balance</th>
                  <th className="text-right">Outstanding</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="cursor-pointer" onClick={() => open(r._id)}>
                    <td className="whitespace-nowrap font-medium">
                      {monthLabel(r.year, r.month)} {r._id === monthId && <Badge tone="brand">Viewing</Badge>}
                    </td>
                    <td className="num text-right">{r.members}</td>
                    <td className="num text-right">{num(r.totalMeals)}</td>
                    <td className="num text-right">{money(r.totalExpense)}</td>
                    <td className="num text-right">{money(r.mealRate, { decimals: 2 })}</td>
                    <td className="num text-right">{money(r.cashInHand)}</td>
                    <td className="num text-right">{r.totalDue ? money(r.totalDue) : '—'}</td>
                    <td className="text-right">
                      {r.status === 'closed' ? (
                        <Badge>
                          <Lock className="size-3" /> Closed
                        </Badge>
                      ) : (
                        <Badge tone="green">Open</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

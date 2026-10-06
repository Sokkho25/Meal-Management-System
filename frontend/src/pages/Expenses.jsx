import { useSearchParams } from 'react-router-dom';
import { Plus, Receipt, Repeat } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useWorkspace } from '../context/WorkspaceContext';
import { useQuickAction } from '../context/QuickActions';
import { fmtDate, memberName, methodLabel, money, typeLabel } from '../utils/format';
import { Badge, Button, Card, PageHeader, StatCard } from '../components/ui';
import RecordList from '../components/RecordList';

const TYPE_TONE = { food: 'blue', household: 'amber', utility: 'violet', other: 'slate' };

export default function Expenses() {
  const { isClosed, isAdmin, monthId, version } = useWorkspace();
  const open = useQuickAction();
  const [params] = useSearchParams();
  const calc = useAsync(() => api.get(`/months/${monthId}/calculation`), [monthId, version]);
  const recurring = useAsync(() => api.get(`/months/${monthId}/expenses/recurring`), [monthId, version], { enabled: isAdmin && !isClosed });
  const t = calc.data?.totals;
  const amount = (e) => money(e.isRefund ? -e.amount : e.amount);

  return (
    <>
      <PageHeader title="Expenses" subtitle="Household, utility and other shared costs." actions={isAdmin && !isClosed && <Button icon={Plus} onClick={() => open('expense')}>Add expense</Button>} />
      {t && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Food" value={money(t.food)} hint="Bazar + food expenses" />
          <StatCard label="Household" value={money(t.household)} />
          <StatCard label="Utilities" value={money(t.utility)} />
          <StatCard label="Other" value={money(t.other)} />
        </div>
      )}
      {(recurring.data?.items || []).length > 0 && (
        <Card title="Recurring bills due this month" subtitle="From last month. Add each one with this month's amount." className={params.get('recurring') ? 'mb-5 ring-2 ring-amber-300' : 'mb-5'}>
          <ul className="divide-y divide-slate-100">
            {recurring.data.items.map((r) => (
              <li key={`${r.category}-${r.title}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <Repeat className="size-4 text-amber-600" />
                  <span className="font-medium">{r.title}</span>
                  <span className="text-slate-500">last month {money(r.amount)}</span>
                </span>
                <Button size="sm" variant="soft" onClick={() => open('expense', { preset: r, onSaved: () => recurring.reload() })}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <RecordList
        path="expenses"
        filters={['expenseType', 'category', 'paymentMethod', 'member']}
        emptyIcon={Receipt}
        emptyTitle="No expenses recorded yet"
        emptyAction={isAdmin && <Button size="sm" onClick={() => open('expense')}>Add expense</Button>}
        onEdit={(item) => open('expense', { item })}
        describe={(e) => `${e.title} · ${amount(e)} on ${fmtDate(e.date)}`}
        columns={[
          { key: 'date', label: 'Date', render: (e) => <span className="whitespace-nowrap text-slate-600">{fmtDate(e.date, { day: '2-digit', month: 'short' })}</span> },
          {
            key: 'title',
            label: 'Title',
            render: (e) => (
              <div>
                <span className="font-medium text-slate-900">{e.title}</span> {e.recurring && <Badge tone="amber">Recurring</Badge>} {e.isRefund && <Badge tone="green">Refund</Badge>} {e.status === 'cancelled' && <Badge>Cancelled</Badge>}
                {e.description && <p className="text-xs text-slate-500">{e.description}</p>}
              </div>
            ),
          },
          { key: 'category', label: 'Category', render: (e) => e.category },
          { key: 'type', label: 'Type', render: (e) => <Badge tone={TYPE_TONE[e.expenseType]}>{typeLabel(e.expenseType)}</Badge> },
          { key: 'amount', label: 'Amount', align: 'right', className: 'font-semibold', render: amount },
          { key: 'paid', label: 'Paid by', render: (e) => (e.paidFrom === 'fund' ? 'Mess fund' : memberName(e.paidBy)) },
          { key: 'method', label: 'Method', render: (e) => methodLabel(e.paymentMethod) },
        ]}
        renderCard={(e) => (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-medium text-slate-900">{e.title}</p>
              <p className="num shrink-0 font-semibold">{amount(e)}</p>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {fmtDate(e.date, { day: '2-digit', month: 'short' })} · {e.category} · {typeLabel(e.expenseType)} · {e.paidFrom === 'fund' ? 'Fund' : memberName(e.paidBy)}
            </p>
          </div>
        )}
      />
    </>
  );
}

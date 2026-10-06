import { Plus, ShoppingBasket, Paperclip } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useQuickAction } from '../context/QuickActions';
import { fileUrl } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { fmtDate, memberName, methodLabel, money, num } from '../utils/format';
import { Badge, Button, Card, PageHeader } from '../components/ui';
import { SERIES, SimpleBars } from '../components/charts';
import RecordList from '../components/RecordList';

const who = (b) => (b.paidFrom === 'fund' ? 'Mess fund' : b.purchasers.map((p) => memberName(p.member)).join(' + ') || '—');
const amount = (b) => money(b.isRefund ? -b.totalPrice : b.totalPrice);

export default function Bazar() {
  const { isClosed, monthId, version } = useWorkspace();
  const open = useQuickAction();
  const calc = useAsync(() => api.get(`/months/${monthId}/calculation`), [monthId, version]);
  const cats = (calc.data?.bazarCategoryTotals || []).filter((c) => c.amount > 0).slice(0, 8);
  return (
    <>
      <PageHeader title="Bazar" subtitle="Groceries and household purchases." actions={!isClosed && <Button icon={Plus} onClick={() => open('bazar')}>Add bazar</Button>} />
      {cats.length > 0 && (
        <Card title="Spending by category" className="mb-5">
          <SimpleBars horizontal data={cats.map((c) => ({ name: c.category, Amount: c.amount }))} dataKey="Amount" name="Amount" color={SERIES[0]} height={120} />
        </Card>
      )}
      <RecordList
        path="bazar"
        filters={['member', 'category', 'paymentMethod']}
        emptyIcon={ShoppingBasket}
        emptyTitle="No bazar recorded yet"
        emptyAction={<Button size="sm" onClick={() => open('bazar')}>Add bazar</Button>}
        onEdit={(item) => open('bazar', { item })}
        describe={(b) => `${b.itemName} · ${amount(b)} on ${fmtDate(b.date)}`}
        columns={[
          { key: 'date', label: 'Date', render: (b) => <span className="whitespace-nowrap text-slate-600">{fmtDate(b.date, { day: '2-digit', month: 'short' })}</span> },
          {
            key: 'item',
            label: 'Item',
            render: (b) => (
              <div>
                <span className="font-medium text-slate-900">{b.itemName}</span> {b.isRefund && <Badge tone="green">Refund</Badge>} {b.status === 'cancelled' && <Badge>Cancelled</Badge>}
                {b.receiptUrl && (
                  <a href={fileUrl(b.receiptUrl)} target="_blank" rel="noreferrer" className="ml-1 inline-flex text-slate-400 hover:text-brand-700" aria-label="Receipt">
                    <Paperclip className="size-3.5" />
                  </a>
                )}
                {b.vendor && <p className="text-xs text-slate-500">{b.vendor}</p>}
              </div>
            ),
          },
          { key: 'category', label: 'Category', render: (b) => <Badge>{b.category}</Badge> },
          { key: 'qty', label: 'Qty', align: 'right', render: (b) => `${num(b.quantity)} ${b.unit}` },
          { key: 'unit', label: 'Unit price', align: 'right', render: (b) => (b.unitPrice ? money(b.unitPrice) : '—') },
          { key: 'total', label: 'Total', align: 'right', className: 'font-semibold', render: amount },
          { key: 'by', label: 'Bought by', render: (b) => <span className="whitespace-nowrap">{who(b)}</span> },
          { key: 'method', label: 'Method', render: (b) => methodLabel(b.paymentMethod) },
        ]}
        renderCard={(b) => (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-medium text-slate-900">
                {b.itemName} {b.isRefund && <Badge tone="green">Refund</Badge>}
              </p>
              <p className="num shrink-0 font-semibold">{amount(b)}</p>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {fmtDate(b.date, { day: '2-digit', month: 'short' })} · {num(b.quantity)} {b.unit} · {b.category} · {who(b)}
            </p>
          </div>
        )}
      />
    </>
  );
}

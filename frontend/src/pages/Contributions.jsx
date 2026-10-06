import { useState } from 'react';
import { HandCoins, Plus, Wallet } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useWorkspace } from '../context/WorkspaceContext';
import { useQuickAction } from '../context/QuickActions';
import { fmtDate, memberName, methodLabel, money } from '../utils/format';
import { Avatar, BalanceBadge, Badge, Button, Card, PageHeader, Tabs } from '../components/ui';
import RecordList from '../components/RecordList';
import DepositForm from '../components/forms/DepositForm';
import { MemberBreakdownModal } from '../components/Breakdowns';

export default function Contributions() {
  const { isClosed, isAdmin, monthId, version, selfMember } = useWorkspace();
  const open = useQuickAction();
  const [tab, setTab] = useState('deposits');
  const [settle, setSettle] = useState(null);
  const [detail, setDetail] = useState(null);
  const calc = useAsync(() => api.get(`/months/${monthId}/calculation`), [monthId, version]);
  const members = calc.data?.members || [];
  const visible = isAdmin ? members : members.filter((m) => m.id === selfMember?._id);

  return (
    <>
      <PageHeader
        title="Contributions"
        subtitle="Deposits, balances and settlements."
        actions={
          !isClosed && (
            <>
              {isAdmin && (
                <Button variant="secondary" icon={HandCoins} onClick={() => setSettle({})}>
                  Record settlement
                </Button>
              )}
              <Button icon={Plus} onClick={() => open('deposit')}>
                Add deposit
              </Button>
            </>
          )
        }
      />
      <Card title={isAdmin ? 'Member balances' : 'Your balance'} subtitle="Positive = gets money back, negative = owes" padded={false} className="mb-5">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Member</th>
                <th className="text-right">Payable</th>
                <th className="text-right">Deposited</th>
                <th className="text-right">Purchases</th>
                <th className="text-right">Carried</th>
                <th className="text-right">Balance</th>
                {isAdmin && !isClosed && <th />}
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.id} className="cursor-pointer" onClick={() => setDetail(m)}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={m.fullName} size="sm" />
                      <span className="whitespace-nowrap font-medium">{memberName(m)}</span>
                    </div>
                  </td>
                  <td className="num text-right">{money(m.payable)}</td>
                  <td className="num text-right">{money(m.deposited)}</td>
                  <td className="num text-right">{money(m.personalPurchases)}</td>
                  <td className="num text-right">{money(m.openingBalance)}</td>
                  <td className="text-right">
                    <BalanceBadge balance={m.balance} status={m.status} />
                  </td>
                  {isAdmin && !isClosed && (
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      {m.status !== 'settled' && (
                        <Button size="sm" variant="ghost" onClick={() => setSettle({ member: m.id, amount: Math.abs(m.balance), direction: m.status === 'due' ? 'received' : 'paid' })}>
                          Settle
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'deposits', label: 'Deposits' },
          { value: 'settlements', label: 'Settlements' },
        ]}
      />
      {tab === 'deposits' ? (
        <RecordList
          path="contributions"
          filters={['member', 'paymentMethod']}
          emptyIcon={Wallet}
          emptyTitle="No deposits yet"
          emptyAction={<Button size="sm" onClick={() => open('deposit')}>Add deposit</Button>}
          onEdit={(item) => open('deposit', { item })}
          describe={(c) => `${memberName(c.member)} · ${money(c.amount)} on ${fmtDate(c.date)}`}
          columns={[
            { key: 'date', label: 'Date', render: (c) => fmtDate(c.date, { day: '2-digit', month: 'short' }) },
            { key: 'member', label: 'Member', render: (c) => <span className="font-medium">{memberName(c.member)}</span> },
            { key: 'amount', label: 'Amount', align: 'right', className: 'font-semibold', render: (c) => money(c.amount) },
            { key: 'method', label: 'Method', render: (c) => <Badge>{methodLabel(c.paymentMethod)}</Badge> },
            { key: 'ref', label: 'Reference', render: (c) => <span className="text-slate-500">{c.reference || '—'}</span> },
            { key: 'note', label: 'Note', render: (c) => <span className="text-slate-500">{c.note}</span> },
          ]}
          renderCard={(c) => (
            <div className="flex items-baseline justify-between">
              <div>
                <p className="font-medium">{memberName(c.member)}</p>
                <p className="text-xs text-slate-500">
                  {fmtDate(c.date, { day: '2-digit', month: 'short' })} · {methodLabel(c.paymentMethod)}
                  {c.reference && ` · ${c.reference}`}
                </p>
              </div>
              <p className="num font-semibold">{money(c.amount)}</p>
            </div>
          )}
        />
      ) : (
        <RecordList
          path="settlements"
          filters={['member']}
          emptyIcon={HandCoins}
          emptyTitle="No settlements recorded"
          describe={(s) => `${memberName(s.member)} · ${money(s.amount)}`}
          columns={[
            { key: 'date', label: 'Date', render: (s) => fmtDate(s.date, { day: '2-digit', month: 'short' }) },
            { key: 'member', label: 'Member', render: (s) => <span className="font-medium">{memberName(s.member)}</span> },
            { key: 'dir', label: 'Type', render: (s) => (s.direction === 'received' ? <Badge tone="blue">Due collected</Badge> : <Badge tone="green">Refund paid</Badge>) },
            { key: 'amount', label: 'Amount', align: 'right', className: 'font-semibold', render: (s) => money(s.amount) },
            { key: 'note', label: 'Note', render: (s) => <span className="text-slate-500">{s.note}</span> },
          ]}
          renderCard={(s) => (
            <div className="flex items-baseline justify-between">
              <div>
                <p className="font-medium">{memberName(s.member)}</p>
                <p className="text-xs text-slate-500">
                  {fmtDate(s.date)} · {s.direction === 'received' ? 'Due collected' : 'Refund paid'}
                </p>
              </div>
              <p className="num font-semibold">{money(s.amount)}</p>
            </div>
          )}
        />
      )}
      {settle && <DepositForm open settlement preset={settle} onClose={() => setSettle(null)} />}
      {detail && <MemberBreakdownModal member={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

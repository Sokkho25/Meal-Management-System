import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, Mail, Pencil, Phone, Plus, Trash2, UserCheck, Users } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useWorkspace } from '../context/WorkspaceContext';
import { useQuickAction } from '../context/QuickActions';
import { fmtDate, money, num } from '../utils/format';
import { Avatar, BalanceBadge, Badge, Button, Card, EmptyState, IconButton, PageHeader, useConfirm } from '../components/ui';
import { MemberBreakdownModal } from '../components/Breakdowns';

export default function Members() {
  const ws = useWorkspace();
  const { members, monthId, version, isAdmin, isClosed, selfMember } = ws;
  const open = useQuickAction();
  const confirm = useConfirm();
  const [detail, setDetail] = useState(null);
  const calc = useAsync(() => api.get(`/months/${monthId}/calculation`), [monthId, version]);
  const byId = Object.fromEntries((calc.data?.members || []).map((m) => [m.id, m]));

  const remove = async (m) => {
    if (!(await confirm({ title: `Remove ${m.fullName}?`, message: 'If they left mid-month, set a leaving date instead so their meals and payments stay in the calculation.', danger: true, confirmText: 'Remove' }))) return;
    try {
      await api.del(`/months/${monthId}/members/${m._id}`);
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 409) return toast.error(err.message);
      if (!(await confirm({ title: 'This member has records', message: err.message, danger: true, confirmText: 'Remove anyway' }))) return;
      try {
        await api.del(`/months/${monthId}/members/${m._id}`, { force: 'true' });
      } catch (e2) {
        return toast.error(e2.message);
      }
    }
    toast.success('Member removed');
    ws.reloadMembers();
  };

  return (
    <>
      <PageHeader title="Members" subtitle={`${members.length} member${members.length === 1 ? '' : 's'} this month`} actions={isAdmin && !isClosed && <Button icon={Plus} onClick={() => open('member')}>Add member</Button>} />
      {members.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No members yet" description="Add everyone who shares meals or costs this month." action={isAdmin && <Button onClick={() => open('member')}>Add member</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => {
            const r = byId[m._id];
            const canEdit = !isClosed && (isAdmin || selfMember?._id === m._id);
            return (
              <div key={m._id} className="card flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={m.fullName} src={m.photoUrl} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">
                      {m.fullName} {m.nickname && <span className="font-normal text-slate-500">({m.nickname})</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.role === 'admin' ? <Badge tone="brand">Admin</Badge> : <Badge>Member</Badge>}
                      {m.leaveDate ? <Badge tone="amber">Leaves {fmtDate(m.leaveDate, { day: '2-digit', month: 'short' })}</Badge> : m.active === false ? <Badge tone="red">Inactive</Badge> : <Badge tone="green">Active</Badge>}
                      {m.user && (
                        <Badge tone="blue">
                          <UserCheck className="size-3" /> Has login
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="-mr-2 -mt-1 flex">
                    {canEdit && <IconButton icon={Pencil} label="Edit member" onClick={() => open('member', { item: m })} />}
                    {isAdmin && !isClosed && <IconButton icon={Trash2} label="Remove member" className="hover:text-rose-600" onClick={() => remove(m)} />}
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  {m.mobile && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="size-3.5" /> {m.mobile}
                    </p>
                  )}
                  {m.email && (
                    <p className="flex items-center gap-1.5">
                      <Mail className="size-3.5" /> {m.email}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" /> Joined {fmtDate(m.joinDate)}
                  </p>
                </div>
                {r && (
                  <button type="button" onClick={() => setDetail(r)} className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-left hover:bg-slate-100">
                    <span>
                      <span className="block text-[11px] text-slate-500">Meals</span>
                      <span className="num text-sm font-semibold">{num(r.meals)}</span>
                    </span>
                    <span>
                      <span className="block text-[11px] text-slate-500">Payable</span>
                      <span className="num text-sm font-semibold">{money(r.payable)}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[11px] text-slate-500">Balance</span>
                      <BalanceBadge balance={r.balance} status={r.status} />
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {detail && <MemberBreakdownModal member={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

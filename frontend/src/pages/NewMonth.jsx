import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { MONTHS, monthLabel } from '../utils/format';
import { Button, Card, Input, PageHeader, Select, Toggle } from '../components/ui';

export default function NewMonth() {
  const ws = useWorkspace();
  const { months, householdId, household, isAdmin } = ws;
  const navigate = useNavigate();
  const latest = months[0];
  const next = latest ? (latest.month === 12 ? { year: latest.year + 1, month: 1 } : { year: latest.year, month: latest.month + 1 }) : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const [v, setV] = useState({
    year: next.year,
    month: next.month,
    name: household?.name || '',
    copyFrom: latest?._id || '',
    copyMembers: true,
    copySettings: true,
    carryForward: true,
    startingBalance: '0',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));

  if (!isAdmin) return <p className="text-sm text-slate-500">Only an admin can create a new month.</p>;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { month } = await api.post(`/households/${householdId}/months`, {
        year: Number(v.year),
        month: Number(v.month),
        name: v.name,
        startingBalance: Number(v.startingBalance) || 0,
        ...(v.copyFrom ? { copyFrom: v.copyFrom, copyMembers: v.copyMembers, copySettings: v.copySettings, carryForward: v.carryForward } : { copyMembers: false, copySettings: false, carryForward: false }),
      });
      await ws.refreshMonths();
      await ws.selectMonth(month._id);
      toast.success(`${monthLabel(month.year, month.month)} created`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="New monthly workspace" subtitle="Previous months are not changed when you create a new one." />
      <Card className="max-w-2xl">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Month" value={v.month} onChange={set('month')} options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} />
            <Input label="Year" type="number" min="2000" max="2100" value={v.year} onChange={set('year')} />
            <Input className="col-span-2" label="Household / mess name" value={v.name} onChange={set('name')} />
            <Input label="Extra starting balance" type="number" step="any" prefix="৳" value={v.startingBalance} onChange={set('startingBalance')} hint="Added on top of any carried balance" />
            <Select label="Start from" value={v.copyFrom} onChange={set('copyFrom')} placeholder="Blank month" options={months.map((m) => ({ value: m._id, label: monthLabel(m.year, m.month) }))} />
          </div>
          {v.copyFrom && (
            <div className="space-y-4 rounded-xl bg-slate-50 p-4">
              <Toggle checked={v.copyMembers} onChange={set('copyMembers')} label="Copy members" description="Members who left before this month are skipped." />
              <Toggle checked={v.copySettings} onChange={set('copySettings')} label="Copy meal types, rules and budget" />
              <Toggle checked={v.carryForward} onChange={set('carryForward')} label="Carry forward balances" description="Cash in hand and each member's due/refund, following that month's carry-forward rules." />
            </div>
          )}
          <Button type="submit" loading={busy}>
            Create {monthLabel(Number(v.year), Number(v.month))}
          </Button>
        </form>
      </Card>
    </>
  );
}

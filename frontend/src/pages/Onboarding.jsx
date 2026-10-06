import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, Home, LogOut } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { MONTHS } from '../utils/format';
import { Button, Input, Select, cx } from '../components/ui';

export default function Onboarding() {
  const { user, logout } = useAuth();
  const ws = useWorkspace();
  const navigate = useNavigate();
  const now = new Date();
  const [v, setV] = useState({ name: '', type: 'mess', address: '', year: now.getFullYear(), month: now.getMonth() + 1, startingBalance: '0', budget: '' });
  const [busy, setBusy] = useState(false);
  // Remembered so a retry after a failed month step doesn't create a second household.
  const [createdId, setCreatedId] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e?.target ? e.target.value : e });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      let hid = createdId;
      if (!hid) {
        const { household } = await api.post('/households', { name: v.name, type: v.type, address: v.address });
        hid = household._id;
        setCreatedId(hid);
      }
      await api.post(`/households/${hid}/months`, {
        year: Number(v.year),
        month: Number(v.month),
        startingBalance: Number(v.startingBalance) || 0,
        ...(v.budget ? { budget: { total: Number(v.budget) } } : {}),
      });
      await ws.loadHouseholds();
      await ws.selectHousehold(hid);
      toast.success('Your household is ready');
      navigate('/members');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-9" />
          <span className="text-lg font-semibold">MessMate</span>
        </div>
        <Button variant="ghost" size="sm" icon={LogOut} onClick={logout}>
          Log out
        </Button>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Hi {user?.name?.split(' ')[0]}, let's set up your household</h1>
      <p className="mt-1 text-sm text-slate-500">If someone already manages your mess, ask them to add your email ({user?.email}) as a member, then log in again.</p>
      <form onSubmit={submit} className="card mt-8 space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'mess', label: 'Bachelor mess', hint: 'Shared flat, per-meal costs', icon: Building2 },
            { value: 'family', label: 'Family household', hint: 'Track family spending', icon: Home },
          ].map((t) => (
            <button key={t.value} type="button" onClick={() => set('type')(t.value)} className={cx('rounded-2xl border p-4 text-left transition', v.type === t.value ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300')}>
              <t.icon className="size-5 text-brand-700" />
              <p className="mt-2 text-sm font-semibold">{t.label}</p>
              <p className="text-xs text-slate-500">{t.hint}</p>
            </button>
          ))}
        </div>
        <Input label="Household / mess name" required placeholder="e.g. Green Villa Mess" value={v.name} onChange={set('name')} />
        <Input label="Address (optional)" value={v.address} onChange={set('address')} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="First month" value={v.month} onChange={set('month')} options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} />
          <Input label="Year" type="number" min="2000" max="2100" value={v.year} onChange={set('year')} />
          <Input label="Starting balance" type="number" step="any" prefix="৳" value={v.startingBalance} onChange={set('startingBalance')} hint="Cash already in the mess fund" />
          <Input label="Monthly budget (optional)" type="number" min="0" prefix="৳" value={v.budget} onChange={set('budget')} />
        </div>
        <p className="text-xs text-slate-500">Currency is BDT (৳). Breakfast, lunch and dinner are set up by default; you can change meal types and weights later.</p>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create household
        </Button>
      </form>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArchiveRestore, Lock, Plus, RotateCcw, Trash2, UserPlus, X } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { DISTRIBUTION_METHODS, EXPENSE_TYPES, timeAgo, typeLabel } from '../utils/format';
import { Avatar, Badge, Button, Card, EmptyState, IconButton, Input, PageHeader, PageLoader, Pagination, Select, Tabs, Toggle, useConfirm } from '../components/ui';
import { FileUpload } from '../components/forms/common';

export default function Settings() {
  const { isAdmin } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const tabs = [
    ...(isAdmin
      ? [
          { value: 'workspace', label: 'Month' },
          { value: 'meals', label: 'Meal rules' },
          { value: 'rules', label: 'Calculation rules' },
          { value: 'budget', label: 'Budget' },
          { value: 'categories', label: 'Categories' },
          { value: 'access', label: 'Access & permissions' },
        ]
      : []),
    { value: 'profile', label: 'Profile' },
    { value: 'notifications', label: 'Notifications' },
    ...(isAdmin
      ? [
          { value: 'audit', label: 'Activity log' },
          { value: 'trash', label: 'Trash' },
          { value: 'household', label: 'Household' },
        ]
      : []),
  ];
  const tab = tabs.some((t) => t.value === params.get('tab')) ? params.get('tab') : tabs[0].value;
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs tabs={tabs} value={tab} onChange={(v) => setParams({ tab: v })} />
      {tab === 'workspace' && <WorkspaceTab />}
      {tab === 'meals' && <MealRulesTab />}
      {tab === 'rules' && <CalcRulesTab />}
      {tab === 'budget' && <BudgetTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'access' && <AccessTab />}
      {tab === 'profile' && <ProfileTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'trash' && <TrashTab />}
      {tab === 'household' && <HouseholdTab />}
    </>
  );
}

function useSaveMonth() {
  const ws = useWorkspace();
  const [busy, setBusy] = useState(false);
  const save = async (body, msg = 'Settings saved') => {
    setBusy(true);
    try {
      await api.patch(`/months/${ws.monthId}`, body);
      await ws.refreshMonth();
      toast.success(msg);
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return [save, busy];
}

function ClosedNote() {
  const { isClosed } = useWorkspace();
  if (!isClosed) return null;
  return (
    <p className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <Lock className="size-4" /> This month is closed. Reopen it to change its settings.
    </p>
  );
}

function SaveBar({ onSave, busy }) {
  const { isClosed } = useWorkspace();
  return (
    <div className="mt-5 flex justify-end">
      <Button onClick={onSave} loading={busy} disabled={isClosed}>
        Save changes
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- Month details
function WorkspaceTab() {
  const { month } = useWorkspace();
  const navigate = useNavigate();
  const [save, busy] = useSaveMonth();
  const [v, setV] = useState({ name: month.name, address: month.address || '', startingBalance: String(month.startingBalance), carryBalance: String(month.carryBalance) });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (
    <div className="grid max-w-3xl gap-5">
      <ClosedNote />
      <Card title="Monthly workspace" subtitle="Currency: BDT (৳)">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Household / mess name" value={v.name} onChange={set('name')} />
          <Input label="Address" value={v.address} onChange={set('address')} />
          <Input label="Starting balance" type="number" step="any" prefix="৳" value={v.startingBalance} onChange={set('startingBalance')} />
          <Input label="Carried from previous month" type="number" step="any" prefix="৳" value={v.carryBalance} onChange={set('carryBalance')} />
        </div>
        <SaveBar busy={busy} onSave={() => save({ ...v, startingBalance: Number(v.startingBalance) || 0, carryBalance: Number(v.carryBalance) || 0 })} />
      </Card>
      <Card title="Month status">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{month.status === 'closed' ? 'Closed and locked.' : 'Open. Close it at the end of the month to lock records.'}</p>
          <Button variant="secondary" icon={Lock} onClick={() => navigate('/close')}>
            {month.status === 'closed' ? 'Reopen…' : 'Close month…'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Meal types & weights
function MealRulesTab() {
  const { month } = useWorkspace();
  const [save, busy] = useSaveMonth();
  const [types, setTypes] = useState(month.mealTypes.map((t) => ({ ...t, weight: String(t.weight) })));
  const [mode, setMode] = useState(month.settings.mealMode);
  const [guests, setGuests] = useState(month.settings.guestMeals);
  const update = (i, k, val) => setTypes(types.map((t, idx) => (idx === i ? { ...t, [k]: val } : t)));
  const add = () => setTypes([...types, { key: '', label: '', weight: '1', order: types.length, isNew: true }]);
  const submit = () => {
    const out = types
      .filter((t) => t.label.trim())
      .map((t, i) => ({ key: t.key || t.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), label: t.label.trim(), weight: Number(t.weight) || 0, order: i }));
    if (!out.length) return toast.error('Keep at least one meal type');
    save({ mealTypes: out, settings: { mealMode: mode, guestMeals: guests } });
  };
  return (
    <div className="grid max-w-3xl gap-5">
      <ClosedNote />
      <Card title="Meal counting">
        <div className="space-y-4">
          <Select
            label="Calculation mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            options={[
              { value: 'standard', label: 'Standard: every meal counts as 1' },
              { value: 'weighted', label: 'Custom weights: e.g. breakfast = 0.5' },
            ]}
          />
          <Select
            label="Guest meals"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            options={[
              { value: 'charge_host', label: 'Count in total meals and charge the host' },
              { value: 'exclude', label: 'Record only; do not count or charge' },
            ]}
          />
        </div>
      </Card>
      <Card title="Meal types" subtitle="Add custom meals like Snacks or Iftar. Weights apply in custom weight mode.">
        <div className="space-y-2">
          {types.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input className="flex-1" placeholder="Name" value={t.label} onChange={(e) => update(i, 'label', e.target.value)} aria-label="Meal name" />
              <Input className="w-28" type="number" min="0" max="10" step="0.25" value={t.weight} disabled={mode !== 'weighted'} onChange={(e) => update(i, 'weight', e.target.value)} aria-label="Weight" />
              <IconButton icon={Trash2} label="Remove meal type" disabled={types.length <= 1} onClick={() => setTypes(types.filter((_, idx) => idx !== i))} />
            </div>
          ))}
        </div>
        <Button variant="soft" size="sm" icon={Plus} className="mt-3" onClick={add}>
          Add meal type
        </Button>
        <p className="mt-3 text-xs text-slate-500">Removing a meal type hides it from entry; meals already recorded under it still count.</p>
        <SaveBar busy={busy} onSave={submit} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Distribution, rounding, carry forward
function SharesEditor({ method, shares, onChange }) {
  const { members } = useWorkspace();
  if (method !== 'percentage' && method !== 'custom') return null;
  const total = members.reduce((s, m) => s + (Number(shares[m._id]) || 0), 0);
  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {members.map((m) => (
          <Input
            key={m._id}
            label={m.fullName}
            type="number"
            min="0"
            step="any"
            prefix={method === 'custom' ? '৳' : undefined}
            placeholder={method === 'percentage' ? '%' : 'Amount'}
            value={shares[m._id] ?? ''}
            onChange={(e) => onChange({ ...shares, [m._id]: e.target.value })}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {method === 'percentage' ? `Total ${total}% ${Math.abs(total - 100) > 0.01 ? '(will be scaled to 100%)' : ''}` : `Total ৳${total}. Any difference from the actual cost is split equally.`}
      </p>
    </div>
  );
}

const cleanShares = (s) => Object.fromEntries(Object.entries(s || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, Number(v)]));

function CalcRulesTab() {
  const { month, categories } = useWorkspace();
  const [save, busy] = useSaveMonth();
  const s = month.settings;
  const [dist, setDist] = useState(() => Object.fromEntries(EXPENSE_TYPES.map((t) => [t.value, { method: s.distribution[t.value]?.method || 'equal', shares: { ...(s.distribution[t.value]?.shares || {}) } }])));
  const [catRules, setCatRules] = useState(() => (s.categoryRules || []).map((r) => ({ ...r, shares: { ...(r.shares || {}) } })));
  const [equalMode, setEqualMode] = useState(s.equalSplitMode);
  const [rounding, setRounding] = useState({ ...s.rounding });
  const [carry, setCarry] = useState({ ...s.carryForward });

  const submit = () =>
    save({
      settings: {
        distribution: Object.fromEntries(Object.entries(dist).map(([k, r]) => [k, { method: r.method, shares: cleanShares(r.shares) }])),
        categoryRules: catRules.filter((r) => r.category).map((r) => ({ category: r.category, method: r.method, shares: cleanShares(r.shares) })),
        equalSplitMode: equalMode,
        rounding: { rateDecimals: Number(rounding.rateDecimals), amountDecimals: Number(rounding.amountDecimals), mode: rounding.mode },
        carryForward: carry,
      },
    });

  return (
    <div className="grid max-w-3xl gap-5">
      <ClosedNote />
      <Card title="How each expense type is shared" subtitle="Per meal costs make up the meal rate. Other methods are added to each member's share separately.">
        <div className="space-y-5">
          {EXPENSE_TYPES.map((t) => (
            <div key={t.value}>
              <Select
                label={`${t.label} expenses`}
                value={dist[t.value].method}
                onChange={(e) => setDist({ ...dist, [t.value]: { ...dist[t.value], method: e.target.value } })}
                options={DISTRIBUTION_METHODS.map((m) => ({ value: m.value, label: `${m.label} — ${m.hint}` }))}
              />
              <SharesEditor method={dist[t.value].method} shares={dist[t.value].shares} onChange={(sh) => setDist({ ...dist, [t.value]: { ...dist[t.value], shares: sh } })} />
            </div>
          ))}
        </div>
      </Card>
      <Card title="Category overrides" subtitle="Share one category differently from its type, e.g. Rent by percentage.">
        <div className="space-y-4">
          {catRules.map((r, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="flex gap-2">
                <Select className="flex-1" value={r.category} onChange={(e) => setCatRules(catRules.map((x, idx) => (idx === i ? { ...x, category: e.target.value } : x)))} placeholder="Category" options={categories.map((c) => ({ value: c.name, label: `${c.name} (${typeLabel(c.expenseType)})` }))} />
                <Select className="flex-1" value={r.method} onChange={(e) => setCatRules(catRules.map((x, idx) => (idx === i ? { ...x, method: e.target.value } : x)))} options={DISTRIBUTION_METHODS} />
                <IconButton icon={X} label="Remove override" onClick={() => setCatRules(catRules.filter((_, idx) => idx !== i))} />
              </div>
              <SharesEditor method={r.method} shares={r.shares} onChange={(sh) => setCatRules(catRules.map((x, idx) => (idx === i ? { ...x, shares: sh } : x)))} />
            </div>
          ))}
          <Button variant="soft" size="sm" icon={Plus} onClick={() => setCatRules([...catRules, { category: '', method: 'percentage', shares: {} }])}>
            Add override
          </Button>
        </div>
      </Card>
      <Card title="Members who join or leave mid-month">
        <Select
          label="Equal split"
          value={equalMode}
          onChange={(e) => setEqualMode(e.target.value)}
          options={[
            { value: 'full', label: 'Full share for anyone who was a member at any point' },
            { value: 'prorated', label: 'Prorated by days they were a member' },
          ]}
        />
      </Card>
      <Card title="Rounding">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Meal rate decimals" value={rounding.rateDecimals} onChange={(e) => setRounding({ ...rounding, rateDecimals: e.target.value })} options={[0, 1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))} />
          <Select label="Amount decimals" value={rounding.amountDecimals} onChange={(e) => setRounding({ ...rounding, amountDecimals: e.target.value })} options={[0, 1, 2].map((n) => ({ value: n, label: String(n) }))} />
          <Select
            label="Rounding"
            value={rounding.mode}
            onChange={(e) => setRounding({ ...rounding, mode: e.target.value })}
            options={[
              { value: 'round', label: 'Nearest' },
              { value: 'ceil', label: 'Always up' },
              { value: 'floor', label: 'Always down' },
            ]}
          />
        </div>
      </Card>
      <Card title="Carry forward to next month">
        <div className="space-y-4">
          <Toggle checked={carry.fund} onChange={(c) => setCarry({ ...carry, fund: c })} label="Carry cash in hand" description="Next month starts with this month's remaining cash." />
          <Toggle checked={carry.memberBalances} onChange={(c) => setCarry({ ...carry, memberBalances: c })} label="Carry member balances" description="Dues and refunds move to next month instead of being settled in cash." />
        </div>
      </Card>
      <SaveBar busy={busy} onSave={submit} />
    </div>
  );
}

// ---------------------------------------------------------------- Budget
function BudgetTab() {
  const { month } = useWorkspace();
  const [save, busy] = useSaveMonth();
  const b = month.budget || {};
  const [v, setV] = useState({ total: b.total || '', food: b.food || '', grocery: b.grocery || '', household: b.household || '', utility: b.utility || '', other: b.other || '', thresholds: (b.thresholds || [75, 90, 100]).join(', ') });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = () => {
    const thresholds = v.thresholds
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((x) => x > 0);
    save({ budget: { total: Number(v.total) || 0, food: Number(v.food) || 0, grocery: Number(v.grocery) || 0, household: Number(v.household) || 0, utility: Number(v.utility) || 0, other: Number(v.other) || 0, thresholds } }, 'Budget saved');
  };
  return (
    <div className="max-w-3xl">
      <ClosedNote />
      <Card title="Monthly budget" subtitle="Leave a field empty to not track it.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Total budget" type="number" min="0" prefix="৳" value={v.total} onChange={set('total')} />
          <Input label="Food budget" type="number" min="0" prefix="৳" value={v.food} onChange={set('food')} hint="All food expenses" />
          <Input label="Grocery (bazar) budget" type="number" min="0" prefix="৳" value={v.grocery} onChange={set('grocery')} hint="Everything in the bazar list" />
          <Input label="Household budget" type="number" min="0" prefix="৳" value={v.household} onChange={set('household')} />
          <Input label="Utility budget" type="number" min="0" prefix="৳" value={v.utility} onChange={set('utility')} />
          <Input label="Other budget" type="number" min="0" prefix="৳" value={v.other} onChange={set('other')} />
          <Input className="sm:col-span-2" label="Warning thresholds (%)" value={v.thresholds} onChange={set('thresholds')} hint="Comma separated, e.g. 75, 90, 100" />
        </div>
        <SaveBar busy={busy} onSave={submit} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Categories
function CategoriesTab() {
  const { householdId, allCategories, refreshCategories } = useWorkspace();
  const [v, setV] = useState({ name: '', expenseType: 'food', scope: 'both' });
  const [busy, setBusy] = useState(false);
  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/households/${householdId}/categories`, v);
      setV({ ...v, name: '' });
      await refreshCategories();
      toast.success('Category added');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const patch = async (c, body) => {
    try {
      await api.patch(`/households/${householdId}/categories/${c._id}`, body);
      await refreshCategories();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <div className="grid max-w-3xl gap-5">
      <Card title="Add category">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-4">
          <Input className="sm:col-span-2" placeholder="Name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label="Category name" />
          <Select value={v.expenseType} onChange={(e) => setV({ ...v, expenseType: e.target.value })} options={EXPENSE_TYPES} aria-label="Expense type" />
          <Select
            value={v.scope}
            onChange={(e) => setV({ ...v, scope: e.target.value })}
            aria-label="Used for"
            options={[
              { value: 'both', label: 'Bazar & expenses' },
              { value: 'bazar', label: 'Bazar only' },
              { value: 'expense', label: 'Expenses only' },
            ]}
          />
          <div className="sm:col-span-4">
            <Button type="submit" icon={Plus} loading={busy}>
              Add category
            </Button>
          </div>
        </form>
      </Card>
      <Card title="Categories" subtitle="Changing a type affects new records only; existing records keep the type they were saved with." padded={false}>
        <ul className="divide-y divide-slate-100">
          {allCategories.map((c) => (
            <li key={c._id} className="flex items-center gap-3 px-4 py-2.5">
              <span className={c.archived ? 'flex-1 text-slate-400 line-through' : 'flex-1 font-medium text-slate-800'}>{c.name}</span>
              <Select className="w-36" value={c.expenseType} onChange={(e) => patch(c, { expenseType: e.target.value })} options={EXPENSE_TYPES} aria-label="Expense type" />
              <Button size="sm" variant="ghost" onClick={() => patch(c, { archived: !c.archived })}>
                {c.archived ? 'Restore' : 'Hide'}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Access & permissions
function AccessTab() {
  const { householdId, month } = useWorkspace();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [save, busy] = useSaveMonth();
  const { data, reload } = useAsync(() => api.get(`/households/${householdId}/users`), [householdId]);
  const [invite, setInvite] = useState({ email: '', role: 'member' });
  const [perm, setPerm] = useState({ ...month.settings.permissions });
  const sendInvite = async (e) => {
    e.preventDefault();
    try {
      const d = await api.post(`/households/${householdId}/users`, invite);
      toast.success(d.added ? 'Access granted' : 'Invite saved. They get access when they sign up with this email.');
      setInvite({ email: '', role: 'member' });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };
  const setRole = async (u, role) => {
    try {
      await api.patch(`/households/${householdId}/users/${u._id}`, { role });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };
  const removeUser = async (u) => {
    if (!(await confirm({ title: `Remove ${u.name}'s access?`, message: 'Their member records stay; they just can no longer log in to this household.', danger: true, confirmText: 'Remove' }))) return;
    try {
      await api.del(`/households/${householdId}/users/${u._id}`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };
  const cancelInvite = async (email) => {
    await api.del(`/households/${householdId}/invites`, { email });
    reload();
  };
  return (
    <div className="grid max-w-3xl gap-5">
      <Card title="Member permissions" subtitle="What members (non-admins) may do this month.">
        <div className="space-y-4">
          <Toggle checked={!!perm.memberCanEdit} onChange={(c) => setPerm({ ...perm, memberCanEdit: c })} label="Members can edit their own records" description="Bazar, deposits and guest meals they added." />
          <Toggle checked={!!perm.memberCanDelete} onChange={(c) => setPerm({ ...perm, memberCanDelete: c })} label="Members can delete their own records" />
          <Toggle checked={!!perm.memberCanEditOthersMeals} onChange={(c) => setPerm({ ...perm, memberCanEditOthersMeals: c })} label="Members can record meals for everyone" description="Useful when one person keeps the meal sheet." />
        </div>
        <SaveBar busy={busy} onSave={() => save({ settings: { permissions: perm } })} />
      </Card>
      <Card title="People with access">
        <form onSubmit={sendInvite} className="mb-4 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
          <Input type="email" placeholder="Email address" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} aria-label="Email" />
          <Select
            value={invite.role}
            onChange={(e) => setInvite({ ...invite, role: e.target.value })}
            aria-label="Role"
            options={[
              { value: 'member', label: 'Member' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <Button type="submit" icon={UserPlus}>
            Give access
          </Button>
        </form>
        {!data ? (
          <PageLoader />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.users.map((u) => (
              <li key={u._id} className="flex items-center gap-3 py-2.5">
                <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {u.name} {u.isOwner && <Badge tone="brand">Owner</Badge>}
                  </p>
                  <p className="truncate text-xs text-slate-500">{u.email}</p>
                </div>
                <Select
                  className="w-28"
                  value={u.role}
                  disabled={u.isOwner || u._id === user._id}
                  onChange={(e) => setRole(u, e.target.value)}
                  aria-label="Role"
                  options={[
                    { value: 'member', label: 'Member' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                />
                {!u.isOwner && u._id !== user._id && <IconButton icon={Trash2} label="Remove access" onClick={() => removeUser(u)} />}
              </li>
            ))}
            {data.invites.map((i) => (
              <li key={i.email} className="flex items-center gap-3 py-2.5">
                <Avatar name={i.email} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{i.email}</p>
                  <p className="text-xs text-slate-500">Invited as {i.role}, waiting for sign up</p>
                </div>
                <IconButton icon={X} label="Cancel invite" onClick={() => cancelInvite(i.email)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Profile
function ProfileTab() {
  const { user, setUser, acceptToken } = useAuth();
  const [v, setV] = useState({ name: user.name, phone: user.phone || '', avatarUrl: user.avatarUrl || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(null);
  const saveProfile = async () => {
    setBusy('profile');
    try {
      const d = await api.patch('/auth/me', v);
      setUser(d.user);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };
  const changePw = async (e) => {
    e.preventDefault();
    setBusy('pw');
    try {
      const d = await api.post('/auth/change-password', pw);
      acceptToken(d.token);
      setPw({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="grid max-w-3xl gap-5">
      <Card title="Profile">
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={v.name} src={v.avatarUrl} size="lg" />
          <FileUpload value={v.avatarUrl} onChange={(url) => setV({ ...v, avatarUrl: url })} label="Upload photo" accept="image/*" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <Input label="Mobile" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          <Input label="Email" value={user.email} disabled />
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={saveProfile} loading={busy === 'profile'}>
            Save profile
          </Button>
        </div>
      </Card>
      <Card title="Change password">
        <form onSubmit={changePw} className="grid gap-3 sm:grid-cols-2">
          <Input label="Current password" type="password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          <Input label="New password" type="password" autoComplete="new-password" minLength={8} required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" loading={busy === 'pw'}>
              Change password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Notifications
function NotificationsTab() {
  const { user, setUser } = useAuth();
  const { bump } = useWorkspace();
  const p = user.notificationPrefs || {};
  const toggle = async (k, val) => {
    try {
      const d = await api.patch('/auth/me', { notificationPrefs: { [k]: val } });
      setUser(d.user);
      bump();
    } catch (err) {
      toast.error(err.message);
    }
  };
  const rows = [
    ['missingMeals', "Missing meals", "Remind when today's meals are not recorded."],
    ['budget', 'Budget warnings', 'When a budget passes its warning thresholds.'],
    ['recurring', 'Recurring bills', 'When last month’s recurring bills are not yet added.'],
    ['dues', 'Outstanding balances', 'Near month end, for members who owe money.'],
    ['closing', 'Month ready to close', 'After the month has ended.'],
  ];
  return (
    <Card title="Notifications" subtitle="Alerts appear under the bell. Dismissed alerts stay hidden until something changes." className="max-w-3xl">
      <div className="space-y-4">
        {rows.map(([k, label, desc]) => (
          <Toggle key={k} checked={p[k] !== false} onChange={(v) => toggle(k, v)} label={label} description={desc} />
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Audit log
function AuditTab() {
  const { householdId, monthId } = useWorkspace();
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState('month');
  const { data, loading } = useAsync(() => api.get(`/households/${householdId}/audit`, { page, month: scope === 'month' ? monthId : undefined }), [householdId, monthId, page, scope]);
  return (
    <Card
      title="Activity log"
      subtitle="Who added, edited, deleted or closed what."
      padded={false}
      className="max-w-3xl"
      action={
        <Select
          value={scope}
          onChange={(e) => (setScope(e.target.value), setPage(1))}
          aria-label="Scope"
          options={[
            { value: 'month', label: 'This month' },
            { value: 'all', label: 'All months' },
          ]}
        />
      }
    >
      {loading && !data ? (
        <PageLoader />
      ) : data.items.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {data.items.map((a) => (
              <li key={a._id} className="flex items-start gap-3 px-4 py-3">
                <Badge tone={{ create: 'green', update: 'blue', delete: 'red', restore: 'violet', close: 'amber', reopen: 'amber', bulk: 'green' }[a.action]}>{a.action}</Badge>
                <p className="flex-1 text-sm text-slate-700">{a.summary}</p>
                <span className="shrink-0 text-xs text-slate-400" title={new Date(a.createdAt).toLocaleString()}>
                  {timeAgo(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Trash
function TrashTab() {
  const ws = useWorkspace();
  const { data, loading, reload } = useAsync(() => api.get(`/months/${ws.monthId}/trash`), [ws.monthId, ws.version]);
  const restore = async (row) => {
    try {
      await api.post(`/months/${ws.monthId}/${row.kind}/${row.id}/restore`);
      toast.success('Restored');
      if (row.kind === 'members') await ws.reloadMembers();
      else ws.bump();
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <Card title="Trash" subtitle="Deleted records are kept and can be restored." padded={false} className="max-w-3xl">
      {loading && !data ? (
        <PageLoader />
      ) : data.items.length === 0 ? (
        <EmptyState icon={ArchiveRestore} title="Trash is empty" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.items.map((row) => (
            <li key={row.id} className="flex items-center gap-3 px-4 py-3">
              <p className="flex-1 text-sm text-slate-700">{row.label}</p>
              <span className="text-xs text-slate-400">{timeAgo(row.deletedAt)}</span>
              <Button size="sm" variant="soft" icon={RotateCcw} disabled={ws.isClosed} onClick={() => restore(row)}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Household
function HouseholdTab() {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const h = ws.households?.find((x) => x._id === ws.householdId) || {};
  const [v, setV] = useState({ name: h.name || '', type: h.type || 'mess', address: h.address || '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/households/${ws.householdId}`, v);
      await ws.loadHouseholds();
      toast.success('Household saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid max-w-3xl gap-5">
      <Card title="Household">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <Select
            label="Type"
            value={v.type}
            onChange={(e) => setV({ ...v, type: e.target.value })}
            options={[
              { value: 'mess', label: 'Bachelor mess / shared flat' },
              { value: 'family', label: 'Family household' },
            ]}
          />
          <Input className="sm:col-span-2" label="Address" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </div>
      </Card>
      {ws.households?.length > 0 && (
        <Card title="Your households">
          <ul className="divide-y divide-slate-100">
            {ws.households.map((x) => (
              <li key={x._id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="font-medium">{x.name}</span> <span className="text-slate-500">· {x.role}</span>
                </span>
                {x._id === ws.householdId ? (
                  <Badge tone="brand">Current</Badge>
                ) : (
                  <Button size="sm" variant="ghost" onClick={async () => (await ws.selectHousehold(x._id), navigate('/dashboard'))}>
                    Switch
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Button variant="soft" size="sm" icon={Plus} className="mt-3" onClick={() => navigate('/welcome?new=1')}>
            Create another household
          </Button>
        </Card>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  History,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
  Check,
  NotebookPen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useQuickAction } from '../context/QuickActions';
import { api } from '../services/api';
import { monthLabel, monthShort } from '../utils/format';
import { Avatar, Badge, cx, IconButton } from '../components/ui';

export const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/meals', label: 'Meals', icon: UtensilsCrossed },
  { to: '/bazar', label: 'Bazar', icon: ShoppingBasket },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/contributions', label: 'Contributions', icon: Wallet },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/shopping', label: 'Shopping List', icon: ListChecks },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/meal-plan', label: 'Meal Plan', icon: NotebookPen },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/history', label: 'Monthly History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const BOTTOM = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/meals', label: 'Meals', icon: UtensilsCrossed },
  null, // quick action button
  { to: '/bazar', label: 'Bazar', icon: ShoppingBasket },
];

function MonthSwitcher() {
  const { months, month, selectMonth, isAdmin } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const fn = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  if (!month) return null;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50">
        {month.status === 'closed' && <Lock className="size-3.5 text-slate-400" />}
        <span className="hidden sm:inline">{monthLabel(month.year, month.month)}</span>
        <span className="sm:hidden">{monthShort(month.year, month.month)}</span>
        <ChevronDown className="size-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:left-0 sm:right-auto">
          <div className="max-h-72 overflow-y-auto py-1">
            {months.map((m) => (
              <button
                key={m._id}
                type="button"
                onClick={async () => {
                  setOpen(false);
                  await selectMonth(m._id);
                }}
                className={cx('flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50', m._id === month._id && 'bg-brand-50/60 font-medium text-brand-900')}
              >
                {monthLabel(m.year, m.month)}
                {m.status === 'closed' ? <Badge>Closed</Badge> : m._id === month._id ? <Check className="size-4 text-brand-600" /> : null}
              </button>
            ))}
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/months/new');
              }}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              <Plus className="size-4" /> New month
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const { monthId, version } = useWorkspace();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!monthId) return;
    api
      .get(`/months/${monthId}/notifications`)
      .then((d) => setItems(d.items))
      .catch(() => {});
  }, [monthId, version]);
  useEffect(() => {
    const fn = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const dismiss = async (keys) => {
    setItems((xs) => xs.filter((x) => !keys.includes(x.key)));
    await api.post(`/months/${monthId}/notifications/dismiss`, { keys }).catch(() => {});
  };
  const dot = { danger: 'bg-rose-500', warning: 'bg-amber-500', info: 'bg-sky-500' };
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label="Notifications" onClick={() => setOpen(!open)} className="relative grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800">
        <Bell className="size-[18px]" />
        {items.length > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{items.length}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-40 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {items.length > 0 && (
              <button type="button" className="text-xs font-medium text-brand-700" onClick={() => dismiss(items.map((i) => i.key))}>
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up.</p>
            ) : (
              items.map((n) => (
                <div key={n.key} className="group flex gap-3 border-b border-slate-50 px-4 py-3 hover:bg-slate-50">
                  <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', dot[n.level] || dot.info)} />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                  >
                    <p className="text-sm font-medium text-slate-800">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>}
                  </button>
                  <button type="button" aria-label="Dismiss" className="text-slate-300 hover:text-slate-600" onClick={() => dismiss([n.key])}>
                    <X className="size-4" />
                  </button>
                </div>
              ))
            )}
          </div>
          <Link to="/settings?tab=notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-medium text-slate-500 hover:text-slate-800">
            Notification settings
          </Link>
        </div>
      )}
    </div>
  );
}

function QuickAddMenu({ open, onClose }) {
  const openForm = useQuickAction();
  const { isAdmin, isClosed } = useWorkspace();
  if (!open) return null;
  const actions = [
    { kind: 'meal', label: 'Add Meal', icon: UtensilsCrossed, tone: 'bg-teal-50 text-teal-700' },
    { kind: 'bazar', label: 'Add Bazar', icon: ShoppingBasket, tone: 'bg-amber-50 text-amber-700' },
    ...(isAdmin ? [{ kind: 'expense', label: 'Add Expense', icon: Receipt, tone: 'bg-violet-50 text-violet-700' }] : []),
    { kind: 'deposit', label: 'Add Deposit', icon: CircleDollarSign, tone: 'bg-sky-50 text-sky-700' },
  ];
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/30" />
      <div className="safe-bottom absolute inset-x-3 bottom-24 rounded-3xl bg-white p-3 shadow-2xl lg:bottom-auto lg:left-auto lg:right-8 lg:top-16 lg:w-72" onClick={(e) => e.stopPropagation()}>
        {isClosed ? (
          <p className="p-4 text-center text-sm text-slate-500">This month is closed. Reopen it to add records.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {actions.map((a) => (
              <button
                key={a.kind}
                type="button"
                onClick={() => {
                  onClose();
                  openForm(a.kind);
                }}
                className="flex flex-col items-center gap-2 rounded-2xl p-4 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100"
              >
                <span className={cx('grid size-12 place-items-center rounded-2xl', a.tone)}>
                  <a.icon className="size-6" />
                </span>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { household, month, isClosed, isAdmin } = useWorkspace();
  const [drawer, setDrawer] = useState(false);
  const [quick, setQuick] = useState(false);
  const location = useLocation();
  useEffect(() => setDrawer(false), [location.pathname]);

  const sidebar = (
    <nav className="flex h-full flex-col">
      <Link to="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
        <img src="/favicon.svg" alt="" className="size-8" />
        <span className="text-base font-semibold tracking-tight text-slate-900">MessMate</span>
      </Link>
      <div className="px-3 pb-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-slate-800">{household?.name}</p>
          <p className="text-xs capitalize text-slate-500">{household?.type === 'family' ? 'Family household' : 'Bachelor mess'} · {isAdmin ? 'Admin' : 'Member'}</p>
        </div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}
          >
            <n.icon className="size-[18px]" />
            {n.label}
          </NavLink>
        ))}
        {user?.isOwner && (
          <NavLink
            to="/owner"
            className={({ isActive }) => cx('mt-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}
          >
            <ShieldCheck className="size-[18px]" />
            Site owner
          </NavLink>
        )}
      </div>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
          <IconButton icon={LogOut} label="Log out" onClick={logout} />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawer(false)} />
          <aside className="safe-top absolute inset-y-0 left-0 w-72 bg-white shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <header className="safe-top sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <IconButton icon={Menu} label="Open menu" className="-ml-2 lg:hidden" onClick={() => setDrawer(true)} />
          <MonthSwitcher />
          {isClosed && (
            <Badge tone="amber">
              <Lock className="size-3" /> Closed<span className="hidden sm:inline"> · read only</span>
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setQuick(true)} className="hidden h-9 items-center gap-1.5 rounded-xl bg-brand-700 px-3 text-sm font-medium text-white shadow-sm hover:bg-brand-800 lg:inline-flex">
              <Plus className="size-4" /> Quick add
            </button>
            <NotificationBell />
            <Link to="/settings?tab=profile" className="ml-1 lg:hidden" aria-label="Profile">
              <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12">{month ? <Outlet /> : null}</main>

      {/* Mobile bottom navigation */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5">
          {BOTTOM.map((n, i) =>
            n ? (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-slate-500')}>
                <n.icon className="size-5" />
                {n.label}
              </NavLink>
            ) : (
              <div key={i} className="grid place-items-center">
                <button type="button" aria-label="Quick add" onClick={() => setQuick(true)} className="-mt-6 grid size-14 place-items-center rounded-2xl bg-brand-700 text-white shadow-lg shadow-brand-900/30 active:scale-95">
                  <Plus className="size-7" />
                </button>
              </div>
            )
          )}
          <button type="button" onClick={() => setDrawer(true)} className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-500">
            <UserRound className="size-5" />
            More
          </button>
        </div>
      </nav>
      <QuickAddMenu open={quick} onClose={() => setQuick(false)} />
    </div>
  );
}

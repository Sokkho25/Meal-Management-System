import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import { initials, money } from '../../utils/format';
import { fileUrl } from '../../services/api';

export const cx = (...c) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------- Buttons
const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm shadow-brand-900/10',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  soft: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
};
const SIZES = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-5 text-base gap-2' };

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-xl font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50', VARIANTS[variant], SIZES[size], className)}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, ...props }) {
  return (
    <button type="button" aria-label={label} title={label} {...props} className={cx('inline-flex size-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40', className)}>
      <Icon className="size-[18px]" />
    </button>
  );
}

// ---------------------------------------------------------------- Form fields
export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Input({ label, hint, error, className, prefix, ...props }) {
  const input = prefix ? (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">{prefix}</span>
      <input {...props} className={cx('input pl-7', error && 'border-rose-400')} />
    </div>
  ) : (
    <input {...props} className={cx('input', error && 'border-rose-400')} />
  );
  return label || hint || error ? (
    <Field label={label} hint={hint} error={error} className={className}>
      {input}
    </Field>
  ) : (
    <div className={className}>{input}</div>
  );
}

export function Select({ label, hint, options = [], className, placeholder, ...props }) {
  const el = (
    <select {...props} className="input appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2394a3b8%22><path d=%22M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z%22/></svg>')] bg-[length:18px] bg-[right_10px_center] bg-no-repeat pr-9">
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
  return label || hint ? (
    <Field label={label} hint={hint} className={className}>
      {el}
    </Field>
  ) : (
    <div className={className}>{el}</div>
  );
}

export function Textarea({ label, className, ...props }) {
  return (
    <Field label={label} className={className}>
      <textarea {...props} className="input min-h-[72px] resize-y" />
    </Field>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={cx('flex cursor-pointer items-start justify-between gap-4', disabled && 'cursor-not-allowed opacity-60')}>
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-slate-300')}
      >
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function Segmented({ value, onChange, options, className, size = 'md' }) {
  return (
    <div className={cx('inline-flex rounded-xl bg-slate-100 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx('rounded-lg font-medium transition', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm', value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Display
export function Card({ title, subtitle, action, children, className, bodyClassName, padded = true }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx(padded && 'p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'slate', onClick }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    brand: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cx('card flex w-full items-start gap-3 p-4 text-left', onClick && 'transition hover:border-brand-300 hover:shadow-md')}>
      {Icon && (
        <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
          <Icon className="size-5" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-slate-500">{label}</span>
        <span className="num mt-0.5 block truncate text-lg font-semibold text-slate-900 sm:text-xl">{value}</span>
        {hint && <span className="mt-0.5 block truncate text-xs text-slate-500">{hint}</span>}
      </span>
    </Comp>
  );
}

export function Badge({ tone = 'slate', children, className }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    red: 'bg-rose-50 text-rose-700 ring-rose-600/15',
    amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    blue: 'bg-sky-50 text-sky-700 ring-sky-600/15',
    violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
    brand: 'bg-brand-50 text-brand-800 ring-brand-600/15',
  };
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent', tones[tone], className)}>{children}</span>;
}

export function BalanceBadge({ balance, status }) {
  const s = status || (Math.abs(balance) < 0.5 ? 'settled' : balance > 0 ? 'refund' : 'due');
  if (s === 'settled') return <Badge tone="slate">Settled</Badge>;
  if (s === 'refund') return <Badge tone="green">Refund {money(balance)}</Badge>;
  return <Badge tone="red">Due {money(-balance)}</Badge>;
}

export function Avatar({ name, src, size = 'md' }) {
  const sz = { sm: 'size-7 text-[10px]', md: 'size-9 text-xs', lg: 'size-12 text-sm' }[size];
  const palette = ['bg-teal-100 text-teal-800', 'bg-sky-100 text-sky-800', 'bg-violet-100 text-violet-800', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800', 'bg-emerald-100 text-emerald-800'];
  const color = palette[[...(name || '')].reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length];
  if (src) return <img src={fileUrl(src)} alt={name} className={cx('shrink-0 rounded-full object-cover', sz)} />;
  return <span className={cx('grid shrink-0 place-items-center rounded-full font-semibold', sz, color)}>{initials(name)}</span>;
}

export function Spinner({ className }) {
  return <Loader2 className={cx('size-5 animate-spin text-brand-600', className)} />;
}

export function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner className="size-7" />
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-lg bg-slate-200/70', className)} />;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="size-6" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <AlertTriangle className="size-8 text-amber-500" />
      <p className="text-sm text-slate-600">{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={() => onRetry()}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-1">
        <IconButton icon={ChevronLeft} label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)} />
        <IconButton icon={ChevronRight} label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)} />
      </div>
    </div>
  );
}

export function Progress({ value, tone }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = tone || (value >= 100 ? 'bg-rose-500' : value >= 90 ? 'bg-amber-500' : value >= 75 ? 'bg-amber-400' : 'bg-brand-500');
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- Modal / sheet
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} className={cx('relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl', widths[size])}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
        <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2 -mt-1" />
        </header>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <footer className="safe-bottom flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------- Confirm dialog (promise based)
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = (v) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title || 'Are you sure?'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {state?.confirmText || 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-slate-600">{state?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

// ---------------------------------------------------------------- Member chips (fast multi-select)
export function MemberChips({ members, value, onChange, multiple = true, disabledIds = [] }) {
  const toggle = (id) => {
    if (!multiple) return onChange(value.includes(id) ? [] : [id]);
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => {
        const on = value.includes(m._id);
        const disabled = disabledIds.includes(m._id);
        return (
          <button
            key={m._id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(m._id)}
            className={cx(
              'flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition disabled:opacity-40',
              on ? 'border-brand-600 bg-brand-50 text-brand-900 ring-2 ring-brand-500/20' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            )}
          >
            <Avatar name={m.fullName} src={m.photoUrl} size="sm" />
            {m.nickname || m.fullName}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="scrollbar-none -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cx('-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition', value === t.value ? 'border-brand-600 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

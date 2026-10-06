import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MoreHorizontal, Pencil, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useAsync, useDebounce } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { EXPENSE_TYPES, PAYMENT_METHODS, monthBounds, money } from '../utils/format';
import { Button, Card, EmptyState, ErrorState, IconButton, Input, Pagination, Select, Skeleton, useConfirm, cx } from './ui';

/**
 * Searchable, filterable, paginated list of month records (bazar, expenses, deposits...).
 * Desktop shows a table; phones show compact cards.
 */
export default function RecordList({ path, columns, renderCard, filters = [], onEdit, describe, emptyIcon, emptyTitle, emptyAction, sumLabel = 'Total', extraParams }) {
  const ws = useWorkspace();
  const { user } = useAuth();
  const { month, monthId, members, categories, version, isAdmin, isClosed } = ws;
  const confirm = useConfirm();
  const bounds = monthBounds(month.year, month.month);
  const [q, setQ] = useState('');
  const [f, setF] = useState({ sort: 'newest' });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const dq = useDebounce(q);
  useEffect(() => setPage(1), [dq, f]);

  const { data, loading, error, reload } = useAsync(() => api.get(`/months/${monthId}/${path}`, { q: dq, page, limit: 25, ...f, ...extraParams }), [monthId, path, dq, page, JSON.stringify(f), version, JSON.stringify(extraParams)]);

  const perms = month.settings?.permissions || {};
  const can = (item, kind) => !isClosed && (isAdmin || ((kind === 'delete' ? perms.memberCanDelete : perms.memberCanEdit) && String(item.createdBy) === String(user?._id)));

  const remove = async (item) => {
    const ok = await confirm({
      title: 'Delete this record?',
      message: (
        <>
          <p>{describe(item)}</p>
          <p className="mt-2 text-xs text-slate-500">It will be removed from all calculations. An admin can restore it from Settings → Trash.</p>
        </>
      ),
      danger: true,
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await api.del(`/months/${monthId}/${path}/${item._id}`);
      toast.success('Deleted');
      ws.bump();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setFilter = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value || undefined }));
  const activeFilters = Object.entries(f).filter(([k, v]) => k !== 'sort' && v).length;
  const cats = categories.filter((c) => (path === 'bazar' ? c.scope !== 'expense' : c.scope !== 'bazar'));

  const filterFields = {
    member: <Select key="member" label="Member" value={f.member || ''} onChange={setFilter('member')} placeholder="All members" options={members.map((m) => ({ value: m._id, label: m.fullName }))} />,
    category: <Select key="category" label="Category" value={f.category || ''} onChange={setFilter('category')} placeholder="All categories" options={cats.map((c) => ({ value: c.name, label: c.name }))} />,
    expenseType: <Select key="expenseType" label="Expense type" value={f.expenseType || ''} onChange={setFilter('expenseType')} placeholder="All types" options={EXPENSE_TYPES} />,
    paymentMethod: <Select key="paymentMethod" label="Payment method" value={f.paymentMethod || ''} onChange={setFilter('paymentMethod')} placeholder="All methods" options={PAYMENT_METHODS} />,
    from: <Input key="from" label="From" type="date" min={bounds.start} max={bounds.end} value={f.from || ''} onChange={setFilter('from')} />,
    to: <Input key="to" label="To" type="date" min={bounds.start} max={bounds.end} value={f.to || ''} onChange={setFilter('to')} />,
    minAmount: <Input key="minAmount" label="Min amount" type="number" min="0" value={f.minAmount || ''} onChange={setFilter('minAmount')} />,
    maxAmount: <Input key="maxAmount" label="Max amount" type="number" min="0" value={f.maxAmount || ''} onChange={setFilter('maxAmount')} />,
  };

  return (
    <Card padded={false}>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        </div>
        <div className="flex gap-2">
          <Select
            className="flex-1 sm:w-40"
            value={f.sort}
            onChange={(e) => setF((s) => ({ ...s, sort: e.target.value }))}
            aria-label="Sort"
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'highest', label: 'Highest amount' },
              { value: 'lowest', label: 'Lowest amount' },
            ]}
          />
          <Button variant={activeFilters ? 'soft' : 'secondary'} icon={SlidersHorizontal} onClick={() => setShowFilters(!showFilters)}>
            Filters{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
        </div>
      </div>
      {showFilters && (
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-4 sm:p-4">
          {[...filters, 'from', 'to', 'minAmount', 'maxAmount'].map((k) => filterFields[k])}
          {activeFilters > 0 && (
            <div className="col-span-2 sm:col-span-4">
              <Button variant="ghost" size="sm" onClick={() => setF({ sort: f.sort })}>
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}

      {error ? (
        <div className="p-4">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : loading && !data ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState icon={emptyIcon} title={q || activeFilters ? 'Nothing matches your filters' : emptyTitle} action={!q && !activeFilters && !isClosed ? emptyAction : undefined} />
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500">
            <span>
              {data.total} record{data.total === 1 ? '' : 's'}
            </span>
            {data.sum !== undefined && (
              <span>
                {sumLabel}: <strong className="num text-slate-800">{money(data.sum)}</strong>
              </span>
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="table-base">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={c.align === 'right' ? 'text-right' : undefined}>
                      {c.label}
                    </th>
                  ))}
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item._id} className={cx(item.status === 'cancelled' && 'opacity-50')}>
                    {columns.map((c) => (
                      <td key={c.key} className={cx(c.align === 'right' && 'num text-right', c.className)}>
                        {c.render(item)}
                      </td>
                    ))}
                    <td className="text-right">
                      <div className="flex justify-end">
                        {can(item, 'edit') && onEdit && <IconButton icon={Pencil} label="Edit" onClick={() => onEdit(item)} />}
                        {can(item, 'delete') && <IconButton icon={Trash2} label="Delete" onClick={() => remove(item)} className="hover:text-rose-600" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-slate-100 md:hidden">
            {data.items.map((item) => (
              <li key={item._id} className={cx('flex items-start gap-3 px-4 py-3', item.status === 'cancelled' && 'opacity-50')}>
                <div className="min-w-0 flex-1">{renderCard(item)}</div>
                {(can(item, 'edit') || can(item, 'delete')) && <RowMenu onEdit={can(item, 'edit') && onEdit ? () => onEdit(item) : null} onDelete={can(item, 'delete') ? () => remove(item) : null} />}
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </Card>
  );
}

function RowMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <IconButton icon={MoreHorizontal} label="Actions" onClick={() => setOpen(!open)} />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {onEdit && (
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50" onClick={() => (setOpen(false), onEdit())}>
                <Pencil className="size-4" /> Edit
              </button>
            )}
            {onDelete && (
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50" onClick={() => (setOpen(false), onDelete())}>
                <Trash2 className="size-4" /> Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

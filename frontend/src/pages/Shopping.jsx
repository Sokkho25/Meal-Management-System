import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, ListChecks, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useWorkspace } from '../context/WorkspaceContext';
import { money, num } from '../utils/format';
import { Badge, Button, Card, EmptyState, IconButton, PageHeader, PageLoader, Segmented, useConfirm } from '../components/ui';
import { ConvertForm, ShoppingItemForm } from '../components/forms/ShoppingForms';

const PRIORITY = { high: { tone: 'red', label: 'High' }, medium: { tone: 'amber', label: 'Medium' }, low: { tone: 'slate', label: 'Low' } };

export default function Shopping() {
  const { monthId, version, isClosed, bump } = useWorkspace();
  const confirm = useConfirm();
  const [status, setStatus] = useState('pending');
  const [form, setForm] = useState(null);
  const [convert, setConvert] = useState(null);
  const { data, loading, reload } = useAsync(() => api.get(`/months/${monthId}/shopping-list`, { status, limit: 200, sort: 'newest' }), [monthId, status, version]);
  const items = (data?.items || []).sort((a, b) => ['high', 'medium', 'low'].indexOf(a.priority) - ['high', 'medium', 'low'].indexOf(b.priority));

  const remove = async (it) => {
    if (!(await confirm({ title: `Remove "${it.item}"?`, danger: true, confirmText: 'Remove' }))) return;
    try {
      await api.del(`/months/${monthId}/shopping-list/${it._id}`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader title="Shopping list" subtitle="What needs to be bought. Tick items off as bazar." actions={!isClosed && <Button icon={Plus} onClick={() => setForm({})}>Add item</Button>} />
      <Segmented
        className="mb-4"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'pending', label: 'To buy' },
          { value: 'purchased', label: 'Purchased' },
        ]}
      />
      {loading && !data ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={ListChecks} title={status === 'pending' ? 'Nothing to buy' : 'Nothing purchased yet'} action={status === 'pending' && !isClosed && <Button size="sm" onClick={() => setForm({})}>Add item</Button>} />
        </Card>
      ) : (
        <Card padded={false}>
          {status === 'pending' && (
            <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
              Estimated total: <strong className="num text-slate-800">{money(items.reduce((s, i) => s + (i.estimatedPrice || 0), 0))}</strong>
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {items.map((it) => (
              <li key={it._id} className="flex items-center gap-3 px-4 py-3">
                {status === 'pending' && !isClosed ? (
                  <button type="button" aria-label="Mark purchased" onClick={() => setConvert(it)} className="grid size-7 shrink-0 place-items-center rounded-lg border-2 border-slate-300 text-transparent hover:border-brand-500 hover:text-brand-500">
                    <Check className="size-4" />
                  </button>
                ) : (
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-600 text-white">
                    <Check className="size-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className={status === 'purchased' ? 'text-slate-500 line-through' : 'font-medium text-slate-900'}>{it.item}</p>
                  <p className="text-xs text-slate-500">
                    {num(it.quantity)} {it.unit} · {it.category}
                    {it.estimatedPrice ? ` · est. ${money(it.estimatedPrice)}` : ''}
                  </p>
                </div>
                <Badge tone={PRIORITY[it.priority].tone}>{PRIORITY[it.priority].label}</Badge>
                {status === 'pending' && !isClosed && (
                  <>
                    <Button size="sm" variant="soft" icon={ShoppingCart} className="hidden sm:inline-flex" onClick={() => setConvert(it)}>
                      Bought
                    </Button>
                    <IconButton icon={Pencil} label="Edit" onClick={() => setForm({ item: it })} />
                    <IconButton icon={Trash2} label="Remove" className="hover:text-rose-600" onClick={() => remove(it)} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {form && <ShoppingItemForm open item={form.item} onClose={() => setForm(null)} onSaved={reload} />}
      {convert && (
        <ConvertForm
          open
          item={convert}
          onClose={() => setConvert(null)}
          onSaved={() => {
            reload();
            bump();
          }}
        />
      )}
    </>
  );
}

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { defaultDate, monthBounds, PAYMENT_METHODS, typeLabel } from '../../utils/format';
import { Button, Input, Modal, Segmented, Select, Textarea, Toggle } from '../ui';
import { FileUpload } from './common';

export default function ExpenseForm({ open, onClose, item, preset, onSaved }) {
  const ws = useWorkspace();
  const { month, categories, activeMembers } = ws;
  const cats = categories.filter((c) => c.scope !== 'bazar');
  const bounds = monthBounds(month.year, month.month);
  const [v, setV] = useState(() => ({
    date: item?.date || defaultDate(month.year, month.month),
    title: item?.title || preset?.title || '',
    category: item?.category || preset?.category || cats[0]?.name || '',
    amount: String(item?.amount ?? preset?.amount ?? ''),
    paidFrom: item?.paidFrom || preset?.paidFrom || 'fund',
    paidBy: item?.paidBy?._id || item?.paidBy || '',
    paymentMethod: item?.paymentMethod || preset?.paymentMethod || 'cash',
    description: item?.description || '',
    receiptUrl: item?.receiptUrl || '',
    recurring: item?.recurring ?? preset?.recurring ?? false,
    isRefund: item?.isRefund || false,
    status: item?.status || 'active',
  }));
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));
  const cat = cats.find((c) => c.name === v.category);

  const submit = async (e) => {
    e.preventDefault();
    if (Number(v.amount) < 0) return toast.error('Amount cannot be negative');
    if (v.paidFrom === 'personal' && !v.paidBy) return toast.error('Select who paid');
    const body = { ...v, amount: Number(v.amount), paidBy: v.paidFrom === 'personal' ? v.paidBy : null };
    setSaving(true);
    try {
      if (item) await api.patch(`/months/${month._id}/expenses/${item._id}`, body);
      else await api.post(`/months/${month._id}/expenses`, body);
      toast.success(item ? 'Expense updated' : 'Expense added');
      ws.bump();
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Edit expense' : 'Add expense'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={submit} className="space-y-4">
        <Input label="Title" required placeholder="e.g. Electricity bill" value={v.title} onChange={set('title')} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Category" value={v.category} onChange={set('category')} options={cats.map((c) => ({ value: c.name, label: c.name }))} hint={cat ? `Counts as ${typeLabel(cat.expenseType).toLowerCase()} expense` : undefined} />
          <Input label="Amount" type="number" inputMode="decimal" min="0" step="any" prefix="৳" required value={v.amount} onChange={set('amount')} />
          <Input label="Date" type="date" min={bounds.start} max={bounds.end} required value={v.date} onChange={set('date')} />
          <Select label="Payment method" value={v.paymentMethod} onChange={set('paymentMethod')} options={PAYMENT_METHODS} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="label mb-0">Paid from</span>
            <Segmented
              size="sm"
              value={v.paidFrom}
              onChange={set('paidFrom')}
              options={[
                { value: 'fund', label: 'Mess fund' },
                { value: 'personal', label: 'A member' },
              ]}
            />
          </div>
          {v.paidFrom === 'personal' && <Select value={v.paidBy} onChange={set('paidBy')} placeholder="Select member" options={activeMembers.map((m) => ({ value: m._id, label: m.fullName }))} />}
        </div>
        <Textarea label="Description (optional)" rows={2} value={v.description} onChange={set('description')} />
        <FileUpload value={v.receiptUrl} onChange={set('receiptUrl')} />
        <div className="space-y-3 rounded-xl bg-slate-50 p-3">
          <Toggle checked={v.recurring} onChange={set('recurring')} label="Recurring every month" description="You'll be reminded next month (rent, internet, utilities)." />
          <Toggle checked={v.isRefund} onChange={set('isRefund')} label="Refund / money returned" description="Reduces the total instead of adding to it." />
          {item && <Toggle checked={v.status === 'cancelled'} onChange={(c) => set('status')(c ? 'cancelled' : 'active')} label="Cancelled" description="Kept for the record but left out of all calculations." />}
        </div>
      </form>
    </Modal>
  );
}

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { defaultDate, monthBounds, PAYMENT_METHODS } from '../../utils/format';
import { Button, Input, MemberChips, Modal, Segmented, Select } from '../ui';
import { COMMON_ITEMS, UNITS } from './common';

export function ShoppingItemForm({ open, onClose, item, onSaved }) {
  const { month, categories } = useWorkspace();
  const cats = categories.filter((c) => c.scope !== 'expense');
  const [v, setV] = useState({
    item: item?.item || '',
    quantity: String(item?.quantity ?? 1),
    unit: item?.unit || 'kg',
    category: item?.category || 'Grocery',
    priority: item?.priority || 'medium',
    estimatedPrice: String(item?.estimatedPrice ?? ''),
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...v, quantity: Number(v.quantity) || 0, estimatedPrice: Number(v.estimatedPrice) || 0 };
      if (item) await api.patch(`/months/${month._id}/shopping-list/${item._id}`, body);
      else await api.post(`/months/${month._id}/shopping-list`, body);
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
      title={item ? 'Edit item' : 'Add to shopping list'}
      footer={
        <Button type="submit" form="shop-form" loading={saving}>
          Save
        </Button>
      }
    >
      <form id="shop-form" onSubmit={submit} className="space-y-4">
        <datalist id="shop-items">
          {COMMON_ITEMS.map((i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
        <Input label="Item" list="shop-items" required autoFocus value={v.item} onChange={set('item')} />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Quantity" type="number" min="0" step="any" value={v.quantity} onChange={set('quantity')} />
          <Select label="Unit" value={v.unit} onChange={set('unit')} options={UNITS.map((u) => ({ value: u, label: u }))} />
          <Input label="Est. price" type="number" min="0" step="any" prefix="৳" value={v.estimatedPrice} onChange={set('estimatedPrice')} />
        </div>
        <Select label="Category" value={v.category} onChange={set('category')} options={cats.map((c) => ({ value: c.name, label: c.name }))} />
        <div>
          <span className="label">Priority</span>
          <Segmented
            value={v.priority}
            onChange={set('priority')}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
          />
        </div>
      </form>
    </Modal>
  );
}

export function ConvertForm({ open, onClose, item, onSaved }) {
  const ws = useWorkspace();
  const { month, activeMembers, selfMember, categories } = ws;
  const cats = categories.filter((c) => c.scope !== 'expense');
  const bounds = monthBounds(month.year, month.month);
  const [v, setV] = useState({
    date: defaultDate(month.year, month.month),
    totalPrice: String(item?.estimatedPrice || ''),
    quantity: String(item?.quantity ?? ''),
    category: cats.some((c) => c.name === item?.category) ? item.category : 'Grocery',
    paidFrom: 'personal',
    purchaser: selfMember?._id || '',
    paymentMethod: 'cash',
    vendor: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));
  const submit = async (e) => {
    e.preventDefault();
    if (v.paidFrom === 'personal' && !v.purchaser) return toast.error('Select who paid');
    setSaving(true);
    try {
      await api.post(`/months/${month._id}/shopping-list/${item._id}/convert`, {
        date: v.date,
        totalPrice: Number(v.totalPrice),
        quantity: Number(v.quantity) || undefined,
        category: v.category,
        paidFrom: v.paidFrom,
        purchasers: v.paidFrom === 'personal' ? [{ member: v.purchaser }] : [],
        paymentMethod: v.paymentMethod,
        vendor: v.vendor,
      });
      toast.success('Added to bazar');
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
      title={`Bought: ${item?.item}`}
      description="Creates a bazar expense from this item."
      footer={
        <Button type="submit" form="convert-form" loading={saving}>
          Convert to bazar
        </Button>
      }
    >
      <form id="convert-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Total paid" type="number" min="0" step="any" prefix="৳" required autoFocus value={v.totalPrice} onChange={set('totalPrice')} />
          <Input label={`Quantity (${item?.unit || ''})`} type="number" min="0" step="any" value={v.quantity} onChange={set('quantity')} />
          <Input label="Date" type="date" min={bounds.start} max={bounds.end} value={v.date} onChange={set('date')} />
          <Select label="Category" value={v.category} onChange={set('category')} options={cats.map((c) => ({ value: c.name, label: c.name }))} />
        </div>
        <Segmented
          size="sm"
          value={v.paidFrom}
          onChange={set('paidFrom')}
          options={[
            { value: 'personal', label: 'Member paid' },
            { value: 'fund', label: 'Mess fund' },
          ]}
        />
        {v.paidFrom === 'personal' && <MemberChips members={activeMembers} value={v.purchaser ? [v.purchaser] : []} onChange={(ids) => set('purchaser')(ids[0] || '')} multiple={false} />}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Payment method" value={v.paymentMethod} onChange={set('paymentMethod')} options={PAYMENT_METHODS} />
          <Input label="Shop (optional)" value={v.vendor} onChange={set('vendor')} />
        </div>
      </form>
    </Modal>
  );
}

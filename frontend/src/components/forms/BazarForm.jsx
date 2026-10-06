import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { defaultDate, money, PAYMENT_METHODS, monthBounds } from '../../utils/format';
import { Button, Input, MemberChips, Modal, Segmented, Select, Textarea, IconButton, cx } from '../ui';
import { COMMON_ITEMS, FileUpload, UNITS } from './common';

const emptyRow = (category) => ({ itemName: '', category, quantity: '1', unit: 'kg', unitPrice: '', totalPrice: '' });

/** Add one or several bazar items from one shopping trip, or edit a single item. */
export default function BazarForm({ open, onClose, item, onSaved }) {
  const ws = useWorkspace();
  const { month, categories, activeMembers, selfMember } = ws;
  const cats = categories.filter((c) => c.scope !== 'expense');
  const defaultCat = cats[0]?.name || 'Grocery';
  const editing = !!item;
  const bounds = monthBounds(month.year, month.month);

  const [common, setCommon] = useState(() =>
    item
      ? {
          date: item.date,
          paidFrom: item.paidFrom,
          paymentMethod: item.paymentMethod,
          vendor: item.vendor || '',
          notes: item.notes || '',
          receiptUrl: item.receiptUrl || '',
          isRefund: item.isRefund,
          purchasers: item.purchasers.map((p) => ({ member: p.member?._id || p.member, amount: String(p.amount ?? '') })),
        }
      : { date: defaultDate(month.year, month.month), paidFrom: 'personal', paymentMethod: 'cash', vendor: '', notes: '', receiptUrl: '', isRefund: false, purchasers: selfMember ? [{ member: selfMember._id, amount: '' }] : [] }
  );
  const [rows, setRows] = useState(() =>
    item ? [{ itemName: item.itemName, category: item.category, quantity: String(item.quantity), unit: item.unit, unitPrice: String(item.unitPrice || ''), totalPrice: String(item.totalPrice) }] : [emptyRow(defaultCat)]
  );
  const [split, setSplit] = useState(() => (item ? item.purchasers.length > 1 : false));
  const [saving, setSaving] = useState(false);

  const rowTotal = (r) => (r.totalPrice !== '' ? Number(r.totalPrice) : (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0));
  const grand = useMemo(() => rows.reduce((s, r) => s + rowTotal(r), 0), [rows]);

  const setRow = (i, k, v) =>
    setRows((rs) =>
      rs.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, [k]: v };
        // Keep total in sync when quantity or unit price changes.
        if ((k === 'quantity' || k === 'unitPrice') && next.unitPrice !== '') next.totalPrice = String(Math.round((Number(next.quantity) || 0) * Number(next.unitPrice) * 100) / 100);
        return next;
      })
    );

  const purchaserIds = common.purchasers.map((p) => p.member);
  const setPurchaserIds = (ids) => setCommon((c) => ({ ...c, purchasers: ids.map((id) => c.purchasers.find((p) => p.member === id) || { member: id, amount: '' }) }));

  const submit = async (e) => {
    e.preventDefault();
    const valid = rows.filter((r) => r.itemName.trim());
    if (!valid.length) return toast.error('Add at least one item');
    if (valid.some((r) => rowTotal(r) < 0)) return toast.error('Amounts cannot be negative');
    if (common.paidFrom === 'personal' && !common.purchasers.length) return toast.error('Select who paid');
    const purchasers = common.paidFrom === 'fund' ? [] : common.purchasers.map((p) => ({ member: p.member, ...(split && p.amount !== '' ? { amount: Number(p.amount) } : {}) }));
    if (split && valid.length === 1) {
      const sum = purchasers.reduce((s, p) => s + (p.amount || 0), 0);
      if (Math.abs(sum - rowTotal(valid[0])) > 0.01) return toast.error(`Split amounts (${money(sum)}) must equal the total (${money(rowTotal(valid[0]))})`);
    }
    const toPayload = (r) => ({
      date: common.date,
      itemName: r.itemName.trim(),
      category: r.category,
      quantity: Number(r.quantity) || 0,
      unit: r.unit,
      ...(r.unitPrice !== '' ? { unitPrice: Number(r.unitPrice) } : {}),
      totalPrice: rowTotal(r),
      purchasers: split ? purchasers : purchasers.slice(0, 1).map((p) => ({ member: p.member })),
      paidFrom: common.paidFrom,
      paymentMethod: common.paymentMethod,
      vendor: common.vendor,
      notes: common.notes,
      receiptUrl: common.receiptUrl,
      isRefund: common.isRefund,
    });
    setSaving(true);
    try {
      if (editing) await api.patch(`/months/${month._id}/bazar/${item._id}`, toPayload(valid[0]));
      else if (valid.length === 1) await api.post(`/months/${month._id}/bazar`, toPayload(valid[0]));
      else await api.post(`/months/${month._id}/bazar/bulk`, { items: valid.map(toPayload) });
      toast.success(editing ? 'Bazar updated' : valid.length > 1 ? `${valid.length} items added` : 'Bazar added');
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
      title={editing ? 'Edit bazar item' : 'Add bazar'}
      description={editing ? undefined : 'Add everything bought in one trip.'}
      size="lg"
      footer={
        <>
          <span className="mr-auto self-center text-sm text-slate-500">
            Total <strong className="num text-slate-900">{money(grand)}</strong>
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="bazar-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="bazar-form" onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" required min={bounds.start} max={bounds.end} value={common.date} onChange={(e) => setCommon({ ...common, date: e.target.value })} />
          <Select label="Payment method" value={common.paymentMethod} onChange={(e) => setCommon({ ...common, paymentMethod: e.target.value })} options={PAYMENT_METHODS} />
        </div>

        <datalist id="common-items">
          {COMMON_ITEMS.map((i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
                <Input className="col-span-2 sm:col-span-5" placeholder="Item (e.g. Rice)" list="common-items" required value={r.itemName} onChange={(e) => setRow(i, 'itemName', e.target.value)} aria-label="Item name" />
                <Select className="col-span-2 sm:col-span-4" value={r.category} onChange={(e) => setRow(i, 'category', e.target.value)} options={cats.map((c) => ({ value: c.name, label: c.name }))} aria-label="Category" />
                <div className="col-span-2 flex items-center justify-end sm:col-span-3">
                  {rows.length > 1 && <IconButton icon={Trash2} label="Remove item" onClick={() => setRows(rows.filter((_, idx) => idx !== i))} />}
                </div>
                <Input className="sm:col-span-3" type="number" inputMode="decimal" min="0" step="any" placeholder="Qty" value={r.quantity} onChange={(e) => setRow(i, 'quantity', e.target.value)} aria-label="Quantity" />
                <Select className="sm:col-span-3" value={r.unit} onChange={(e) => setRow(i, 'unit', e.target.value)} options={UNITS.map((u) => ({ value: u, label: u }))} aria-label="Unit" />
                <Input className="sm:col-span-3" type="number" inputMode="decimal" min="0" step="any" placeholder="Unit price" prefix="৳" value={r.unitPrice} onChange={(e) => setRow(i, 'unitPrice', e.target.value)} aria-label="Unit price" />
                <Input className="sm:col-span-3" type="number" inputMode="decimal" min="0" step="any" placeholder="Total" prefix="৳" required value={r.totalPrice} onChange={(e) => setRow(i, 'totalPrice', e.target.value)} aria-label="Total price" />
              </div>
            </div>
          ))}
          {!editing && (
            <Button variant="soft" size="sm" icon={Plus} onClick={() => setRows([...rows, emptyRow(rows[rows.length - 1]?.category || defaultCat)])}>
              Add another item
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="label mb-0">Paid by</span>
            <Segmented
              size="sm"
              value={common.paidFrom}
              onChange={(v) => setCommon({ ...common, paidFrom: v })}
              options={[
                { value: 'personal', label: 'Member paid' },
                { value: 'fund', label: 'Mess fund' },
              ]}
            />
          </div>
          {common.paidFrom === 'personal' ? (
            <>
              <MemberChips members={activeMembers} value={purchaserIds} onChange={setPurchaserIds} multiple={split} />
              {rows.length === 1 && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} className="accent-brand-600" /> Several people paid for this
                </label>
              )}
              {split && common.purchasers.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {common.purchasers.map((p, i) => (
                    <Input
                      key={p.member}
                      label={activeMembers.find((m) => m._id === p.member)?.fullName}
                      type="number"
                      min="0"
                      step="any"
                      prefix="৳"
                      value={p.amount}
                      onChange={(e) => setCommon((c) => ({ ...c, purchasers: c.purchasers.map((x, idx) => (idx === i ? { ...x, amount: e.target.value } : x)) }))}
                    />
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500">The person who paid is credited with this amount in their balance.</p>
            </>
          ) : (
            <p className="text-xs text-slate-500">Paid from the shared cash box; reduces cash in hand.</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Shop / vendor (optional)" value={common.vendor} onChange={(e) => setCommon({ ...common, vendor: e.target.value })} />
          <div className="flex items-end">
            <FileUpload value={common.receiptUrl} onChange={(url) => setCommon({ ...common, receiptUrl: url })} />
          </div>
        </div>
        <Textarea label="Notes (optional)" rows={2} value={common.notes} onChange={(e) => setCommon({ ...common, notes: e.target.value })} />
        <label className={cx('flex items-center gap-2 text-sm text-slate-600')}>
          <input type="checkbox" checked={common.isRefund} onChange={(e) => setCommon({ ...common, isRefund: e.target.checked })} className="accent-brand-600" />
          This is a return / refund (reduces cost)
        </label>
      </form>
    </Modal>
  );
}

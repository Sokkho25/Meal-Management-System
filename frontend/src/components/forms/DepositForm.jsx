import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { defaultDate, monthBounds, PAYMENT_METHODS } from '../../utils/format';
import { Button, Input, MemberChips, Modal, Select } from '../ui';

export default function DepositForm({ open, onClose, item, onSaved, settlement = false, preset }) {
  const ws = useWorkspace();
  const { month, activeMembers, members, selfMember, isAdmin } = ws;
  const bounds = monthBounds(month.year, month.month);
  const [v, setV] = useState(() => ({
    date: item?.date || defaultDate(month.year, month.month),
    member: item?.member?._id || item?.member || preset?.member || (!isAdmin && selfMember ? selfMember._id : ''),
    amount: String(item?.amount ?? preset?.amount ?? ''),
    paymentMethod: item?.paymentMethod || 'cash',
    reference: item?.reference || '',
    note: item?.note || '',
    direction: item?.direction || preset?.direction || 'received',
  }));
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));
  const choices = isAdmin ? (settlement ? members : activeMembers) : activeMembers.filter((m) => m._id === selfMember?._id);
  const path = settlement ? 'settlements' : 'contributions';

  const submit = async (e) => {
    e.preventDefault();
    if (!v.member) return toast.error('Select a member');
    if (!(Number(v.amount) > 0)) return toast.error('Amount must be more than 0');
    const body = settlement
      ? { date: v.date, member: v.member, amount: Number(v.amount), paymentMethod: v.paymentMethod, note: v.note, direction: v.direction }
      : { date: v.date, member: v.member, amount: Number(v.amount), paymentMethod: v.paymentMethod, reference: v.reference, note: v.note };
    setSaving(true);
    try {
      if (item) await api.patch(`/months/${month._id}/${path}/${item._id}`, body);
      else await api.post(`/months/${month._id}/${path}`, body);
      toast.success(settlement ? 'Settlement recorded' : item ? 'Deposit updated' : 'Deposit added');
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
      title={settlement ? 'Record settlement' : item ? 'Edit deposit' : 'Add deposit'}
      description={settlement ? 'Money collected from a member who owes, or refunded to a member.' : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="deposit-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="deposit-form" onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">Member</span>
          <MemberChips members={choices} value={v.member ? [v.member] : []} onChange={(ids) => set('member')(ids[0] || '')} multiple={false} />
        </div>
        {settlement && (
          <Select
            label="Direction"
            value={v.direction}
            onChange={set('direction')}
            options={[
              { value: 'received', label: 'Member paid their due into the fund' },
              { value: 'paid', label: 'Fund refunded money to the member' },
            ]}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount" type="number" inputMode="decimal" min="0" step="any" prefix="৳" required autoFocus value={v.amount} onChange={set('amount')} />
          <Input label="Date" type="date" min={bounds.start} max={bounds.end} required value={v.date} onChange={set('date')} />
          <Select label="Payment method" value={v.paymentMethod} onChange={set('paymentMethod')} options={PAYMENT_METHODS} />
          {!settlement && <Input label="Reference / TrxID" value={v.reference} onChange={set('reference')} />}
        </div>
        <Input label="Note (optional)" value={v.note} onChange={set('note')} />
      </form>
    </Modal>
  );
}

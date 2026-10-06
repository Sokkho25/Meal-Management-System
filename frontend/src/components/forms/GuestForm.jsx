import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { defaultDate, monthBounds } from '../../utils/format';
import { Button, Input, MemberChips, Modal, Segmented } from '../ui';

export default function GuestForm({ open, onClose, date, onSaved }) {
  const ws = useWorkspace();
  const { month, activeMembers, selfMember, isAdmin } = ws;
  const bounds = monthBounds(month.year, month.month);
  const canOthers = isAdmin || month.settings?.permissions?.memberCanEditOthersMeals;
  const [v, setV] = useState({
    host: selfMember?._id || '',
    guestName: '',
    date: date || defaultDate(month.year, month.month),
    mealType: month.mealTypes[month.mealTypes.length - 1]?.key,
    count: '1',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    if (!v.host) return toast.error('Select the host');
    setSaving(true);
    try {
      await api.post(`/months/${month._id}/guests`, { ...v, count: Number(v.count) });
      toast.success('Guest meal added');
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
      title="Add guest meal"
      description={month.settings?.guestMeals === 'exclude' ? 'Guest meals are currently not charged (see Meal rules).' : 'Guest meals count in the total and are charged to the host.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="guest-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="guest-form" onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">Host</span>
          <MemberChips members={canOthers ? activeMembers : activeMembers.filter((m) => m._id === selfMember?._id)} value={v.host ? [v.host] : []} onChange={(ids) => set('host')(ids[0] || '')} multiple={false} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Guest name" placeholder="Guest" value={v.guestName} onChange={set('guestName')} />
          <Input label="Date" type="date" min={bounds.start} max={bounds.end} value={v.date} onChange={set('date')} />
        </div>
        <div>
          <span className="label">Meal</span>
          <Segmented value={v.mealType} onChange={set('mealType')} options={month.mealTypes.map((t) => ({ value: t.key, label: t.label }))} />
        </div>
        <Input label="Number of meals" type="number" min="1" max="50" value={v.count} onChange={set('count')} />
      </form>
    </Modal>
  );
}

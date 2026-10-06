import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';
import { api } from '../../services/api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { defaultDate, monthBounds } from '../../utils/format';
import { Button, Input, MemberChips, Modal, cx } from '../ui';

/** Minimum-tap meal entry: date → members → meal types → Save. */
export default function QuickMealForm({ open, onClose, onSaved }) {
  const ws = useWorkspace();
  const { month, activeMembers, selfMember, isAdmin } = ws;
  const bounds = monthBounds(month.year, month.month);
  const canOthers = isAdmin || month.settings?.permissions?.memberCanEditOthersMeals;
  const choices = canOthers ? activeMembers : activeMembers.filter((m) => m._id === selfMember?._id);
  const [date, setDate] = useState(defaultDate(month.year, month.month));
  const present = choices.filter((m) => m.joinDate <= date && (!m.leaveDate || m.leaveDate >= date));
  const [members, setMembers] = useState(() => (canOthers ? [] : selfMember ? [selfMember._id] : []));
  const [types, setTypes] = useState([]);
  const [saving, setSaving] = useState(false);

  const save = async (value) => {
    if (!members.length) return toast.error('Select at least one member');
    if (!types.length) return toast.error('Select at least one meal');
    setSaving(true);
    try {
      const d = await api.post(`/months/${month._id}/meals/quick`, { date, members, mealTypes: types, value });
      toast.success(value ? `Meals saved (${d.changed} updated)` : 'Meals cleared');
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
      title="Add meal"
      footer={
        <>
          <Button variant="ghost" onClick={() => save(0)} disabled={saving}>
            Mark absent
          </Button>
          <Button onClick={() => save(1)} loading={saving} icon={Check}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Input label="Date" type="date" min={bounds.start} max={bounds.end} value={date} onChange={(e) => setDate(e.target.value)} />
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label mb-0">Members</span>
            {present.length > 1 && (
              <button type="button" className="text-xs font-medium text-brand-700" onClick={() => setMembers(members.length === present.length ? [] : present.map((m) => m._id))}>
                {members.length === present.length ? 'Clear' : 'Select all'}
              </button>
            )}
          </div>
          <MemberChips members={present} value={members} onChange={setMembers} />
        </div>
        <div>
          <span className="label">Meals</span>
          <div className="grid grid-cols-3 gap-2">
            {month.mealTypes.map((t) => {
              const on = types.includes(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTypes(on ? types.filter((x) => x !== t.key) : [...types, t.key])}
                  className={cx('rounded-xl border px-3 py-3 text-sm font-medium transition', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

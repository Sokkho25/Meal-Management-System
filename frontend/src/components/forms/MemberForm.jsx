import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { monthBounds } from '../../utils/format';
import { Avatar, Button, Input, Modal, Select, Toggle } from '../ui';
import { FileUpload } from './common';

export default function MemberForm({ open, onClose, item }) {
  const ws = useWorkspace();
  const { month, isAdmin } = ws;
  const bounds = monthBounds(month.year, month.month);
  const [v, setV] = useState(() => ({
    fullName: item?.fullName || '',
    nickname: item?.nickname || '',
    mobile: item?.mobile || '',
    email: item?.email || '',
    photoUrl: item?.photoUrl || '',
    role: item?.role || 'member',
    joinDate: item?.joinDate || bounds.start,
    leaveDate: item?.leaveDate || '',
    active: item?.active ?? true,
    openingBalance: String(item?.openingBalance ?? 0),
  }));
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    const body = isAdmin
      ? { ...v, leaveDate: v.leaveDate || null, openingBalance: Number(v.openingBalance) || 0 }
      : { nickname: v.nickname, mobile: v.mobile, photoUrl: v.photoUrl };
    setSaving(true);
    try {
      if (item) await api.patch(`/months/${month._id}/members/${item._id}`, body);
      else await api.post(`/months/${month._id}/members`, body);
      toast.success(item ? 'Member updated' : 'Member added');
      await ws.reloadMembers();
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
      title={item ? 'Edit member' : 'Add member'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="member-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={v.fullName || '?'} src={v.photoUrl} size="lg" />
          <FileUpload value={v.photoUrl} onChange={set('photoUrl')} label="Upload photo" accept="image/*" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input className="col-span-2" label="Full name" required disabled={!isAdmin} value={v.fullName} onChange={set('fullName')} />
          <Input label="Nickname" value={v.nickname} onChange={set('nickname')} />
          <Input label="Mobile" type="tel" inputMode="tel" value={v.mobile} onChange={set('mobile')} />
          {isAdmin && (
            <>
              <Input className="col-span-2" label="Email (optional)" type="email" value={v.email} onChange={set('email')} hint="If set, they can sign in with this email and see this household." />
              <Select
                label="Role"
                value={v.role}
                onChange={set('role')}
                options={[
                  { value: 'member', label: 'Member' },
                  { value: 'admin', label: 'Admin / Manager' },
                ]}
              />
              <Input label="Carried balance" type="number" step="any" prefix="৳" value={v.openingBalance} onChange={set('openingBalance')} hint="+ credit, − due" />
              <Input label="Joining date" type="date" max={bounds.end} required value={v.joinDate} onChange={set('joinDate')} />
              <Input label="Leaving date" type="date" min={v.joinDate} value={v.leaveDate} onChange={set('leaveDate')} hint="Leave empty if staying" />
              <div className="col-span-2 rounded-xl bg-slate-50 p-3">
                <Toggle checked={v.active} onChange={set('active')} label="Active" description="Inactive members without a leaving date are left out of shared expenses." />
              </div>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}

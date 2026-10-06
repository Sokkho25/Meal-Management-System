import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Paperclip, X } from 'lucide-react';
import { api, fileUrl } from '../../services/api';
import { Button } from '../ui';

export function useFormState(initial) {
  const [values, setValues] = useState(initial);
  const set = (k) => (e) => {
    const v = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setValues((s) => ({ ...s, [k]: v }));
  };
  return [values, set, setValues];
}

export function FileUpload({ value, onChange, label = 'Attach receipt', accept = 'image/*,application/pdf' }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const d = await api.upload(file);
      onChange(d.url);
      toast.success('File attached');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <input ref={ref} type="file" accept={accept} capture="environment" className="hidden" onChange={pick} />
      {value ? (
        <>
          <a href={fileUrl(value)} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-brand-700 underline">
            View attachment
          </a>
          <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => onChange('')} aria-label="Remove attachment">
            <X className="size-4" />
          </button>
        </>
      ) : (
        <Button variant="secondary" size="sm" icon={Paperclip} loading={busy} onClick={() => ref.current?.click()}>
          {label}
        </Button>
      )}
    </div>
  );
}

export const COMMON_ITEMS = ['Rice', 'Potato', 'Onion', 'Garlic', 'Ginger', 'Green chili', 'Tomato', 'Egg', 'Chicken', 'Beef', 'Fish', 'Hilsa', 'Rui', 'Dal (lentils)', 'Soybean oil', 'Mustard oil', 'Salt', 'Sugar', 'Tea', 'Milk', 'Turmeric', 'Chili powder', 'Cumin', 'Coriander', 'Brinjal', 'Pumpkin', 'Spinach', 'Cabbage', 'Cauliflower', 'Banana', 'Bread', 'Soap', 'Detergent', 'Tissue', 'Dishwash'];
export const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'dozen', 'packet', 'bundle', 'hali'];

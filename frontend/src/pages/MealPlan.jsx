import { useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useWorkspace } from '../context/WorkspaceContext';
import { addDays, defaultDate, fmtDay, monthBounds } from '../utils/format';
import { Card, IconButton, PageHeader, PageLoader } from '../components/ui';

/** Optional module: plan a week of menus. */
export default function MealPlan() {
  const { month, monthId, isAdmin, isClosed } = useWorkspace();
  const bounds = monthBounds(month.year, month.month);
  const [start, setStart] = useState(() => {
    const d = defaultDate(month.year, month.month);
    const back = Math.min(Number(d.slice(8)) - 1, (new Date(`${d}T00:00`).getDay() + 1) % 7);
    return addDays(d, -back);
  });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => d >= bounds.start && d <= bounds.end);
  const end = days[days.length - 1];
  const { data, loading, setData } = useAsync(() => api.get(`/months/${monthId}/meal-plans`, { from: start, to: end }), [monthId, start]);
  const editable = isAdmin && !isClosed;

  const save = async (date, mealType, menu) => {
    const prev = (data?.items || []).find((p) => p.date === date && p.mealType === mealType)?.menu || '';
    if (prev === menu) return;
    try {
      const d = await api.put(`/months/${monthId}/meal-plans`, { date, mealType, menu });
      setData((x) => ({ items: [...x.items.filter((p) => !(p.date === date && p.mealType === mealType)), ...(d.item ? [d.item] : [])] }));
      toast.success('Saved', { id: 'plan' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Meal plan"
        subtitle="Optional: plan the week's menu so the bazar list is easier to make."
        actions={
          <>
            <IconButton icon={ChevronLeft} label="Previous week" disabled={start <= bounds.start} onClick={() => setStart(addDays(start, -7) < bounds.start ? bounds.start : addDays(start, -7))} />
            <IconButton icon={ChevronRight} label="Next week" disabled={addDays(start, 7) > bounds.end} onClick={() => setStart(addDays(start, 7))} />
          </>
        }
      />
      {loading && !data ? (
        <PageLoader />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {days.map((d) => (
            <Card key={d} title={fmtDay(d)}>
              <div className="space-y-2">
                {month.mealTypes.map((t) => {
                  const plan = (data?.items || []).find((p) => p.date === d && p.mealType === t.key);
                  return (
                    <label key={`${d}-${t.key}-${plan?.updatedAt || ''}`} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-xs font-medium text-slate-500">{t.label}</span>
                      <input className="input py-2" placeholder={editable ? 'e.g. Rice + Fish + Dal' : '—'} disabled={!editable} defaultValue={plan?.menu || ''} onBlur={(e) => save(d, t.key, e.target.value.trim())} />
                    </label>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

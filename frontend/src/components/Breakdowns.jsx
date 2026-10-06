import { Calculator } from 'lucide-react';
import { money, num, typeLabel } from '../utils/format';
import { BalanceBadge, Modal, cx } from './ui';

function Line({ label, value, detail, emphasis, isMoney = true }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 py-2', emphasis && 'border-t border-slate-200 font-semibold text-slate-900')}>
      <div className="min-w-0">
        <p className={cx('text-sm', emphasis ? 'text-slate-900' : 'text-slate-600')}>{label}</p>
        {detail && <p className="text-xs text-slate-400">{detail}</p>}
      </div>
      <span className="num shrink-0 text-sm">{isMoney ? money(value, { decimals: Number.isInteger(value) ? 0 : 2 }) : num(value)}</span>
    </div>
  );
}

/** "Rahim's final calculation" – every line that leads to the balance. */
export function MemberBreakdownModal({ member, onClose }) {
  if (!member) return null;
  return (
    <Modal open onClose={onClose} title={`${member.fullName}'s calculation`} description={member.leaveDate ? `Member ${member.joinDate} to ${member.leaveDate}` : `Member since ${member.joinDate}`} size="sm">
      <div className="divide-y divide-slate-100">
        {member.breakdown.map((b, i) => (
          <Line key={i} label={b.label} value={b.value} detail={b.detail} emphasis={b.emphasis} isMoney={!!b.money} />
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <BalanceBadge balance={member.balance} status={member.status} />
      </div>
    </Modal>
  );
}

export function MealRateModal({ calc, onClose }) {
  if (!calc) return null;
  const b = calc.mealRateBreakdown;
  return (
    <Modal open onClose={onClose} title="How the meal rate is calculated" size="sm">
      <p className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        <Calculator className="size-4 shrink-0 text-brand-600" />
        {b.formula}
      </p>
      <div className="divide-y divide-slate-100">
        {b.pools.map((p) => (
          <Line key={p.key} label={`${p.label === p.expenseType ? typeLabel(p.expenseType) : p.label} costs`} detail={`${p.items} records`} value={p.total} />
        ))}
        <Line label="Meal-based expenses" value={b.mealBasedExpense} emphasis />
        <Line label="Total meals" value={b.totalMeals} isMoney={false} detail={calc.settings.mealMode === 'weighted' ? 'Weighted by meal type' : '1 meal = 1'} />
        <Line label="Meal rate" value={b.mealRate} emphasis detail={`${money(b.mealBasedExpense, { decimals: 2 })} ÷ ${num(b.totalMeals)} = ${b.rawRate ? b.rawRate.toFixed(4) : 0}, rounded`} />
      </div>
      <p className="mt-3 text-xs text-slate-500">Costs set to other distribution methods (equal, percentage, custom) are shared separately and do not affect the meal rate.</p>
    </Modal>
  );
}

export function CashModal({ calc, onClose }) {
  if (!calc) return null;
  const c = calc.cashBreakdown;
  return (
    <Modal open onClose={onClose} title="Cash in hand" size="sm">
      <p className="mb-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{c.formula}</p>
      <div className="divide-y divide-slate-100">
        <Line label="Starting balance" value={c.startingBalance} />
        <Line label="Carried from last month" value={c.carryBalance} />
        <Line label="Deposits" value={c.deposits} />
        {c.settlementsReceived > 0 && <Line label="Dues collected" value={c.settlementsReceived} />}
        <Line label="Paid from fund" value={-c.fundPaidCosts} detail="Purchases a member paid personally are not taken from the fund" />
        {c.settlementsPaid > 0 && <Line label="Refunds paid out" value={-c.settlementsPaid} />}
        <Line label="Cash in hand" value={c.cashInHand} emphasis />
      </div>
    </Modal>
  );
}

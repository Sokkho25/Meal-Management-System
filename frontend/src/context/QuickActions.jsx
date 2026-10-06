import { createContext, useCallback, useContext, useState } from 'react';
import BazarForm from '../components/forms/BazarForm';
import ExpenseForm from '../components/forms/ExpenseForm';
import DepositForm from '../components/forms/DepositForm';
import QuickMealForm from '../components/forms/QuickMealForm';
import MemberForm from '../components/forms/MemberForm';
import GuestForm from '../components/forms/GuestForm';

const Ctx = createContext(null);
const FORMS = { bazar: BazarForm, expense: ExpenseForm, deposit: DepositForm, meal: QuickMealForm, member: MemberForm, guest: GuestForm };

/** Opens any of the main forms from anywhere (quick-action button, pages, notifications). */
export function QuickActionsProvider({ children }) {
  const [state, setState] = useState(null);
  const open = useCallback((kind, props = {}) => setState({ kind, props, key: Date.now() }), []);
  const close = useCallback(() => setState(null), []);
  const Form = state && FORMS[state.kind];
  return (
    <Ctx.Provider value={open}>
      {children}
      {Form && <Form key={state.key} open onClose={close} {...state.props} />}
    </Ctx.Provider>
  );
}

export const useQuickAction = () => useContext(Ctx);

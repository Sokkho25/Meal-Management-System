import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);
const MONTH_KEY = 'mm_month';
const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
};

/**
 * Holds the selected household and monthly workspace, plus the data most pages need
 * (members, categories). `version` increases after every write so pages can refetch.
 */
export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const [households, setHouseholds] = useState(null);
  const [householdId, setHouseholdId] = useState(null);
  const [months, setMonths] = useState([]);
  const [monthState, setMonthState] = useState(null); // { month, role, selfMember, household }
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadHouseholds = useCallback(async () => {
    const d = await api.get('/households');
    setHouseholds(d.households);
    return d;
  }, []);

  const loadMonth = useCallback(async (monthId) => {
    const [m, mem] = await Promise.all([api.get(`/months/${monthId}`), api.get(`/months/${monthId}/members`)]);
    setMonthState(m);
    setMembers(mem.items);
    write(MONTH_KEY, monthId);
    return m;
  }, []);

  const selectHousehold = useCallback(
    async (hid, preferredMonthId) => {
      setHouseholdId(hid);
      const [ms, cats] = await Promise.all([api.get(`/households/${hid}/months`), api.get(`/households/${hid}/categories`)]);
      setMonths(ms.months);
      setCategories(cats.categories);
      const target = ms.months.find((x) => x._id === preferredMonthId) || ms.months[0];
      if (target) await loadMonth(target._id);
      else {
        setMonthState(null);
        setMembers([]);
      }
    },
    [loadMonth]
  );

  useEffect(() => {
    if (!user) {
      setHouseholds(null);
      setMonthState(null);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const d = await loadHouseholds();
        if (!d.households.length) return;
        const saved = read(MONTH_KEY);
        let hid = d.lastHousehold && d.households.some((h) => h._id === d.lastHousehold) ? d.lastHousehold : d.households[0]._id;
        if (saved) {
          try {
            const m = await api.get(`/months/${saved}`);
            hid = m.household._id;
          } catch {
            write(MONTH_KEY, null);
          }
        }
        await selectHousehold(hid, read(MONTH_KEY));
      } finally {
        setLoading(false);
      }
    })();
  }, [user, loadHouseholds, selectHousehold]);

  const refreshMonth = useCallback(async () => {
    if (!monthState) return;
    await loadMonth(monthState.month._id);
    setVersion((v) => v + 1);
  }, [monthState, loadMonth]);

  const refreshMonths = useCallback(async () => {
    if (!householdId) return;
    const ms = await api.get(`/households/${householdId}/months`);
    setMonths(ms.months);
  }, [householdId]);

  const refreshCategories = useCallback(async () => {
    if (!householdId) return;
    const cats = await api.get(`/households/${householdId}/categories`);
    setCategories(cats.categories);
  }, [householdId]);

  const value = useMemo(() => {
    const month = monthState?.month || null;
    const role = monthState?.role || null;
    return {
      loading,
      households,
      householdId,
      household: monthState?.household || households?.find((h) => h._id === householdId) || null,
      months,
      month,
      monthId: month?._id,
      role,
      isAdmin: role === 'admin',
      isClosed: month?.status === 'closed',
      selfMember: monthState?.selfMember || null,
      members,
      activeMembers: members.filter((m) => m.active !== false),
      categories: categories.filter((c) => !c.archived),
      allCategories: categories,
      version,
      bump: () => setVersion((v) => v + 1),
      selectMonth: async (id) => {
        await loadMonth(id);
        setVersion((v) => v + 1);
      },
      selectHousehold,
      loadHouseholds,
      refreshMonth,
      refreshMonths,
      refreshCategories,
      reloadMembers: async () => {
        if (!month) return;
        const mem = await api.get(`/months/${month._id}/members`);
        setMembers(mem.items);
        setVersion((v) => v + 1);
      },
    };
  }, [loading, households, householdId, months, monthState, members, categories, version, loadMonth, selectHousehold, loadHouseholds, refreshMonth, refreshMonths, refreshCategories]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace = () => useContext(WorkspaceContext);

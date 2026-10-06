import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    setToken(null);
    setUser(null);
    try {
      localStorage.removeItem('mm_month');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    if (!getToken()) {
      setReady(true);
      return;
    }
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch((err) => {
        // Only a rejected token logs the user out; network or rate-limit errors keep the session.
        if (err.status === 401) setToken(null);
      })
      .finally(() => setReady(true));
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      setUser,
      async login(email, password) {
        const d = await api.post('/auth/login', { email, password });
        setToken(d.token);
        setUser(d.user);
        return d.user;
      },
      async register(payload) {
        const d = await api.post('/auth/register', payload);
        setToken(d.token);
        setUser(d.user);
        return d.user;
      },
      acceptToken(token, u) {
        setToken(token);
        if (u) setUser(u);
      },
      logout,
    }),
    [user, ready, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

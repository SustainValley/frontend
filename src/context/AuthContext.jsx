// src/context/AuthContext.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setTokens, clearAuth } from '../lib/axios';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

const AuthContext = createContext({
  isAuthenticated: false,
  role: null,
  user: null,
  login: async () => {},
  logout: () => {},
  refreshNow: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);

  const refreshNow = useCallback(async () => {
    const rt = localStorage.getItem(REFRESH_KEY) || '';
    const headers = rt ? { Authorization: `Bearer ${rt}` } : {};
    const body = rt ? { refreshToken: rt } : {};
    const { data } = await api.post('/api/auth/refresh', body, { headers }); // withCredentials 포함
    const nextAccess = data?.accessToken || data?.token;
    if (!nextAccess) throw new Error('No access token in refresh response');
    setTokens({ accessToken: nextAccess, refreshToken: data?.refreshToken });
    return nextAccess;
  }, []);

  const login = useCallback(
    async ({ id, pw }) => {
      const { data } = await api.post('/api/auth/login', { id, password: pw });
      const accessToken = data?.accessToken || data?.token;
      const refreshToken = data?.refreshToken;
      if (!accessToken && !refreshToken) {
        throw new Error('Login succeeded but no tokens were returned');
      }
      setTokens({ accessToken, refreshToken });

      try {
        const me = await api.get('/api/users/me');
        setUser(me.data);
        setRole(me.data?.role ?? null);
      } catch {}
      setIsAuthenticated(true);
    },
    []
  );

  const logout = useCallback(() => {
    clearAuth();
    setIsAuthenticated(false);
    setUser(null);
    setRole(null);
    if (typeof window !== 'undefined') window.location.href = '/login';
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const at = localStorage.getItem(ACCESS_KEY);
        if (at) {
          const me = await api.get('/api/users/me');
          setUser(me.data);
          setRole(me.data?.role ?? null);
          setIsAuthenticated(true);
        } else {
          await refreshNow();
          const me = await api.get('/api/users/me').catch(() => null);
          if (me?.data) {
            setUser(me.data);
            setRole(me.data?.role ?? null);
          }
          setIsAuthenticated(true);
        }
      } catch {
        clearAuth();
        setIsAuthenticated(false);
      } finally {
        setBooted(true);
      }
    })();
  }, [refreshNow]);

  const value = useMemo(
    () => ({ isAuthenticated, role, user, login, logout, refreshNow }),
    [isAuthenticated, role, user, login, logout, refreshNow]
  );

  if (!booted) return null;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

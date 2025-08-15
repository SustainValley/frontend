import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import instance, { setTokens, clearAuth } from '../lib/axios';
import { isBizNo, hyphenizeBiz10 } from '../utils/id';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token') || '');
  const [role, setRole] = useState(() => localStorage.getItem('role') || '');
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  });

  const isAuthenticated = !!accessToken && !!role;

  useEffect(() => {
    if (role) localStorage.setItem('role', role); else localStorage.removeItem('role');
    if (user) localStorage.setItem('user', JSON.stringify(user)); else localStorage.removeItem('user');
  }, [role, user]);

  const refresh = useCallback(async () => {
    const apply = (data) => {
      const nextAT = data?.accessToken || data?.token;
      if (!nextAT) return null;
      setTokens({ accessToken: nextAT, refreshToken: data?.refreshToken });
      setAccessToken(nextAT);
      if (data?.role) setRole(String(data.role).trim().toLowerCase());
      if (data?.user) setUser(data.user);
      return nextAT;
    };

    try {
      const { data } = await instance.post('/api/auth/refresh', {}); 
      return apply(data);
    } catch {
      try {
        const { data } = await instance.get('/api/auth/refresh'); 
        return apply(data);
      } catch {
        return null;
      }
    }
  }, []);

  useEffect(() => {
    if (!accessToken) refresh();
  }, [refresh, accessToken]);

  const login = useCallback(async (username, password) => {
    const usernameForServer = isBizNo(username) ? hyphenizeBiz10(username) : username;

    const { data } = await instance.post('/api/users/login', {
      username: usernameForServer,
      password,
    });

    const at = data?.accessToken || data?.token;
    if (!at) throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.');

    setTokens({ accessToken: at, refreshToken: data?.refreshToken });
    setAccessToken(at);

    let fromServer =
      data?.role || data?.type || data?.userRole || data?.accountType ||
      data?.user?.role || data?.user?.type || data?.user?.userRole;
    const fallback = isBizNo(username) ? 'owner' : 'user';
    const normalizedRole = String(fromServer || fallback).trim().toLowerCase();

    setRole(normalizedRole);
    setUser(data?.user ?? { username: usernameForServer });
    return normalizedRole;
  }, []);

  const logout = useCallback(async () => {
    try { await instance.post('/api/auth/logout', {}); } catch (_) {}
    clearAuth();
    setAccessToken('');
    setRole('');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, role, user, accessToken, login, logout, refresh }),
    [isAuthenticated, role, user, accessToken, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

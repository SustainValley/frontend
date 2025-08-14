import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    role: null,         // 'user' | 'owner'
    user: null,         // { id: string }
  });

  useEffect(() => {
    const saved = localStorage.getItem('auth');
    if (saved) setAuth(JSON.parse(saved));
  }, []);

  const login = ({ role, id }) => {
    const next = { isAuthenticated: true, role, user: { id } };
    setAuth(next);
    localStorage.setItem('auth', JSON.stringify(next));
  };

  const logout = () => {
    setAuth({ isAuthenticated: false, role: null, user: null });
    localStorage.removeItem('auth');
  };

  const value = useMemo(() => ({ ...auth, login, logout }), [auth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

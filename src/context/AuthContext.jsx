import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, { setTokens, clearAuth, refreshClient } from "../lib/axios";

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

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
    const rt = localStorage.getItem(REFRESH_KEY) || "";
    if (!rt) {
      clearAuth();
      setIsAuthenticated(false);
      setUser(null);
      setRole(null);
      return;
    }
    try {
      const res = await refreshClient.post(
        "/api/users/refresh",
        {},
        { headers: { Authorization: `Bearer ${rt}` } }
      );

      const access = res.data.accessToken;
      const refresh = res.data.refreshToken;
      const userId = res.data.userId;

      if (!access || !refresh) throw new Error("리프레시 실패");

      setTokens({ accessToken: access, refreshToken: refresh, userId });

      setIsAuthenticated(true);
      setUser(userId || null);

      if (/^\d{3}-\d{2}-\d{5}$/.test(userId)) {
        setRole("owner");
      } else {
        setRole("user");
      }
    } catch (err) {
      console.error("❌ 토큰 리프레시 실패:", err.response?.data || err);
      clearAuth();
      setIsAuthenticated(false);
      setUser(null);
      setRole(null);
    }
  }, []);

  const login = async (username, password) => {
    try {
      const res = await api.post("/api/users/login", { username, password });

      const access = res.data.accessToken;
      const refresh = res.data.refreshToken;
      const userId = res.data.userId;

      if (!access || !refresh) throw new Error("로그인 실패");

      setTokens({ accessToken: access, refreshToken: refresh, userId });

      if (/^\d{3}-\d{2}-\d{5}$/.test(username)) {
        setRole("owner");
      } else {
        setRole("user");
      }

      setIsAuthenticated(true);
      setUser(userId);
      return true;
    } catch (err) {
      console.error("❌ 로그인 실패:", err.response?.data || err);
      throw err;
    }
  };

  const logout = useCallback(() => {
    clearAuth();
    setIsAuthenticated(false);
    setRole(null);
    setUser(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refreshNow();
      } finally {
        setBooted(true);
      }
    })();
  }, [refreshNow]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      role,
      user,
      login,
      logout,
      refreshNow,
    }),
    [isAuthenticated, role, user, refreshNow, logout]
  );

  if (!booted) return null;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

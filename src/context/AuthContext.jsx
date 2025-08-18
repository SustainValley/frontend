import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, { setTokens, clearAuth, refreshClient, getType } from "../lib/axios";

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
  const [role, setRole] = useState(null); // "owner" | "user"
  const [user, setUser] = useState(null); // userId 저장
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

      const { accessToken: access, refreshToken: refresh, userId, type } = res.data;

      if (!access || !refresh) throw new Error("리프레시 실패");
      const finalType = type || localStorage.getItem("type");

      setTokens({
        accessToken: access,
        refreshToken: refresh,
        userId,
        type: finalType,
      });

      setIsAuthenticated(true);
      setUser(userId || null);
      setRole(finalType === "COR" ? "owner" : finalType === "PER" ? "user" : null);
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

      const { accessToken: access, refreshToken: refresh, userId, type } = res.data;

      if (!access || !refresh) throw new Error("로그인 실패");

      setTokens({ accessToken: access, refreshToken: refresh, userId, type });

      setRole(type === "COR" ? "owner" : type === "PER" ? "user" : null);
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

    const savedType = getType();
    if (savedType) {
      setRole(savedType === "COR" ? "owner" : savedType === "PER" ? "user" : null);
      setIsAuthenticated(!!localStorage.getItem(ACCESS_KEY));
      setUser(localStorage.getItem("user_id"));
    }

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

  if (!booted) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, {
  setTokens,
  clearAuth,
  refreshClient,
  getType,
  getCafeId, 
} from "../lib/axios";

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

const AuthContext = createContext({
  isAuthenticated: false,
  role: null,
  user: null,
  cafeId: null,      
  login: async () => {},
  logout: () => {},
  refreshNow: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null); // "owner" | "user"
  const [user, setUser] = useState(null); 
  const [cafeId, setCafeId] = useState(null); 
  const [booted, setBooted] = useState(false);

  const refreshNow = useCallback(async () => {
    const rt = localStorage.getItem(REFRESH_KEY) || "";
    if (!rt) {
      clearAuth();
      setIsAuthenticated(false);
      setUser(null);
      setRole(null);
      setCafeId(null);
      return;
    }
    try {
      const res = await refreshClient.post(
        "/api/users/refresh",
        {},
        { headers: { Authorization: `Bearer ${rt}` } }
      );

      const {
        accessToken: access,
        refreshToken: refresh,
        userId,
        type,
        cafeId: cafeIdFromServer, 
      } = res.data;

      if (!access || !refresh) throw new Error("리프레시 실패");
      const finalType = type || localStorage.getItem("type");

      setTokens({
        accessToken: access,
        refreshToken: refresh,
        userId,
        type: finalType,
        cafeId: cafeIdFromServer !== undefined ? cafeIdFromServer : undefined, // 있으면 저장
      });

      setIsAuthenticated(true);
      setUser(userId || null);
      setRole(finalType === "COR" ? "owner" : finalType === "PER" ? "user" : null);
      const nextCafeId =
        cafeIdFromServer !== undefined ? cafeIdFromServer : getCafeId() || null;
      setCafeId(nextCafeId);
    } catch (err) {
      console.error("❌ 토큰 리프레시 실패:", err?.response?.data || err);
      clearAuth();
      setIsAuthenticated(false);
      setUser(null);
      setRole(null);
      setCafeId(null);
    }
  }, []);

  const login = async (username, password) => {
    try {
      const res = await api.post("/api/users/login", { username, password });

      const {
        accessToken: access,
        refreshToken: refresh,
        userId,
        type,
        cafeId: cafeIdFromServer, 
      } = res.data;

      if (!access || !refresh) throw new Error("로그인 실패");

      setTokens({
        accessToken: access,
        refreshToken: refresh,
        userId,
        type,
        cafeId: cafeIdFromServer, 
      });

      setRole(type === "COR" ? "owner" : type === "PER" ? "user" : null);
      setIsAuthenticated(true);
      setUser(userId);
      setCafeId(cafeIdFromServer ?? null); 
      return true;
    } catch (err) {
      console.error("❌ 로그인 실패:", err?.response?.data || err);
      throw err;
    }
  };

  const logout = useCallback(() => {
    clearAuth();
    setIsAuthenticated(false);
    setRole(null);
    setUser(null);
    setCafeId(null);
  }, []);

  useEffect(() => {
    const savedType = getType();
    if (savedType) {
      setRole(savedType === "COR" ? "owner" : savedType === "PER" ? "user" : null);
      setIsAuthenticated(!!localStorage.getItem(ACCESS_KEY));
      setUser(localStorage.getItem("user_id"));
      const savedCafeId = getCafeId();
      setCafeId(savedCafeId ? Number(savedCafeId) : null); 
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
      cafeId,    
      login,
      logout,
      refreshNow,
    }),
    [isAuthenticated, role, user, cafeId, refreshNow, logout]
  );

  if (!booted) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isBizNo, hyphenizeBiz10 } from "../utils/id";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem("auth");
    return saved
      ? JSON.parse(saved)
      : { isAuthenticated: false, user: null, role: null, token: null };
  });

  useEffect(() => {
    localStorage.setItem("auth", JSON.stringify(auth));
  }, [auth]);

  const login = async (username, password) => {
    const usernameForServer = isBizNo(username) ? hyphenizeBiz10(username) : username;

    const res = await fetch("/hackathon/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameForServer, password }),
    });

    if (!res.ok) {
      let msg = "로그인에 실패했어요.";
      try { const t = await res.text(); if (t) msg = t; } catch {}
      throw new Error(msg);
    }

    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : {};

    let fromServer =
      data?.role ||
      data?.type ||
      data?.userRole ||
      data?.accountType ||
      data?.user?.role ||
      data?.user?.type ||
      data?.user?.userRole;

    const fallback = isBizNo(username) ? "owner" : "user";

    const normalizedRole = String(fromServer || fallback).trim().toLowerCase();

    const next = {
      isAuthenticated: true,
      user: data?.user ?? { username: usernameForServer },
      role: normalizedRole,
      token: data?.token ?? null,
    };
    setAuth(next);
    return normalizedRole;
  };

  const logout = () => {
    setAuth({ isAuthenticated: false, user: null, role: null, token: null });
    localStorage.removeItem("auth");
  };

  const value = useMemo(() => ({ ...auth, login, logout }), [auth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

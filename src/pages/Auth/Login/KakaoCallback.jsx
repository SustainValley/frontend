// src/pages/Auth/KakaoCallback.jsx
import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { setTokens } from "../../../lib/axios";
import { useAuth } from "../../../context/AuthContext";

export default function KakaoCallback() {
  const navigate = useNavigate();
  const { refreshNow } = useAuth();        // ✅ 컨텍스트 갱신용
  const onceRef = useRef(false);

  useEffect(() => {
    if (onceRef.current) return;
    onceRef.current = true;

    const run = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") || "";

      if (!code) {
        navigate("/login", { replace: true });
        return;
      }

      const LOCK_KEY = `kakao_code_lock_${code}`;
      const DONE_KEY = `kakao_code_done_${code}`;
      if (sessionStorage.getItem(DONE_KEY) === "1") return;
      if (sessionStorage.getItem(LOCK_KEY)) return;
      sessionStorage.setItem(LOCK_KEY, "1");

      try {
        const res = await api.get("/api/oauth/kakao/callback", { params: { code, state } });
        const payload = res.data?.result ?? res.data;
        const { accessToken, refreshToken, userId, type, cafeId } = payload || {};
        if (!accessToken || !refreshToken) throw new Error("토큰이 응답에 없습니다.");

        // 1) 로컬 저장 + axios 세팅
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        if (userId != null) localStorage.setItem("user_id", String(userId));
        if (type) localStorage.setItem("type", type);
        if (cafeId != null) localStorage.setItem("cafe_id", String(cafeId));
        setTokens({ accessToken, refreshToken, userId, type, cafeId });

        // 2) 🔥 컨텍스트 즉시 갱신 (isAuthenticated/role 업데이트)
        await refreshNow();

        // 3) URL 정리 + 완료 마킹 + 이동
        window.history.replaceState({}, document.title, url.pathname);
        sessionStorage.setItem(DONE_KEY, "1");

        const dest = type === "COR" ? "/owner/home" : "/user/home";
        navigate(dest, { replace: true });
      } catch (err) {
        console.error("카카오 로그인 실패:", err?.response?.data || err);
        if (sessionStorage.getItem(DONE_KEY) === "1") return; // 이미 성공했으면 에러 무시
        sessionStorage.removeItem(LOCK_KEY);
        alert(
          `카카오 로그인 실패: ${
            err?.response?.data?.message || err?.message || "알 수 없는 오류"
          }`
        );
        navigate("/login", { replace: true });
      }
    };

    run();
  }, [navigate, refreshNow]);

  return <div>카카오 로그인 처리 중...</div>;
}

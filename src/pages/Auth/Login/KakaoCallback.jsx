// src/pages/Auth/KakaoCallback.jsx
import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { setTokens } from "../../../lib/axios";

export default function KakaoCallback() {
  const navigate = useNavigate();
  const onceRef = useRef(false);

  useEffect(() => {
    if (onceRef.current) return;        // React StrictMode 등 이중 마운트 1차 차단
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

      // 이미 이 code 처리 완료면 아무 것도 하지 않음 (뒤로가기/새로고침 대비)
      if (sessionStorage.getItem(DONE_KEY) === "1") return;

      // 처리중이면 재진입 차단
      if (sessionStorage.getItem(LOCK_KEY)) return;
      sessionStorage.setItem(LOCK_KEY, "1");

      try {
        const res = await api.get("/api/oauth/kakao/callback", { params: { code, state } });
        const payload = res.data?.result ?? res.data;
        const { accessToken, refreshToken, userId, type, cafeId } = payload || {};
        if (!accessToken || !refreshToken) throw new Error("토큰이 응답에 없습니다.");

        // 토큰/유저 저장
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        if (userId != null) localStorage.setItem("user_id", String(userId));
        if (type) localStorage.setItem("type", type);
        if (cafeId != null) localStorage.setItem("cafe_id", String(cafeId));
        setTokens({ accessToken, refreshToken, userId, type, cafeId });

        // URL의 ?code 제거 (뒤로가기 시 재호출 방지)
        window.history.replaceState({}, document.title, url.pathname);

        // ✅ 성공 처리 완료 마킹
        sessionStorage.setItem(DONE_KEY, "1");

        // 홈으로 이동 (이후 동일 code로 재요청이 와도 아무 것도 안 함)
        navigate("/user/home", { replace: true });
      } catch (err) {
        console.error("카카오 로그인 실패:", err?.response?.data || err);

        // ⚠ 이미 성공 처리(DONE_KEY) 되어 있으면 에러 무시하고 끝낸다. (두 번째 실패가 성공을 덮지 않게)
        if (sessionStorage.getItem(DONE_KEY) === "1") return;

        // 실패한 경우에만 락 해제 (다시 시도 가능)
        sessionStorage.removeItem(LOCK_KEY);

        alert(
          `카카오 로그인 실패: ${
            err?.response?.data?.message ||
            err?.message ||
            "알 수 없는 오류"
          }`
        );
        navigate("/login", { replace: true });
      }
    };

    run();
  }, [navigate]);

  return <div>카카오 로그인 처리 중...</div>;
}

import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { setTokens } from "../../../lib/axios";
import { useAuth } from "../../../context/AuthContext";

export default function KakaoCallback() {
  const navigate = useNavigate();
  const { refreshNow } = useAuth();
  const onceRef = useRef(false);

  useEffect(() => {
    if (onceRef.current) return;
    onceRef.current = true;

    const run = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") || "";
      
      // state 검증 (CSRF 방지)
      const savedState = sessionStorage.getItem("kakao_oauth_state");
      if (state && savedState && state !== savedState) {
        sessionStorage.removeItem("kakao_oauth_state");
        alert("보안 검증에 실패했습니다. 다시 시도해주세요.");
        navigate("/login", { replace: true });
        return;
      }
      if (savedState) {
        sessionStorage.removeItem("kakao_oauth_state");
      }

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
        const res = await api.get("/api/oauth/kakao/callback", {
          params: { code, state },
        });

        const data = res?.data ?? {};
        const payload = data?.result ?? data?.loginResponse ?? data;

        const accessToken = payload?.accessToken;
        const refreshToken = payload?.refreshToken;
        const userId = payload?.userId ?? payload?.id ?? null;
        const type = payload?.type ?? payload?.role ?? null;
        const cafeId = payload?.cafeId ?? null;

        const hasPhoneNumberRaw =
          typeof data?.hasPhoneNumber === "boolean"
            ? data.hasPhoneNumber
            : payload?.hasPhoneNumber;
        const hasPhoneNumber =
          typeof hasPhoneNumberRaw === "boolean" ? hasPhoneNumberRaw : true;

        if (!accessToken || !refreshToken) {
          throw new Error("토큰이 응답에 없습니다.");
        }

        setTokens({
          accessToken,
          refreshToken,
          userId,
          type,
          cafeId,
          hasPhoneNumber,
        });

        if (hasPhoneNumber === false) {
          localStorage.setItem("has_phone_number", "0");
          localStorage.setItem("phone_enforce", "1"); 
        } else {
          localStorage.setItem("has_phone_number", "1");
          localStorage.removeItem("phone_enforce");  
        }

        await refreshNow();

        window.history.replaceState({}, document.title, url.pathname);
        sessionStorage.setItem(DONE_KEY, "1");

        const isOwner = type === "COR";
        const home = isOwner ? "/owner/home" : "/user/home";
        const needPhoneRoute = isOwner
          ? "/auth/signup/owner/phone"
          : "/signup/user/phone";

        if (!hasPhoneNumber) {
          navigate(`${needPhoneRoute}?next=${encodeURIComponent(home)}`, { replace: true });
        } else {
          navigate(home, { replace: true });
        }
      } catch (err) {
        console.error("카카오 로그인 실패:", err?.response?.data || err);

        if (sessionStorage.getItem(DONE_KEY) === "1") return;
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

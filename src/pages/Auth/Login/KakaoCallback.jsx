import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { setTokens } from "../../../lib/axios";

export default function KakaoCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (!code) {
        alert("카카오 인가 코드가 없습니다.");
        navigate("/login", { replace: true });
        return;
      }

      try {
        const res = await api.get(`/api/oauth/kakao/callback?code=${code}`);

        const { accessToken, refreshToken, userId } = res.data;

        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        localStorage.setItem("user_id", userId);
     
        setTokens(accessToken, refreshToken);

        navigate("/user/home", { replace: true });
      } catch (err) {
        console.error("카카오 로그인 실패:", err);
        alert("카카오 로그인에 실패했습니다.");
        navigate("/login", { replace: true });
      }
    };
    run();
  }, [navigate]);

  return <div>카카오 로그인 처리 중...</div>;
}

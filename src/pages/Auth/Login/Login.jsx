import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./Login.module.css";
import kakaoLogo from "../../../assets/kakaoLogo.svg";
import logoImg from "../../../assets/Logo-main-fin.svg";
import { useAuth } from "../../../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { isAuthenticated, role, login } = useAuth();

  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => id.trim().length > 0 && pw.trim().length > 0,
    [id, pw]
  );

  useEffect(() => {
    if (!isAuthenticated || !role) return;

    const hasPhoneRaw = localStorage.getItem("has_phone_number"); 
    const enforce = localStorage.getItem("phone_enforce") === "1";

    if (role === "owner") {
      navigate("/owner/home", { replace: true });
      return;
    }

    if (role === "user") {

      if (enforce && hasPhoneRaw === "0") {
        navigate(`/signup/user/phone?next=${encodeURIComponent("/user/home")}`, {
          replace: true,
        });
      } else {
        navigate("/user/home", { replace: true });
      }
    }
  }, [isAuthenticated, role, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setErr("");
    setLoading(true);

    try {
      await login(id, pw);

      localStorage.removeItem("phone_enforce");      
      localStorage.setItem("has_phone_number", "1"); 

      navigate("/", { replace: true });
    } catch {
      setErr("아이디 또는 비밀번호가 일치하지 않습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleKakaoLogin = () => {
    const CLIENT_ID = "7b56421a48b08f9dc4dd3e9f246b3a54";
    // 프로덕션은 mocacafe.site, 로컬은 window.location.origin 사용
    const isProduction = window.location.hostname === "localhost" || !window.location.hostname.includes("localhost");
    const REDIRECT_URI = isProduction 
      ? "http://localhost:3000/oauth/kakao/callback"
      : "https://mocacafe.vercel.app/oauth/kakao/callback";
    // CSRF 방지를 위한 state 생성
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem("kakao_oauth_state", state);

    window.location.href =
      "https://kauth.kakao.com/oauth/authorize" +
      `?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&state=${state}`;
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.logo}>
        <img src={logoImg} alt="서비스 로고" className={styles.logoImg} />
      </div>

      <div className={styles.content}>
        <form className={styles.form} onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="아이디 (또는 사업자번호)"
            className={`${styles.inputBox} ${err ? styles.inputError : ""}`}
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="비밀번호"
            className={`${styles.inputBox} ${err ? styles.inputError : ""}`}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
          />

          {err && <div className={styles.errorText}>{err}</div>}

          <button
            type="submit"
            className={styles.loginButton}
            disabled={!canSubmit || loading}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className={styles.divider}>
          <hr className={styles.line} />
          <span className={styles.orText}>또는</span>
          <hr className={styles.line} />
        </div>

        <button
          type="button"
          onClick={handleKakaoLogin}
          className={styles.kakaoButton}
        >
          <img src={kakaoLogo} alt="카카오 로그인" className={styles.kakaoIcon} />
          카카오 로그인
        </button>

        <div className={styles.signupText}>
          아직 회원이 아니신가요?{" "}
          <Link to="/signup" className={styles.signupLink}>
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;

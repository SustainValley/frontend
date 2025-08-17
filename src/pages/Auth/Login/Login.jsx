import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Login.module.css';
import kakaoLogo from '../../../assets/kakaoLogo.svg';
import { useAuth } from '../../../context/AuthContext';

const digits = (v) => (v || '').replace(/[^0-9]/g, '');

const formatBizNo = (v) => {
  const s = digits(v).slice(0, 10); 
  if (s.length <= 3) return s;
  if (s.length <= 5) return `${s.slice(0, 3)}-${s.slice(3)}`;
  return `${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5)}`;
};

const Login = () => {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  const canSubmit = useMemo(
    () => id.trim().length > 0 && pw.trim().length > 0,
    [id, pw]
  );

  useEffect(() => {
    if (!isAuthenticated || !id) return;

    const rawId = digits(id);
    const isBizNo = /^\d{10}$/.test(rawId); // 숫자 10자리면 사업자번호

    navigate(isBizNo ? '/owner/home' : '/user/home', { replace: true });
  }, [isAuthenticated, id, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErr('');
    try {
      await login(id, pw);
    } catch (_error) {
      setErr('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };
  
  const onIdChange = (e) => {
    const value = e.target.value;
    const onlyDigits = value.replace(/-/g, '');

    if (/^\d*$/.test(onlyDigits)) {
      setId(formatBizNo(value));
    } else {
      setId(value); 
    }

    if (err) setErr('');
  };

  const handleKakaoLogin = () => {
    const REST_API_KEY = process.env.REACT_APP_KAKAO_REST_API_KEY;
    const REDIRECT_URI = process.env.REACT_APP_KAKAO_REDIRECT_URI;

    if (!REST_API_KEY || !REDIRECT_URI) {
      console.error('[KAKAO] 환경변수(REACT_APP_KAKAO_REST_API_KEY, REACT_APP_KAKAO_REDIRECT_URI)가 설정되지 않았습니다.');
      return;
    }

    window.location.href =
      `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code`;
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.content}>
        <form className={styles.form} onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="아이디 (또는 사업자번호)"
            className={styles.inputBox}
            value={id}
            onChange={onIdChange}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="비밀번호"
            className={styles.inputBox}
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              if (err) setErr('');
            }}
            autoComplete="current-password"
          />

          {/* 에러 메시지는 제출했을 때만 표시 */}
          {err && <div className={styles.errorText}>{err}</div>}

          <button
            type="submit"
            className={styles.loginButton}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
          >
            로그인
          </button>
        </form>

        <div className={styles.divider}>
          <hr className={styles.line} />
          <span className={styles.orText}>또는</span>
          <hr className={styles.line} />
        </div>

        <button type="button" onClick={handleKakaoLogin} className={styles.kakaoButton}>
          <img src={kakaoLogo} alt="카카오 로그인" className={styles.kakaoIcon} />
          카카오 로그인
        </button>

        <div className={styles.signupText}>
          아직 회원이 아니신가요?{' '}
          <Link to="/signup" className={styles.signupLink}>
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Login.module.css';
import kakaoLogo from '../../../assets/kakaoLogo.svg';
import { useAuth } from '../../../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { isAuthenticated, role, login } = useAuth();

  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  const canSubmit = useMemo(
    () => id.trim().length > 0 && pw.trim().length > 0,
    [id, pw]
  );

  useEffect(() => {
    if (!isAuthenticated || !role) return;

    if (role === 'owner') {
      navigate('/owner/home', { replace: true });
    } else if (role === 'user') {
      navigate('/user/home', { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErr('');
    try {
      await login(id, pw);
      // role, cafeId 등은 login 내부에서 저장/세팅됨
    } catch (_error) {
      setErr('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
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
            onChange={(e) => {
              setId(e.target.value);
              if (err) setErr('');
            }}
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

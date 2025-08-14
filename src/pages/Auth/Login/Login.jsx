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
    if (!isAuthenticated) return;
    if (!role) return;
    const r = String(role).trim().toLowerCase();
    navigate(r === 'owner' ? '/owner/home' : '/user/home', { replace: true });
  }, [isAuthenticated, role, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErr('');
    try {
      await login(id.trim(), pw);
    } catch (_error) {
      setErr('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.content}>
        <form className={styles.form} onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="아이디"
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

          {canSubmit && err && <div className={styles.errorText}>{err}</div>}

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

        <button
          type="button"
          className={styles.kakaoButton}
          onClick={() => (window.location.href = '/api/oauth2/authorization/kakao')}
        >
          <img src={kakaoLogo} alt="카카오 로고" className={styles.kakaoIcon} />
          <span>카카오 로그인</span>
        </button>

        <div className={styles.signupText}>
          아직 회원이 아니신가요?{' '}
          <Link to="/signup" className={styles.signupLink}>회원가입</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;

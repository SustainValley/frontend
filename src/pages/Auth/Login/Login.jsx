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
  const [loading, setLoading] = useState(false);

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
    if (!canSubmit || loading) return;

    setErr('');
    setLoading(true);

    try {
      await login(id, pw);
      setErr('');
    } catch (_error) {
      setErr('아이디 또는 비밀번호가 일치하지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 🔴 여기만 네가 원하는대로 “백엔드 콜백 URL(이미 code 포함)”로 바로 이동
  const handleKakaoLogin = () => {
    // ✅ 네가 지정한 링크로만 이동
    window.location.href =
      "https://kauth.kakao.com/oauth/authorize?client_id=7b56421a48b08f9dc4dd3e9f246b3a54&redirect_uri=http://localhost:3000/oauth/kakao/callback&response_type=code";
  };
  

  return (
    <div className={styles.loginContainer}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.content}>
        <form className={styles.form} onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="아이디 (또는 사업자번호)"
            className={`${styles.inputBox} ${err ? styles.inputError : ''}`}
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="비밀번호"
            className={`${styles.inputBox} ${err ? styles.inputError : ''}`}
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
            {loading ? '로그인 중...' : '로그인'}
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

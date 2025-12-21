import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './UserSignup.module.css';
import kakaoLogo from '../../../assets/kakaoLogo.svg';
import { useSignup } from '../../../context/SignupContext';
import instance from '../../../lib/axios';

import logoImg from '../../../assets/Logo-main-fin.svg';

const USERNAME_RE = /^[A-Za-z0-9]{5,20}$/;
const PW_HAS_LETTER = /[A-Za-z]/;
const PW_HAS_DIGIT = /\d/;
const PW_HAS_SPECIAL = /[^A-Za-z0-9]/;
const PW_SPACE = /\s/;

function validateUsername(u) {
  const v = u.trim();
  if (!v) return { ok: false, msg: '아이디를 입력해주세요.' };
  if (!USERNAME_RE.test(v)) {
    return { ok: false, msg: '아이디는 영문/숫자만 사용하여 5~20자여야 해요.' };
  }
  return { ok: true, msg: '' };
}

function validatePassword(p, username) {
  if (!p) return { ok: false, msg: '비밀번호를 입력해주세요.' };
  if (PW_SPACE.test(p)) return { ok: false, msg: '비밀번호에 공백은 사용할 수 없어요.' };
  if (p.length < 8 || p.length > 20) return { ok: false, msg: '비밀번호는 8~20자여야 해요.' };
  if (!PW_HAS_LETTER.test(p) || !PW_HAS_DIGIT.test(p) || !PW_HAS_SPECIAL.test(p)) {
    return { ok: false, msg: '영문, 숫자, 특수문자를 각각 1자 이상 포함해주세요.' };
  }
  if (username && p.toLowerCase().includes(username.trim().toLowerCase())) {
    return { ok: false, msg: '비밀번호에 아이디를 포함할 수 없어요.' };
  }
  return { ok: true, msg: '' };
}

const UserSignup = () => {
  const navigate = useNavigate();
  const { updateField } = useSignup();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  const [userErr, setUserErr] = useState('');
  const [pwErr, setPwErr] = useState('');

  const [dupMsg, setDupMsg] = useState('');
  const [dupStatus, setDupStatus] = useState('idle');

  const usernameValid = useMemo(() => validateUsername(username).ok, [username]);
  const passwordValid = useMemo(
    () => validatePassword(password, username).ok,
    [password, username]
  );
  const passwordMatch = useMemo(
    () => password && password2 && password === password2,
    [password, password2]
  );

  const canClickDup = usernameValid && dupStatus !== 'checking';
  const canNext = usernameValid && passwordValid && passwordMatch && dupStatus === 'available';

  const onNext = () => {
    const u = validateUsername(username);
    const p = validatePassword(password, username);

    setUserErr(u.ok ? '' : u.msg);
    if (!u.ok) return;

    if (!p.ok) {
      setPwErr(p.msg);
      return;
    }
    if (!passwordMatch) {
      setPwErr('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (dupStatus !== 'available') {
      setUserErr('아이디 중복확인을 완료해주세요.');
      return;
    }

    updateField('username', username.trim());
    updateField('password', password);
    setUserErr('');
    setPwErr('');
    navigate('/signup/user/name');
  };

  const onCheckDup = async () => {
    const u = validateUsername(username);
    setUserErr(u.ok ? '' : u.msg);
    if (!u.ok) {
      setDupStatus('idle');
      setDupMsg('');
      return;
    }

    try {
      setDupStatus('checking');
      setDupMsg('');

      const { data } = await instance.post('/api/users/signup/check-username', {
        username: username.trim(),
      });

      const msg = typeof data?.message === 'string' ? data.message : '';

      if (msg.includes('사용 가능')) {
        setDupStatus('available');
      } else if (msg.includes('이미 사용중')) {
        setDupStatus('taken');
      } else {
        setDupStatus('info');
      }
      setDupMsg(msg || '확인되었습니다.');
    } catch {
      setDupStatus('error');
      setDupMsg('네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  const onKakaoLogin = () => {
    const REST_API_KEY = 'c84cef645a77c5d2642041b3b6bc8959';
    const REDIRECT_URI = 'http://54.180.2.235:8080/hackathon/api/oauth/kakao/callback';
    window.location.href =
      `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code`;
  };

  return (
    <div className={styles.userSignupContainer}>
      <div className={styles.logo}>
        <img src={logoImg} alt="서비스 로고" className={styles.logoImg} />
      </div>

      <div className={styles.formSection}>
        <div className={styles.inputCard}>
          <label className={styles.label}>아이디</label>
          <div className={styles.inputRow}>
            <input
              type="text"
              placeholder="아이디"
              className={styles.input}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUserErr('');
                setDupStatus('idle');
                setDupMsg('');
              }}
              onBlur={() => {
                const u = validateUsername(username);
                setUserErr(u.ok ? '' : u.msg);
              }}
              autoComplete="username"
              inputMode="text"
              pattern="[A-Za-z0-9]*"
            />
            <button
              className={styles.checkButton}
              onClick={onCheckDup}
              type="button"
              disabled={!canClickDup}
            >
              {dupStatus === 'checking' ? '확인 중...' : '중복확인'}
            </button>
          </div>

          {userErr && (
            <div className={styles.errorText} aria-live="assertive">
              {userErr}
            </div>
          )}

          {!userErr && dupStatus !== 'idle' && dupMsg && (
            <div
              className={
                dupStatus === 'available'
                  ? styles.statusOk
                  : dupStatus === 'taken'
                  ? styles.statusBad
                  : dupStatus === 'error'
                  ? styles.statusError
                  : styles.statusInfo
              }
            >
              {dupMsg}
            </div>
          )}
        </div>

        <div className={styles.inputCard}>
          <label className={styles.label}>비밀번호</label>
          <input
            type="password"
            placeholder="비밀번호"
            className={styles.input}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (pwErr) setPwErr('');
            }}
            onBlur={() => {
              const p = validatePassword(password, username);
              setPwErr(p.ok ? '' : p.msg);
            }}
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="비밀번호 확인"
            className={styles.input}
            value={password2}
            onChange={(e) => {
              setPassword2(e.target.value);
              if (pwErr) setPwErr('');
            }}
            onBlur={() => {
              if (password && password2 && password !== password2) {
                setPwErr('비밀번호가 일치하지 않습니다.');
              }
            }}
            autoComplete="new-password"
          />

          {pwErr && (
            <div className={styles.errorText} aria-live="assertive">
              {pwErr}
            </div>
          )}
        </div>
      </div>

      <div className={styles.inputCard}>
        <button
          className={styles.nextButton}
          onClick={onNext}
          disabled={!canNext}
        >
          다음으로
        </button>

        <div className={styles.divider}>또는</div>

        <button
          className={styles.kakaoButton}
          type="button"
          onClick={onKakaoLogin}
        >
          <img src={kakaoLogo} alt="카카오 로고" className={styles.kakaoIcon} />
          카카오톡으로 시작하기
        </button>
      </div>
    </div>
  );
};

export default UserSignup;

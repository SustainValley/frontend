// src/pages/Auth/Signup/OwnerPasswordSignup.jsx
import React, { useState, useMemo } from 'react';
import styles from './OwnerPasswordSignup.module.css';
import { useNavigate } from 'react-router-dom';
import { useOwnerSignup } from '../../../context/OwnerSignupContext';

const PW_HAS_LETTER = /[A-Za-z]/;
const PW_HAS_DIGIT = /\d/;
const PW_HAS_SPECIAL = /[^A-Za-z0-9]/;
const PW_SPACE = /\s/;

function validatePassword(p) {
  if (!p) return { ok: false, msg: '비밀번호를 입력해주세요.' };
  if (PW_SPACE.test(p)) return { ok: false, msg: '비밀번호에 공백은 사용할 수 없어요.' };
  if (p.length < 8 || p.length > 20) return { ok: false, msg: '비밀번호는 8~20자여야 해요.' };
  if (!PW_HAS_LETTER.test(p) || !PW_HAS_DIGIT.test(p) || !PW_HAS_SPECIAL.test(p)) {
    return { ok: false, msg: '영문, 숫자, 특수문자를 각각 1자 이상 포함해주세요.' };
  }
  return { ok: true, msg: '' };
}

const OwnerPasswordSignup = () => {
  const navigate = useNavigate();
  const { password, setPassword } = useOwnerSignup();
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');

  const pwValid = useMemo(() => validatePassword(password).ok, [password]);
  const match = useMemo(() => password && confirm && password === confirm, [password, confirm]);
  const valid = pwValid && match;

  const onNext = () => {
    const v = validatePassword(password);
    if (!v.ok) {
      setErr(v.msg);
      return;
    }
    if (!match) {
      setErr('비밀번호가 일치하지 않습니다.');
      return;
    }
    setErr('');
    navigate('/signup/owner/phone');
  };

  return (
    <div className={styles.container}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.wrapper}>
        <div className={styles.inputCard}>
          <label className={styles.label}>비밀번호</label>

          <input
            type="password"
            placeholder="비밀번호"
            className={styles.input}
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (err) setErr('');
            }}
            onBlur={() => {
              const v = validatePassword(password);
              setErr(v.ok ? '' : v.msg);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) onNext();
            }}
          />

          <input
            type="password"
            placeholder="비밀번호 확인"
            className={styles.input}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (err) setErr('');
            }}
            onBlur={() => {
              if (password && confirm && password !== confirm) {
                setErr('비밀번호가 일치하지 않습니다.');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) onNext();
            }}
          />

          {err && <div className={styles.errorText} aria-live="assertive">{err}</div>}
        </div>

        <button
          className={styles.nextButton}
          onClick={onNext}
          disabled={!valid}
        >
          다음으로
        </button>
      </div>
    </div>
  );
};

export default OwnerPasswordSignup;

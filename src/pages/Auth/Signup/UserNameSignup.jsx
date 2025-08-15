import React, { useState, useMemo } from 'react';
import styles from './UserNameSignup.module.css';
import { useNavigate } from 'react-router-dom';
import { useSignup } from '../../../context/SignupContext';

const NAME_RE = /^[A-Za-z가-힣\s]{2,20}$/;

function validateName(v) {
  const t = v.trim();
  if (!t) return { ok: false, msg: '이름을 입력해주세요.' };
  if (!NAME_RE.test(t)) return { ok: false, msg: '이름은 한글/영문 2~20자만 가능해요.' };
  return { ok: true, msg: '' };
}

const UserNameSignup = () => {
  const navigate = useNavigate();
  const { updateField } = useSignup();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const nameValid = useMemo(() => validateName(nickname).ok, [nickname]);

  const onNext = () => {
    const v = validateName(nickname);
    if (!v.ok) {
      setError(v.msg);
      return;
    }
    updateField('nickname', nickname.trim());
    setError('');
    navigate('/signup/user/phone');
  };

  return (
    <div className={styles.container}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.wrapper}>
        <p className={styles.title}>이름을 입력해주세요</p>
        <p className={styles.subText}>회의실 예약 시 예약자명으로 사용돼요.</p>

        <div className={styles.inputGroup}>
          <label className={styles.label}>이름</label>
          <input
            className={styles.input}
            type="text"
            placeholder="이름"
            value={nickname}
            onChange={e => {
              setNickname(e.target.value);
              if (error) setError('');
            }}
            onBlur={() => {
              const v = validateName(nickname);
              setError(v.ok ? '' : v.msg);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && nameValid) onNext();
            }}
            autoComplete="name"
            inputMode="text"
          />
          {error && <div className={styles.errorText} aria-live="assertive">{error}</div>}
        </div>

        <button className={styles.nextButton} onClick={onNext} disabled={!nameValid}>
          다음으로
        </button>
      </div>
    </div>
  );
};

export default UserNameSignup;

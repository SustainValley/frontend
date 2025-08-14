import React, { useState } from 'react';
import styles from './UserNameSignup.module.css';
import { useNavigate } from 'react-router-dom';
import { useSignup } from '../../../context/SignupContext';

const UserNameSignup = () => {
  const navigate = useNavigate();
  const { updateField } = useSignup();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const onNext = () => {
    if (!nickname.trim()) return setError('이름을 입력해주세요.');
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
            onChange={e => setNickname(e.target.value)}
          />
          {error && <div className={styles.errorText}>{error}</div>}
        </div>

        <button className={styles.nextButton} onClick={onNext}>
          다음으로
        </button>
      </div>
    </div>
  );
};

export default UserNameSignup;

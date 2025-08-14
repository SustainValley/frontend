import React from 'react';
import styles from './OwnerPasswordSignup.module.css';
import { useNavigate } from 'react-router-dom';

const OwnerPasswordSignup = () => {
  const navigate = useNavigate();

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
          />

          <input
            type="password"
            placeholder="비밀번호 확인"
            className={styles.input}
            autoComplete="new-password"
          />
        </div>

        <button
          className={styles.nextButton}
          onClick={() => navigate('/signup/owner/phone')}
        >
          다음으로
        </button>
      </div>
    </div>
  );
};

export default OwnerPasswordSignup;

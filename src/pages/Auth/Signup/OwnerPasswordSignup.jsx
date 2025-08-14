// src/pages/Auth/Signup/OwnerPasswordSignup.jsx
import React, { useState } from 'react';
import styles from './OwnerPasswordSignup.module.css';
import { useNavigate } from 'react-router-dom';
import { useOwnerSignup } from '../../../context/OwnerSignupContext';

const OwnerPasswordSignup = () => {
  const navigate = useNavigate();
  const { password, setPassword } = useOwnerSignup();
  const [confirm, setConfirm] = useState('');

  const minLen = 4; 
  const valid = password.length >= minLen && password === confirm;

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
            onChange={(e) => setPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="비밀번호 확인"
            className={styles.input}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {!valid && (
            <div className={styles.errorText}>
              {password.length < minLen
                ? `비밀번호는 최소 ${minLen}자 이상이어야 해요.`
                : '비밀번호가 일치하지 않습니다.'}
            </div>
          )}
        </div>

        <button
          className={styles.nextButton}
          onClick={() => navigate('/signup/owner/phone')}
          disabled={!valid}
        >
          다음으로
        </button>
      </div>
    </div>
  );
};

export default OwnerPasswordSignup;

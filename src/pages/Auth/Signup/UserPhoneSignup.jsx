import React from 'react';
import styles from './UserNameSignup.module.css';
import { useNavigate } from 'react-router-dom';

const UserPhoneSignup = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.wrapper}>
        <p className={styles.title}>전화번호를 입력해주세요</p>
        <p className={styles.subText}>회의실 예약 시 사장님과 연락할 번호를 입력해주세요.</p>

        <div className={styles.inputGroup}>
          <label className={styles.label}>전화번호</label>
          <input className={styles.input} type="text" placeholder="전화번호" />
        </div>

        <button className={styles.nextButton} onClick={() => navigate('/signup/user/complete')}>
          회원가입
        </button>
      </div>
    </div>
  );
};

export default UserPhoneSignup;

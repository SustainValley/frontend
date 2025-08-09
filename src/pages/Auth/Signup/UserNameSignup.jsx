import React from 'react';
import styles from './UserNameSignup.module.css';
import { useNavigate } from 'react-router-dom';

const UserNameSignup = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.wrapper}>
        <p className={styles.title}>이름을 입력해주세요</p>
        <p className={styles.subText}>회의실 예약 시 예약자명으로 사용돼요.</p>

        <div className={styles.inputGroup}>
          <label className={styles.label}>이름</label>
          <input className={styles.input} type="text" placeholder="이름" />
        </div>

        <button className={styles.nextButton} onClick={() => navigate('/signup/user/phone')}>
          다음으로
        </button>
      </div>
    </div>
  );
};

export default UserNameSignup;

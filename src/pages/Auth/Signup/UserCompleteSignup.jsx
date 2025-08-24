import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './UserCompleteSignup.module.css';

import logoImg from '../../../assets/Logo-3D.svg';

const UserCompleteSignup = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={`${styles.confetti} ${styles.c1}`} aria-hidden />
      <div className={`${styles.confetti} ${styles.c2}`} aria-hidden />
      <div className={`${styles.confetti} ${styles.c3}`} aria-hidden />
      <div className={`${styles.confetti} ${styles.c4}`} aria-hidden />

      <div className={styles.centerWrap}>
        <img src={logoImg} alt="moca" className={styles.logo} />
        <h1 className={styles.title} aria-live="polite">
          회원가입 완료되었습니다
        </h1>
      </div>

      <div className={styles.footer}>
        <p className={styles.subText}>이제 회의실 예약이 가능해요</p>
        <button
          className={styles.nextButton}
          onClick={() => navigate('/login')}
        >
          로그인하러 가기
        </button>
      </div>
    </div>
  );
};

export default UserCompleteSignup;

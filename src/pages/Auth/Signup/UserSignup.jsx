import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './UserSignup.module.css';
import kakaoLogo from '../../../assets/kakaoLogo.svg';

const UserSignup = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.userSignupContainer}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.formSection}>
        <div className={styles.inputCard}>
          <label className={styles.label}>아이디</label>
          <div className={styles.inputRow}>
            <input type="text" placeholder="아이디" className={styles.input} />
            <button className={styles.checkButton}>중복확인</button>
          </div>
        </div>

        <div className={styles.inputCard}>
          <label className={styles.label}>비밀번호</label>
          <input type="password" placeholder="비밀번호" className={styles.input} />
          <input type="password" placeholder="비밀번호 확인" className={styles.input} />
        </div>
      </div>

      <div className={styles.inputCard}>
        <button className={styles.nextButton} onClick={() => navigate('/signup/user/name')}>
          다음으로
        </button>
        <div className={styles.divider}>또는</div>
        <button className={styles.kakaoButton}>
          <img src={kakaoLogo} alt="카카오 로고" className={styles.kakaoIcon} />
          카카오톡으로 시작하기
        </button>
      </div>
    </div>
  );
};

export default UserSignup;

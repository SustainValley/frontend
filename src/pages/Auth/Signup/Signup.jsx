import React from 'react';
import styles from './Signup.module.css';
import { Link } from 'react-router-dom';
import arrowRight from '../../../assets/arrow-narrow-right.svg';

const Signup = () => {
  return (
    <div className={styles.signUpContainer}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.buttonWrapper}>
        <Link to="/signup/user" className={styles.cardButton}>
          <div className={styles.textBox}>
            <div className={styles.title}>회의실 이용을 시작하세요</div>
            <div className={styles.subtitle}>모카 회원가입하기</div>
          </div>
          <img src={arrowRight} alt="화살표" className={styles.icon} />
        </Link>

        <Link to="/signup/owner" className={styles.cardButton}>
          <div className={styles.textBox}>
            <div className={styles.title}>사장님이신가요?</div>
            <div className={styles.subtitle}>매장 등록을 시작해 주세요</div>
          </div>
          <img src={arrowRight} alt="화살표" className={styles.icon} />
        </Link>
      </div>
    </div>
  );
};

export default Signup;

import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Login.module.css';
import kakaoLogo from '../../../assets/kakaoLogo.svg'

const Login = () => {
  return (
    <div className={styles.loginContainer}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.content}>
        <input type="text" placeholder="아이디" className={styles.inputBox} />
        <input type="password" placeholder="비밀번호" className={styles.inputBox} />

        <button className={styles.loginButton}>로그인</button>

        <div className={styles.divider}>
          <hr className={styles.line} />
          <span className={styles.orText}>또는</span>
          <hr className={styles.line} />
        </div>

        <button className={styles.kakaoButton}>
            <img
                src={kakaoLogo}
                alt="카카오 로고"
                className={styles.kakaoIcon}
            />
            <span>카카오 로그인</span>
        </button>


        <div className={styles.signupText}>
          아직 회원이 아니신가요?{' '}
          <Link to="/signup" className={styles.signupLink}>회원가입</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;

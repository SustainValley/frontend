import React from 'react';
import styles from './UserNameSignup.module.css';
import { useNavigate } from 'react-router-dom';

const UserCompleteSignup = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.logo}>Logo</div>

        <button className={styles.nextButton} onClick={() => navigate('/login')}>
          로그인하러 가기
        </button>
    </div>
  );
};

export default UserCompleteSignup;

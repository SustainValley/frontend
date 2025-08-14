import React from 'react';
import styles from './UserCompleteSignup.module.css';
import { useNavigate } from 'react-router-dom';

const UserCompleteSignup = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      {/* 가운데 로고 박스 */}
      <div className={styles.centerWrap}>
        <div className={styles.brandBox}>Logo</div>
        <p className={styles.title}>회원가입 완료되었습니다</p>
      </div>

      {/* 하단 안내 + 버튼 */}
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

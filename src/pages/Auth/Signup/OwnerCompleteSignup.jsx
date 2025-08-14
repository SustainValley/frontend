import React from 'react';
import styles from './OwnerCompleteSignup.module.css';
import { useNavigate } from 'react-router-dom';

const OwnerCompleteSignup = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>

      <div className={styles.centerWrap}>
        <div className={styles.brandBox}>Logo</div>
        <p className={styles.title}>매장 등록 완료되었습니다</p>
      </div>

      <div className={styles.footer}>
        <p className={styles.subText}>이제 사장님 전용 서비스를 이용할 수 있어요</p>
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

export default OwnerCompleteSignup;

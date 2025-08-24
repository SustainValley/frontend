import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./OwnerCompleteSignup.module.css";
import logoImg from "../../../assets/Logo-3D.svg";

const OwnerCompleteSignup = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={`${styles.confetti} ${styles.c1}`} aria-hidden="true" />
      <div className={`${styles.confetti} ${styles.c2}`} aria-hidden="true" />
      <div className={`${styles.confetti} ${styles.c3}`} aria-hidden="true" />
      <div className={`${styles.confetti} ${styles.c4}`} aria-hidden="true" />

      <div className={styles.centerWrap}>
        <img src={logoImg} alt="서비스 로고" className={styles.logo} />
        <h1 className={styles.title} aria-live="polite">
          매장 등록이 완료되었습니다
        </h1>
      </div>

      <div className={styles.footer}>
        <p className={styles.subText}>
          이제 사장님 전용 서비스를 이용할 수 있어요
        </p>
        <button
          type="button"
          className={styles.nextButton}
          onClick={() => navigate("/login")}
        >
          로그인하러 가기
        </button>
      </div>
    </div>
  );
};

export default OwnerCompleteSignup;

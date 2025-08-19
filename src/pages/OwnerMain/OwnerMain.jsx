import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import styles from "./OwnerMain.module.css";

import rightArrow from "../../assets/chevron-right.svg";
import arrowCircle from "../../assets/arrow-right2.svg";
import reserveIcon from "../../assets/logo_graphic.svg";

const OwnerMain = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        {/* 카페명 */}
        <div className={styles.cafeHeader}>
          <span className={styles.cafeName}>풍치커피익스프레스공릉점</span>
          <button
            type="button"
            className={styles.arrowBtn}
            onClick={() => navigate("/owner/store")}
            aria-label="가게 정보로 이동"
          >
            <img src={rightArrow} alt=">" className={styles.arrowIcon} />
          </button>
        </div>

        {/* MOCA 카드 */}
        <div
          className={styles.tipCard}
          onClick={() => navigate("/owner/analysis")}
        >
          <span className={styles.tipText}>✨ 더 효율적으로 MOCA 사용하기</span>
          <img src={arrowCircle} alt="arrow" className={styles.tipIcon} />
        </div>

        {/* 오늘의 예약 */}
        <div
          className={styles.reservationCard}
          onClick={() => navigate("/owner/reservations")} 
        >
          <span className={styles.reservationTitle}>오늘의 예약</span>
          <img src={reserveIcon} alt="예약 아이콘" className={styles.reservationImg} />
        </div>

        {/* 두 개 카드 */}
        <div className={styles.gridBox}>
          <div className={styles.smallCard}>
            <span>실시간 예약</span>
            <span>확인하기</span>
          </div>

          <div
            className={`${styles.smallCard} ${styles.chatCard}`}
            onClick={() => navigate("/chat")}
          >
            <span>채팅문의 확인하기</span>
            <span className={styles.newLabel}>New!</span>
          </div>
        </div>
      </div>

      {/* 로그아웃 버튼 */}
      <button onClick={logout} className={styles.logoutBtn}>
        로그아웃
      </button>
    </div>
  );
};

export default OwnerMain;

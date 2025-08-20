import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import styles from "./OwnerMain.module.css";

import rightArrow from "../../assets/chevron-right.svg";
import arrowCircle from "../../assets/arrow-right2.svg";
import reserveIcon from "../../assets/logo_graphic.svg";

import instance from "../../lib/axios";

const OwnerMain = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [cafeName, setCafeName] = useState("카페");
  const [loadingName, setLoadingName] = useState(false);
  const [nameError, setNameError] = useState(null);

  const getCafeId = () => {
    if (user?.cafeId) return user.cafeId;
    const ls = localStorage.getItem("cafeId") ?? localStorage.getItem("cafe_id");
    if (ls && !Number.isNaN(Number(ls))) return Number(ls);
    return null;
  };

  useEffect(() => {
    const cafeId = getCafeId();
    if (!cafeId) return;

    const controller = new AbortController();
    let mounted = true;

    (async () => {
      try {
        setLoadingName(true);
        setNameError(null);

        const { data } = await instance.get(`/api/cafe/${cafeId}/name`, {
          signal: controller.signal,
          headers: { Accept: "*/*" },
        });

        if (!mounted) return;
        const name = (data && (data.name ?? data)) || "이름 없음";
        setCafeName(typeof name === "string" ? name : "이름 없음");
      } catch (err) {
        const code = err?.code || err?.name || "";
        if (code === "ERR_CANCELED" || code === "CanceledError" || code === "AbortError") {
          return;
        }
        if (!mounted) return;
        setNameError(err?.message || "가게 이름을 불러오지 못했습니다.");
        setCafeName((prev) => prev || "카페");
      } finally {
        if (mounted) setLoadingName(false);
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [user?.cafeId]);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.cafeHeader}>
          <span className={styles.cafeName}>
            {loadingName ? "불러오는 중..." : cafeName}
          </span>
          <button
            type="button"
            className={styles.arrowBtn}
            onClick={() => navigate("/owner/store")}
            aria-label="가게 정보로 이동"
          >
            <img src={rightArrow} alt=">" className={styles.arrowIcon} />
          </button>
        </div>

        <div className={styles.tipCard} onClick={() => navigate("/owner/analysis")}>
          <span className={styles.tipText}>✨ 더 효율적으로 MOCA 사용하기</span>
          <img src={arrowCircle} alt="arrow" className={styles.tipIcon} />
        </div>

        {/* 오늘의 예약 → 오늘 탭/이용중 서브탭으로 진입 */}
        <div
          className={styles.reservationCard}
          onClick={() => navigate("/owner/reservations?tab=today&sub=using")}
        >
          <span className={styles.reservationTitle}>오늘의 예약</span>
          <img src={reserveIcon} alt="예약 아이콘" className={styles.reservationImg} />
        </div>

        <div className={styles.gridBox}>
          {/* 실시간 예약 → 예약 요청 탭으로 진입 */}
          <div
            className={styles.smallCard}
            onClick={() => navigate("/owner/reservations?tab=request")}
          >
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

      <button onClick={logout} className={styles.logoutBtn}>
        로그아웃
      </button>

      {nameError && (
        <div className={styles.errorToast} role="alert">
          {nameError}
        </div>
      )}
    </div>
  );
};

export default OwnerMain;

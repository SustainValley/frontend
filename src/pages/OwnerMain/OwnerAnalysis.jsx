// OwnerAnalysis.jsx (전체 교체본)
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./OwnerAnalysis.module.css";
import { useAuth } from "../../context/AuthContext";

import backIcon from "../../assets/chevron-right.svg";
import warningIcon from "../../assets/exclamation-circle.svg";

const meetingTypeMap = {
  PROJECT: "프로젝트 회의",
  STUDY: "과제/스터디",
  MEETING: "외부 미팅",
  INTERVIEW: "면담/인터뷰",
  NETWORKING: "네트워킹",
  ETC: "기타",
};

const cancelReasonMap = {
  CLOSED_TIME: "매장 혼잡",
  EQUIPMENT_UNAVAILABLE: "요일 장비 사용 불가",
  PEAK_LIMIT: "피크타임 인원 제한",
  CROWDED: "해당 시간대 예약 마감",
  LOCATION_CHANGE: "장소변경",
  BUDGET_ISSUE: "비용, 예산 문제",
};

const OwnerAnalysis = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // 1) cafeId 동적 결정 (user → localStorage → null)
  const cafeId = useMemo(() => {
    if (user?.cafeId) return Number(user.cafeId);
    const ls =
      localStorage.getItem("cafeId") ?? localStorage.getItem("cafe_id");
    return ls && !Number.isNaN(Number(ls)) ? Number(ls) : null;
  }, [user]);

  const [promotion, setPromotion] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [rootCause, setRootCause] = useState("");
  const [advice, setAdvice] = useState("");
  const [loadingReasons, setLoadingReasons] = useState(true);

  // cafeId가 확정되었을 때만 호출
  useEffect(() => {
    if (!cafeId) return;
    fetch(
      `https://port-0-analysis-api-mar0zdvm42447885.sel4.cloudtype.app/promotion/${cafeId}`
    )
      .then((res) => res.json())
      .then((data) => setPromotion(data))
      .catch((err) => console.error("프로모션 데이터 불러오기 실패:", err));
  }, [cafeId]);

  useEffect(() => {
    if (!cafeId) return;
    const url = `https://port-0-analysis-api-mar0zdvm42447885.sel4.cloudtype.app/cafe/${cafeId}/cancel-reason`;
    setLoadingReasons(true);
    fetch(url, { headers: { accept: "application/json" } })
      .then((res) => res.json())
      .then((data) => {
        const focused = Array.isArray(data?.focused_cancel_reason)
          ? data.focused_cancel_reason
          : [];
        const parsed = focused.map((obj) => {
          const key = Object.keys(obj)[0];
          const count = obj[key] ?? 0;
          return { key, count, label: cancelReasonMap[key] ?? key };
        });
        parsed.sort(
          (a, b) => b.count - a.count || a.label.localeCompare(b.label)
        );
        const ranked = parsed.map((r, i) => ({ ...r, rank: i + 1 }));
        setReasons(ranked);
        setRootCause(data?.root_cause ?? "");
        setAdvice(data?.rec_advice ?? "");
      })
      .catch((err) => {
        console.error("취소 사유 데이터 불러오기 실패:", err);
        setReasons([]);
      })
      .finally(() => setLoadingReasons(false));
  }, [cafeId]);

  const visibleReasons = useMemo(() => reasons.slice(0, 6), [reasons]);

  // cafeId 미확정 시 가드 UI
  if (!cafeId) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <img
            src={backIcon}
            alt="뒤로가기"
            className={styles.backBtn}
            onClick={() => navigate(-1)}
          />
          <span className={styles.title}>더 효율적으로 MOCA 사용하기</span>
        </div>
        <div className={styles.scrollArea}>
          <div className={styles.section}>
            <p className={styles.subtitle}>
              카페 정보를 찾을 수 없어요. (로그인/카페 연결 확인)
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <img
          src={backIcon}
          alt="뒤로가기"
          className={styles.backBtn}
          onClick={() => navigate(-1)}
        />
        <span className={styles.title}>더 효율적으로 MOCA 사용하기</span>
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.section}>
          <p className={styles.subtitle}>현재 공릉동은..</p>
          <div className={styles.highlightCard}>
            <p className={styles.highlightTitle}>
              {promotion
                ? `상권 ${promotion.commercial_status}인 시간이에요.`
                : "상권 정보를 불러오는 중이에요..."}
              <br /> 고객 유치에 힘써보세요!
            </p>
            {promotion && (
              <>
                <p className={styles.time}>
                  {promotion.dayOfWeek} {promotion.timeSlot}
                </p>
                <div className={styles.promoCard}>
                  <div className={styles.promoHeader}>프로모션 추천</div>
                  <p className={styles.promoText}>
                    예약 목적 중{" "}
                    {meetingTypeMap[promotion.main_purpose] ??
                      promotion.main_purpose}{" "}
                    비중이 {promotion.percent} 이상이에요!
                    <br />
                    {promotion.rec_promotion}
                  </p>
                </div>
              </>
            )}
            <button
              className={styles.promoBtn}
              onClick={() =>
                navigate("/owner/promotion", {
                  state: { promotion, cafeId },
                })
              }
            >
              프로모션 입력하기
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>예약 실패 분석</h3>
          {loadingReasons ? (
            <ol className={styles.reasonList}>
              {Array.from({ length: 6 }).map((_, i) => (
                <li
                  key={i}
                  className={`${styles.reasonItem} ${styles.skeleton}`}
                >
                  <span className={styles.rankBadge}>{i + 1}</span>
                  <span className={styles.reasonText}>로딩중…</span>
                  <span className={styles.countPill}>-</span>
                </li>
              ))}
            </ol>
          ) : (
            <ol className={styles.reasonList}>
              {visibleReasons.map((item) => (
                <li key={item.key} className={styles.reasonItem}>
                  <span className={styles.rankBadge}>{item.rank}</span>
                  <span className={styles.reasonText}>{item.label}</span>
                  <span className={styles.countPill}>
                    {item.count}
                    <span className={styles.countUnit}>회</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>MOCA의 예약 운영 제안</h3>
          <div className={styles.suggestionCard}>
            <div className={styles.suggestionHeader}>
              <img src={warningIcon} alt="" className={styles.suggestionIcon} />
              <span className={styles.suggestionTitle}>
                {rootCause ? rootCause : "운영 이슈"}
              </span>
            </div>
            <p className={styles.suggestionBody}>
              {advice
                ? advice
                : "현재 수집된 데이터를 기반으로 운영 개선안을 준비 중입니다."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerAnalysis;

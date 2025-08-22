import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./OwnerAnalysis.module.css";

import backIcon from "../../assets/chevron-right.svg";
import warningIcon from "../../assets/exclamation-circle.svg";

const monthlyFailData = [
  { day: "월", value: 0 },
  { day: "화", value: 3 },
  { day: "수", value: 2 },
  { day: "목", value: 2 },
  { day: "금", value: 4 },
  { day: "토", value: 3 },
  { day: "일", value: 0 },
];

const hourlyFailData = [
  { time: "05-11", value: 1 },
  { time: "11-15", value: 2 },
  { time: "15-18", value: 4 },
  { time: "18-20", value: 3 },
  { time: "20-22", value: 3 },
  { time: "22-01", value: 2 },
];

// MeetingType 매핑
const meetingTypeMap = {
  PROJECT: "프로젝트 회의",
  STUDY: "과제/스터디",
  MEETING: "외부 미팅",
  INTERVIEW: "면담/인터뷰",
  NETWORKING: "네트워킹",
  ETC: "기타",
};

const OwnerAnalysis = () => {
  const navigate = useNavigate();

  const [promotion, setPromotion] = useState(null);

  useEffect(() => {
    const cafeId = 7; // TODO: localStorage나 context에서 cafe_id 가져오면 교체
    fetch(
      `https://port-0-analysis-api-mar0zdvm42447885.sel4.cloudtype.app/promotion/${cafeId}`
    )
      .then((res) => res.json())
      .then((data) => {
        setPromotion(data);
      })
      .catch((err) => console.error("프로모션 데이터 불러오기 실패:", err));
  }, []);

  const maxVal = Math.max(...hourlyFailData.map((d) => d.value));
  const chartWidth = 290;
  const chartHeight = 95;
  const stepX = chartWidth / (hourlyFailData.length - 1);

  const linePoints = hourlyFailData
    .map((d, i) => {
      const x = i * stepX;
      const y = chartHeight - (d.value / maxVal) * (chartHeight - 10);
      return `${x},${y}`;
    })
    .join(" ");

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
        {/* ===== 상권 상태 & 프로모션 ===== */}
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
              <p className={styles.time}>
                {promotion.dayOfWeek} {promotion.timeSlot}
              </p>
            )}

            {promotion && (
              <div className={styles.promoCard}>
                <div className={styles.promoHeader}>프로모션 추천</div>
                <p className={styles.promoText}>
                  예약 목적 중{" "}
                  {meetingTypeMap[promotion.main_purpose] ??
                    promotion.main_purpose}{" "}
                  비중이 {promotion.percent} 이에요! <br />
                  {promotion.rec_promotion}
                </p>
              </div>
            )}

            <button className={styles.promoBtn}>프로모션 입력하기</button>
          </div>
        </div>

        {/* ===== 예약 실패 분석 ===== */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>예약 실패 분석</h3>

          <div className={styles.chartCard}>
            <p className={styles.chartLabel}>이번 달</p>
            <div className={styles.barChart}>
              {monthlyFailData.map((d, i) => (
                <div key={i} className={styles.barItem}>
                  <div
                    className={`${styles.bar} ${
                      d.value >= 3
                        ? styles.barHigh
                        : d.value >= 1
                        ? styles.barMid
                        : styles.barLow
                    }`}
                    style={{ height: `${d.value * 15 + 5}px` }}
                  ></div>
                  <span className={styles.barLabel}>{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.chartCard}>
            <p className={styles.chartLabel}>시간대별</p>
            <div className={styles.lineChartContainer}>
              <svg
                className={styles.lineChart}
                width="100%"
                height="120"
                viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
                preserveAspectRatio="xMidYMid meet"
              >
                <polyline className={styles.linePath} points={linePoints} />

                {hourlyFailData.map((d, i) => {
                  const x = i * stepX;
                  return (
                    <text
                      key={i}
                      className={styles.lineLabel}
                      x={x}
                      y={chartHeight + 20}
                    >
                      {d.time}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className={styles.alertContainer}>
            <div className={styles.alert}>
              <img
                src={warningIcon}
                alt="경고"
                className={styles.alertIcon}
              />
              <span className={styles.alertText}>
                자리 부족 | 4인 테이블 추가 배치를 추천드려요!
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerAnalysis;

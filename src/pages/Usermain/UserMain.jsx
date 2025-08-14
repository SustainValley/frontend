import React, { useState } from "react";
import styles from "./UserMain.module.css";

const UserMain = () => {
  const [expanded, setExpanded] = useState(false);
  const [keyword, setKeyword] = useState("");

  return (
    <div className={styles.previewFrame}>
      {/* 지도 영역 */}
      <div className={styles.mapArea}>
        {/* 검색 바 */}
        <div className={styles.searchBar}>
          <button className={styles.iconBtn} aria-label="검색">
            {/* 돋보기 */}
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M10.5 3a7.5 7.5 0 015.9 12.2l3.7 3.7-1.4 1.4-3.7-3.7A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z" />
            </svg>
          </button>
          <input
            className={styles.searchInput}
            placeholder="회의실 예약 원하는 카페를 검색해주세요."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button
            className={styles.iconBtn}
            title="필터"
            aria-label="필터 열기"
            onClick={() => alert("필터 패널은 나중에 연결하세요 :)")}
          >
            {/* 필터(깔때기) */}
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path d="M3 5h18v2l-7 7v5l-4 2v-7L3 7V5z" />
            </svg>
          </button>
        </div>

        {/* 마커들 (위치는 샘플, 필요 시 좌표 맞춰 조정) */}
        <Marker style={{ top: "42%", left: "58%" }} label="보라눌레스 아파트" />
        <Marker style={{ top: "66%", left: "70%" }} label="하오청" />
        <Marker style={{ top: "60%", left: "26%" }} label="풍치커피익스프레스공릉점" highlight />

        {/* iOS 그랩바 느낌의 미세한 스크럽 표시 */}
        <div className={styles.centerScrub} />
      </div>

      {/* 하단 시트 */}
      <div
        className={`${styles.bottomSheet} ${expanded ? styles.expanded : ""}`}
      >
        <div className={styles.grabber} onClick={() => setExpanded(!expanded)} />
        <div className={styles.sheetTitle}>회의실 예약</div>

        {/* 카드 1: 디자인과 동일한 첫 항목 */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>풍치커피익스프레스공릉점</div>
          <div className={styles.infoRow}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M12 1a11 11 0 1011 11A11.013 11.013 0 0012 1zm0 2a9 9 0 11-9 9 9.01 9.01 0 019-9zm1 4h-2v6h6v-2h-4z" />
            </svg>
            <span>12:00 - 18:00</span>
          </div>
          <div className={styles.chips}>
            <span className={styles.chip}>회의실 있음</span>
            <span className={styles.chip}>2–6인</span>
            <span className={styles.chip}>콘센트</span>
          </div>
        </div>

        {/* 카드 2: 예시 */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>공릉 카페 A</div>
          <div className={styles.infoRow}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M12 1a11 11 0 1011 11A11.013 11.013 0 0012 1zm0 2a9 9 0 11-9 9 9.01 9.01 0 019-9zm1 4h-2v6h6v-2h-4z" />
            </svg>
            <span>13:00 - 20:00</span>
          </div>
          <div className={styles.chips}>
            <span className={styles.chip}>미팅룸</span>
            <span className={styles.chip}>4–8인</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Marker = ({ style, label, highlight }) => (
  <div className="markerWrap" style={style}>
    <div className={`markerDot ${highlight ? "hl" : ""}`}>
      {/* 말풍선/얼굴 느낌 */}
      <span>💬</span>
    </div>
    {label && <div className="markerLabel">{label}</div>}

    {/* 스타일을 모듈 안에서 쓰기 위해 CSS 클래스 네임을 전역으로 매핑 */}
    <style>{`
      .markerWrap {
        position: absolute;
        transform: translate(-50%, -100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        pointer-events: none;
      }
      .markerDot {
        width: 38px;
        height: 38px;
        border-radius: 999px;
        background: #9cd27a;
        border: 3px solid #fff;
        box-shadow: 0 6px 16px rgba(0,0,0,0.18);
        display: grid;
        place-items: center;
        font-size: 18px;
      }
      .markerDot.hl { background: #8dcf63; }
      .markerLabel {
        pointer-events: none;
        font-size: 12px;
        line-height: 1;
        background: #f19b2c;
        color: #fff;
        padding: 6px 10px;
        border-radius: 10px;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
    `}</style>
  </div>
);

export default UserMain;

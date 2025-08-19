import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./BlockTime.module.css";

import backIcon from "../../assets/chevron.svg";
import chevronDownIcon from "../../assets/down.svg";
import calendarIcon from "../../assets/calendar.svg";   
import alertIcon from "../../assets/exclamation-circle.svg";         

const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2,"0")}:00`);

function formatToday() {
  const now = new Date();
  const day = ["일","월","화","수","목","금","토"][now.getDay()];
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${day}요일`;
}

export default function BlockTime() {
  const navigate = useNavigate();
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("18:00");
  const [modalOpen, setModalOpen] = useState(false);

  const handleReset = () => {
    setStart("00:00");
    setEnd("00:00");
  };

  const selStartMin = Number(start.slice(0,2)) * 60 + Number(start.slice(3));
  const selEndMin   = Number(end.slice(0,2)) * 60 + Number(end.slice(3));
  const morningSelected = getRowSegment(selStartMin, selEndMin, 0, 12);
  const afternoonSelected = getRowSegment(selStartMin, selEndMin, 12, 24);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.backBtn}>
          <img src={backIcon} alt="뒤로" />
        </button>
        <h1 className={styles.title}>예약 가능 시간 설정</h1>
        <span className={styles.headerRight} />
      </div>

      <div className={styles.dateWrap}>
        <img src={calendarIcon} alt="달력" className={styles.icon} />
        <span className={styles.dateText}>{formatToday()}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.notice}>
          <img src={alertIcon} alt="경고" className={styles.icon} />
          <span>오늘 예약 시간만 막을 수 있어요!</span>
        </div>

        <div className={styles.timelineSection}>
          <span className={styles.timelineLabel}>시간</span>
          <div className={styles.timelineWrap}>
            <div className={styles.timelineRow}>
              <span className={styles.ampm}>오전</span>
              <div className={styles.grid24}>
                {morningSelected.show && (
                  <span className={styles.fillRange}
                    style={{ left: `${morningSelected.left}%`, width: `${morningSelected.width}%` }}
                  />
                )}
              </div>
            </div>
            <div className={styles.timelineRow}>
              <span className={styles.ampm}>오후</span>
              <div className={styles.grid24}>
                {afternoonSelected.show && (
                  <span className={styles.fillRange}
                    style={{ left: `${afternoonSelected.left}%`, width: `${afternoonSelected.width}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.timePickers}>
          <div className={styles.timePicker}>
            <span className={styles.label}>시작시간</span>
            <div className={styles.selectWrap}>
              <select value={start} onChange={(e) => setStart(e.target.value)}>
                {hours.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <img src={chevronDownIcon} alt="" className={styles.selectArrow} />
            </div>
          </div>

          <div className={styles.timePicker}>
            <span className={styles.label}>종료시간</span>
            <div className={styles.selectWrap}>
              <select value={end} onChange={(e) => setEnd(e.target.value)}>
                {hours.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <img src={chevronDownIcon} alt="" className={styles.selectArrow} />
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.blockBtn} onClick={()=>setModalOpen(true)}>예약 막기</button>
          <button className={styles.resetBtn} onClick={handleReset}>초기화</button>
        </div>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              완료
              <button className={styles.modalClose} onClick={()=>setModalOpen(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalTitle}>예약 차단</div>
              <div className={styles.modalText}>
                {`${start} ~ ${end}`} 시간 예약이 차단되었습니다.
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtn} onClick={()=>setModalOpen(false)}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getRowSegment(fromMin, toMin, rowStartH, rowEndH) {
  const rowStart = rowStartH * 60;
  const rowEnd = rowEndH * 60;
  const s = Math.max(fromMin, rowStart);
  const e = Math.min(toMin, rowEnd);
  const w = Math.max(0, e - s);
  if (w <= 0) return { show:false,left:0,width:0 };
  return {
    show:true,
    left: ((s - rowStart) / (rowEnd - rowStart)) * 100,
    width: (w / (rowEnd - rowStart)) * 100
  };
}

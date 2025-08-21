import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./BlockTime.module.css";

import backIcon from "../../assets/chevron.svg";
import chevronDownIcon from "../../assets/down.svg";
import calendarIcon from "../../assets/calendar.svg";
import alertIcon from "../../assets/exclamation-circle.svg";
import instance from "../../lib/axios";

const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

function formatToday() {
  const now = new Date();
  const day = ["일","월","화","수","목","금","토"][now.getDay()];
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${day}요일`;
}

function toIsoTime(hhmm) {
  const [h, m] = (hhmm || "00:00").split(":");
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`;
}

function toHHMM(serverTime) {
  if (!serverTime) return "00:00";
  if (typeof serverTime === "string") {
    const parts = serverTime.split(":");
    return parts.length >= 2 ? `${parts[0].padStart(2,"0")}:${parts[1].padStart(2,"0")}` : "00:00";
  }
  const { hour = 0, minute = 0 } = serverTime;
  return `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
}

function minutesOf(hhmm) {
  if (!hhmm) return null; 
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getRowSegment(fromMin, toMin, rowStartH, rowEndH) {
  if (fromMin == null || toMin == null) return { show:false, left:0, width:0 };
  const rowStart = rowStartH * 60;
  const rowEnd = rowEndH * 60;
  const s = Math.max(fromMin, rowStart);
  const e = Math.min(toMin, rowEnd);
  const w = Math.max(0, e - s);
  if (w <= 0) return { show:false,left:0,width:0 };
  return {
    show: true,
    left: ((s - rowStart) / (rowEnd - rowStart)) * 100,
    width: (w / (rowEnd - rowStart)) * 100,
  };
}

export default function BlockTime() {
  const navigate = useNavigate();

  const cafeId =
    Number(localStorage.getItem("cafe_id")) ||
    Number(localStorage.getItem("cafeId")) ||
    0;

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("AVAILABLE");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMsg, setModalMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!cafeId) {
      setErr("카페 ID를 찾을 수 없어요. (localStorage: cafe_id 또는 cafeId)");
      setLoading(false);
      return;
    }
    fetchAbletime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafeId]);

  const fetchAbletime = async () => {
    try {
      setLoading(true);
      const { data } = await instance.get(`/api/cafe/${cafeId}/abletime`);
      const s = toHHMM(data?.ableStartTime);
      const e = toHHMM(data?.ableEndTime);
      const st = data?.reservationStatus || "AVAILABLE";
      setStatus(st);

      if (st === "AVAILABLE" && s === "00:00" && e === "00:00") {
        setStart("");
        setEnd("");
      } else {
        setStart(s);
        setEnd(e);
      }
      setErr("");
    } catch (e) {
      setErr("예약 가능 시간 정보를 불러오지 못했어요.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selStartMin = minutesOf(start);
  const selEndMin = minutesOf(end);
  const morningSelected = getRowSegment(selStartMin, selEndMin, 0, 12);
  const afternoonSelected = getRowSegment(selStartMin, selEndMin, 12, 24);

  const validateRange = () => {
    if (!cafeId) {
      setErr("카페 ID를 찾을 수 없어요. (localStorage: cafe_id 또는 cafeId)");
      return false;
    }
    if (status === "AVAILABLE") {
      if (!start || !end) {
        setErr("시작/종료 시간을 모두 선택해주세요.");
        return false;
      }
      if (selEndMin <= selStartMin) {
        setErr("종료시간은 시작시간보다 늦어야 해요.");
        return false;
      }
    }
    setErr("");
    return true;
  };

  const handlePrimary = async () => {
    if (status === "AVAILABLE" && !validateRange()) return;
    try {
      setSubmitting(true);
      const nextStatus = status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";
      const body =
        nextStatus === "UNAVAILABLE"
          ? {
              ableStartTime: toIsoTime(start),
              ableEndTime: toIsoTime(end),
              reservationStatus: "UNAVAILABLE",
            }
          : {
              ableStartTime: toIsoTime("00:00"),
              ableEndTime: toIsoTime("00:00"),
              reservationStatus: "AVAILABLE",
            };

      const { data } = await instance.patch(
        `/api/cafe/${cafeId}/abletime/update`,
        body,
        { headers: { "Content-Type": "application/json" } }
      );

      setModalMsg(
        data?.message ||
          (nextStatus === "UNAVAILABLE"
            ? `${start} ~ ${end} 시간 예약이 차단되었습니다.`
            : "예약 차단이 해제되었습니다.")
      );
      setModalOpen(true);

      if (nextStatus === "AVAILABLE") {
        setStart("");
        setEnd("");
      }
      await fetchAbletime();
    } catch (e) {
      setModalMsg("처리에 실패했어요. 잠시 후 다시 시도해주세요.");
      setModalOpen(true);
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    try {
      setSubmitting(true);
      const body = {
        ableStartTime: toIsoTime("00:00"),
        ableEndTime: toIsoTime("00:00"),
        reservationStatus: "AVAILABLE",
      };
      const { data } = await instance.patch(
        `/api/cafe/${cafeId}/abletime/update`,
        body,
        { headers: { "Content-Type": "application/json" } }
      );
      setModalMsg(data?.message || "시간 설정이 모두 초기화되었어요.");
      setModalOpen(true);

      setStatus("AVAILABLE");
      setStart("");
      setEnd("");

      await fetchAbletime();
    } catch (e) {
      setModalMsg("초기화에 실패했어요. 잠시 후 다시 시도해주세요.");
      setModalOpen(true);
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

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

        {loading ? (
          <div className={styles.loading}>불러오는 중...</div>
        ) : (
          <>
            <div className={styles.timelineSection}>
              <span className={styles.timelineLabel}>시간</span>
              <div className={styles.timelineWrap}>
                <div className={styles.timelineRow}>
                  <span className={styles.ampm}>오전</span>
                  <div className={styles.grid24}>
                    {morningSelected.show && (
                      <span
                        className={styles.fillRange}
                        style={{ left: `${morningSelected.left}%`, width: `${morningSelected.width}%` }}
                      />
                    )}
                  </div>
                </div>
                <div className={styles.timelineRow}>
                  <span className={styles.ampm}>오후</span>
                  <div className={styles.grid24}>
                    {afternoonSelected.show && (
                      <span
                        className={styles.fillRange}
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
                  <select
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    disabled={submitting || status === "UNAVAILABLE"}
                  >
                    <option value="">시작 선택</option>
                    {hours.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <img src={chevronDownIcon} alt="" className={styles.selectArrow} />
                </div>
              </div>

              <div className={styles.timePicker}>
                <span className={styles.label}>종료시간</span>
                <div className={styles.selectWrap}>
                  <select
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    disabled={submitting || status === "UNAVAILABLE"}
                  >
                    <option value="">종료 선택</option>
                    {hours.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <img src={chevronDownIcon} alt="" className={styles.selectArrow} />
                </div>
              </div>
            </div>

            {err && <div className={styles.errorText}>{err}</div>}

            <div className={styles.footer}>
              <button className={styles.blockBtn} onClick={handlePrimary} disabled={submitting}>
                {submitting ? "처리 중..." : status === "AVAILABLE" ? "예약 막기" : "차단 해제"}
              </button>
              <button className={styles.resetBtn} onClick={handleReset} disabled={submitting}>
                초기화
              </button>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              완료
              <button className={styles.modalClose} onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalTitle}>예약 차단/해제</div>
              <div className={styles.modalText}>{modalMsg}</div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtn} onClick={() => setModalOpen(false)}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

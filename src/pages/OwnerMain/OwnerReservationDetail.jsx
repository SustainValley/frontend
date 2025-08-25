// src/pages/OwnerReservationDetail/OwnerReservationDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import styles from "./OwnerReservationDetail.module.css";

import backIcon from "../../assets/chevron.svg";
import clockIcon from "../../assets/clock.svg";
import { useAuth } from "../../context/AuthContext";
import instance from "../../lib/axios";

const RESV = { PENDING: "PENDING", APPROVED: "APPROVED", REJECTED: "REJECTED" };
const ATT  = { BEFORE_USE: "BEFORE_USE", IN_USE: "IN_USE", COMPLETED: "COMPLETED" };

// 한국 전화번호 하이픈 포맷터 (010-1234-5678 등)
function formatPhoneKR(raw) {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (d.startsWith("02")) {
    if (d.length === 9) return `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}`;
    if (d.length === 10) return `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6)}`;
  }
  if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  return raw; // 그 외는 원문 유지
}

function getTodayISODate(tzName = "Asia/Seoul") {
  const now = new Date();
  const y = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, year: "numeric" }).format(now);
  const m = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, month: "2-digit" }).format(now);
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, day: "2-digit" }).format(now);
  return `${y}-${m}-${d}`;
}

function toHms(t) {
  if (!t) return "";
  if (typeof t === "string") {
    if (/^\d{2}:\d{2}:\d{2}/.test(t)) return t.slice(0, 8);
    if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
    return t;
  }
  if (typeof t === "object" && t !== null) {
    const hh = String(t.hour ?? 0).padStart(2, "0");
    const mm = String(t.minute ?? 0).padStart(2, "0");
    return `${hh}:${mm}:00`;
  }
  return "";
}

const MEETING_TYPE_LABELS = {
  STUDY: "스터디",
  PROJECT: "프로젝트 회의",
  INTERVIEW: "인터뷰",
  NETWORKING: "네트워킹",
};
const meetingTypeLabel = (code) => MEETING_TYPE_LABELS[code] ?? (code ?? "기타");

/** 취소/거절 사유 코드 -> 라벨 매핑 (실제 전송은 코드 사용) */
const CANCEL_REASON = {
  CLOSED_TIME: "해당 시간대 예약 마감",
  OUT_OF_BUSINESS: "영업시간 외 예약요청",
  CROWDED: "매장 혼잡",
  EQUIPMENT_UNAVAILABLE: "요청 장비 사용 불가",
  MAINTENANCE: "시설 점검",
  PEAK_LIMIT: "피크타임 인원 제한",
};
const REASON_OPTIONS = Object.entries(CANCEL_REASON); // [code, label][]

export default function OwnerReservationDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const { user } = useAuth();

  const targetId = useMemo(() => {
    const qs = new URLSearchParams(location.search);
    const candidates = [
      params.reservationsId,
      params.id,
      qs.get("id"),
      location.state?.reservationsId,
      location.state?.id,
    ]
      .filter((v) => v !== undefined && v !== null)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));
    return candidates[0];
  }, [params, location.search, location.state]);

  const [showModal, setShowModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null); // 코드값
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);

  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showApproveDone, setShowApproveDone] = useState(false);

  const [showSeatedConfirm, setShowSeatedConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [actErr, setActErr] = useState("");
  const [item, setItem] = useState(null); // <- 고객 userId 포함

  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    if (item?.attendanceStatus !== ATT.IN_USE) return;
    setNowTs(Date.now());
    const id = setInterval(() => setNowTs(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [item?.attendanceStatus]);

  const fetchReservation = async () => {
    setLoading(true);
    setLoadErr("");
    try {
      if (!Number.isFinite(targetId)) {
        setLoadErr("잘못된 접근입니다. (예약 ID 없음)");
        setItem(null);
        return;
      }
      const ownerId = (user?.id) || Number(localStorage.getItem("userId") ?? localStorage.getItem("user_id"));
      if (!ownerId) throw new Error("userId를 찾을 수 없어요.");

      const res = await instance.get(`/api/reservation/owner`, { params: { userId: ownerId } });
      const arr = Array.isArray(res.data?.result) ? res.data.result : [];
      const found = arr.find((r) => String(r.reservationsId) === String(targetId));

      if (!found) {
        setLoadErr("해당 예약을 찾을 수 없어요.");
        setItem(null);
        return;
      }

      const userName = found.nickname ?? found.userName ?? "고객";
      const phone = formatPhoneKR(found.phoneNumber ?? found.phone ?? "");

      const date = typeof found.date === "string" ? found.date : getTodayISODate();
      const st = toHms(found.startTime);
      const et = toHms(found.endTime);

      setItem({
        id: Number(found.reservationsId),
        customerUserId: Number(found.userId) || null, // ✅ 고객 userId 보관
        userName,
        phone,
        people: found.peopleCount,
        meetingType: meetingTypeLabel(found.meetingType),
        date,
        start: st ? `${date}T${st}` : undefined,
        end: et ? `${date}T${et}` : undefined,
        timeText: st && et ? `${st.slice(0, 5)}-${et.slice(0, 5)}${et < st ? " (+1일)" : ""}` : "",
        reservationStatus: found.reservationStatus,
        attendanceStatus: found.attendanceStatus,
      });
    } catch (e) {
      console.error(e);
      setLoadErr("예약 정보를 불러오지 못했어요.");
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  // 자정 넘김 보정 포함 진행률/잔여시간 계산
  const getProgressAndRemain = (r, nowMs) => {
    if (!r?.start || !r?.end) return { remain: 0, percent: 0 };
    let start = Date.parse(r.start);
    let end = Date.parse(r.end);
    if (end <= start) end += 24 * 60 * 60 * 1000;

    const now = typeof nowMs === "number" ? nowMs : Date.now();
    const total = Math.max(1, end - start);
    const used = Math.min(Math.max(0, now - start), total);
    const remainMs = end - now;
    const remain = remainMs > 0 ? Math.ceil(remainMs / 60000) : 0;
    const percent = Math.min(100, Math.max(0, Math.round((used / total) * 100)));
    return { remain, percent };
  };

  const mode = useMemo(() => {
    if (!item) return "none";
    if (item.attendanceStatus === ATT.IN_USE) return "inuse";
    if (item.attendanceStatus === ATT.COMPLETED) return "completed";
    if (item.reservationStatus === RESV.PENDING) return "request";
    if (item.reservationStatus === RESV.APPROVED) {
      const isToday = item.date === getTodayISODate();
      return isToday ? "today" : "confirmed";
    }
    return "none";
  }, [item]);

  const updateReservationStatus = async ({ id, status }) => {
    setActErr("");
    try {
      await instance.patch(
        `/api/reservation/owner/update`,
        { reservationsId: id, reservationStatus: status },
        { headers: { "Content-Type": "application/json" } }
      );
      await fetchReservation();
      return true;
    } catch (e) {
      console.error(e);
      setActErr("처리 중 오류가 발생했어요.");
      return false;
    }
  };

  const updateAttendance = async ({ id, attendance }) => {
    setActErr("");
    try {
      await instance.patch(`/api/reservation/owner/today/${id}`, null, {
        params: { attendance },
        headers: { "Content-Type": "application/json" },
      });
      await fetchReservation();
      return true;
    } catch (e) {
      console.error(e);
      setActErr("처리 중 오류가 발생했어요.");
      return false;
    }
  };

  /** ✔ 거절/취소: 고객 userId로 삭제 엔드포인트 호출 */
  const deleteReservationWithReason = async ({ id, reasonCode }) => {
    setActErr("");
    try {
      const customerId = item?.customerUserId;
      if (!customerId) throw new Error("예약 고객 userId를 찾을 수 없어요.");
      await instance.patch(
        `/api/reservation/delete/${id}`,
        { cancelReason: reasonCode },
        {
          params: { userId: customerId }, // ✅ 고객 userId 전송
          headers: { "Content-Type": "application/json" },
        }
      );
      return true;
    } catch (e) {
      console.error(e);
      setActErr("처리 중 오류가 발생했어요.");
      return false;
    }
  };

  const doReject = async () => {
    if (!item) return;
    if (!selectedReason) {
      setActErr("취소(거절) 사유를 선택해주세요.");
      return;
    }
    const ok = await deleteReservationWithReason({ id: item.id, reasonCode: selectedReason });
    if (ok) setShowDoneModal(true);
  };

  const doApprove = async () => {
    if (!item) return;
    const ok = await updateReservationStatus({ id: item.id, status: RESV.APPROVED });
    if (ok) setShowApproveDone(true);
  };

  const doSeated = async () => {
    if (!item) return;
    await updateAttendance({ id: item.id, attendance: ATT.IN_USE });
  };

  const doComplete = async () => {
    if (!item) return;
    await updateAttendance({ id: item.id, attendance: ATT.COMPLETED });
  };

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="뒤로가기">
          <img src={backIcon} alt="뒤로" />
        </button>
        <span className={styles.title}>실시간 예약 확인하기</span>
      </div>
      <p className={styles.value} style={{ padding: "16px" }}>불러오는 중…</p>
    </div>
  );

  if (loadErr || !item) return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="뒤로가기">
          <img src={backIcon} alt="뒤로" />
        </button>
        <span className={styles.title}>실시간 예약 확인하기</span>
      </div>
      <p className={styles.value} style={{ padding: "16px" }}>{loadErr || "예약을 찾을 수 없어요."}</p>
    </div>
  );

  const isInUse = item.attendanceStatus === ATT.IN_USE;
  const { remain, percent } = isInUse ? getProgressAndRemain(item, nowTs) : { remain: 0, percent: 0 };
  const isTimeout = isInUse && remain <= 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="뒤로가기">
          <img src={backIcon} alt="뒤로" />
        </button>
        <span className={styles.title}>실시간 예약 확인하기</span>
      </div>

      {actErr && <p className={styles.value} style={{ color:"#d00", padding:"8px 16px" }}>{actErr}</p>}

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>예약자 정보</h3>
        <div className={styles.row}>
          <span className={styles.label}>이름</span>
          <span className={styles.value}>{item.userName}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>전화번호</span>
          <span className={styles.value}>{item.phone || "-"}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>회의 인원</span>
          <span className={styles.value}>{item.people}명</span>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>회의 종류</h3>
        <div className={styles.row}>
          <span className={styles.value}>{item.meetingType}</span>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>예약 일정</h3>
        <div className={styles.row}>
          <span className={styles.label}>날짜</span>
          <span className={styles.value}>{item.date}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>시간</span>
          <span className={styles.value}>{item.timeText}</span>
        </div>
      </div>

      <div className={`${styles.section} ${isInUse ? "" : styles.noBorder}`}>
        <h3 className={styles.sectionTitle}>회의 인원</h3>
        <div className={styles.row}>
          <span className={styles.value}>{item.people} 명</span>
        </div>
      </div>

      {isInUse && (
        <div className={`${styles.section} ${styles.noBorder}`}>
          <h3 className={styles.sectionTitle}>남은 시간</h3>

          <div className={styles.remainCard}>
            <div className={styles.remainHeader}>
              <img src={clockIcon} alt="" aria-hidden className={styles.remainIcon} />
              <span className={`${isTimeout ? styles.remainRed : styles.remainBlue}`}>
                {isTimeout ? "0 분" : `${remain} 분`}
              </span>
            </div>

            <div className={`${styles.remainTrack} ${isTimeout ? styles.remainTrackRed : styles.remainTrackBlue}`}>
              <div
                className={`${styles.remainFill} ${isTimeout ? styles.remainFillRed : styles.remainFillGreen}`}
                style={{ width: `${isTimeout ? 100 : percent}%` }}
              />
            </div>

            {isTimeout && <p className={styles.remainNote}>고객에게 이용 완료 안내를 해주세요!</p>}
          </div>
        </div>
      )}

      {mode === "request" && (
        <div className={styles.btnWrap}>
          <button className={styles.rejectBtn} onClick={() => setShowModal(true)}>거절하기</button>
          <button className={styles.approveBtn} onClick={() => setShowApproveConfirm(true)}>승인하기</button>
        </div>
      )}

      {(mode === "confirmed" || mode === "today") && (
        <div className={styles.btnWrap}>
          <button className={styles.rejectBtn} onClick={() => setShowModal(true)}>취소하기</button>
          <button className={styles.approveBtn} onClick={() => setShowSeatedConfirm(true)}>착석</button>
        </div>
      )}

      {mode === "inuse" && (
        <div className={styles.btnWrap}>
          <button className={styles.approveBtn} onClick={doComplete}>
            이용 완료
          </button>
        </div>
      )}

      {mode === "completed" && (
        <div className={styles.btnWrap}>
          <button
            className={styles.approveBtn}
            disabled
            style={{ background: "#e6f6ee", color: "#0f766e", border: "1px solid #99f6e4" }}
          >
            ✓ 이용 완료
          </button>
        </div>
      )}

      {/* ---- 취소/거절 사유 선택 모달 (코드 선택, 라벨 표시) ---- */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>예약 취소 사유</span>
              <button
                className={styles.closeBtn}
                onClick={() => { setShowModal(false); setSelectedReason(null); }}
              >✕</button>
            </div>
            <ul className={styles.reasonList}>
              {REASON_OPTIONS.map(([code, label]) => (
                <li
                  key={code}
                  className={selectedReason === code ? styles.selectedReason : ""}
                  onClick={() => setSelectedReason(code)}
                >
                  {label}
                </li>
              ))}
            </ul>
            {selectedReason && (
              <button className={styles.cancelBtn} onClick={() => setShowConfirmModal(true)}>
                {mode === "request" ? "예약 거절하기" : "예약 취소하기"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ---- 최종 확인 모달 ---- */}
      {showConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p>{mode === "request" ? "예약을 거절하시겠어요?" : "예약을 취소하시겠어요?"}</p>
            <div className={styles.confirmBtns}>
              <button onClick={() => setShowConfirmModal(false)} className={styles.rejectBtn}>아니요</button>
              <button
                onClick={async () => {
                  setShowConfirmModal(false);
                  setShowModal(false);
                  await doReject();
                }}
                className={styles.approveBtn}
              >네</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- 처리 완료 모달 ---- */}
      {showDoneModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p className={styles.doneText}>{mode === "request" ? "예약이 거절되었습니다." : "예약이 취소되었습니다."}</p>
            <div className={styles.confirmBtns}>
              <button
                onClick={() => {
                  setShowDoneModal(false);
                  navigate(`/owner/reservations?tab=${mode === "request" ? "request" : "confirmed"}`);
                }}
                className={styles.approveBtn}
              >확인</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- 승인 확인/완료 모달 ---- */}
      {showApproveConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p>예약을 승인하시겠어요?</p>
            <div className={styles.confirmBtns}>
              <button onClick={() => setShowApproveConfirm(false)} className={styles.rejectBtn}>아니요</button>
              <button
                onClick={async () => { setShowApproveConfirm(false); await doApprove(); }}
                className={styles.approveBtn}
              >네</button>
            </div>
          </div>
        </div>
      )}

      {showApproveDone && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p className={styles.doneText}>예약이 승인되었습니다.</p>
            <div className={styles.confirmBtns}>
              <button
                onClick={() => {
                  setShowApproveDone(false);
                  fetchReservation();
                }}
                className={styles.approveBtn}
              >확인</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- 착석 확인 모달 ---- */}
      {showSeatedConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p>착석 처리하시겠어요?</p>
            <div className={styles.confirmBtns}>
              <button onClick={() => setShowSeatedConfirm(false)} className={styles.rejectBtn}>아니요</button>
              <button
                onClick={async () => { setShowSeatedConfirm(false); await doSeated(); }}
                className={styles.approveBtn}
              >네</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

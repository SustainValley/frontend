import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import styles from "./OwnerReservationDetail.module.css";

import backIcon from "../../assets/chevron.svg";
import clockIcon from "../../assets/clock.svg"; // 남은 시간 아이콘
import { useAuth } from "../../context/AuthContext";
import instance from "../../lib/axios";

// 서버 상태값 상수
const RESV = { PENDING: "PENDING", APPROVED: "APPROVED", REJECTED: "REJECTED" };
const ATT  = { BEFORE_USE: "BEFORE_USE", IN_USE: "IN_USE", COMPLETED: "COMPLETED" };

// "YYYY-MM-DD"
function getTodayISODate(tzName = "Asia/Seoul") {
  const now = new Date();
  const y = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, year: "numeric" }).format(now);
  const m = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, month: "2-digit" }).format(now);
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, day: "2-digit" }).format(now);
  return `${y}-${m}-${d}`;
}

// HH:mm[:ss] → HH:mm:ss
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

const meetingTypeLabel = (code) => {
  switch (code) {
    case "STUDY": return "스터디";
    case "PROJECT": return "프로젝트 회의";
    case "INTERVIEW": return "인터뷰";
    default: return code ?? "기타";
  }
};

export default function OwnerReservationDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const { user } = useAuth();

  // 여러 경로에서 ID 회수
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

  // UI 상태
  const [showModal, setShowModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);

  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showApproveDone, setShowApproveDone] = useState(false);

  const [showSeatedConfirm, setShowSeatedConfirm] = useState(false);

  // 데이터 상태
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [actErr, setActErr] = useState("");
  const [item, setItem] = useState(null); // 선택된 예약 1건

  // 남은시간/진행바 갱신용(10초)
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    if (item?.attendanceStatus !== ATT.IN_USE) return;
    setNowTs(Date.now());
    const id = setInterval(() => setNowTs(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [item?.attendanceStatus]);

  const cancelReasons = [
    "해당 시간대 예약 마감",
    "영업시간 외 예약요청",
    "매장 혼잡",
    "요청 장비 사용 불가",
    "시설 점검",
    "피크타임 인원제한",
    "고객 노쇼",
  ];

  const getUserId = () => {
    if (user?.id) return user.id;
    const ls = localStorage.getItem("userId") ?? localStorage.getItem("user_id");
    if (ls && !Number.isNaN(Number(ls))) return Number(ls);
    return null;
  };

  // ===== 목록에서 해당 예약만 찾아오기 =====
  const fetchReservation = async () => {
    setLoading(true);
    setLoadErr("");
    try {
      if (!Number.isFinite(targetId)) {
        setLoadErr("잘못된 접근입니다. (예약 ID 없음)");
        setItem(null);
        return;
      }
      const uid = getUserId();
      if (!uid) throw new Error("userId를 찾을 수 없어요.");

      const res = await instance.get(`/api/reservation/owner`, { params: { userId: uid } });
      const arr = Array.isArray(res.data?.result) ? res.data.result : [];
      const found = arr.find((r) => String(r.reservationsId) === String(targetId));

      if (!found) {
        setLoadErr("해당 예약을 찾을 수 없어요.");
        setItem(null);
        return;
      }

      const date = typeof found.date === "string" ? found.date : getTodayISODate();
      const st = toHms(found.startTime);
      const et = toHms(found.endTime);

      setItem({
        id: Number(found.reservationsId),
        userName: found.userName ?? "고객",
        phone: "", // 백엔드에 없으므로 비워둠
        people: found.peopleCount,
        meetingType: meetingTypeLabel(found.meetingType),
        date,
        start: st ? `${date}T${st}` : undefined,
        end: et ? `${date}T${et}` : undefined,
        timeText: st && et ? `${st.slice(0, 5)}-${et.slice(0, 5)}` : "",
        reservationStatus: found.reservationStatus,   // PENDING | APPROVED | REJECTED
        attendanceStatus: found.attendanceStatus,     // BEFORE_USE | IN_USE | COMPLETED
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

  // ===== 진행률/남은시간 계산 =====
  const getProgressAndRemain = (r, nowMs) => {
    if (!r?.start || !r?.end) return { remain: 0, percent: 0 };
    const start = Date.parse(r.start);
    const end = Date.parse(r.end);
    const now = typeof nowMs === "number" ? nowMs : Date.now();
    const total = Math.max(1, end - start);
    const used = Math.min(Math.max(0, now - start), total);
    const remainMs = end - now;
    const remain = remainMs > 0 ? Math.ceil(remainMs / 60000) : 0;
    const percent = Math.min(100, Math.max(0, Math.round((used / total) * 100)));
    return { remain, percent };
  };

  // ===== 버튼 모드 결정 =====
  const mode = useMemo(() => {
    if (!item) return "none";
    if (item.attendanceStatus === ATT.IN_USE) return "inuse";        // 이용 중 → ‘이용 완료’만
    if (item.attendanceStatus === ATT.COMPLETED) return "completed"; // 완료 표시만
    if (item.reservationStatus === RESV.PENDING) return "request";   // 거절/승인
    if (item.reservationStatus === RESV.APPROVED) {
      const isToday = item.date === getTodayISODate();
      return isToday ? "today" : "confirmed"; // 취소/착석
    }
    return "none";
  }, [item]);

  // ===== 액션 API =====
  const updateReservationStatus = async ({ id, status }) => {
    setActErr("");
    try {
      await instance.patch(
        `/api/reservation/owner/update`,
        { reservationsId: id, reservationStatus: status }, // APPROVED | REJECTED
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
        params: { attendance }, // BEFORE_USE | IN_USE | COMPLETED
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

  // ===== 버튼 핸들러 =====
  const doReject = async () => {
    if (!item) return;
    const ok = await updateReservationStatus({ id: item.id, status: RESV.REJECTED });
    if (ok) setShowDoneModal(true);
  };

  const doApprove = async () => {
    if (!item) return;
    const ok = await updateReservationStatus({ id: item.id, status: RESV.APPROVED });
    if (ok) setShowApproveDone(true);
  };

  const doSeated = async () => {
    if (!item) return;
    // 확정 상태에서 '착석' → IN_USE
    await updateAttendance({ id: item.id, attendance: ATT.IN_USE });
  };

  const doComplete = async () => {
    if (!item) return;
    // 이용 완료 → COMPLETED (모달 없이 즉시 처리 & UI 전환)
    await updateAttendance({ id: item.id, attendance: ATT.COMPLETED });
  };

  // ===== 렌더 =====
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

      {/* 회의 인원: 기본은 마지막 섹션이라 보더 제거, IN_USE 때는 보더 표시 */}
      <div className={`${styles.section} ${isInUse ? "" : styles.noBorder}`}>
        <h3 className={styles.sectionTitle}>회의 인원</h3>
        <div className={styles.row}>
          <span className={styles.value}>{item.people} 명</span>
        </div>
      </div>

      {/* 남은 시간 카드 (IN_USE일 때만, 마지막 섹션이므로 noBorder) */}
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

      {/* ===== 상태에 따라 버튼 영역 ===== */}
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

      {/* 이용 중(IN_USE): ‘이용 완료’ 한 개만 */}
      {mode === "inuse" && (
        <div className={styles.btnWrap}>
          <button className={styles.approveBtn} onClick={doComplete}>
            이용 완료
          </button>
        </div>
      )}

      {/* 완료 상태(COMPLETED): 버튼 회색 + 체크, 비활성 */}
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

      {/* ====== 취소 사유 선택 모달 (UI만, 서버엔 REJECTED만 전송) ====== */}
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
              {cancelReasons.map((reason, idx) => (
                <li key={idx}
                    className={selectedReason === reason ? styles.selectedReason : ""}
                    onClick={() => setSelectedReason(reason)}>
                  {reason}
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

      {/* 취소/거절 최종 확인 */}
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
                  await doReject(); // REJECTED
                }}
                className={styles.approveBtn}
              >네</button>
            </div>
          </div>
        </div>
      )}

      {/* 취소/거절 완료 */}
      {showDoneModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p className={styles.doneText}>{mode === "request" ? "예약이 거절되었습니다." : "예약이 취소되었습니다."}</p>
            <div className={styles.confirmBtns}>
              <button
                onClick={() => {
                  setShowDoneModal(false);
                  navigate("/owner/reservations?tab=request");
                }}
                className={styles.approveBtn}
              >확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 승인 확인 */}
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

      {/* 착석 확인 (확정/오늘에서만) */}
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

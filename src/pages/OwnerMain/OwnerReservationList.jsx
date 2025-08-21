// src/pages/OwnerMain/OwnerReservationList.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./OwnerReservationList.module.css";

import backIcon from "../../assets/chevron.svg";
import peopleIcon from "../../assets/people.svg";
import calendarIcon from "../../assets/calendar.svg";
import clockIcon from "../../assets/clock.svg";

import { useAuth } from "../../context/AuthContext";
import instance from "../../lib/axios";

const tz = "Asia/Seoul";
const todayStr = new Intl.DateTimeFormat("ko-KR", {
  timeZone: tz,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
  .format(new Date())
  .replace(/\./g, "-")
  .replace(/\s/g, "")
  .replace(/-$/g, "");

// "YYYY-MM-DD" (타임존 고려)
function getTodayISODate(tzName = "Asia/Seoul") {
  const now = new Date();
  const y = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, year: "numeric" }).format(now);
  const m = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, month: "2-digit" }).format(now);
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, day: "2-digit" }).format(now);
  return `${y}-${m}-${d}`;
}

// HH:mm[:ss] → HH:mm:ss 로 표준화
const toHms = (t) => {
  if (!t) return "";
  if (typeof t === "string") {
    if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;      // 이미 HH:mm:ss
    if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;    // HH:mm → HH:mm:ss
    return t.slice(0, 8);                              // 혹시 모를 이상 포맷 방어
  }
  if (typeof t === "object" && t !== null) {
    const hh = String(t.hour ?? 0).padStart(2, "0");
    const mm = String(t.minute ?? 0).padStart(2, "0");
    const ss = String(t.second ?? 0).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return "";
};

// 서버 상태값 상수
const RESV = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

const ATT = {
  BEFORE_USE: "BEFORE_USE",
  IN_USE: "IN_USE",
  COMPLETED: "COMPLETED",
};

const OwnerReservationList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("today"); // request | confirmed | today
  const [todayTab, setTodayTab] = useState("using");   // before | using | done

  const [showModal, setShowModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);

  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showApproveDone, setShowApproveDone] = useState(false);

  const [showSeatedConfirm, setShowSeatedConfirm] = useState(false);
  const [showSeatedDone, setShowSeatedDone] = useState(false);

  const [actionTarget, setActionTarget] = useState(null);

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [actErr, setActErr] = useState("");

  // 진행바/남은시간 실시간 갱신용 타임스탬프 (10초마다 업데이트)
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    if (!(activeTab === "today" && todayTab === "using")) return;
    setNowTs(Date.now()); // 탭 진입 즉시 갱신
    const id = setInterval(() => setNowTs(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [activeTab, todayTab]);

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

  // API → 내부 표준 형태로 매핑
  const mapApiItem = (it) => {
    const date = typeof it.date === "string" ? it.date : getTodayISODate();

    const st = toHms(it.startTime);
    const et = toHms(it.endTime);

    const timeText = st && et ? `${st.slice(0, 5)}-${et.slice(0, 5)}` : "";

    // 예약 상태 매핑 (PENDING/APPROVED/REJECTED)
    const status =
      it.reservationStatus === RESV.PENDING
        ? "request"
        : it.reservationStatus === RESV.APPROVED
        ? "confirmed"
        : "other";

    // 이용 상태 매핑 (BEFORE_USE/IN_USE/COMPLETED)
    let todayStatus = undefined;
    if (it.attendanceStatus === ATT.BEFORE_USE) todayStatus = "before";
    else if (it.attendanceStatus === ATT.IN_USE) todayStatus = "using";
    else if (it.attendanceStatus === ATT.COMPLETED) todayStatus = "done";

    return {
      id: it.reservationsId, // ✅ 서버 키: reservationsId
      name: it.userName ?? "고객",
      phone: "",
      people: it.peopleCount,
      date,
      time: timeText,
      status,       // request | confirmed | other
      todayStatus,  // before | using | done
      start: st ? `${date}T${st}` : undefined, // 절대 ":00" 추가하지 않음!
      end: et ? `${date}T${et}` : undefined,
      raw: it,
    };
  };

  const fetchReservations = async () => {
    setLoading(true);
    setLoadErr("");
    try {
      const uid = getUserId();
      if (!uid) throw new Error("userId를 찾을 수 없어요.");
      const res = await instance.get(`/api/reservation/owner`, { params: { userId: uid } });
      const arr = Array.isArray(res.data?.result) ? res.data.result : [];
      const mapped = arr.map(mapApiItem);
      setReservations(mapped);
    } catch (err) {
      console.error(err);
      setLoadErr("예약 목록을 불러오지 못했어요.");
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 쿼리 → 상태 초기화/동기화
  useEffect(() => {
    const tab = searchParams.get("tab");
    const sub = searchParams.get("sub");

    if (tab === "request" || tab === "confirmed" || tab === "today") {
      setActiveTab(tab);
    }
    if (tab === "today" && (sub === "before" || sub === "using" || sub === "done")) {
      setTodayTab(sub);
    }
  }, [searchParams]);

  // 탭 변경 시 URL 동기화
  const goTab = (tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    if (tab !== "today") params.delete("sub");
    setSearchParams(params);
  };

  const goSub = (sub) => {
    setTodayTab(sub);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "today");
    params.set("sub", sub);
    setSearchParams(params);
  };

  // "오늘 예약" 필터: 오늘 날짜 + APPROVED(=confirmed)만
  const todayISO = getTodayISODate(tz);

  const computedList = useMemo(() => {
    if (activeTab === "request") {
      return reservations.filter((r) => r.status === "request");
    }
    if (activeTab === "confirmed") {
      return reservations.filter((r) => r.status === "confirmed");
    }
    // today
    return reservations.filter(
      (r) => r.status === "confirmed" && r.date === todayISO && r.todayStatus === todayTab
    );
  }, [reservations, activeTab, todayTab, todayISO]);

  // 진행률/남은시간 계산 (nowMs 전달)
  const getProgressAndRemain = (r, nowMs) => {
    if (!r.start || !r.end) return { remain: 0, percent: 0 };
    const start = Date.parse(r.start);
    const end = Date.parse(r.end);
    if (Number.isNaN(start) || Number.isNaN(end)) return { remain: 0, percent: 0 };

    const now = typeof nowMs === "number" ? nowMs : Date.now();
    const total = Math.max(1, end - start);
    const used = Math.min(Math.max(0, now - start), total);
    const remainMs = Math.max(0, end - now);

    const remain = Math.round(remainMs / 60000);
    const percent = Math.min(100, Math.max(0, Math.round((used / total) * 100)));
    return { remain, percent };
  };

  // ===== 예약 상태 업데이트 (승인/거절) =====
  const updateReservationStatus = async ({ id, status }) => {
    setActErr("");
    try {
      const payload = {
        reservationsId: id,
        reservationStatus: status, // "APPROVED" | "REJECTED"
      };
      await instance.patch(`/api/reservation/owner/update`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      await fetchReservations();
      return true;
    } catch (e) {
      console.error(e);
      setActErr("처리 중 오류가 발생했어요.");
      return false;
    }
  };

  // ===== 이용 상태 업데이트 (착석/완료 등) =====
  // PATCH /api/reservation/owner/today/{reservationId}?attendance=BEFORE_USE|IN_USE|COMPLETED
  const updateAttendance = async ({ id, attendance }) => {
    setActErr("");
    try {
      await instance.patch(`/api/reservation/owner/today/${id}`, null, {
        params: { attendance }, // 쿼리스트링로 전달
        headers: { "Content-Type": "application/json" },
      });
      await fetchReservations();
      return true;
    } catch (e) {
      console.error(e);
      setActErr("처리 중 오류가 발생했어요.");
      return false;
    }
  };

  // ===== 취소(=거절) 실행 (요청/확정 공통) =====
  const doCancel = async () => {
    if (!actionTarget) return;
    const ok = await updateReservationStatus({
      id: actionTarget,
      status: RESV.REJECTED,
    });
    if (ok) setShowDoneModal(true);
  };

  // ===== 승인 실행 (요청 탭) =====
  const doApprove = async () => {
    if (!actionTarget) return;
    const ok = await updateReservationStatus({
      id: actionTarget,
      status: RESV.APPROVED,
    });
    if (ok) setShowApproveDone(true);
  };

  // ===== 착석 실행 (확정/오늘 before 탭) → IN_USE
  const doSeated = async () => {
    if (!actionTarget) return;
    const ok = await updateAttendance({
      id: actionTarget,
      attendance: ATT.IN_USE,
    });
    if (ok) setShowSeatedDone(true);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate("/owner/home")} aria-label="홈으로 이동">
          <img src={backIcon} alt="뒤로" />
        </button>
        <span className={styles.title}>실시간 예약 확인하기</span>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "request" ? styles.active : ""}`}
          onClick={() => goTab("request")}
        >
          예약 요청
        </button>
        <button
          className={`${styles.tab} ${activeTab === "confirmed" ? styles.active : ""}`}
          onClick={() => goTab("confirmed")}
        >
          확정 예약
        </button>
        <button
          className={`${styles.tab} ${activeTab === "today" ? styles.active : ""}`}
          onClick={() => goTab("today")}
        >
          오늘 예약
        </button>
      </div>

      {activeTab === "today" && (
        <div className={styles.subTabs}>
          <button
            className={`${styles.subTab} ${todayTab === "before" ? styles.subActive : ""}`}
            onClick={() => goSub("before")}
          >
            이용 전
          </button>
          <button
            className={`${styles.subTab} ${todayTab === "using" ? styles.subActive : ""}`}
            onClick={() => goSub("using")}
          >
            이용 중
          </button>
          <button
            className={`${styles.subTab} ${todayTab === "done" ? styles.subActive : ""}`}
            onClick={() => goSub("done")}
          >
            이용 완료
          </button>
        </div>
      )}

      <div className={styles.list}>
        {loading ? (
          <p className={styles.emptyText}>불러오는 중…</p>
        ) : loadErr ? (
          <p className={styles.emptyText}>{loadErr}</p>
        ) : actErr ? (
          <p className={styles.emptyText}>{actErr}</p>
        ) : computedList.length === 0 ? (
          <p className={styles.emptyText}>예약이 없습니다.</p>
        ) : (
          computedList.map((r) => {
            const { remain, percent } =
              activeTab === "today" && todayTab === "using" ? getProgressAndRemain(r, nowTs) : { remain: 0, percent: 0 };
            const isTimeOut = activeTab === "today" && todayTab === "using" && remain <= 0;

            return (
              <div
                key={r.id}
                className={`${styles.card} ${activeTab === "today" && todayTab === "done" ? styles.cardDone : ""}`}
                onClick={() => navigate(`/owner/reservation/${r.id}`)}
              >
                <div className={styles.topRow}>
                  <div className={styles.nameRow}>
                    <span className={styles.name}>{r.name}</span>
                    {r.phone ? <span className={styles.phone}>{r.phone}</span> : null}
                  </div>

                  {activeTab === "today" && todayTab === "using" && (
                    <div className={styles.remainBox}>
                      <span className={styles.remainLabel}>남은 시간</span>
                      <div className={`${styles.badge} ${isTimeOut ? styles.badgeRed : styles.badgeBlue}`}>
                        {isTimeOut ? "0 분" : `${remain} 분`}
                      </div>
                    </div>
                  )}

                  {activeTab === "today" && todayTab === "done" && <div className={styles.doneCheck}>✓</div>}
                </div>

                <div className={styles.infoRow}>
                  <img src={peopleIcon} alt="인원" className={styles.icon} />
                  <span>{r.people}명</span>
                </div>
                <div className={styles.infoRow}>
                  <img src={calendarIcon} alt="날짜" className={styles.icon} />
                  <span>{r.date}</span>
                </div>
                <div className={styles.infoRow}>
                  <img src={clockIcon} alt="시간" className={styles.icon} />
                  <span>{r.time}</span>
                </div>

                {activeTab === "request" && (
                  <div className={styles.btnWrap} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => {
                        setActionTarget(r.id);
                        setShowModal(true);
                      }}
                    >
                      거절
                    </button>
                    <button
                      className={styles.approveBtn}
                      onClick={() => {
                        setActionTarget(r.id);
                        setShowApproveConfirm(true);
                      }}
                    >
                      승인
                    </button>
                  </div>
                )}

                {activeTab === "confirmed" && (
                  <div className={styles.btnWrap} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => {
                        setActionTarget(r.id);
                        setShowModal(true);
                      }}
                    >
                      취소하기
                    </button>
                    <button
                      className={styles.blackBtn}
                      onClick={() => {
                        setActionTarget(r.id);
                        setShowSeatedConfirm(true);
                      }}
                    >
                      착석
                    </button>
                  </div>
                )}

                {activeTab === "today" && todayTab === "before" && (
                  <div className={styles.btnWrap} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => {
                        setActionTarget(r.id);
                        setShowModal(true);
                      }}
                    >
                      취소하기
                    </button>
                    <button
                      className={styles.blackBtn}
                      onClick={() => {
                        setActionTarget(r.id);
                        setShowSeatedConfirm(true);
                      }}
                    >
                      착석
                    </button>
                  </div>
                )}

                {activeTab === "today" && todayTab === "using" && (
                  <>
                    <div className={styles.progressTrack}>
                      <div
                        className={`${styles.progressFill} ${isTimeOut ? styles.progressRed : styles.progressGreen}`}
                        style={{ width: `${isTimeOut ? 100 : percent}%` }}
                      />
                    </div>
                    {isTimeOut && <p className={styles.notice}>고객에게 이용 완료 안내를 해주세요!</p>}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 취소 사유 모달 (UI만, 서버엔 REJECTED만 전송) */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>예약 취소 사유</span>
              <button
                className={styles.closeBtn}
                onClick={() => {
                  setShowModal(false);
                  setSelectedReason(null);
                }}
              >
                ✕
              </button>
            </div>
            <ul className={styles.reasonList}>
              {cancelReasons.map((reason, idx) => (
                <li
                  key={idx}
                  className={selectedReason === reason ? styles.selectedReason : ""}
                  onClick={() => setSelectedReason(reason)}
                >
                  {reason}
                </li>
              ))}
            </ul>
            {selectedReason && (
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  setShowConfirmModal(true);
                }}
              >
                예약 취소하기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 취소 최종 확인 */}
      {showConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p>예약을 취소하시겠어요?</p>
            <div className={styles.confirmBtns}>
              <button onClick={() => setShowConfirmModal(false)} className={styles.rejectBtn}>
                아니요
              </button>
              <button
                onClick={async () => {
                  setShowConfirmModal(false);
                  setShowModal(false);
                  await doCancel(); // REJECTED로 전송
                }}
                className={styles.approveBtn}
              >
                네
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 취소 완료 안내 */}
      {showDoneModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p className={styles.doneText}>예약이 취소되었습니다.</p>
            <div className={styles.confirmBtns}>
              <button
                onClick={() => {
                  setShowDoneModal(false);
                  setSelectedReason(null);
                  navigate("/owner/reservations?tab=request");
                }}
                className={styles.approveBtn}
              >
                확인
              </button>
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
              <button onClick={() => setShowApproveConfirm(false)} className={styles.rejectBtn}>
                아니요
              </button>
              <button
                onClick={async () => {
                  setShowApproveConfirm(false);
                  await doApprove(); // APPROVED 전송
                }}
                className={styles.approveBtn}
              >
                네
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 승인 완료 안내 */}
      {showApproveDone && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p className={styles.doneText}>예약이 승인되었습니다.</p>
            <div className={styles.confirmBtns}>
              <button
                onClick={() => {
                  setShowApproveDone(false);
                  navigate("/owner/reservations?tab=confirmed");
                }}
                className={styles.approveBtn}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 착석 확인 */}
      {showSeatedConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p>착석 처리하시겠어요?</p>
            <div className={styles.confirmBtns}>
              <button onClick={() => setShowSeatedConfirm(false)} className={styles.rejectBtn}>
                아니요
              </button>
              <button
                onClick={async () => {
                  setShowSeatedConfirm(false);
                  await doSeated(); // IN_USE로 전송
                }}
                className={styles.approveBtn}
              >
                네
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 착석 완료 안내 */}
      {showSeatedDone && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p className={styles.doneText}>착석 처리되었습니다.</p>
            <div className={styles.confirmBtns}>
              <button
                onClick={() => {
                  setShowSeatedDone(false);
                  navigate("/owner/reservations?tab=today&sub=using");
                }}
                className={styles.approveBtn}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerReservationList;

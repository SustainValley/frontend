// src/pages/OwnerReservationList/OwnerReservationList.jsx
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

function getTodayISODate(tzName = "Asia/Seoul") {
  const now = new Date();
  const y = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, year: "numeric" }).format(now);
  const m = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, month: "2-digit" }).format(now);
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: tzName, day: "2-digit" }).format(now);
  return `${y}-${m}-${d}`;
}

function normalizeYMD(input) {
  if (!input) return getTodayISODate(tz);
  if (typeof input !== "string") return getTodayISODate(tz);

  const m = input.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const mm = String(m[2]).padStart(2, "0");
    const dd = String(m[3]).padStart(2, "0");
    return `${m[1]}-${mm}-${dd}`;
  }

  const m2 = input.match(/^(\d{4})[.](\d{1,2})[.](\d{1,2})/);
  if (m2) {
    const mm = String(m2[2]).padStart(2, "0");
    const dd = String(m2[3]).padStart(2, "0");
    return `${m2[1]}-${mm}-${dd}`;
  }

  return getTodayISODate(tz);
}

const toHms = (t) => {
  if (!t) return "";
  if (typeof t === "string") {
    if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
    if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
    return t.slice(0, 8);
  }
  if (typeof t === "object" && t !== null) {
    const hh = String(t.hour ?? 0).padStart(2, "0");
    const mm = String(t.minute ?? 0).padStart(2, "0");
    const ss = String(t.second ?? 0).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return "";
};

const RESV = { PENDING: "PENDING", APPROVED: "APPROVED", REJECTED: "REJECTED" };
const ATT  = { BEFORE_USE: "BEFORE_USE", IN_USE: "IN_USE", COMPLETED: "COMPLETED" };

/** 취소/거절 사유 코드 -> 라벨 (전송은 코드 사용) */
const CANCEL_REASON = {
  CLOSED_TIME: "해당 시간대 예약 마감",
  OUT_OF_BUSINESS: "영업시간 외 예약요청",
  CROWDED: "매장 혼잡",
  EQUIPMENT_UNAVAILABLE: "요청 장비 사용 불가",
  MAINTENANCE: "시설 점검",
  PEAK_LIMIT: "피크타임 인원제한",
};
const REASON_OPTIONS = Object.entries(CANCEL_REASON); // [code, label][]

/** 오늘 탭 표시 상태 계산: 시간 기준 + attendance 보정(되돌림 없음) */
function deriveTodayStatus({ date, startHms, endHms, attendance }) {
  if (!date) return undefined;
  const today = getTodayISODate(tz);
  if (date !== today) return undefined;

  const start = startHms ? Date.parse(`${date}T${startHms}`) : NaN;
  const end   = endHms   ? Date.parse(`${date}T${endHms}`)   : NaN;

  let base;
  if (Number.isNaN(start) || Number.isNaN(end)) {
    base = "before";
  } else {
    const now = Date.now();
    if (now < start) base = "before";
    else if (now <= end) base = "using";
    else base = "done";
  }

  if (attendance === ATT.COMPLETED) return "done";
  if (attendance === ATT.IN_USE) return base === "done" ? "done" : "using";
  if (attendance === ATT.BEFORE_USE) return base;

  return base;
}

const OwnerReservationList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("today"); // "request" | "confirmed" | "today"
  const [todayTab, setTodayTab] = useState("using");   // "before" | "using" | "done"

  // ----- 모달/액션 상태 -----
  const [showModal, setShowModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null); // 코드
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);

  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showApproveDone, setShowApproveDone] = useState(false);

  const [showSeatedConfirm, setShowSeatedConfirm] = useState(false);
  const [showSeatedDone, setShowSeatedDone] = useState(false);

  const [actionTarget, setActionTarget] = useState(null);
  const [actionType, setActionType] = useState(null); // 'reject' | 'cancel' | null

  // ----- 데이터/오류 -----
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [actErr, setActErr] = useState("");

  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    if (!(activeTab === "today" && todayTab === "using")) return;
    setNowTs(Date.now());
    const id = setInterval(() => setNowTs(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [activeTab, todayTab]);

  const getUserId = () => {
    if (user?.id) return user.id;
    const ls = localStorage.getItem("userId") ?? localStorage.getItem("user_id");
    if (ls && !Number.isNaN(Number(ls))) return Number(ls);
    return null;
  };

  const mapApiItem = (it) => {
    const date = normalizeYMD(it.date);
    const st = toHms(it.startTime);
    const et = toHms(it.endTime);

    const timeText = st && et ? `${st.slice(0, 5)}-${et.slice(0, 5)}` : "";

    const status =
      it.reservationStatus === RESV.PENDING
        ? "request"
        : it.reservationStatus === RESV.APPROVED
        ? "confirmed"
        : "other";

    const ATT_MAP = {
      BEFORE_USE: ATT.BEFORE_USE,
      "BEFORE-USE": ATT.BEFORE_USE,
      PRE_USE: ATT.BEFORE_USE,
      IN_USE: ATT.IN_USE,
      "IN-USE": ATT.IN_USE,
      USING: ATT.IN_USE,
      COMPLETED: ATT.COMPLETED,
      COMPLETE: ATT.COMPLETED,
      AFTER_USE: ATT.COMPLETED,
      DONE: ATT.COMPLETED,
    };
    const rawAtt = String(it.attendanceStatus ?? "").toUpperCase();
    const attendance = ATT_MAP[rawAtt] ?? undefined;

    const todayStatus = deriveTodayStatus({
      date,
      startHms: st,
      endHms: et,
      attendance,
    });

    return {
      id: it.reservationsId,
      name: it.nickname ?? it.userName ?? "고객",
      phone: it.phoneNumber ?? "",
      people: it.peopleCount,
      date,
      time: timeText,
      status,
      todayStatus,
      start: st ? `${date}T${st}` : undefined,
      end: et ? `${date}T${et}` : undefined,
      att: attendance,
      immediate: it.immediate === true || it.immediate === "true" || it.immediate === 1,
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

  // URL 쿼리(tab, sub) → 상태 적용
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

  const todayISO = getTodayISODate(tz);

  const computedList = useMemo(() => {
    if (activeTab === "request") {
      return reservations.filter((r) => r.status === "request");
    }
    if (activeTab === "confirmed") {
      return reservations.filter((r) => r.status === "confirmed");
    }

    // 오늘 예약
    return reservations.filter((r) => {
      if (r.date !== todayISO) return false;
      const ts = r.todayStatus ?? "before";
      if (todayTab === "done") {
        return ts === "done" || r.att === ATT.COMPLETED;
      }
      return ts === todayTab;
    });
  }, [reservations, activeTab, todayTab, todayISO]);

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

  const updateReservationStatus = async ({ id, status }) => {
    setActErr("");
    try {
      const payload = { reservationsId: id, reservationStatus: status };
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

  const updateAttendance = async ({ id, attendance }) => {
    setActErr("");
    try {
      await instance.patch(`/api/reservation/owner/today/${id}`, null, {
        params: { attendance },
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

  /** ✔ 거절/취소: 삭제 엔드포인트 호출 + 사유 코드 전송 */
  const deleteReservationWithReason = async ({ id, reasonCode }) => {
    setActErr("");
    try {
      const uid = getUserId();
      if (!uid) throw new Error("userId를 찾을 수 없어요.");
      await instance.patch(
        `/api/reservation/delete/${id}`,
        { cancelReason: reasonCode },
        {
          params: { userId: uid },
          headers: { "Content-Type": "application/json" },
        }
      );
      await fetchReservations();
      return true;
    } catch (e) {
      console.error(e);
      setActErr("처리 중 오류가 발생했어요.");
      return false;
    }
  };

  // ----- 액션 핸들러 -----
  const doDelete = async () => {
    if (!actionTarget) return;
    if (!selectedReason) {
      setActErr("취소(거절) 사유를 선택해주세요.");
      return;
    }
    const ok = await deleteReservationWithReason({
      id: actionTarget,
      reasonCode: selectedReason,
    });
    if (ok) setShowDoneModal(true);
  };

  const doApprove = async () => {
    if (!actionTarget) return;
    const ok = await updateReservationStatus({
      id: actionTarget,
      status: RESV.APPROVED,
    });
    if (ok) setShowApproveDone(true);
  };

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
      {/* 상단 흰색 영역(헤더+탭) 높이 고정 */}
      <div className={styles.topWrapWhite}>
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
      </div>

      {/* 서브탭: 오늘일 때만 내용 표시(컨테이너는 유지해도 OK) */}
      <div className={styles.subTabs}>
        {activeTab === "today" ? (
          <>
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
          </>
        ) : null}
      </div>

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
                  {r.immediate && <span className={styles.nowBadge}>바로이용</span>}
                </div>
                <div className={styles.infoRow}>
                  <img src={calendarIcon} alt="날짜" className={styles.icon} />
                  <span>{r.date}</span>
                </div>
                <div className={styles.infoRow}>
                  <img src={clockIcon} alt="시간" className={styles.icon} />
                  <span>{r.time}</span>
                </div>

                {/* 상태별 버튼 처리 */}
                {activeTab === "request" && (
                  <div className={styles.btnWrap} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => {
                        setActionTarget(r.id);
                        setActionType("reject");
                        setSelectedReason(null);
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
                        setActionType("cancel");
                        setSelectedReason(null);
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
                    {r.status === "request" ? (
                      <>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => {
                            setActionTarget(r.id);
                            setActionType("reject");
                            setSelectedReason(null);
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
                      </>
                    ) : (
                      <>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => {
                            setActionTarget(r.id);
                            setActionType("cancel");
                            setSelectedReason(null);
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
                      </>
                    )}
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

      {/* 취소/거절 사유 선택 모달 (코드 선택, 라벨 표기) */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>{actionType === "reject" ? "예약 거절 사유" : "예약 취소 사유"}</span>
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
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  setShowConfirmModal(true);
                }}
              >
                {actionType === "reject" ? "예약 거절하기" : "예약 취소하기"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 최종 확인 모달 */}
      {showConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p>{actionType === "reject" ? "예약을 거절하시겠어요?" : "예약을 취소하시겠어요?"}</p>
            <div className={styles.confirmBtns}>
              <button onClick={() => setShowConfirmModal(false)} className={styles.rejectBtn}>
                아니요
              </button>
              <button
                onClick={async () => {
                  setShowConfirmModal(false);
                  setShowModal(false);
                  await doDelete();
                }}
                className={styles.approveBtn}
              >
                네
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 처리 완료 모달 */}
      {showDoneModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p className={styles.doneText}>
              {actionType === "reject" ? "예약이 거절되었습니다." : "예약이 취소되었습니다."}
            </p>
            <div className={styles.confirmBtns}>
              <button
                onClick={() => {
                  setShowDoneModal(false);
                  setSelectedReason(null);
                  const nextTab = actionType === "reject" ? "request" : "confirmed";
                  navigate(`/owner/reservations?tab=${nextTab}`);
                }}
                className={styles.approveBtn}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 승인 확인/완료 모달 */}
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
                  await doApprove();
                }}
                className={styles.approveBtn}
              >
                네
              </button>
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

      {/* 착석 확인/완료 모달 */}
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
                  await doSeated();
                }}
                className={styles.approveBtn}
              >
                네
              </button>
            </div>
          </div>
        </div>
      )}

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

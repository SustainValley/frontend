import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./OwnerReservationList.module.css";

import backIcon from "../../assets/chevron.svg";
import peopleIcon from "../../assets/people.svg";
import calendarIcon from "../../assets/calendar.svg";
import clockIcon from "../../assets/clock.svg";

const OwnerReservationList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState("today");     // request | confirmed | today
  const [todayTab, setTodayTab] = useState("using");       // before | using | done

  const [showModal, setShowModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);

  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showApproveDone, setShowApproveDone] = useState(false);

  const [showSeatedConfirm, setShowSeatedConfirm] = useState(false);
  const [showSeatedDone, setShowSeatedDone] = useState(false);

  const [actionTarget, setActionTarget] = useState(null);

  const reservations = [
    { id: 1, name: "김민수", phone: "010-1234-1234", people: 5, date: "2025-08-07", time: "15:00-18:00", status: "request" },
    { id: 2, name: "이영희", phone: "010-5678-5678", people: 3, date: "2025-08-07", time: "12:00-14:00", status: "confirmed" },
    { id: 10, name: "김민수", phone: "010-1234-1234", people: 5, date: "2025-08-07", start: "2025-08-07T15:00:00", end: "2025-08-07T18:00:00", time: "15:00-18:00", status: "today", todayStatus: "before" },
    { id: 11, name: "김민수", phone: "010-1234-1234", people: 5, date: "2025-08-07", start: "2025-08-07T15:00:00", end: "2025-08-07T18:00:00", time: "15:00-18:00", status: "today", todayStatus: "using", mockRemainingMin: 60 },
    { id: 12, name: "박지현", phone: "010-1234-1234", people: 4, date: "2025-08-07", start: "2025-08-07T15:00:00", end: "2025-08-07T17:00:00", time: "15:00-17:00", status: "today", todayStatus: "using", mockRemainingMin: 0 },
    { id: 13, name: "박지현", phone: "010-1234-1234", people: 5, date: "2025-08-07", time: "15:00-18:00", status: "today", todayStatus: "done" },
  ];

  const cancelReasons = [
    "해당 시간대 예약 마감",
    "영업시간 외 예약요청",
    "매장 혼잡",
    "요청 장비 사용 불가",
    "시설 점검",
    "피크타임 인원제한",
    "고객 노쇼",
  ];

  const getProgressAndRemain = (r) => {
    if (typeof r.mockRemainingMin === "number") {
      const total = 120;
      const remain = r.mockRemainingMin;
      const used = Math.max(0, total - remain);
      const percent = Math.max(0, Math.min(100, Math.round((used / total) * 100)));
      return { remain, percent };
    }
    if (!r.start || !r.end) return { remain: 0, percent: 0 };
    const start = new Date(r.start).getTime();
    const end = new Date(r.end).getTime();
    const now = Date.now();
    const total = Math.max(1, end - start);
    const used = Math.min(Math.max(0, now - start), total);
    const remainMs = Math.max(0, end - now);
    const remain = Math.round(remainMs / 60000);
    const percent = Math.round((used / total) * 100);
    return { remain, percent };
  };

  const filteredReservations = useMemo(() => {
    let list = reservations.filter((r) => r.status === activeTab);
    if (activeTab === "today") list = list.filter((r) => r.todayStatus === todayTab);
    return list;
  }, [reservations, activeTab, todayTab]);

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
      <button className={styles.backBtn} onClick={() => navigate("/owner/home")} aria-label="홈으로 이동">
          <img src={backIcon} alt="뒤로" />
        </button>
        <span className={styles.title}>실시간 예약 확인하기</span>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === "request" ? styles.active : ""}`} onClick={() => goTab("request")}>예약 요청</button>
        <button className={`${styles.tab} ${activeTab === "confirmed" ? styles.active : ""}`} onClick={() => goTab("confirmed")}>확정 예약</button>
        <button className={`${styles.tab} ${activeTab === "today" ? styles.active : ""}`} onClick={() => goTab("today")}>오늘 예약</button>
      </div>

      {activeTab === "today" && (
        <div className={styles.subTabs}>
          <button className={`${styles.subTab} ${todayTab === "before" ? styles.subActive : ""}`} onClick={() => goSub("before")}>이용 전</button>
          <button className={`${styles.subTab} ${todayTab === "using" ? styles.subActive : ""}`} onClick={() => goSub("using")}>이용 중</button>
          <button className={`${styles.subTab} ${todayTab === "done" ? styles.subActive : ""}`} onClick={() => goSub("done")}>이용 완료</button>
        </div>
      )}

      <div className={styles.list}>
        {filteredReservations.length === 0 ? (
          <p className={styles.emptyText}>예약이 없습니다.</p>
        ) : (
          filteredReservations.map((r) => {
            const { remain, percent } =
              activeTab === "today" && todayTab === "using" ? getProgressAndRemain(r) : { remain: 0, percent: 0 };
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
                    <span className={styles.phone}>{r.phone}</span>
                  </div>

                  {activeTab === "today" && todayTab === "using" && (
                    <div className={styles.remainBox}>
                      <span className={styles.remainLabel}>남은 시간</span>
                      <div className={`${styles.badge} ${isTimeOut ? styles.badgeRed : styles.badgeBlue}`}>
                        {isTimeOut ? "0 분" : `${remain} 분`}
                      </div>
                    </div>
                  )}

                  {activeTab === "today" && todayTab === "done" && (
                    <div className={styles.doneCheck}>✓</div>
                  )}
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
                    {isTimeOut && (
                      <p className={styles.notice}>고객에게 이용 완료 안내를 해주세요!</p>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

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
                onClick={() => setShowConfirmModal(true)}
              >
                예약 취소하기
              </button>
            )}
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p>예약을 취소하시겠어요?</p>
            <div className={styles.confirmBtns}>
              <button onClick={() => setShowConfirmModal(false)} className={styles.rejectBtn}>아니요</button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setShowModal(false);
                  setShowDoneModal(true);
                }}
                className={styles.approveBtn}
              >
                네
              </button>
            </div>
          </div>
        </div>
      )}

      {showDoneModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p className={styles.doneText}>예약이 취소되었습니다.</p>
            <div className={styles.confirmBtns}>
              <button
                onClick={() => {
                  setShowDoneModal(false);
                  navigate("/owner/reservations?tab=request")}
                }
                className={styles.approveBtn}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showApproveConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p>예약을 승인하시겠어요?</p>
            <div className={styles.confirmBtns}>
              <button onClick={() => setShowApproveConfirm(false)} className={styles.rejectBtn}>아니요</button>
              <button
                onClick={() => {
                  setShowApproveConfirm(false);
                  setShowApproveDone(true);
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

      {showSeatedConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <p>착석 처리하시겠어요?</p>
            <div className={styles.confirmBtns}>
              <button onClick={() => setShowSeatedConfirm(false)} className={styles.rejectBtn}>아니요</button>
              <button
                onClick={() => {
                  setShowSeatedConfirm(false);
                  setShowSeatedDone(true);
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

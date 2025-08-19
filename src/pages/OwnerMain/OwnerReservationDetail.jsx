import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./OwnerReservationDetail.module.css";

import backIcon from "../../assets/chevron.svg";

const OwnerReservationDetail = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);

  const reservation = {
    name: "김민수",
    phone: "010-1234-1234",
    people: 5,
    meetingType: "프로젝트 회의",
    date: "2025.08.07 (목)",
    time: "15:00-18:00 (3시간)",
  };

  const cancelReasons = [
    "해당 시간대 예약 마감",
    "영업시간 외 예약요청",
    "매장 혼잡",
    "요청 장비 사용 불가",
    "시설 점검",
    "피크타임 인원제한",
    "고객 노쇼",
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
        >
          <img src={backIcon} alt="뒤로" />
        </button>
        <span className={styles.title}>실시간 예약 확인하기</span>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>예약자 정보</h3>
        <div className={styles.row}>
          <span className={styles.label}>이름</span>
          <span className={styles.value}>{reservation.name}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>전화번호</span>
          <span className={styles.value}>{reservation.phone}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>회의 인원</span>
          <span className={styles.value}>{reservation.people}명</span>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>회의 종류</h3>
        <div className={styles.row}>
          <span className={styles.value}>{reservation.meetingType}</span>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>예약 일정</h3>
        <div className={styles.row}>
          <span className={styles.label}>날짜</span>
          <span className={styles.value}>{reservation.date}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>시간</span>
          <span className={styles.value}>{reservation.time}</span>
        </div>
      </div>

      <div className={`${styles.section} ${styles.noBorder}`}>
        <h3 className={styles.sectionTitle}>회의 인원</h3>
        <div className={styles.row}>
          <span className={styles.value}>{reservation.people} 명</span>
        </div>
      </div>

      <div className={styles.btnWrap}>
        <button
          className={styles.rejectBtn}
          onClick={() => setShowModal(true)}
        >
          거절하기
        </button>
        <button className={styles.approveBtn}>승인하기</button>
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
                  className={
                    selectedReason === reason ? styles.selectedReason : ""
                  }
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
              <button
                onClick={() => setShowConfirmModal(false)}
                className={styles.rejectBtn}
              >
                아니요
              </button>
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
                onClick={() => navigate("/owner/reservations")}
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

export default OwnerReservationDetail;

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./OperatingHours.module.css";

import backIcon from "../../assets/chevron.svg"; 

const DAYS = ["월요일","화요일","수요일","목요일","금요일","토요일","일요일"];

const makeTimes = () => {
  const arr = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      arr.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
    }
  }
  return arr;
};

export default function OperatingHours() {
  const navigate = useNavigate();
  const options = useMemo(() => makeTimes(), []);
  const [hours, setHours] = useState({
    0:{on:false, open:"09:00", close:"18:00"},
    1:{on:true , open:"09:00", close:"18:00"},
    2:{on:true , open:"09:00", close:"18:00"},
    3:{on:true , open:"09:00", close:"18:00"},
    4:{on:true , open:"09:00", close:"18:00"},
    5:{on:true , open:"09:00", close:"18:00"},
    6:{on:true , open:"09:00", close:"18:00"},
  });

  const [modalOpen, setModalOpen] = useState(false);

  const toggle = (i)=> setHours(s=>({...s,[i]:{...s[i],on:!s[i].on}}));
  const setOpen = (i,v)=> setHours(s=>({...s,[i]:{...s[i],open:v}}));
  const setClose= (i,v)=> setHours(s=>({...s,[i]:{...s[i],close:v}}));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={()=>navigate(-1)} aria-label="뒤로">
          <img src={backIcon} alt="뒤로가기" className={styles.backIcon} />
        </button>
        <div className={styles.title}>운영 정보 설정</div>
        <div className={styles.headerRight}></div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>MOCA 운영 정보</div>

          {DAYS.map((d, i)=>(
            <div key={d} className={styles.row}>
              <div className={styles.left}>
                <div className={styles.day}>
                  {d}
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={hours[i].on}
                      onChange={()=>toggle(i)}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div className={styles.timeRow}>
                  <span className={styles.timeLabel}>오픈시간</span>
                  <div className={styles.selectWrapper}>
                    <select
                      className={styles.select}
                      value={hours[i].open}
                      onChange={(e)=>setOpen(i, e.target.value)}
                      disabled={!hours[i].on}
                    >
                      {options.map(t => <option key={`${i}-o-${t}`} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <span className={styles.timeLabel}>마감시간</span>
                  <div className={styles.selectWrapper}>
                    <select
                      className={styles.select}
                      value={hours[i].close}
                      onChange={(e)=>setClose(i, e.target.value)}
                      disabled={!hours[i].on}
                    >
                      {options.map(t => <option key={`${i}-c-${t}`} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className={styles.saveBtn} onClick={()=>setModalOpen(true)}>
          저장하기
        </button>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              저장 완료
              <button className={styles.modalClose} onClick={()=>setModalOpen(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalTitle}>운영 정보 저장</div>
              <div className={styles.modalText}>운영 정보가 저장되었습니다.</div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalBtn}
                onClick={()=>{
                  setModalOpen(false);
                  navigate("/owner/store");
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

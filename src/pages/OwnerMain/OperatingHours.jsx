import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./OperatingHours.module.css";
import instance from "../../lib/axios";

import backIcon from "../../assets/chevron.svg";

const DAYS = ["월요일","화요일","수요일","목요일","금요일","토요일","일요일"];
const KEYMAP = ["mon","tue","wed","thu","fri","sat","sun"];

const makeTimes = () => {
  const arr = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      arr.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
    }
  }
  return arr;
};

const toTimeString = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`;
};

const toTimeObject = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return { hour: h, minute: m, second: 0, nano: 0 };
};

const normalizeToHHMM = (v) => {
  if (v == null) return null;
  if (typeof v === "string") {
    const parts = v.split(":");
    if (parts.length >= 2) return `${parts[0].padStart(2,"0")}:${parts[1].padStart(2,"0")}`;
    return null;
  }
  if (typeof v === "object") {
    const h = v.hour ?? 0;
    const m = v.minute ?? 0;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }
  return null;
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const toggle = useCallback((i)=> {
    setHours(s=>({...s,[i]:{...s[i],on:!s[i].on}}));
  },[]);
  const setOpen = useCallback((i,v)=> {
    setHours(s=>({...s,[i]:{...s[i],open:v}}));
  },[]);
  const setClose= useCallback((i,v)=> {
    setHours(s=>({...s,[i]:{...s[i],close:v}}));
  },[]);

  const buildPayload = (format /* "string" | "object" */) => {
    const json = {};
    KEYMAP.forEach((key, idx) => {
      const { on, open, close } = hours[idx];
      const openKey = `${key}Open`;
      const closeKey = `${key}Close`;
      const openVal = on ? (format === "string" ? toTimeString(open) : toTimeObject(open)) : null;
      const closeVal = on ? (format === "string" ? toTimeString(close) : toTimeObject(close)) : null;
      json[openKey] = openVal;
      json[closeKey] = closeVal;
      json[`${key}IsOpen`] = !!on;
    });
    return json;
  };

  const getCafeId = () => {
    const a = localStorage.getItem("cafe_id");
    const b = localStorage.getItem("cafeId");
    return a ?? b;
  };

  useEffect(() => {
    const fetchOperating = async () => {
      setError("");
      const cafeId = getCafeId();
      if (!cafeId) {
        setError("카페 ID를 찾을 수 없어요. 로그인/가게선택을 확인해주세요.");
        setLoading(false);
        return;
      }
      try {
        const res = await instance.get(`/api/cafe/${cafeId}/operating`, {
          headers: { Accept: "application/json" },
        });
        const data = res.data || {};
        // 서버 키 → 인덱스 매핑
        const next = {};
        KEYMAP.forEach((key, idx) => {
          const isOpen = !!data[`${key}IsOpen`];
          const openHHMM  = normalizeToHHMM(data[`${key}Open`])  ?? "09:00";
          const closeHHMM = normalizeToHHMM(data[`${key}Close`]) ?? "18:00";
          next[idx] = { on: isOpen, open: openHHMM, close: closeHHMM };
        });
        setHours(next);
      } catch (e) {
        setError(e?.response?.data?.message || "운영 정보 조회에 실패했어요.");
      } finally {
        setLoading(false);
      }
    };
    fetchOperating();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    setError("");
    const cafeId = getCafeId();
    if (!cafeId) {
      setError("카페 ID를 찾을 수 없어요. 로그인/가게선택을 확인해주세요.");
      return;
    }

    const url = `/api/cafe/${cafeId}/operating/update`;
    const headers = { "Content-Type": "application/json", Accept: "application/json" };

    try {
      setSaving(true);
      const bodyStr = buildPayload("string");
      await instance.patch(url, bodyStr, { headers });
      setModalOpen(true);
    } catch (e1) {
      if (e1?.response?.status === 400) {
        try {
          const bodyObj = buildPayload("object");
          await instance.patch(url, bodyObj, { headers });
          setModalOpen(true);
        } catch (e2) {
          setError(e2?.response?.data?.message || "저장 실패(객체 형식). 관리자에게 문의해주세요.");
        }
      } else {
        setError(e1?.response?.data?.message || "저장 실패. 네트워크/권한을 확인해주세요.");
      }
    } finally {
      setSaving(false);
    }
  };

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
                  <span className={styles.dayLabel}>{d}</span>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={hours[i].on}
                      onChange={()=>toggle(i)}
                      disabled={loading}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div className={styles.timeRow}>
                  <span className={styles.timeLabel}>오픈</span>
                  <div className={styles.selectWrapper}>
                    <select
                      className={styles.select}
                      value={hours[i].open}
                      onChange={(e)=>setOpen(i, e.target.value)}
                      disabled={!hours[i].on || loading}
                    >
                      {options.map(t => <option key={`${i}-o-${t}`} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <span className={styles.timeLabel}>마감</span>
                  <div className={styles.selectWrapper}>
                    <select
                      className={styles.select}
                      value={hours[i].close}
                      onChange={(e)=>setClose(i, e.target.value)}
                      disabled={!hours[i].on || loading}
                    >
                      {options.map(t => <option key={`${i}-c-${t}`} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button
          className={styles.saveBtn}
          onClick={onSave}
          disabled={saving || loading}
        >
          {saving ? "저장 중..." : loading ? "로딩 중..." : "저장하기"}
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

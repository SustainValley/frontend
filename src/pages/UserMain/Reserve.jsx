import React, { useMemo, useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./Reserve.module.css";

import backIcon from "../../assets/chevron.svg";
import locationIcon from "../../assets/Group.svg";
import chevronDownIcon from "../../assets/down.svg";
import phoneIcon from "../../assets/tabler_phone.svg";
import chatIcon from "../../assets/tabler_message-circle.svg";

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <rect x="3" y="4" width="18" height="17" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 2v4M16 2v4M3 9h18" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const defaultCafe = {
  name: "풍치커피익스프레스공릉점",
  addr: "서울 노원구 동일로176길 19-20",
  photos: [
    "https://picsum.photos/seed/meeting1/1200/900",
    "https://picsum.photos/seed/meeting2/1200/900",
    "https://picsum.photos/seed/meeting3/1200/900",
    "https://picsum.photos/seed/meeting4/1200/900"
  ],
  hours: {
    weekly: [
      ["월", "12:00 - 18:00"],
      ["화", "12:00 - 18:00"],
      ["수", "12:00 - 18:00"],
      ["목", "12:00 - 18:00"],
      ["금", "12:00 - 18:00"],
      ["토", "12:00 - 18:00"],
      ["일", "휴무일"]
    ]
  },
  ppl: 5
};

const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function parseTimeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
function parseRangeToMinutes(range) {
  const [s, e] = range.split("-").map((s) => s.trim());
  return [parseTimeToMinutes(s), parseTimeToMinutes(e)];
}
function getEntryForDate(weekly, iso) {
  const d = new Date(iso);
  const label = DAY_LABELS[d.getDay()];
  return weekly.find(([day]) => day === label) || null;
}
function formatKoDate(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const w = DAY_LABELS[d.getDay()];
  return `${y}.${m}.${dd} (${w})`;
}
function getRowSegment(fromMin, toMin, rowStartH, rowEndH) {
  const rowStart = rowStartH * 60;
  const rowEnd = rowEndH * 60;
  const s = Math.max(fromMin, rowStart);
  const e = Math.min(toMin, rowEnd);
  const w = Math.max(0, e - s);
  if (w <= 0) return { show: false, left: 0, width: 0 };
  return {
    show: true,
    left: ((s - rowStart) / (rowEnd - rowStart)) * 100,
    width: (w / (rowEnd - rowStart)) * 100
  };
}

export default function Reserve() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const cafe = state?.cafe ?? defaultCafe;

  const photos = Array.isArray(cafe.photos) && cafe.photos.length ? cafe.photos : [cafe.thumb ?? defaultCafe.photos[0]];
  const [idx, setIdx] = useState(0);
  const trackRef = useRef(null);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setIdx(Math.max(0, Math.min(photos.length - 1, i)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => onScroll();
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [photos.length]);

  const [activeTab, setActiveTab] = useState("detail");
  const tabsRef = useRef(null);
  const inkRef = useRef(null);
  const detailSecRef = useRef(null);
  const reserveSecRef = useRef(null);
  const moveInk = (tab) => {
    const bar = inkRef.current;
    const cont = tabsRef.current;
    if (!bar || !cont) return;
    const half = cont.clientWidth / 2;
    bar.style.width = `${half}px`;
    bar.style.transform = tab === "detail" ? "translateX(0)" : `translateX(${half}px)`;
  };
  useEffect(() => {
    const obs = new IntersectionObserver(
      (ents) => {
        ents.forEach((e) => {
          if (!e.isIntersecting) return;
          const tab = e.target.dataset.tab;
          setActiveTab(tab);
          requestAnimationFrame(() => moveInk(tab));
        });
      },
      { threshold: 0.4 }
    );
    if (detailSecRef.current) obs.observe(detailSecRef.current);
    if (reserveSecRef.current) obs.observe(reserveSecRef.current);
    const onResize = () => moveInk(activeTab);
    window.addEventListener("resize", onResize);
    requestAnimationFrame(() => moveInk("detail"));
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);
  const scrollToSection = (ref, tabName) => {
    if (!ref.current) return;
    setActiveTab(tabName);
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => moveInk(tabName));
  };

  const [type, setType] = useState("프로젝트 회의");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("18:00");
  const [headcount, setHeadcount] = useState(1);

  const maxHeadcount = cafe.ppl ?? defaultCafe?.ppl ?? 1;
  useEffect(() => {
    setHeadcount((h) => Math.min(Math.max(1, h), maxHeadcount));
  }, [maxHeadcount]);

  const dateInputRef = useRef(null);
  const openCalendar = () => {
    const el = dateInputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
      else {
        el.focus();
        el.click();
      }
    } catch {
      el.focus();
      el.click();
    }
  };

  const weekly = cafe.hours?.weekly ?? defaultCafe.hours.weekly;

  const dayEntry = useMemo(() => getEntryForDate(weekly, date), [weekly, date]);
  const openRange = useMemo(() => {
    if (!dayEntry) return null;
    const [, str] = dayEntry;
    if (!str || str.includes("휴무")) return null;
    const [s, e] = parseRangeToMinutes(str);
    return { s, e };
  }, [dayEntry]);

  const todayISO = new Date().toISOString().slice(0, 10);
  const todayEntry = useMemo(() => getEntryForDate(weekly, todayISO), [weekly]);
  const todayRange = useMemo(() => {
    if (!todayEntry) return null;
    const [, str] = todayEntry;
    if (!str || str.includes("휴무")) return null;
    const [s, e] = parseRangeToMinutes(str);
    return { s, e };
  }, [todayEntry]);

  const [showHours, setShowHours] = useState(false);
  const accInnerRef = useRef(null);
  const [accH, setAccH] = useState(0);
  useEffect(() => {
    const update = () =>
      setAccH(showHours && accInnerRef.current ? accInnerRef.current.offsetHeight : 0);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [showHours, weekly]);

  const isStartHourEnabled = (h) => {
    if (!openRange) return false;
    const blockStart = h * 60;
    const blockEnd = (h + 1) * 60;
    return blockStart >= openRange.s && blockEnd <= openRange.e;
  };
  const isEndHourEnabled = (h) => {
    if (!openRange) return false;
    const endMinute = h * 60;
    return endMinute > openRange.s && endMinute <= openRange.e;
  };
  const findNextEnabledEnd = (fromH) => {
    for (let h = fromH; h <= 23; h++) if (isEndHourEnabled(h)) return h;
    return fromH;
  };
  const findPrevEnabledStart = (fromH) => {
    for (let h = fromH; h >= 0; h--) if (isStartHourEnabled(h)) return h;
    return fromH;
  };

  const price = useMemo(() => {
    const [sH] = start.split(":").map(Number);
    const [eH] = end.split(":").map(Number);
    return Math.max(0, eH - sH) * 6000;
  }, [start, end]);

  const selStartMin = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  const selEndMin = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));
  const morningSelected = getRowSegment(selStartMin, selEndMin, 0, 12);
  const afternoonSelected = getRowSegment(selStartMin, selEndMin, 12, 24);

  const FULL_DAY_END = 24 * 60;
  const morningUnA = getRowSegment(0, openRange ? openRange.s : FULL_DAY_END, 0, 12);
  const morningUnB = openRange ? getRowSegment(openRange.e, FULL_DAY_END, 0, 12) : { show: false, left: 0, width: 0 };
  const afternoonUnA = getRowSegment(0, openRange ? openRange.s : FULL_DAY_END, 12, 24);
  const afternoonUnB = openRange ? getRowSegment(openRange.e, FULL_DAY_END, 12, 24) : { show: false, left: 0, width: 0 };

  const runText = useMemo(() => {
    if (!todayRange) return "휴무일";
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < todayRange.s) return "운영 전";
    if (nowMin < todayRange.e) return "운영중";
    return "영업 종료";
  }, [todayRange]);
  const isOpenNow = useMemo(() => {
    if (!todayRange) return false;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return nowMin >= todayRange.s && nowMin < todayRange.e;
  }, [todayRange]);

  const onSubmit = (e) => {
    e.preventDefault();
    alert(
      [
        "예약 요청",
        `- 장소: ${cafe.name}`,
        `- 일자: ${date}`,
        `- 시간: ${start} ~ ${end}`,
        `- 인원: ${headcount}명`,
        `- 종류: ${type}`,
        `- 금액: ${price.toLocaleString()}원`
      ].join("\n")
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <div className={styles.appbar}>
          <button className={styles.backBtn} aria-label="뒤로가기" onClick={() => navigate(-1)}>
            <img className={styles.backIcon} src={backIcon} alt="" />
          </button>
          <h1 className={styles.title}>{cafe.name}</h1>
          <span aria-hidden />
        </div>

        <div className={styles.hero}>
          <div className={styles.heroTrack} ref={trackRef}>
            {photos.map((src, i) => (
              <div className={styles.slide} key={i}>
                <img src={src} alt={`${cafe.name} 사진 ${i + 1}`} />
              </div>
            ))}
          </div>
          <span className={styles.photoCount}>{idx + 1}/{photos.length}</span>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="카페 상세/예약">
        <div className={styles.tabsInner} ref={tabsRef}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "detail"}
            className={`${styles.tab} ${activeTab === "detail" ? "" : styles.tabMuted}`}
            onClick={() => scrollToSection(detailSecRef, "detail")}
          >
            상세정보
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "reserve"}
            className={`${styles.tab} ${activeTab === "reserve" ? "" : styles.tabMuted}`}
            onClick={() => scrollToSection(reserveSecRef, "reserve")}
          >
            예약하기
          </button>
          <span className={styles.ink} ref={inkRef} aria-hidden />
        </div>
      </div>

      <main className={styles.body}>
        <section ref={detailSecRef} data-tab="detail" className={styles.section} id="detail">
          <p className={styles.sectionTitle}>운영 정보</p>
          <div className={styles.row}>
            <img src={locationIcon} className={styles.rowIcon} alt="" aria-hidden />
            <span className={styles.k}>위치</span>
            <span className={styles.v}>{cafe.addr}</span>
          </div>

          <div className={styles.hoursWrap}>
            <section className={`${styles.accordion} ${showHours ? styles.accordionOpen : ""}`}>
              <button
                type="button"
                className={styles.accHeader}
                aria-expanded={showHours}
                aria-controls="hours-acc-body"
                onClick={() => setShowHours((v) => !v)}
              >
                <div className={styles.hoursLeft}>
                  <span id="accHeaderLabel" className={styles.hoursTitle}>운영 시간</span>
                  <span className={isOpenNow ? styles.dotGreen : styles.dotGray} aria-hidden />
                  <span className={styles.runText}>{runText}</span>
                </div>
                <img src={chevronDownIcon} className={`${styles.chev} ${showHours ? styles.chevUp : ""}`} alt="" aria-hidden />
              </button>

              <div id="hours-acc-body" className={styles.accBody} aria-labelledby="accHeaderLabel" style={{ height: accH }}>
                <div ref={accInnerRef} className={styles.accBodyInner}>
                  <table className={styles.hoursTable} role="table" aria-label="요일별 운영 시간">
                    <tbody>
                      {(cafe.hours?.weekly ?? defaultCafe.hours.weekly).map(([d, t]) => (
                        <tr key={d}>
                          <th scope="row" className={styles.dayCell}>{d}</th>
                          <td className={styles.timeCell}>{t}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          <div className={styles.actions}>
            <button className={styles.outlineBtn} type="button">
              <img src={phoneIcon} className={styles.btnIcon} alt="" aria-hidden />
              전화하기
            </button>
            <button className={styles.outlineBtn} type="button">
              <img src={chatIcon} className={styles.btnIcon} alt="" aria-hidden />
              채팅 문의하기
            </button>
          </div>
        </section>

        <section className={`${styles.section} ${styles.meetingInfo}`}>
          <h2 className={styles.sectionTitle}>회의실 이용 정보</h2>
          <div className={styles.row}>
            <span className={styles.k}>최소 주문</span>
            <span className={styles.v}>1인 1음료</span>
          </div>
          <div className={styles.row}>
            <span className={styles.k}>수용가능인원</span>
            <span className={styles.v}>최대 {cafe.ppl}명</span>
          </div>
          <div className={styles.row}>
            <span className={styles.k}>공간</span>
            <span className={styles.v}>오픈된 공간 (다른 사용자와 함께 사용)</span>
          </div>
        </section>

        <section ref={reserveSecRef} data-tab="reserve" className={styles.section} id="reserve">
          <h2 className={styles.sectionTitle}>예약 정보 입력</h2>

          <div className={styles.rowCol}>
            <span className={styles.kk}>회의 종류</span>
            <div className={styles.chipsGrid}>
              {["프로젝트 회의", "과제/스터디", "외부 미팅", "면담/인터뷰", "네트워킹", "기타"].map((label) => (
                <button
                  key={label}
                  className={`${styles.chip} ${label === type ? styles.chipActive : ""}`}
                  onClick={() => setType(label)}
                  type="button"
                  aria-pressed={label === type}
                >
                  <span className={styles.chipLabel}>{label}</span>
                  <span className={styles.chipCheckIcon} aria-hidden />
                </button>
              ))}
            </div>
          </div>

          <div className={styles.rowCol}>
            <span className={styles.kk}>일정</span>
            <div className={styles.card}>
              <div className={styles.dateRow}>
                <span className={styles.smallLabel}>날짜</span>
                <div
                  className={styles.dateButtonWrap}
                  role="button"
                  tabIndex={0}
                  onClick={openCalendar}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openCalendar()}
                >
                  <div className={styles.dateButton}>
                    <span>{formatKoDate(date)}</span>
                    <CalendarIcon />
                  </div>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", clip: "rect(0 0 0 0)" }}
                  />
                </div>
              </div>

              <div className={styles.timeRow}>
                <label className={styles.smallLabel}>시간</label>

                <div className={styles.timeline2} aria-hidden>
                  <div className={styles.timelineRow}>
                    <span className={styles.ampm}>오전</span>
                    <div className={styles.grid24}>
                      {morningUnA.show && (
                        <span className={styles.unavailableBand} style={{ left: `${morningUnA.left}%`, width: `${morningUnA.width}%` }} />
                      )}
                      {morningUnB.show && (
                        <span className={styles.unavailableBand} style={{ left: `${morningUnB.left}%`, width: `${morningUnB.width}%` }} />
                      )}
                      {morningSelected.show && (
                        <span className={styles.fillRange} style={{ left: `${morningSelected.left}%`, width: `${morningSelected.width}%` }} />
                      )}
                    </div>
                  </div>
                  <div className={styles.timelineRow}>
                    <span className={styles.ampm}>오후</span>
                    <div className={styles.grid24}>
                      {afternoonUnA.show && (
                        <span className={styles.unavailableBand} style={{ left: `${afternoonUnA.left}%`, width: `${afternoonUnA.width}%` }} />
                      )}
                      {afternoonUnB.show && (
                        <span className={styles.unavailableBand} style={{ left: `${afternoonUnB.left}%`, width: `${afternoonUnB.width}%` }} />
                      )}
                      {afternoonSelected.show && (
                        <span className={styles.fillRange} style={{ left: `${afternoonSelected.left}%`, width: `${afternoonSelected.width}%` }} />
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.timePickers}>
                  <div className={styles.timePicker}>
                    <span className={`${styles.smallLabel} ${styles.inlineLabel}`}>시작시간</span>
                    <div className={styles.selectWrap}>
                      <select
                        value={start}
                        onChange={(e) => {
                          const v = e.target.value;
                          setStart(v);
                          const sH = Number(v.slice(0, 2));
                          const eH = Number(end.slice(0, 2));
                          if (eH <= sH || !isEndHourEnabled(eH)) {
                            const next = findNextEnabledEnd(sH + 1);
                            setEnd(`${String(next).padStart(2, "0")}:00`);
                          }
                        }}
                      >
                        {hours.map((h) => {
                          const HH = Number(h.slice(0, 2));
                          return (
                            <option key={h} value={h} disabled={!isStartHourEnabled(HH)}>
                              {h}
                            </option>
                          );
                        })}
                      </select>
                      <img src={chevronDownIcon} alt="" className={styles.selectArrow} />
                    </div>
                  </div>

                  <div className={styles.timePicker}>
                    <span className={`${styles.smallLabel} ${styles.inlineLabel}`}>종료시간</span>
                    <div className={styles.selectWrap}>
                      <select
                        value={end}
                        onChange={(e) => {
                          const v = e.target.value;
                          const newEndH = Number(v.slice(0, 2));
                          const sH = Number(start.slice(0, 2));
                          if (newEndH <= sH) {
                            const prevStart = findPrevEnabledStart(newEndH - 1);
                            setStart(`${String(prevStart).padStart(2, "0")}:00`);
                          }
                          setEnd(v);
                        }}
                      >
                        {hours.map((h) => {
                          const HH = Number(h.slice(0, 2));
                          return (
                            <option key={h} value={h} disabled={!isEndHourEnabled(HH)}>
                              {h}
                            </option>
                          );
                        })}
                      </select>
                      <img src={chevronDownIcon} alt="" className={styles.selectArrow} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.countRow}>
                <span className={styles.smallLabel}>회의 인원</span>
                <div className={styles.counter}>
                  <button
                    type="button"
                    onClick={() => setHeadcount((h) => Math.max(1, h - 1))}
                    disabled={headcount <= 1}
                    aria-disabled={headcount <= 1}
                  >
                    -
                  </button>
                  <span>{headcount} 명</span>
                  <button
                    type="button"
                    onClick={() => setHeadcount((h) => Math.min(maxHeadcount, h + 1))}
                    disabled={headcount >= maxHeadcount}
                    aria-disabled={headcount >= maxHeadcount}
                    title={headcount >= maxHeadcount ? `최대 ${maxHeadcount}명까지 예약 가능` : undefined}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.notice}>
            <p className={styles.noticeTitle}>예약 전 꼭 확인해주세요</p>
            <ul>
              <li>예약 후 방문하지 않으면 이용 제한이 생길 수 있어요.</li>
              <li>일정이 바뀌면 반드시 사전에 예약 취소를 해주세요.</li>
              <li>다른 고객에게 피해가 되지 않도록 매장 방문 후 문의해 주세요.</li>
            </ul>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryK}>회의 종류</span>
              <span className={styles.summaryV}>{type}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryK}>예약 인원</span>
              <span className={styles.summaryV}>{headcount}명</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryK}>예약 시간</span>
              <span className={styles.summaryV}>{start} - {end}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryK}>예약 금액</span>
              <span className={styles.summaryVStrong}>{price.toLocaleString()} 원</span>
            </div>
          </div>

          <form onSubmit={onSubmit} className={styles.ctaWrap}>
            <button className={styles.cta} type="submit">예약 요청하기</button>
          </form>
        </section>
      </main>
    </div>
  );
}

// src/pages/Reserve/Reserve.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const TIME_STEP = 30;
const timeSlots = Array.from({ length: (24 * 60) / TIME_STEP }, (_, i) => {
  const m = i * TIME_STEP;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
});

// ✅ 프론트 라벨 -> 백엔드 Enum 값 매핑 (백엔드 제공 표에 맞춤)
const MEETING_TYPE_ENUM = {
  "프로젝트 회의": "PROJECT",
  "과제/스터디": "STUDY",
  "외부 미팅": "MEETING",
  "면담/인터뷰": "INTERVIEW",
  "네트워킹": "NETWORKING",
  "기타": "ETC",
};

const defaultCafe = {
  id: null,
  name: "풍치커피익스프레스공릉점",
  addr: "서울 노원구 동일로176길 19-20",
  photos: [], // ✅ 기본 사진 제거(없으면 검정 화면만)
  hours: {
    weekly: [
      ["월", "12:00 - 18:00"],
      ["화", "12:00 - 18:00"],
      ["수", "12:00 - 18:00"],
      ["목", "12:00 - 18:00"],
      ["금", "12:00 - 18:00"],
      ["토", "12:00 - 18:00"],
      ["일", "휴무일"],
    ],
  },
  ppl: 5,
  minOrder: "1인 1음료",
  spaceType: "오픈된 공간 (다른 이용자와 함께 사용)",
  phoneNumber: "",
  storeUserId: null,
};

function pad2(n) { return String(n).padStart(2, "0"); }
function parseTimeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
function parseRangeToMinutes(range) {
  const [s, e] = range.split("-").map((s) => s.trim());
  return [parseTimeToMinutes(s), parseTimeToMinutes(e)];
}
function hhmmToMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
function hhmmToHHMMSS(hhmm) {
  const [h, m] = hhmm.split(":");
  return `${pad2(h)}:${pad2(m)}:00`;
}
function getEntryForDate(weekly, iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const localDate = new Date(y, m - 1, d);
  const label = DAY_LABELS[localDate.getDay()];
  return weekly.find(([day]) => day === label) || null;
}
function formatKoDate(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
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
    width: (w / (rowEnd - rowStart)) * 100,
  };
}

function buildWeeklyFromOperating(op) {
  const dayMap = [
    ["월", "mon"], ["화", "tue"], ["수", "wed"],
    ["목", "thu"], ["금", "fri"], ["토", "sat"], ["일", "sun"],
  ];
  const toHHMM = (v) => {
    if (!v) return null;
    if (typeof v === "string") {
      const [hh = "", mm = ""] = v.split(":");
      if (!hh || !mm) return null;
      return `${pad2(hh)}:${pad2(mm)}`;
    }
    if (typeof v === "object" && v !== null) {
      const hh = Number(v.hour ?? v.HH ?? v.h);
      const mm = Number(v.minute ?? v.MM ?? v.m);
      if (Number.isFinite(hh) && Number.isFinite(mm)) return `${pad2(hh)}:${pad2(mm)}`;
    }
    return null;
  };

  if (!op || typeof op !== "object") return defaultCafe.hours.weekly;

  return dayMap.map(([label, key]) => {
    const isOpen = Boolean(op[`${key}IsOpen`]);
    if (!isOpen) return [label, "휴무일"];
    const open = toHHMM(op[`${key}Open`]);
    const close = toHHMM(op[`${key}Close`]);
    if (!open || !close) return [label, "휴무일"];
    return [label, `${open} - ${close}`];
  });
}

const IS_DEV = process.env.NODE_ENV === "development";
const API_HOST = IS_DEV ? "http://3.27.150.124:8080" : "";
const API_PREFIX = `${API_HOST}/hackathon/api`;

/** ✅ 카페 API → UI용 cafe 객체 변환 (images만 사용, id 포함) */
function toUiCafe(api) {
  const photos =
    Array.isArray(api?.images) && api.images.length
      ? api.images
          .map((img) => {
            const url = typeof img === "string" ? img : img?.url;
            if (!url) return null;
            return url.startsWith("http") ? url : `${API_HOST}${url}`;
          })
          .filter(Boolean)
      : []; // ✅ 없으면 빈 배열(=검정 화면)

  const storeUserId = api?.storeUserId ?? api?.ownerUserId ?? api?.ownerId ?? null;

  return {
    id: api?.id ?? null, // ✅ cafe id 포함
    name: api?.name ?? defaultCafe.name,
    addr: api?.location ?? defaultCafe.addr,
    photos,
    hours: { weekly: defaultCafe.hours.weekly }, // 별도 요청으로 갱신
    ppl: Number(api?.maxSeats) > 0 ? Number(api.maxSeats) : defaultCafe.ppl,
    minOrder: api?.minOrder || defaultCafe.minOrder,
    spaceType: api?.spaceType || defaultCafe.spaceType,
    phoneNumber: api?.phoneNumber || "",
    storeUserId,
  };
}

export default function Reserve() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const resolvedCafeId = useMemo(() => {
    const byParam = params.cafeId && !Number.isNaN(Number(params.cafeId)) ? Number(params.cafeId) : null;
    const byState = location.state?.cafeId && !Number.isNaN(Number(location.state.cafeId))
      ? Number(location.state.cafeId) : null;
    const byLsRaw = window.localStorage.getItem("cafe_id");
    const byLs = byLsRaw && !Number.isNaN(Number(byLsRaw)) ? Number(byLsRaw) : null;
    return byParam || byState || byLs || null;
  }, [params.cafeId, location.state]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [cafe, setCafe] = useState(defaultCafe);

  useEffect(() => {
    let aborted = false;
    async function fetchCafe() {
      if (!resolvedCafeId) {
        setLoadError("유효한 카페 ID를 찾을 수 없어요.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError("");
      try {
        const resInfo = await fetch(`${API_PREFIX}/cafe/${resolvedCafeId}`, {
          method: "GET",
          headers: { accept: "*/*" },
        });
        if (!resInfo.ok) throw new Error(`HTTP ${resInfo.status}`);
        const info = await resInfo.json();
        if (aborted) return;

        const ui = toUiCafe(info);
        setCafe(ui);

        // 운영시간 추가 로드
        try {
          const resOp = await fetch(`${API_PREFIX}/cafe/${resolvedCafeId}/operating`, {
            method: "GET",
            headers: { accept: "*/*" },
          });
          if (resOp.ok) {
            const op = await resOp.json();
            if (!aborted) {
              const weekly = buildWeeklyFromOperating(op);
              setCafe((prev) => ({ ...prev, hours: { weekly } }));
            }
          } else {
            console.warn("operating hours fetch failed:", resOp.status);
          }
        } catch (err) {
          console.warn("operating hours error:", err);
        }
      } catch (e) {
        if (aborted) return;
        setLoadError("카페 정보를 불러오지 못했어요.");
        setCafe(defaultCafe);
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    fetchCafe();
    return () => { aborted = true; };
  }, [resolvedCafeId]);

  /** ===== 사진 캐러셀 ===== */
  const photos = Array.isArray(cafe.photos) && cafe.photos.length ? cafe.photos : [];
  const [idx, setIdx] = useState(0);
  const totalSlides = photos.length;
  const goTo = (i) => setIdx(Math.max(0, Math.min(i, totalSlides - 1)));
  const prevSlide = () => goTo(idx - 1);
  const nextSlide = () => goTo(idx + 1);

  const dragRef = useRef({ down: false, x: 0, startIdx: 0 });
  const onPointerDown = (e) => {
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    dragRef.current = { down: true, x, startIdx: idx };
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.down) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = x - dragRef.current.x;
    if (Math.abs(dx) > 50) {
      if (dx < 0) nextSlide(); else prevSlide();
      dragRef.current.down = false;
    }
  };
  const onPointerUp = () => { dragRef.current.down = false; };

  /** ===== 탭 & 잉크바 ===== */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToSection = (ref, tabName) => {
    if (!ref.current) return;
    setActiveTab(tabName);
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => moveInk(tabName));
  };

  /** ===== 예약 폼 상태 ===== */
  const [type, setType] = useState("프로젝트 회의");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("18:00");
  const [headcount, setHeadcount] = useState(1);

  const maxHeadcount = cafe.ppl ?? defaultCafe.ppl;
  useEffect(() => {
    setHeadcount((h) => Math.min(Math.max(1, h), maxHeadcount));
  }, [maxHeadcount]);

  /** ===== 운영 시간 계산 ===== */
  const weekly = cafe.hours?.weekly ?? defaultCafe.hours.weekly;

  const dayEntry = useMemo(() => getEntryForDate(weekly, date), [weekly, date]);
  const openRange = useMemo(() => {
    if (!dayEntry) return null;
    const [, str] = dayEntry;
    if (!str || str.includes("휴무")) return null;
    const [s, e] = parseRangeToMinutes(str);
    return { s, e };
  }, [dayEntry]);

  const todayLabel = DAY_LABELS[new Date().getDay()];
  const todayEntry = weekly.find(([day]) => day === todayLabel) || null;
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

  const [runText, setRunText] = useState("휴무일");
  const [isOpenNow, setIsOpenNow] = useState(false);
  useEffect(() => {
    if (!todayRange) {
      setRunText("휴무일");
      setIsOpenNow(false);
      return;
    }
    const update = () => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin < todayRange.s) setRunText("운영 전");
      else if (nowMin < todayRange.e) setRunText("운영중");
      else setRunText("영업 종료");
      setIsOpenNow(nowMin >= todayRange.s && nowMin < todayRange.e);
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [todayRange]);

  /** ===== 시간 선택 유효성 ===== */
  const isStartEnabled = (hhmm) => {
    if (!openRange) return false;
    const t = hhmmToMin(hhmm);
    return t >= openRange.s && (t + TIME_STEP) <= openRange.e;
  };
  const isEndEnabled = (hhmm, currentStart) => {
    if (!openRange) return false;
    const t = hhmmToMin(hhmm);
    const s = hhmmToMin(currentStart);
    return t > s && t <= openRange.e;
  };
  const findNextEnabledEnd = (currentStart) => {
    if (!openRange) return currentStart;
    const s = hhmmToMin(currentStart);
    const minEnd = s + TIME_STEP;
    for (const slot of timeSlots) {
      const t = hhmmToMin(slot);
      if (t >= minEnd && isEndEnabled(slot, currentStart)) return slot;
    }
    return currentStart;
  };
  const findPrevEnabledStart = (newEnd) => {
    if (!openRange) return newEnd;
    const e = hhmmToMin(newEnd);
    const maxStart = e - TIME_STEP;
    for (let i = timeSlots.length - 1; i >= 0; i--) {
      const slot = timeSlots[i];
      const t = hhmmToMin(slot);
      if (t <= maxStart && isStartEnabled(slot)) return slot;
    }
    return newEnd;
  };

  /** ===== 요금 계산(예시) ===== */
  const price = useMemo(() => {
    const s = hhmmToMin(start);
    const e = hhmmToMin(end);
    const hours = Math.max(0, (e - s) / 60);
    return Math.round(hours * 6000);
  }, [start, end]);

  /** ===== 타임라인 표시 ===== */
  const selStartMin = hhmmToMin(start);
  const selEndMin = hhmmToMin(end);
  const morningSelected = getRowSegment(selStartMin, selEndMin, 0, 12);
  const afternoonSelected = getRowSegment(selStartMin, selEndMin, 12, 24);

  const FULL_DAY_END = 24 * 60;
  const morningUnA = getRowSegment(0, openRange ? openRange.s : FULL_DAY_END, 0, 12);
  const morningUnB = openRange ? getRowSegment(openRange.e, FULL_DAY_END, 0, 12) : { show: false, left: 0, width: 0 };
  const afternoonUnA = getRowSegment(0, openRange ? openRange.s : FULL_DAY_END, 12, 24);
  const afternoonUnB = openRange ? getRowSegment(openRange.e, FULL_DAY_END, 12, 24) : { show: false, left: 0, width: 0 };

  /** ===== 유저 ID ===== */
  const getUserId = () => {
    const a = window.localStorage.getItem("user_id");
    const b = window.localStorage.getItem("userId");
    const parsedA = a && !Number.isNaN(Number(a)) ? Number(a) : null;
    const parsedB = b && !Number.isNaN(Number(b)) ? Number(b) : null;
    return parsedA ?? parsedB ?? null;
  };

  /** ===== 채팅방 생성 ===== */
  const [creatingChat, setCreatingChat] = useState(false);

  async function tryFindExistingRoom(userId, storeUserId, cafeId) {
    const headers = { accept: "*/*" };
    try {
      if (cafeId) {
        const urlWithCafe = `${API_PREFIX}/chat/room/find?userId=${encodeURIComponent(
          userId
        )}&storeUserId=${encodeURIComponent(storeUserId)}&cafeId=${encodeURIComponent(cafeId)}`;
        const res1 = await fetch(urlWithCafe, { method: "GET", headers });
        if (res1.ok) {
          const data1 = await res1.json();
          const roomId1 = data1?.result?.roomId ?? data1?.roomId ?? null;
          if (roomId1) return roomId1;
        }
      }
      const url = `${API_PREFIX}/chat/room/find?userId=${encodeURIComponent(
        userId
      )}&storeUserId=${encodeURIComponent(storeUserId)}`;
      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) return null;
      const data = await res.json();
      const roomId = data?.result?.roomId ?? data?.roomId ?? null;
      return roomId || null;
    } catch {
      return null;
    }
  }

  const handleCreateChat = async () => {
    const userId = getUserId();
    const storeUserId = cafe.storeUserId ?? null;
    const cafeId = resolvedCafeId ?? cafe.id ?? null;

    if (!userId) return alert("로그인이 필요해요. (user_id를 찾을 수 없음)");
    if (!storeUserId) return alert("판매자 정보를 찾을 수 없어요. (storeUserId 없음)");
    if (!cafeId) return alert("유효한 카페 ID가 없어요. (cafeId 없음)");
    if (creatingChat) return;

    setCreatingChat(true);
    try {
      const res = await fetch(`${API_PREFIX}/chat/room/create`, {
        method: "POST",
        headers: { accept: "*/*", "Content-Type": "application/json" },
        body: JSON.stringify({ userId, storeUserId, cafeId }), // ✅ cafeId 함께 전송
      });

      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch {}

      const ok = res.ok && data?.isSuccess === true && data?.result?.roomId;
      if (ok) {
        navigate(`/chat/room/${data.result.roomId}`);
        return;
      }

      if (data?.code === "USER404") {
        alert("유저 정보를 찾지 못했어요. 다시 로그인해 주세요.");
        return;
      }
      if (data?.code === "CHAT-ROOM409") {
        const resRoomId = data?.result?.roomId ?? data?.roomId ?? null;
        if (resRoomId) {
          navigate(`/chat/room/${resRoomId}`);
          return;
        }
        const found = await tryFindExistingRoom(userId, storeUserId, cafeId);
        if (found) {
          navigate(`/chat/room/${found}`);
          return;
        }
        alert("이미 개설된 채팅방이 있어요. 채팅 목록에서 확인해주세요.");
        navigate("/chat");
        return;
      }

      const looksLikeDuplicate500 =
        res.status === 500 &&
        /Duplicate entry/i.test(String(data?.result ?? data?.message ?? text ?? ""));
      if (looksLikeDuplicate500) {
        const found = await tryFindExistingRoom(userId, storeUserId, cafeId);
        if (found) {
          navigate(`/chat/room/${found}`);
          return;
        }
        alert("이미 개설된 채팅방이 있어요. 채팅 목록에서 확인해주세요.");
        navigate("/chat");
        return;
      }

      console.error("채팅방 생성 실패:", res.status, data);
      alert(`채팅방 생성 실패 (HTTP ${res.status})`);
    } catch (e) {
      console.error("채팅방 생성 예외:", e);
      alert("채팅방을 생성하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setCreatingChat(false);
    }
  };

  /** ===== 예약 생성 ===== */
  const [creatingReservation, setCreatingReservation] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const cafeId = resolvedCafeId ?? cafe.id;
    if (!cafeId) {
      alert("유효한 카페 ID가 없습니다.");
      return;
    }
    const userId = getUserId();
    if (!userId) {
      alert("로그인이 필요해요. (user_id를 찾을 수 없음)");
      return;
    }
    if (!openRange) {
      alert("선택한 날짜는 휴무일이에요.");
      return;
    }
    const sOk = isStartEnabled(start);
    const eOk = isEndEnabled(end, start);
    if (!sOk || !eOk) {
      alert("운영시간 밖의 시간입니다. 시간을 다시 선택해주세요.");
      return;
    }

    // ✅ 라벨을 서버 Enum 문자열로 변환
    const mappedMeetingType = MEETING_TYPE_ENUM[type];
    if (!mappedMeetingType) {
      alert("회의 종류 매핑을 찾을 수 없습니다. 관리자에게 문의해주세요.");
      return;
    }

    const payload = {
      userId,
      cafeId, // ✅ cafe id 포함 보장
      meetingType: mappedMeetingType, // ✅ 서버 Enum 값 사용
      date, // "YYYY-MM-DD"
      peopleCount: headcount,
      startTime: hhmmToHHMMSS(start),
      endTime: hhmmToHHMMSS(end),
    };

    if (creatingReservation) return;
    setCreatingReservation(true);
    try {
      const res = await fetch(`${API_PREFIX}/reservation/create`, {
        method: "POST",
        headers: {
          accept: "*/*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.error("예약 생성 실패:", res.status, errJson);
        alert(`예약을 생성하지 못했어요. (HTTP ${res.status})`);
        return;
      }

      const data = await res.json();
      const rid =
        data?.result?.reservationsId ??
        data?.result?.reservationId ??
        data?.reservationsId ??
        null;

      alert(
        [
          "✓ 예약이 생성되었어요!",
          `- 예약번호: ${rid ?? "(알 수 없음)"}`,
          `- 장소: ${cafe.name}`,
          `- 일자: ${date}`,
          `- 시간: ${start} ~ ${end}`,
          `- 인원: ${headcount}명`,
          `- 종류: ${type}`,
          `- 금액: ${price.toLocaleString()}원 (예시)`,
        ].join("\n")
      );

      navigate(-1);
    } catch (err) {
      console.error("예약 생성 예외:", err);
      alert("예약을 생성하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setCreatingReservation(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <div className={styles.appbar}>
          <button className={styles.backBtn} aria-label="뒤로가기" onClick={() => navigate(-1)}>
            <img className={styles.backIcon} src={backIcon} alt="" />
          </button>
          <h1 className={styles.title}>
            {loading ? "불러오는 중..." : cafe.name}
          </h1>
          <span aria-hidden />
        </div>

        <div className={styles.photoCarousel}>
          {totalSlides > 0 ? (
            <>
              <div className={styles.badge}>{idx + 1}/{totalSlides}</div>

              {totalSlides > 1 && (
                <>
                  <button
                    type="button"
                    className={`${styles.navBtn} ${styles.navLeft}`}
                    onClick={prevSlide}
                    disabled={idx === 0}
                    aria-label="이전 사진"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M15 6l-6 6 6 6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className={`${styles.navBtn} ${styles.navRight}`}
                    onClick={nextSlide}
                    disabled={idx === totalSlides - 1}
                    aria-label="다음 사진"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </>
              )}

              <div
                className={styles.slides}
                style={{ transform: `translateX(-${idx * 100}%)` }}
                onMouseDown={onPointerDown}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
              >
                {photos.map((src, i) => (
                  <div className={styles.photoSlide} key={`${src}-${i}`}>
                    <img className={styles.photo} src={src} alt={`${cafe.name} 사진 ${i + 1}`} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            // ✅ 사진이 하나도 없으면 검정 배경만
            <div className={styles.photoSlide} />
          )}
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

          {loadError && <p className={styles.errorText}>{loadError}</p>}

          <div className={styles.row}>
            <img src={locationIcon} className={styles.rowIcon} alt="" aria-hidden />
            <span className={styles.k}>위치</span>
            <span className={styles.v}>{cafe.addr}</span>
          </div>

          <div className={styles.row}>
            <span className={styles.k}>연락처</span>
            <span className={styles.v}>{cafe.phoneNumber || "전화번호 미등록"}</span>
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
                  <span className={styles.runText}>{isOpenNow ? "운영중" : runText}</span>
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
            <button
              className={styles.outlineBtn}
              type="button"
              onClick={() => cafe.phoneNumber && window.open(`tel:${cafe.phoneNumber}`)}
            >
              <img src={phoneIcon} className={styles.btnIcon} alt="" aria-hidden />
              전화하기
            </button>

            <button
              className={styles.outlineBtn}
              type="button"
              onClick={handleCreateChat}
              disabled={creatingChat}
            >
              <img src={chatIcon} className={styles.btnIcon} alt="" aria-hidden />
              {creatingChat ? "채팅방 생성 중..." : "채팅 문의하기"}
            </button>
          </div>
        </section>

        <section className={`${styles.section} ${styles.meetingInfo}`}>
          <h2 className={styles.sectionTitle}>회의실 이용 정보</h2>
          <div className={styles.row}>
            <span className={styles.k}>최소 주문</span>
            <span className={styles.v}>{cafe.minOrder}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.k}>수용가능인원</span>
            <span className={styles.v}>최대 {cafe.ppl}명</span>
          </div>
          <div className={styles.row}>
            <span className={styles.k}>공간</span>
            <span className={styles.v}>{cafe.spaceType}</span>
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
                  onClick={() => {
                    dateInputRef.current?.showPicker?.();
                    if (!dateInputRef.current?.showPicker) {
                      dateInputRef.current?.focus();
                      dateInputRef.current?.click();
                    }
                  }}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (dateInputRef.current?.showPicker?.() || dateInputRef.current?.click())}
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
                          if (!openRange) return;
                          const next = findNextEnabledEnd(v);
                          if (!isEndEnabled(end, v)) setEnd(next);
                        }}
                      >
                        {timeSlots.map((t) => (
                          <option key={t} value={t} disabled={openRange ? !isStartEnabled(t) : false}>
                            {t}
                          </option>
                        ))}
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
                          if (openRange) {
                            const sMin = hhmmToMin(start);
                            const eMin = hhmmToMin(v);
                            if (eMin <= sMin) {
                              const prevStart = findPrevEnabledStart(v);
                              setStart(prevStart);
                            }
                          }
                          setEnd(v);
                        }}
                      >
                        {timeSlots.map((t) => (
                          <option key={t} value={t} disabled={openRange ? !isEndEnabled(t, start) : false}>
                            {t}
                          </option>
                        ))}
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
                  >
                    -
                  </button>
                  <span>{headcount} 명</span>
                  <button
                    type="button"
                    onClick={() => setHeadcount((h) => Math.min(maxHeadcount, h + 1))}
                    disabled={headcount >= maxHeadcount}
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
            <button className={styles.cta} type="submit" disabled={loading || !!loadError || creatingReservation}>
              {creatingReservation ? "예약 생성 중..." : (loading ? "불러오는 중..." : "예약 요청하기")}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

const dateInputRef = React.createRef();

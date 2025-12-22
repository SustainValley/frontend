import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import KakaoMap from '../../components/map/KakaoMap';
import styles from './UserMain.module.css';
import { useAuth } from '../../context/AuthContext';
import { getUserId as getStoredUserId } from '../../lib/axios';

import searchIcon from '../../assets/Search.svg';
import filterIcon from '../../assets/filter.svg';
import menuIcon from '../../assets/tabler_menu-2.svg';
import chatIcon from '../../assets/tabler_message-circle2.svg';
import locationIcon from '../../assets/Group1.svg';
import clockIcon from '../../assets/clock.svg';
import peopleIcon from '../../assets/people.svg';
import chatIcon2 from '../../assets/chat.svg';

import defaultCafeLogo from '../../assets/Logo-gray.svg';

import inuseRightImg from '../../assets/logo3.svg';

const KST_OFFSET = '+09:00';

const pad2 = (n) => String(n).padStart(2, '0');

const minutesToHHMM = (mins) => {
  const m = Math.max(0, mins);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
};

// "08:00:00" -> "08:00"
const fmtHHMM = (t = '') => {
  if (!t) return '';
  const [hh = '', mm = ''] = String(t).split(':');
  return `${hh}:${mm}`;
};

const fmtDateDot = (d = '') => (d ? d.replaceAll('-', '.') : '');
const weekdayKo = ['일', '월', '화', '수', '목', '금', '토'];
const dateWithWeekday = (isoDate) => {
  if (!isoDate) return '';
  const dt = new Date(`${isoDate}T00:00:00`);
  const w = weekdayKo[dt.getDay()];
  return `${fmtDateDot(isoDate)} (${w})`;
};

const durationFromTimes = (start = '', end = '') => {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
};

const kstDateTime = (date, hhmm) => {
  const t = `${hhmm}:00`;
  return new Date(`${date}T${t}${KST_OFFSET}`);
};

const buildRangeKST = (date, startHHMM, endHHMM) => {
  const start = kstDateTime(date, startHHMM);
  let end = kstDateTime(date, endHHMM);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { startMs: start.getTime(), endMs: end.getTime() };
};

const meetingTypeKo = (t) => {
  switch (t) {
    case 'STUDY': return '스터디';
    case 'MEETING': return '회의';
    case 'INTERVIEW': return '인터뷰';
    case 'PROJECT': return '프로젝트';
    case 'NETWORKING': return '네트워킹';
    default: return '기타';
  }
};

const statusLabelKo = (status) => {
  switch (status) {
    case 'inuse': return '회의실 이용 중이에요!';
    case 'pending': return '회의실 이용 요청 중이에요!';
    case 'scheduled': return '회의실 이용 예정이에요!';
    default: return '';
  }
};

/** ✅ 거절 사유 코드 -> 한국어 라벨 매핑 */
const CANCEL_REASON_LABELS = {
  CLOSED_TIME: '해당 시간대 예약 마감',
  OUT_OF_BUSINESS: '영업시간 외 예약요청',
  CROWDED: '매장 혼잡',
  EQUIPMENT_UNAVAILABLE: '요청 장비 사용 불가',
  MAINTENANCE: '시설 점검',
  PEAK_LIMIT: '피크타임 인원 제한',
};

const cancelReasonToKo = (code) => {
  if (!code) return null;
  return CANCEL_REASON_LABELS[code] || code;
};

const toFrontStatus = (reservationStatus, attendanceStatus) => {
  const REJECTEDS = ['REJECTED', 'CANCELLED', 'CANCELED', 'DENIED'];
  const APPROVED = 'APPROVED';
  if (REJECTEDS.includes(reservationStatus)) return null;
  if (attendanceStatus === 'COMPLETED') return null;
  if (reservationStatus === APPROVED) {
    if (attendanceStatus === 'IN_USE') return 'inuse';
    return 'scheduled';
  }
  return 'pending';
};

const IS_DEV = process.env.NODE_ENV === 'development';
const DEV_API_HOST = 'http://54.180.2.235:8080';
const PROD_API_HOST = 'https://mocacafe.site';
const API_HOST = IS_DEV ? DEV_API_HOST : PROD_API_HOST;
const API_PREFIX = `${API_HOST}/hackathon/api`;

const MEDIA_HOST = API_HOST;
const withHost = (url) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${MEDIA_HOST}${path}`;
};



const near = (a, b, eps = 0.001) => {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < eps && Math.abs(a.lng - b.lng) < eps;
};

const getCenterLatLng = (map) => {
  if (!map?.getCenter) return null;
  const c = map.getCenter();
  if (!c?.getLat || !c?.getLng) return null;
  return { lat: c.getLat(), lng: c.getLng() };
};

const panToLatLng = (api, lat, lng, level = 4) => {
  const kakao = window?.kakao;
  if (!api || !kakao?.maps) return;

  const map = api.getMap ? api.getMap() : api;
  const pos = new kakao.maps.LatLng(lat, lng);

  if (map.panTo) map.panTo(pos);
  else if (map.setCenter) map.setCenter(pos);

  if (map.getLevel && map.setLevel) {
    if (map.getLevel() > level) map.setLevel(level);
  }
};

/** ✅ 마곡역 좌표(고정) */
const GONGNEUNG = { lat: 37.5600, lng: 126.8270 };

/** ✅ Geolocation 옵션 */
const GEO_OPTS = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 30_000,
};

export default function UserMain() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const filters = location.state?.filters || { spaces: [], people: 0 };

  const [input, setInput] = useState('');
  const [cafes, setCafes] = useState([]);
  const [selectedCafeId, setSelectedCafeId] = useState(null);

  const wrapRef = useRef(null);
  const mapRef = useRef(null);
  const [ch, setCh] = useState(800);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const openMenu = () => {
    setMenuVisible(true);
    requestAnimationFrame(() => setIsMenuOpen(true));
  };
  const closeMenu = () => {
    setIsMenuOpen(false);
    setTimeout(() => setMenuVisible(false), 250);
  };

  // ✅ 내 현재 위치
  const [myPos, setMyPos] = useState(null);

  const requestMyPos = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setMyPos(p);
          resolve(p);
        },
        (err) => {
          console.warn('geolocation error', err);
          resolve(null);
        },
        GEO_OPTS
      );
    });

  useEffect(() => {
    requestMyPos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 카페 리스트
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const res = await fetch(`${API_PREFIX}/cafe/cafelist`, {
          headers: { accept: '*/*' },
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!abort) setCafes(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('cafelist error', e);
        if (!abort) setCafes([]);
      }
    })();
    return () => { abort = true; };
  }, []);

  // 화면 높이 추적
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setCh(Math.max(300, Math.round(e.contentRect.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 바텀시트 스냅 포인트
  const SNAP = useMemo(() => {
    const HEADER = 300;
    const BUTTON_MARGIN = 120;
    const FULL_TOP = HEADER + BUTTON_MARGIN;
    const MID_TOP = Math.round(ch * 0.65);
    const PEEK = 140;
    const PEEK_TOP = ch - PEEK;
    return { FULL_TOP, MID_TOP, PEEK_TOP, MIN: FULL_TOP, MAX: PEEK_TOP };
  }, [ch]);

  const [sheetTop, setSheetTop] = useState(0);
  useLayoutEffect(() => {
    setSheetTop(SNAP.PEEK_TOP);
  }, [SNAP.PEEK_TOP]);

  const drag = useRef({ active: false, startY: 0, startTop: SNAP.PEEK_TOP });
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const onPointerDown = (e) => {
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    drag.current = { active: true, startY: y, startTop: sheetTop };
    e.currentTarget.setPointerCapture?.(e.pointerId ?? 1);
  };
  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    const dy = y - drag.current.startY;
    setSheetTop(clamp(drag.current.startTop + dy, SNAP.MIN, SNAP.MAX));
  };
  const onPointerUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const mid1 = (SNAP.FULL_TOP + SNAP.MID_TOP) / 2;
    const mid2 = (SNAP.MID_TOP + SNAP.PEEK_TOP) / 2;
    setSheetTop(sheetTop <= mid1 ? SNAP.FULL_TOP : sheetTop <= mid2 ? SNAP.MID_TOP : SNAP.PEEK_TOP);
  };

  /* ====== ✅ 현재 위치 버튼: 내 위치 ↔ 마곡역 토글 ====== */
  const moveToMyLocation = async () => {
    const api = mapRef.current;
    const kakao = window?.kakao;
    if (!api || !kakao?.maps) return;

    const map = api.getMap ? api.getMap() : api;
    const center = getCenterLatLng(map);

    let p = myPos;
    if (!p) p = await requestMyPos();

    const isNearG = near(center, GONGNEUNG);
    const isNearM = p ? near(center, p) : false;

    if (p) {
      if (isNearM && !isNearG) {
        panToLatLng(api, GONGNEUNG.lat, GONGNEUNG.lng, 4);
      } else {
        panToLatLng(api, p.lat, p.lng, 4);
      }
      return;
    }
    panToLatLng(api, GONGNEUNG.lat, GONGNEUNG.lng, 4);
  };

  // ===== 예약 관련 상태 =====
  const [reservations, setReservations] = useState([]);
  const [activeReservation, setActiveReservation] = useState(null);

  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);
  const [cancelInFlight, setCancelInFlight] = useState(false);
  
  // ✅ 거절 모달 상태
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectedCafeName, setRejectedCafeName] = useState('');
  const [rejectedReason, setRejectedReason] = useState('');
  const [rejectedReservationId, setRejectedReservationId] = useState(null);
  const [shownRejectedIds, setShownRejectedIds] = useState(new Set());

  const userId = useMemo(() => {
    const fromState = location.state?.userId;
    const fromStorage = getStoredUserId();
    return fromState ?? (fromStorage || null);
  }, [location.state]);

  // ✅ 남은시간 갱신용 nowMs (30초마다)
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  // 예약 조회
  useEffect(() => {
    let abort = false;
    const fetchReservations = async () => {
      if (!userId) {
        if (!abort) setReservations([]);
        return;
      }
      try {
        const res = await fetch(
          `${API_PREFIX}/reservation?userId=${encodeURIComponent(userId)}`,
          {
            headers: { accept: '*/*' },
            credentials: 'include',
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const raw = Array.isArray(data?.result) ? data.result : [];

        // ✅ 거절된 예약 감지 (cancelChecked가 false인 경우만 표시)
        const REJECTEDS = ['REJECTED', 'CANCELLED', 'CANCELED', 'DENIED'];
        const rejectedReservation = raw.find((row) => {
          const isRejected = REJECTEDS.includes(row.reservationStatus) && 
                           row.attendanceStatus !== 'COMPLETED';
          const reservationId = String(row.reservationsId ?? '');
          const isNotChecked = row.cancelChecked !== true; // cancelChecked가 true가 아닌 경우만
          return isRejected && isNotChecked && !shownRejectedIds.has(reservationId);
        });
        
        if (rejectedReservation && !abort) {
          const reservationId = String(rejectedReservation.reservationsId ?? '');
          const cafeName = rejectedReservation.cafeName || `카페 #${rejectedReservation.cafeId ?? '-'}`;
          const reasonCode = rejectedReservation.cancelReason || rejectedReservation.rejectReason || '';
          const reasonText = cancelReasonToKo(reasonCode);
          console.log('거절된 예약:', rejectedReservation, '사유 코드:', reasonCode, '사유 텍스트:', reasonText);
          setRejectedCafeName(cafeName);
          setRejectedReason(reasonText || '');
          setRejectedReservationId(rejectedReservation.reservationsId);
          setShowRejectModal(true);
          setShownRejectedIds((prev) => new Set([...prev, reservationId]));
        }

        const mapped = raw
          .map((row, idx) => {
            const status = toFrontStatus(row.reservationStatus, row.attendanceStatus);
            if (!status) return null;

            const startHHMM = fmtHHMM(row.startTime);
            const endHHMM = fmtHHMM(row.endTime);
            const time = `${startHHMM} - ${endHHMM}`;

            const { startMs, endMs } = buildRangeKST(row.date, startHHMM, endHHMM);

            const rawImg = row.cafeImageUrl ?? row.imageUrl ?? null;
            const thumb = withHost(rawImg);

            return {
              id: String(row.reservationsId ?? idx),
              cafeId: row.cafeId,                // ✅ 추가
              cafe: row.cafeName || `카페 #${row.cafeId ?? '-'}`,
              time,
              status,
              people: row.peopleCount ?? 0,
              meetingType: row.meetingType || '',
              dateText: dateWithWeekday(row.date),
              durationText: durationFromTimes(startHHMM, endHHMM),
              phone: row.phoneNumber || '',
              name: row.nickname || '',
              thumb,
              startTime: startHHMM,
              endTime: endHHMM,
              date: row.date,
              startMs,
              endMs,
            };
          })
          .filter(Boolean);

        if (!abort) setReservations(mapped);
      } catch (err) {
        console.error('reservation error', err);
        if (!abort) setReservations([]);
      }
    };
    fetchReservations();
    return () => { abort = true; };
  }, [userId]);

  const visibleReservations = useMemo(
    () => reservations.filter((r) => ['inuse', 'scheduled', 'pending'].includes(r.status)),
    [reservations]
  );

  const openReservationDetail = (r) => {
    setActiveReservation(r);
    if (['scheduled', 'inuse', 'pending'].includes(r.status)) setShowDetailSheet(true);
  };

  // 카페 카드 가공
  const decorateCafe = (c, i) => {
    const raw = c.operatingHours ?? '';
    const str = String(raw || '').trim();
    let hoursKind = 'OPEN_TEXT';
    let hoursHint = str;

    if (!str) {
      hoursKind = 'UNREGISTERED';
      hoursHint = '영업시간 미등록';
    } else if (str.includes('휴무')) {
      hoursKind = 'CLOSED';
      hoursHint = '휴무일';
    }

    return {
      id: String(c.cafeId ?? i),
      cafeId: c.cafeId,
      name: c.name || '이름없는 카페',
      addr: c.address || '주소 준비중',
      thumb: withHost(c.imageUrl),
      hours: hoursHint,
      hoursRaw: raw,
      hoursKind,
      spaceType: c.spaceType || '',
      ppl: Number.isFinite(c.maxSeats) ? c.maxSeats : 0,
    };
  };

  const shortSpace = (s = '') => String(s).split('(')[0].trim();

  const rawList = cafes.map(decorateCafe);

  const norm = (s = '') => String(s).toLowerCase().trim();
  const q = norm(input);
  const bySearch = q
    ? rawList.filter((c) => norm(c.name).includes(q) || norm(c.addr).includes(q))
    : rawList;

  const spaceKeyFromCafe = (cafe) => {
    const s = cafe.spaceType || '';
    if (s.includes('오픈')) return 'open';
    if (s.includes('조용') || s.includes('제한적')) return 'quiet';
    if (s.includes('회의실')) return 'room';
    return 'limited';
  };

  const byFilters = bySearch.filter((cafe) => {
    const matchSpace = filters.spaces.length === 0 || filters.spaces.includes(spaceKeyFromCafe(cafe));
    const matchPeople = filters.people === 0 || cafe.ppl >= filters.people;
    return matchSpace && matchPeople;
  });

  const listForRender = selectedCafeId
    ? byFilters.filter((c) => String(c.cafeId) === String(selectedCafeId))
    : byFilters;

  const cafesForMap = listForRender.map((c) => ({
    cafeId: c.cafeId,
    name: c.name,
    address: c.addr,
    operatingHours: c.hours,
    imageUrl: c.thumb,
    maxSeats: c.ppl,
    spaceType: c.spaceType,
  }));

  const handlePlaceClick = (cafe) => {
    setSelectedCafeId(cafe.cafeId ?? null);
  };

  // 가로 드래그 스트립
  const stripRef = useRef(null);
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const dragMovedRef = useRef(false);

  const onStripMouseDown = (e) => {
    const el = stripRef.current;
    if (!el) return;
    dragState.current.isDown = true;
    dragMovedRef.current = false;
    el.classList.add(styles.dragging);
    dragState.current.startX = e.pageX - el.offsetLeft;
    dragState.current.scrollLeft = el.scrollLeft;
  };
  const onStripMouseMove = (e) => {
    const el = stripRef.current;
    if (!el || !dragState.current.isDown) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = x - dragState.current.startX;
    if (Math.abs(walk) > 5) dragMovedRef.current = true;
    el.scrollLeft = dragState.current.scrollLeft - walk;
  };
  const endStripDrag = () => {
    const el = stripRef.current;
    dragState.current.isDown = false;
    el?.classList.remove(styles.dragging);
  };

  // 취소 사유 코드 매핑
  const reasonToCode = (text = '') => {
    const t = String(text).trim();
    const pairs = [
      ['일정 변경', 'SCHEDULE_CHANGE'],
      ['개인 사정', 'PERSONAL_REASON'],
      ['예약 시간 착오', 'TIME_MISTAKE'],
      ['시간 착오', 'TIME_MISTAKE'],
      ['장소 변경', 'LOCATION_CHANGE'],
      ['참석 인원 부족', 'LACK_OF_ATTENDEES'],
      ['인원 부족', 'LACK_OF_ATTENDEES'],
      ['비용', 'BUDGET_ISSUE'],
      ['예산', 'BUDGET_ISSUE'],
      ['중복 예약', 'DUPLICATE'],
      ['중복', 'DUPLICATE'],
    ];
    const hit = pairs.find(([key]) => t.includes(key));
    return hit ? hit[1] : 'PERSONAL_REASON';
  };

  const isReservations = location.pathname.startsWith('/user/reservations');

  const cancelReservation = async ({ reservationId, userId, reasonText }) => {
    const reasonCode = reasonToCode(reasonText);
    const url = `${API_PREFIX}/reservation/delete/${encodeURIComponent(reservationId)}?userId=${encodeURIComponent(
      userId
    )}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        accept: '*/*',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ cancelReason: reasonCode }),
    });

    if (!res.ok) {
      throw new Error(`취소 실패 (HTTP ${res.status})`);
    }
    const data = await res.json().catch(() => ({}));
    if (data?.isSuccess === false) {
      throw new Error(data?.message || '취소 실패');
    }
    return data;
  };

  const handleConfirmCancel = async () => {
    if (!activeReservation) return;
    try {
      setCancelInFlight(true);
      const reservationId = Number(activeReservation.id);
      await cancelReservation({
        reservationId,
        userId,
        reasonText: selectedReason,
      });

      setReservations((prev) => prev.filter((r) => r.id !== String(reservationId)));
      setActiveReservation(null);
      setShowCancelModal(false);
      setShowResultModal(true);
    } catch (err) {
      console.error(err);
      alert(err?.message || '예약을 취소할 수 없어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setCancelInFlight(false);
    }
  };

  const handleImgErrorToLogo = (e) => {
    const img = e.currentTarget;
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = '1';
    img.src = defaultCafeLogo;
  };

  const handleStoryShare = () => {
    if (!activeReservation) return;
    navigate('/user/story', {
      state: { reservation: activeReservation },
    });
  };

  // ✅ “바로 이용하기” 판단 로직(너 기존 그대로)
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function nowInKST() {
    const d = new Date();
    const h = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        hour12: false,
      }).format(d)
    );
    const m = Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', minute: '2-digit' }).format(d)
    );
    const w = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(d);
    return { minutes: h * 60 + m, dow: dayMap[w] ?? d.getDay() };
  }

  const [{ minutes: nowMin, dow: nowDow }, setNowInfo] = useState(nowInKST());
  useEffect(() => {
    const t = setInterval(() => setNowInfo(nowInKST()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  function daysFromTextKo(t) {
    const days = new Set();
    let hit = false;
    if (/매일|연중무휴/.test(t)) {
      [0, 1, 2, 3, 4, 5, 6].forEach((d) => days.add(d));
      hit = true;
    }
    if (/평일/.test(t)) {
      [1, 2, 3, 4, 5].forEach((d) => days.add(d));
      hit = true;
    }
    if (/주말/.test(t)) {
      [0, 6].forEach((d) => days.add(d));
      hit = true;
    }
    const ko = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
    const range = t.match(/([일월화수목금토])\s*[~\-–—]\s*([일월화수목금토])/);
    if (range) {
      const a = ko[range[1]];
      const b = ko[range[2]];
      hit = true;
      if (a <= b) for (let i = a; i <= b; i++) days.add(i);
      else {
        for (let i = a; i <= 6; i++) days.add(i);
        for (let i = 0; i <= b; i++) days.add(i);
      }
    }
    Object.entries(ko).forEach(([k, v]) => {
      if (t.includes(k + '요일') || t.includes(k)) {
        days.add(v);
        hit = true;
      }
    });
    return hit ? days : null;
  }

  function isOpenNowByText(rawText, nowMin, nowDow) {
    const s = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!s) return false;
    if (/상시|24\s*시간|24h/i.test(s)) return true;

    const segs = s.split(/[/|,\n]/).map((x) => x.trim()).filter(Boolean);
    let openRanges = [];

    for (const seg0 of segs.length ? segs : [s]) {
      const seg = seg0.replace(/브레이크\s*타임.*$/i, '');
      const days = daysFromTextKo(seg);
      const applies = days == null || days.has(nowDow);
      if (!applies) continue;

      if (/휴무|쉼|닫음|closed/i.test(seg)) continue;

      const regex = /(\d{1,2})(?::?(\d{2}))?\s*[~\-–—]\s*(\d{1,2})(?::?(\d{2}))?/g;
      for (const m of seg.matchAll(regex)) {
        const sh = Number(m[1]);
        const sm = Number(m[2] || '0');
        const eh = Number(m[3]);
        const em = Number(m[4] || '0');
        if (Number.isNaN(sh) || Number.isNaN(eh)) continue;
        const start = sh * 60 + sm;
        const end = eh * 60 + em;
        openRanges.push({ start, end });
      }
    }

    if (openRanges.length === 0) {
      if (/영업\s*중|open/i.test(s) && !/휴무/.test(s)) return true;
      return false;
    }

    for (const { start, end } of openRanges) {
      if (start <= end) {
        if (nowMin >= start && nowMin < end) return true;
      } else {
        if (nowMin >= start || nowMin < end) return true;
      }
    }
    return false;
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div className={styles.topbar}>
        <button className={styles.topBtn} aria-label="메뉴 열기" onClick={openMenu}>
          <img src={menuIcon} alt="" className={styles.topIcon} />
        </button>
        <div className={styles.topTitle}>MOCA</div>
        <button className={styles.topBtn} aria-label="채팅 열기" onClick={() => navigate('/chat')}>
          <img src={chatIcon} alt="" className={styles.topIcon} />
        </button>
      </div>

      <KakaoMap
        ref={mapRef}
        cafes={cafesForMap}
        onPlaceClick={handlePlaceClick}
        initialCenter={GONGNEUNG}
        initialLevel={4}
      />

      {menuVisible && (
        <>
          <div className={styles.menuBackdrop} onClick={closeMenu} />
          <div className={`${styles.sideMenu} ${isMenuOpen ? styles.open : styles.close}`}>
            <div className={styles.sideMenuInner}>
              <button
                className={`${styles.menuItem} ${styles.menuItemPrimary} ${isReservations ? styles.menuItemActive : ''}`}
                onClick={() => {
                  closeMenu();
                  navigate('/user/reservations');
                }}
              >
                나의 예약
              </button>
              <button
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={() => {
                  closeMenu();
                  logout();
                  navigate('/login');
                }}
              >
                로그아웃
              </button>
            </div>
          </div>
        </>
      )}

      <div className={styles.searchBar}>
        <img src={searchIcon} alt="" className={styles.icon} />
        <input
          className={styles.searchInput}
          placeholder="회의실 예약 원하는 카페를 검색해주세요."
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setSelectedCafeId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setInput('');
              setSelectedCafeId(null);
            }
          }}
        />
        <span className={styles.vline} aria-hidden />
        <button
          className={styles.filterBtn}
          onClick={() => navigate('/user/filters', { state: { filters } })}
          aria-label="필터 열기"
        >
          <img src={filterIcon} alt="" className={styles.icon} />
        </button>
      </div>

      <div className={styles.backdrop} style={{ height: `${Math.max(0, ch - sheetTop)}px` }} aria-hidden />

      <div className={styles.bottomSheet}>
        <div className={styles.sheetPanel} style={{ top: `${sheetTop}px`, height: `calc(100% - ${sheetTop}px)` }}>
          <div
            className={styles.handle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            aria-hidden
          />

          <button
            className={`${styles.myLocationBtn} ${visibleReservations.length ? styles.withReserve : styles.noReserve}`}
            onClick={moveToMyLocation}
            type="button"
          >
            <img src={locationIcon} alt="내 위치" />
          </button>

          {visibleReservations.length > 0 && (
            <div
              ref={stripRef}
              className={styles.reserveStrip}
              role="region"
              aria-label="예약 목록 가로 스크롤"
              onMouseDown={onStripMouseDown}
              onMouseMove={onStripMouseMove}
              onMouseUp={endStripDrag}
              onMouseLeave={endStripDrag}
            >
              {visibleReservations.map((r) => {
                const isInUse = r.status === 'inuse';

                // ✅ IN_USE면 날짜 상관없이 무조건 계산 (백엔드 신뢰)
                const remainingMins = isInUse
                  ? Math.ceil((r.endMs - nowMs) / 60000)
                  : null;

                const overdue = isInUse && nowMs > r.endMs;

                const remainingText = isInUse
                  ? minutesToHHMM(remainingMins ?? 0)
                  : null;

                const chipStatusClass =
                  r.status === 'scheduled'
                    ? styles.scheduled
                    : r.status === 'inuse'
                    ? styles.inuse
                    : styles.pending;

                return (
                  <button
                    key={r.id}
                    type="button"
                    className={[
                      styles.reserveChip,
                      chipStatusClass,
                      overdue ? styles.overdue : '',
                    ].join(' ')}
                    onClick={() => {
                      if (dragMovedRef.current) return;
                      openReservationDetail(r);
                    }}
                  >
                    <div className={styles.reserveCafe}>{r.cafe}</div>

                    <div className={styles.reserveInfo}>
                      {isInUse ? (
                        <>
                          <span className={styles.timeStrong}>{remainingText}</span>
                          {statusLabelKo(r.status)}
                        </>
                      ) : (
                        <>
                          <span className={styles.timeStrong}>{r.time}</span>
                          {statusLabelKo(r.status)}
                        </>
                      )}
                    </div>

                    {/* ✅ 이용중 + 초과 아님일 때만 오른쪽 이미지 */}
                    {isInUse && !overdue && (
                      <img
                        className={styles.inuseRightImg}
                        src={inuseRightImg}
                        alt=""
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className={styles.sheetContent}>
            <div className={styles.sheetTitle}>
              회의 가능한 카페를 둘러보세요!
              {selectedCafeId && (
                <button
                  className={styles.smallClearBtn}
                  onClick={() => setSelectedCafeId(null)}
                  style={{ marginLeft: 8 }}
                  type="button"
                >
                  전체 보기
                </button>
              )}
            </div>

            {listForRender.length === 0 ? (
              <div className={styles.cardGhost}>
                {q ? '검색 결과가 없어요. 검색어나 필터를 바꿔보세요.' : '지도의 핀을 선택하거나 검색어를 입력해보세요.'}
              </div>
            ) : (
              listForRender.map((cafe) => (
                <div key={cafe.id} className={styles.cafeCard}>
                  <img
                    className={styles.thumb}
                    src={cafe.thumb || defaultCafeLogo}
                    alt={cafe.name}
                    onError={handleImgErrorToLogo}
                  />

                  <div className={styles.info}>
                    <div className={styles.cafeName}>{cafe.name}</div>

                    <div className={styles.metaRow}>
                      <img src={clockIcon} alt="" className={styles.metaIcon} />
                      {cafe.hours}
                    </div>

                    <div className={styles.metaRow}>
                      <img src={chatIcon2} alt="" className={styles.metaIcon} />
                      {shortSpace(cafe.spaceType)}
                    </div>

                    <div className={styles.metaRow}>
                      <img src={peopleIcon} alt="" className={styles.metaIcon} />
                      {cafe.ppl}명
                    </div>
                  </div>

                  <div className={styles.btnGroup}>
                    <button
                      className={styles.reserveBtn}
                      disabled={cafe.hoursKind === 'UNREGISTERED'}
                      type="button"
                      onClick={() => {
                        if (cafe.hoursKind === 'UNREGISTERED') return;
                        try {
                          localStorage.setItem('cafe_id', String(cafe.cafeId));
                        } catch {}
                        navigate('/user/reserve', {
                          state: {
                            cafeId: cafe.cafeId,
                            hoursStatus: cafe.hoursKind === 'UNREGISTERED' ? '미등록' : '등록됨',
                            hoursKind: cafe.hoursKind,
                            hoursHint: cafe.hours,
                          },
                        });
                      }}
                    >
                      예약하기
                    </button>

                    <button
                      className={styles.useNowBtn}
                      disabled={!isOpenNowByText(cafe.hoursRaw ?? cafe.hours, nowMin, nowDow)}
                      type="button"
                      onClick={() => {
                        if (!isOpenNowByText(cafe.hoursRaw ?? cafe.hours, nowMin, nowDow)) return;
                        try {
                          localStorage.setItem('cafe_id', String(cafe.cafeId));
                        } catch {}
                        navigate('/user/reserve', {
                          state: {
                            cafeId: cafe.cafeId,
                            quick: true,
                            hoursStatus: cafe.hoursKind === 'UNREGISTERED' ? '미등록' : '등록됨',
                            hoursKind: cafe.hoursKind,
                            hoursHint: cafe.hours,
                          },
                        });
                      }}
                    >
                      바로 이용하기
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showDetailSheet && activeReservation && (() => {
  const isInUse = activeReservation.status === 'inuse';

  // ✅ 이용중이면 남은시간 계산
  const remainingMins = isInUse ? Math.ceil((activeReservation.endMs - nowMs) / 60000) : 0;
  const remainingText = minutesToHHMM(remainingMins);

  return (
    <div className={isInUse ? styles.inuseSheet : styles.detailSheet}>
      <div
        className={styles.handle}
        onClick={() => setShowDetailSheet(false)}
        role="button"
        tabIndex={0}
        aria-label="닫기"
      />

      {/* ===================== ✅ 이용중 전용 화면 (두 번째 사진) ===================== */}
      {isInUse ? (
        <div className={styles.inuseBody}>
          <div className={styles.inuseHeader}>
            <p className={styles.inuseTitle}>
              ‘{activeReservation.cafe}’를<br />
              이용중이에요
            </p>

            <button
              type="button"
              className={styles.inuseCafeLink}
              onClick={() => {
                // "카페 정보 보러가기" → reserve 페이지로 이동
                if (activeReservation.cafeId != null) {
                  // cafes 배열에서 해당 카페 정보 찾기
                  const cafeInfo = rawList.find((c) => String(c.cafeId) === String(activeReservation.cafeId));
                  
                  if (cafeInfo) {
                    try {
                      localStorage.setItem('cafe_id', String(activeReservation.cafeId));
                    } catch {}
                    
                    setShowDetailSheet(false);
                    
                    navigate('/user/reserve', {
                      state: {
                        cafeId: activeReservation.cafeId,
                        hoursStatus: cafeInfo.hoursKind === 'UNREGISTERED' ? '미등록' : '등록됨',
                        hoursKind: cafeInfo.hoursKind,
                        hoursHint: cafeInfo.hours,
                      },
                    });
                  } else {
                    // 카페 정보를 찾지 못한 경우 메인 리스트에서 해당 카페만 보이게
                    setSelectedCafeId(String(activeReservation.cafeId));
                    setShowDetailSheet(false);
                    setSheetTop(SNAP.MID_TOP);
                  }
                } else {
                  setShowDetailSheet(false);
                }
              }}
            >
              카페 정보 보러가기 &gt;
            </button>

            <div className={styles.inuseInfoList}>
              <div className={styles.inuseInfoRow}>
                <img src={clockIcon} alt="" className={styles.inuseInfoIcon} />
                <span className={styles.inuseInfoLabel}>예약일정</span>
                <span className={styles.inuseInfoValue}>
                  {activeReservation.startTime}-{activeReservation.endTime}
                  {activeReservation.durationText ? ` (${activeReservation.durationText})` : ''}
                </span>
              </div>

              <div className={styles.inuseInfoRow}>
                <img src={clockIcon} alt="" className={styles.inuseInfoIcon} />
                <span className={styles.inuseInfoLabel}>남은시간</span>
                <span className={styles.inuseRemainPill}>{remainingText}</span>
              </div>
            </div>
          </div>

          <div className={styles.inuseCenter}>
            <img className={styles.inuseHeroImg} src={inuseRightImg} alt="" aria-hidden="true" />
            <p className={styles.inuseMsg}>
              이용 중인 카페가 만족스럽다면<br />
              모카 공식 계정에 소개해보세요!
            </p>
          </div>

          <div className={styles.inuseCtaBar}>
            <button
              className={styles.inuseCtaBtn}
              type="button"
              onClick={handleStoryShare}
            >
              이 공간 소개하기
            </button>
          </div>
        </div>
      ) : (
        /* ===================== ✅ 기존 상세 화면(예정/요청중) 그대로 ===================== */
        <>
          <div className={styles.detailHeader}>
            {activeReservation.status === 'pending' && (
              <p style={{ fontWeight: 600, marginBottom: 8 }}>‘{activeReservation.cafe}’에</p>
            )}
            <p style={{ marginBottom: 8 }}>
              <span className={styles.today}>오늘</span>{' '}
              <span className={styles.time}>
                {activeReservation.startTime} - {activeReservation.endTime}
              </span>
            </p>
            <p>{statusLabelKo(activeReservation.status)}</p>
          </div>

          {activeReservation.status !== 'pending' && (
            <div className={styles.detailCafeCard}>
              <img
                className={styles.thumb}
                src={activeReservation.thumb || defaultCafeLogo}
                alt={activeReservation.cafe}
                onError={handleImgErrorToLogo}
              />
              <div className={styles.info}>
                <div className={styles.cafeName}>{activeReservation.cafe}</div>
                <div className={styles.metaRow}>
                  <img src={chatIcon2} alt="" className={styles.metaIcon} />
                  {meetingTypeKo(activeReservation.meetingType)}
                </div>
                <div className={styles.metaRow}>
                  <img src={peopleIcon} alt="" className={styles.metaIcon} />
                  {activeReservation.people}명
                </div>
              </div>
            </div>
          )}

          <div className={styles.detailContent}>
            <h4>예약자 정보</h4>
            <p><b>이름</b> {activeReservation.name || '—'}</p>
            <p><b>전화번호</b> {activeReservation.phone || '—'}</p>
            <p><b>회의 인원</b> {activeReservation.people}명</p>

            <h4>회의 종류</h4>
            <p>{meetingTypeKo(activeReservation.meetingType)}</p>

            <h4>예약 일정</h4>
            <p><b>날짜</b> {activeReservation.dateText}</p>
            <p>
              <b>시간</b> {activeReservation.time}
              {activeReservation.durationText ? ` (${activeReservation.durationText})` : ''}
            </p>

            <h4>회의 인원</h4>
            <p>{activeReservation.people} 명</p>
          </div>

          {(activeReservation.status === 'pending' || activeReservation.status === 'scheduled') && (
            <button
              className={styles.cancelBtn}
              type="button"
              onClick={() => {
                setShowDetailSheet(false);
                setShowCancelModal(true);
              }}
            >
              {activeReservation.status === 'pending' ? '요청 취소' : '예약 취소'}
            </button>
          )}
        </>
      )}
    </div>
  );
})()}


      {showCancelModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.cancelModal}>
            <div className={styles.modalHeader}>
              <h3>취소 사유</h3>
              <button
                className={styles.closeIcon}
                onClick={() => {
                  if (cancelInFlight) return;
                  setShowCancelModal(false);
                  setSelectedReason('');
                }}
                aria-label="닫기"
                type="button"
              >
                ✕
              </button>
            </div>

            <ul className={styles.cancelReasons}>
              {[
                '일정 변경으로 인한 취소',
                '개인 사정(긴급 용무 등)',
                '예약 시간 착오',
                '장소 변경',
                '참석 인원 부족',
                '비용, 예산 문제',
                '중복 예약',
              ].map((reason) => (
                <li
                  key={reason}
                  onClick={() => !cancelInFlight && setSelectedReason(reason)}
                  className={selectedReason === reason ? styles.reasonSelected : ''}
                  role="button"
                  tabIndex={0}
                >
                  {reason}
                </li>
              ))}
            </ul>

            <button
              className={styles.cancelBtn}
              disabled={!selectedReason || cancelInFlight}
              onClick={handleConfirmCancel}
              type="button"
            >
              {cancelInFlight ? '처리 중…' : '확인'}
            </button>
          </div>
        </div>
      )}

      {showResultModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.cancelModal}>
            <div className={styles.modalHeader}>
              <h3>예약 취소 완료</h3>
              <button
                className={styles.closeIcon}
                onClick={() => {
                  setShowResultModal(false);
                  setSelectedReason('');
                }}
                aria-label="닫기"
                type="button"
              >
                ✕
              </button>
            </div>
            <div className={styles.completeBody}>
              <p><strong>{selectedReason || '사유 선택 안됨'}</strong></p>
              <p>사유로 예약이 취소되었습니다.</p>
            </div>
            <button
              className={styles.closeBtn}
              onClick={() => {
                setShowResultModal(false);
                setSelectedReason('');
              }}
              type="button"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* ✅ 거절 모달 */}
      {showRejectModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.rejectModal}>
            <p className={styles.rejectMessage}>
              '{rejectedCafeName}'에서 요청을 거절했어요!
            </p>
            <p className={styles.rejectSubMessage}>다음에 이용해보세요!</p>
            <p className={styles.rejectReason}>
              사유: {rejectedReason || '사유 없음'}
            </p>
            <button
              className={styles.rejectCloseBtn}
              onClick={async () => {
                // ✅ cancelCheck API 호출
                if (rejectedReservationId) {
                  try {
                    const res = await fetch(
                      `${API_PREFIX}/reservation/${rejectedReservationId}/cancelCheck`,
                      {
                        method: 'PATCH',
                        headers: {
                          accept: '*/*',
                          'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                      }
                    );
                    if (!res.ok) {
                      console.error('cancelCheck API 호출 실패:', res.status);
                    }
                  } catch (err) {
                    console.error('cancelCheck API 호출 오류:', err);
                  }
                }
                setShowRejectModal(false);
                setRejectedCafeName('');
                setRejectedReason('');
                setRejectedReservationId(null);
              }}
              type="button"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

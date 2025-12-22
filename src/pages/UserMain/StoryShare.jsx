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

/* ===================== 상수 & 유틸 (컴포넌트 밖으로 분리) ===================== */

const KST = 'Asia/Seoul';
const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** ✅ 공릉역 좌표(고정) */
const GONGNEUNG = { lat: 37.62556, lng: 127.07306 };

function nowInKST() {
  const d = new Date();
  const h = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: KST,
      hour: '2-digit',
      hour12: false,
    }).format(d)
  );
  const m = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: KST, minute: '2-digit' }).format(d)
  );
  const w = new Intl.DateTimeFormat('en-US', { timeZone: KST, weekday: 'short' }).format(d);
  return { minutes: h * 60 + m, dow: dayMap[w] ?? d.getDay() };
}

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
    const a = ko[range[1]],
      b = ko[range[2]];
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

    if (/휴무|쉼|닫음|closed/i.test(seg)) {
      continue;
    }

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

// 시간/날짜 포맷 유틸
const fmtHHMM = (t = '') => {
  if (!t) return '';
  const [hh = '', mm = ''] = t.split(':');
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

// meetingType, 상태 라벨
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
const API_HOST = IS_DEV ? 'http://54.180.2.235:8080' : '';
const API_PREFIX = `${API_HOST}/hackathon/api`;

/* ===================== 컴포넌트 ===================== */

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

  const [{ minutes: nowMin, dow: nowDow }, setNowInfo] = useState(nowInKST());
  useEffect(() => {
    const t = setInterval(() => setNowInfo(nowInKST()), 30 * 1000);
    return () => clearInterval(t);
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

  /* ====== 내 위치 이동(항상 공릉역으로) ====== */
  const moveToMyLocation = () => {
    const api = mapRef.current;
    const kakao = window?.kakao;

    if (api?.centerToGongneung) {
      api.centerToGongneung({ level: 4, showMarker: true });
      return;
    }
    if (api?.panToGongneung) {
      api.panToGongneung();
      return;
    }

    if (api && kakao?.maps) {
      const map = api.getMap ? api.getMap() : api;
      const pos = new kakao.maps.LatLng(GONGNEUNG.lat, GONGNEUNG.lng);
      map.panTo(pos);
      if (map.getLevel && map.getLevel() > 4) map.setLevel(4);
    }
  };

  // ===== 예약 관련 상태 =====
  const [reservations, setReservations] = useState([]);
  const [activeReservation, setActiveReservation] = useState(null);

  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);
  const [cancelInFlight, setCancelInFlight] = useState(false);

  // userId: 1) route state → 2) localStorage('user_id') → 3) null
  const userId = useMemo(() => {
    const fromState = location.state?.userId;
    const fromStorage = getStoredUserId();
    return fromState ?? (fromStorage || null);
  }, [location.state]);

  // 예약 조회
  useEffect(() => {
    let abort = false;
    const fetchReservations = async () => {
      if (!userId) {
        if (!abort) { setReservations([]); }
        return;
      }
      try {
        const res = await fetch(
          `${API_PREFIX}/reservation?userId=${encodeURIComponent(userId)}`,
          { headers: { accept: '*/*' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const raw = Array.isArray(data?.result) ? data.result : [];

        const mapped = raw
          .map((row, idx) => {
            const status = toFrontStatus(row.reservationStatus, row.attendanceStatus);
            if (!status) return null;
            const time = `${fmtHHMM(row.startTime)} - ${fmtHHMM(row.endTime)}`;

            // 이미지 URL 우선순위: cafeImageUrl → imageUrl
            const rawImg = row.cafeImageUrl ?? row.imageUrl ?? null;
            const thumb = rawImg
              ? /^https?:\/\//i.test(rawImg)
                ? rawImg
                : `${API_HOST}${rawImg}`
              : null;

            return {
              id: String(row.reservationsId ?? idx),
              cafe: row.cafeName || `카페 #${row.cafeId ?? '-'}`,
              time,
              status,
              people: row.peopleCount ?? 0,
              meetingType: row.meetingType || '',
              dateText: dateWithWeekday(row.date),
              durationText: durationFromTimes(row.startTime, row.endTime),
              phone: row.phoneNumber || '',
              name: row.nickname || '',
              thumb,
              startTime: fmtHHMM(row.startTime),
              endTime: fmtHHMM(row.endTime),
            };
          })
          .filter(Boolean);

        if (!abort) setReservations(mapped);
      } catch (err) {
        console.error(err);
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
      thumb: c.imageUrl ? (c.imageUrl.startsWith('http') ? c.imageUrl : `${API_HOST}${c.imageUrl}`) : null,
      hours: hoursHint,
      hoursRaw: raw,
      hoursKind,
      spaceType: c.spaceType || '',
      ppl: Number.isFinite(c.maxSeats) ? c.maxSeats : 0,
    };
  };

  const shortSpace = (s = '') => s.split('(')[0].trim();

  const rawList = cafes.map(decorateCafe);

  const norm = (s = '') => s.toLowerCase().trim();
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

  const listForRender = selectedCafeId ? byFilters.filter((c) => String(c.cafeId) === String(selectedCafeId)) : byFilters;

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
      body: JSON.stringify({ cancelReason: reasonCode }),
    });

    if (!res.ok) {
      const msg = `취소 실패 (HTTP ${res.status})`;
      throw new Error(msg);
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
              {visibleReservations.map((r) => (
                <button
                  key={r.id}
                  className={`${styles.reserveChip} ${
                    r.status === 'scheduled' ? styles.scheduled : r.status === 'inuse' ? styles.inuse : styles.pending
                  }`}
                  onClick={() => {
                    if (dragMovedRef.current) return;
                    openReservationDetail(r);
                  }}
                >
                  <div className={styles.reserveCafe}>{r.cafe}</div>
                  <div className={styles.reserveInfo}>
                    <span className={styles.timeStrong}>{r.time}</span> {statusLabelKo(r.status)}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className={styles.sheetContent}>
            <div className={styles.sheetTitle}>
              회의 가능한 카페를 둘러보세요!
              {selectedCafeId && (
                <button className={styles.smallClearBtn} onClick={() => setSelectedCafeId(null)} style={{ marginLeft: 8 }}>
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

      {showDetailSheet && activeReservation && (
        <div className={styles.detailSheet}>
          <div className={styles.handle} onClick={() => setShowDetailSheet(false)} role="button" tabIndex={0} />

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

          {/* ✅ 이용중(inuse)일 때 스토리 공유 버튼 */}
          {activeReservation.status === 'inuse' && (
            <button
              className={styles.storyShareBtn}
              onClick={() => {
                setShowDetailSheet(false);
                navigate('/user/story-share', { state: { reservation: activeReservation } });
              }}
            >
              스토리 공유
            </button>
          )}

          {(activeReservation.status === 'pending' || activeReservation.status === 'scheduled') && (
            <button
              className={styles.cancelBtn}
              onClick={() => {
                setShowDetailSheet(false);
                setShowCancelModal(true);
              }}
            >
              {activeReservation.status === 'pending' ? '요청 취소' : '예약 취소'}
            </button>
          )}
        </div>
      )}

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
                >
                  {reason}
                </li>
              ))}
            </ul>

            <button className={styles.cancelBtn} disabled={!selectedReason || cancelInFlight} onClick={handleConfirmCancel}>
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
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

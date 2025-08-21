// src/pages/UserMain/UserMain.jsx
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

import searchIcon from '../../assets/Search.svg';
import filterIcon from '../../assets/filter.svg';
import menuIcon from '../../assets/tabler_menu-2.svg';
import chatIcon from '../../assets/tabler_message-circle2.svg';
import locationIcon from '../../assets/Group1.svg';
import clockIcon from '../../assets/clock.svg';
import peopleIcon from '../../assets/people.svg';
import chatIcon2 from '../../assets/chat.svg';

const IS_DEV = process.env.NODE_ENV === 'development';
const API_HOST = IS_DEV ? 'http://3.27.150.124:8080' : '';
const API_PREFIX = `${API_HOST}/hackathon/api`;

export default function MapExplore() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const filters = location.state?.filters || { spaces: [], people: 0 };

  // ==== 검색어 (실시간 반영) ====
  const [input, setInput] = useState('');

  // 서버 카페 목록 & 선택
  const [cafes, setCafes] = useState([]);
  const [selectedCafeId, setSelectedCafeId] = useState(null);

  // 맵/레이아웃
  const wrapRef = useRef(null);
  const mapRef = useRef(null);
  const [ch, setCh] = useState(800);

  // 사이드메뉴
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const openMenu = () => { setMenuVisible(true); requestAnimationFrame(() => setIsMenuOpen(true)); };
  const closeMenu = () => { setIsMenuOpen(false); setTimeout(() => setMenuVisible(false), 250); };

  /* ====== 서버 카페 리스트 로드 ====== */
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

  /* ====== 레이아웃 / 바텀시트 ====== */
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setCh(Math.max(300, Math.round(e.contentRect.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
  useLayoutEffect(() => { setSheetTop(SNAP.PEEK_TOP); }, [SNAP.PEEK_TOP]);

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

  /* ====== 내 위치 이동 (사용자 의도일 때만 지도 이동) ====== */
  const moveToMyLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('이 브라우저는 위치 정보를 지원하지 않아요.');
      return;
    }
    const explain = (err) => {
      const code = err?.code;
      if (code === 1) return '위치 권한이 거부되었어요. 브라우저 설정에서 위치 권한을 허용해 주세요.';
      if (code === 2) return '현재 위치를 확인할 수 없어요. 실내/네트워크 상태를 확인 후 다시 시도해 주세요.';
      if (code === 3) return '위치 확인 시간이 초과되었어요. 잠시 후 다시 시도해 주세요.';
      return '위치 정보를 가져올 수 없어요.';
    };
    const tryOnce = (opts) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject({ code: 3 }), (opts?.timeout ?? 0) + 50);
        navigator.geolocation.getCurrentPosition(
          (pos) => { clearTimeout(timer); resolve(pos); },
          (err) => { clearTimeout(timer); reject(err); },
          opts
        );
      });

    (async () => {
      try {
        const posHigh =
          (await tryOnce({ enableHighAccuracy: true, timeout: 3500, maximumAge: 0 }).catch(() => null)) ||
          (await tryOnce({ enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }).catch(() => null));
        if (!posHigh) throw new Error('POSITION_FAIL');

        const { latitude, longitude } = posHigh.coords;
        if (mapRef.current && window.kakao?.maps) {
          const loc = new window.kakao.maps.LatLng(latitude, longitude);
          mapRef.current.panTo(loc);
          if (mapRef.current.getLevel() > 4) mapRef.current.setLevel(4);
        }
      } catch (e) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            if (mapRef.current && window.kakao?.maps) {
              const loc = new window.kakao.maps.LatLng(latitude, longitude);
              mapRef.current.panTo(loc);
              if (mapRef.current.getLevel() > 4) mapRef.current.setLevel(4);
            }
          },
          (err) => { alert(explain(err)); },
          { enableHighAccuracy: false, timeout: 2000, maximumAge: 120000 }
        );
      }
    })();
  };

  /* ====== 예약 영역 (원래 플로우 복구) ====== */
  const [reservations, setReservations] = useState([]);
  const [activeReservation, setActiveReservation] = useState(null);
  const [loadingRsv, setLoadingRsv] = useState(false);
  const [errorRsv, setErrorRsv] = useState('');

  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);
  const [cancelInFlight, setCancelInFlight] = useState(false); // 🔄 취소 요청 로딩

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

  const meetingTypeKo = (t) => {
    switch (t) {
      case 'STUDY': return '스터디';
      case 'MEETING': return '회의';
      case 'INTERVIEW': return '인터뷰';
      default: return '기타';
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

  const statusLabelKo = (status) => {
    switch (status) {
      case 'inuse': return '회의실 이용 중이에요!';
      case 'pending': return '회의실 이용 요청 중이에요!';
      case 'scheduled': return '회의실 이용 예정이에요!';
      default: return '';
    }
  };

  const userId = location.state?.userId ?? 11;

  useEffect(() => {
    let abort = false;
    const fetchReservations = async () => {
      setLoadingRsv(true);
      setErrorRsv('');
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
            return {
              id: String(row.reservationsId ?? idx), // ← API에서 쓸 id
              cafe: `카페 #${row.cafeId ?? '-'}`,
              time,
              status, // 'inuse' | 'scheduled' | 'pending'
              people: row.peopleCount ?? 0,
              meetingType: row.meetingType || '',
              dateText: dateWithWeekday(row.date),
              durationText: durationFromTimes(row.startTime, row.endTime),
              phone: '',
              name: row.userName ?? '',
              thumb: `https://picsum.photos/seed/rsv${row.reservationsId}/200/200`,
              startTime: fmtHHMM(row.startTime),
              endTime: fmtHHMM(row.endTime),
            };
          })
          .filter(Boolean);

        if (!abort) setReservations(mapped);
      } catch (err) {
        if (!abort) setErrorRsv('');
        console.error(err);
      } finally {
        if (!abort) setLoadingRsv(false);
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

  /* ====== 리스트/핀을 위한 데이터 구성 ====== */
  const decorateCafe = (c, i) => ({
    id: String(c.cafeId ?? i),
    cafeId: c.cafeId,
    name: c.name || '이름없는 카페',
    addr: c.address || '주소 준비중',
    thumb: c.imageUrl
      ? (c.imageUrl.startsWith('http') ? c.imageUrl : `${API_HOST}${c.imageUrl}`)
      : `https://picsum.photos/seed/cafe${(c.cafeId ?? i) + 7}/300/300`,
    hours: c.operatingHours || '영업시간 등록 전 입니다',
    spaceType: c.spaceType || '',
    ppl: Number.isFinite(c.maxSeats) ? c.maxSeats : 0,
  });
  const shortSpace = (s = '') => s.split('(')[0].trim();

  const rawList = cafes.map(decorateCafe);

  // 검색 필터 (이름/주소 포함)
  const norm = (s = '') => s.toLowerCase().trim();
  const q = norm(input);
  const bySearch = q
    ? rawList.filter((c) =>
        norm(c.name).includes(q) || norm(c.addr).includes(q)
      )
    : rawList;

  // 공간/인원 필터
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

  // 리스트 표시 규칙:
  // - 핀(마커)을 누르면 그 한 개만 표시
  // - 아니면 검색/필터 결과 전체 표시
  const listForRender = selectedCafeId
    ? byFilters.filter((c) => String(c.cafeId) === String(selectedCafeId))
    : byFilters;

  // 지도에 넘기는 핀도 리스트와 동일해야 하므로 같은 배열 사용
  const cafesForMap = listForRender.map((c) => ({
    cafeId: c.cafeId,
    name: c.name,
    address: c.addr,
    operatingHours: c.hours,
    imageUrl: c.thumb,
    maxSeats: c.ppl,
    spaceType: c.spaceType,
  }));

  const sheetHeight = Math.max(0, ch - sheetTop);

  // 지도(마커) 클릭 콜백: KakaoMap에서 넘어옴 (지도는 이동 X, 리스트만 바꿈)
  const handlePlaceClick = (cafe) => {
    setSelectedCafeId(cafe.cafeId ?? null);
  };

  // =========== 예약 스트립(가로 드래그) 드래그 핸들러 =============
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

  /* ====== 취소 API 호출 ====== */
  const reasonToCode = (text) => {
    // 서버 enum 가정치. 모르면 OTHER 로 보냄
    if (!text) return 'OTHER';
    const map = [
      ['일정 변경', 'SCHEDULE_CHANGE'],
      ['개인 사정', 'PERSONAL_REASON'],
      ['시간 착오', 'WRONG_TIME'],
      ['장소 변경', 'LOCATION_CHANGE'],
      ['인원 부족', 'NOT_ENOUGH_PEOPLE'],
      ['비용', 'BUDGET_ISSUE'],
      ['중복 예약', 'DUPLICATE'],
      ['영업시간', 'CLOSED_TIME'],
    ];
    const found = map.find(([k]) => text.includes(k));
    return found ? found[1] : 'OTHER';
  };

  const cancelReservation = async ({ reservationId, userId, reasonText }) => {
    const reasonCode = reasonToCode(reasonText);
    const url = `${API_PREFIX}/reservation/delete/${encodeURIComponent(
      reservationId
    )}?userId=${encodeURIComponent(userId)}`;

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
    // 응답 스킴: { isSuccess, code, message, result }
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

      // 성공: 리스트에서 제거, UI 업데이트
      setReservations((prev) => prev.filter((r) => r.id !== String(reservationId)));
      setActiveReservation(null);
      setShowCancelModal(false);
      setShowResultModal(true);
    } catch (err) {
      console.error(err);
      alert(err?.message || '예약을 취소할 수 없어요. 잠시 후 다시 시도해 주세요.');
      // 실패 시 모달은 그대로 유지
    } finally {
      setCancelInFlight(false);
    }
  };

  return (
    <div ref={wrapRef} className={styles.wrap}>
      {/* 상단 바 */}
      <div className={styles.topbar}>
        <button className={styles.topBtn} aria-label="메뉴 열기" onClick={openMenu}>
          <img src={menuIcon} alt="" className={styles.topIcon} />
        </button>
        <div className={styles.topTitle}>MOCA</div>
        <button className={styles.topBtn} aria-label="채팅 열기" onClick={() => navigate('/chat')}>
          <img src={chatIcon} alt="" className={styles.topIcon} />
        </button>
      </div>

      {/* 지도: 리스트에 보이는 것만 핀 표시, 핀 클릭해도 지도는 그대로 */}
      <KakaoMap ref={mapRef} cafes={cafesForMap} onPlaceClick={handlePlaceClick} />

      {/* 사이드 메뉴 */}
      {menuVisible && (
        <>
          <div className={styles.menuBackdrop} onClick={closeMenu} />
          <div className={`${styles.sideMenu} ${isMenuOpen ? styles.open : styles.close}`}>
            <button
              className={styles.menuItem}
              onClick={() => {
                closeMenu();
                logout();
                navigate('/login');
              }}
            >
              로그아웃
            </button>
          </div>
        </>
      )}

      {/* 검색바 */}
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

      <div className={styles.backdrop} style={{ height: `${sheetHeight}px` }} aria-hidden />

      <div className={styles.bottomSheet}>
        <div
          className={styles.sheetPanel}
          style={{ top: `${sheetTop}px`, height: `calc(100% - ${sheetTop}px)` }}
        >
          <div
            className={styles.handle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            aria-hidden
          />

          {/* 내 위치 버튼 — 예약 스트립 유무로 자동 위치 조정 */}
          <button
            className={`${styles.myLocationBtn} ${
              visibleReservations.length ? styles.withReserve : styles.noReserve
            }`}
            onClick={moveToMyLocation}
          >
            <img src={locationIcon} alt="내 위치" />
          </button>

          {/* ✅ 예약 스트립 — 예약 있을 때만 렌더 (원래 플로우 유지) */}
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
                    r.status === 'scheduled'
                      ? styles.scheduled
                      : r.status === 'inuse'
                      ? styles.inuse
                      : styles.pending
                  }`}
                  onClick={() => {
                    if (dragMovedRef.current) return;
                    openReservationDetail(r);
                  }}
                >
                  <div className={styles.reserveCafe}>{r.cafe}</div>
                  <div className={styles.reserveInfo}>
                    <span className={styles.timeStrong}>{r.time}</span>{' '}
                    {statusLabelKo(r.status)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 리스트 */}
          <div className={styles.sheetContent}>
            <div className={styles.sheetTitle}>
              회의 가능한 카페를 둘러보세요!
              {selectedCafeId && (
                <button
                  className={styles.smallClearBtn}
                  onClick={() => setSelectedCafeId(null)}
                  style={{ marginLeft: 8 }}
                >
                  전체 보기
                </button>
              )}
            </div>

            {listForRender.length === 0 ? (
              <div className={styles.cardGhost}>
                {q
                  ? '검색 결과가 없어요. 검색어나 필터를 바꿔보세요.'
                  : '지도의 핀을 선택하거나 검색어를 입력해보세요.'}
              </div>
            ) : (
              listForRender.map((cafe) => (
                <div key={cafe.id} className={styles.cafeCard}>
                  <img className={styles.thumb} src={cafe.thumb} alt={cafe.name} />
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

                  {/* ✅ 방법 1: state + localStorage로 cafeId 전달 */}
                  <button
                    className={styles.reserveBtn}
                    onClick={() => {
                      // 폴백까지 단단하게
                      try {
                        localStorage.setItem('cafe_id', String(cafe.cafeId));
                      } catch {}
                      navigate('/user/reserve', { state: { cafeId: cafe.cafeId } });
                    }}
                  >
                    예약하기
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ====== 예약 상세 시트(원래 플로우 유지) ====== */}
      {showDetailSheet && activeReservation && (
        <div className={styles.detailSheet}>
          <div
            className={styles.handle}
            onClick={() => setShowDetailSheet(false)}
            role="button"
            tabIndex={0}
          />

          {/* 헤더 */}
          <div className={styles.detailHeader}>
            {activeReservation.status === 'pending' && (
              <p style={{ fontWeight: 600, marginBottom: 8 }}>
                ‘{activeReservation.cafe}’에
              </p>
            )}
            <p style={{ marginBottom: 8 }}>
              <span className={styles.today}>오늘</span>{' '}
              <span className={styles.time}>
                {activeReservation.startTime} - {activeReservation.endTime}
              </span>
            </p>
            <p>{statusLabelKo(activeReservation.status)}</p>
          </div>

          {/* 카드: 요청 중이면 숨김, 예정/이용중이면 표시 */}
          {activeReservation.status !== 'pending' && (
            <div className={styles.detailCafeCard}>
              <img
                className={styles.thumb}
                src={activeReservation.thumb}
                alt={activeReservation.cafe}
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

          {/* 본문 공통 */}
          <div className={styles.detailContent}>
            <h4>예약자 정보</h4>
            <p>
              <b>이름</b> {activeReservation.name || '—'}
            </p>
            <p>
              <b>전화번호</b> {activeReservation.phone || '—'}
            </p>
            <p>
              <b>회의 인원</b> {activeReservation.people}명
            </p>

            <h4>회의 종류</h4>
            <p>{meetingTypeKo(activeReservation.meetingType)}</p>

            <h4>예약 일정</h4>
            <p>
              <b>날짜</b> {activeReservation.dateText}
            </p>
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
              onClick={() => {
                setShowDetailSheet(false);
                setShowCancelModal(true); // ✅ 취소 사유 선택 모달 열기
              }}
            >
              {activeReservation.status === 'pending' ? '요청 취소' : '예약 취소'}
            </button>
          )}
        </div>
      )}

      {/* ====== 취소 사유 선택 모달 ====== */}
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

            <button
              className={styles.cancelBtn}
              disabled={!selectedReason || cancelInFlight}
              onClick={handleConfirmCancel}
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
              >
                ✕
              </button>
            </div>
            <div className={styles.completeBody}>
              <p>
                <strong>{selectedReason || '사유 선택 안됨'}</strong>
              </p>
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

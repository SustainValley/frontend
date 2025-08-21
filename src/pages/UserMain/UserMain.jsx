import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

export default function MapExplore() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const filters = location.state?.filters || { spaces: [], people: 0 };

  const [keyword, setKeyword] = useState('');
  const [input, setInput] = useState('');
  const [places, setPlaces] = useState([]);
  const [selected, setSelected] = useState(null);

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

  // ====== API 예약 데이터 ======
  const [reservations, setReservations] = useState([]);
  const [activeReservation, setActiveReservation] = useState(null);
  const [loadingRsv, setLoadingRsv] = useState(false);
  const [errorRsv, setErrorRsv] = useState('');

  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);

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

  const SNAP = useMemo(() => {
    const HEADER = 300;
    const BUTTON_MARGIN = 120;
    const FULL_TOP = HEADER + BUTTON_MARGIN;
    const MID_TOP = Math.round(ch * 0.65);
    const PEEK = 140;
    const PEEK_TOP = ch - PEEK;
    return { FULL_TOP, MID_TOP, PEEK_TOP, MIN: FULL_TOP, MAX: PEEK_TOP };
  }, [ch]);

  const [sheetTop, setSheetTop] = useState(SNAP.PEEK_TOP);
  useLayoutEffect(() => {
    setSheetTop(SNAP.PEEK_TOP);
  }, [SNAP.PEEK_TOP]);

  const drag = useRef({ active: false, startY: 0, startTop: SNAP.PEEK_TOP });
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const onPointerDown = (e) => {
    const y = e.touches?.[0]?.clientY ?? e.clientY;
    drag.current = { active: true, startY: y, startTop: sheetTop };
    e.currentTarget.setPointerCapture?.(e.pointerId ?? 1);
  };

  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const y = e.touches?.[0]?.clientY ?? e.clientY;
    const dy = y - drag.current.startY;
    const next = clamp(drag.current.startTop + dy, SNAP.MIN, SNAP.MAX);
    setSheetTop(next);
    if (e.cancelable) e.preventDefault();
  };

  const onPointerUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const mid1 = (SNAP.FULL_TOP + SNAP.MID_TOP) / 2;
    const mid2 = (SNAP.MID_TOP + SNAP.PEEK_TOP) / 2;
    let target;
    if (sheetTop <= mid1) target = SNAP.FULL_TOP;
    else if (sheetTop <= mid2) target = SNAP.MID_TOP;
    else target = SNAP.PEEK_TOP;
    setSheetTop(target);
  };

  const search = () => {
    if (!input.trim()) return;
    setSelected(null);
    setKeyword(input.trim());
  };
  const onInputChange = (e) => setInput(e.target.value);

  const decorate = (p, i) => ({
    id: p.id ?? `${p.place_name}-${i}`,
    name: p.place_name ?? p.name ?? '이름없는 카페',
    addr: p.road_address_name || p.address_name || '주소 준비중',
    thumb: p.thumb || `https://picsum.photos/seed/cafe${i + 3}/300/300`,
    hours: i % 2 ? '12:00 - 18:00' : '09:00 - 21:00',
    mood: i % 3 ? '오픈된 공간' : '조용한 공간',
    ppl: i % 2 ? 6 : 2,
  });

  const spaceKeyFromCafe = (cafe) => {
    if (cafe.mood.includes('오픈')) return 'open';
    if (cafe.mood.includes('조용')) return 'quiet';
    if (cafe.name.includes('회의실')) return 'room';
    return 'limited';
  };

  const list = (selected ? [selected] : places).map(decorate);

  const filtered = list.filter((cafe) => {
    const matchSpace =
      filters.spaces.length === 0 || filters.spaces.includes(spaceKeyFromCafe(cafe));
    const matchPeople = filters.people === 0 || cafe.ppl >= filters.people;
    return matchSpace && matchPeople;
  });

  const sheetHeight = Math.max(0, ch - sheetTop);

  const moveToMyLocation = () => {
    if (!navigator.geolocation) {
      alert('위치 정보를 지원하지 않는 브라우저입니다.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapRef.current) {
          const loc = new window.kakao.maps.LatLng(latitude, longitude);
          mapRef.current.panTo(loc);
        }
      },
      () => alert('위치 정보를 가져올 수 없어요.')
    );
  };

  const openReservationDetail = (r) => {
    setActiveReservation(r);
    if (['scheduled', 'inuse', 'pending'].includes(r.status)) setShowDetailSheet(true);
  };

  // ====== 예약 스트립 드래그/휠 스크롤 ======
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

  const onStripWheel = (e) => {
    const el = stripRef.current;
    if (!el) return;
    if (!e.shiftKey) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  // ====== 상태 매핑 & API 호출 ======
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
      case 'STUDY':
        return '스터디';
      case 'MEETING':
        return '회의';
      case 'INTERVIEW':
        return '인터뷰';
      default:
        return '기타';
    }
  };

  // 우선순위: 예약상태 > 출입상태
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
      case 'inuse':
        return '회의실 이용 중이에요!';
      case 'pending':
        return '회의실 이용 요청 중이에요!';
      case 'scheduled':
        return '회의실 이용 예정이에요!';
      default:
        return '';
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
          `http://3.27.150.124:8080/hackathon/api/reservation?userId=${encodeURIComponent(
            userId
          )}`,
          { headers: { accept: '*/*' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const raw = Array.isArray(data?.result) ? data.result : [];

        const mapped = raw
          .map((row, idx) => {
            const status = toFrontStatus(row.reservationStatus, row.attendanceStatus);
            if (!status) return null; // 숨김
            const time = `${fmtHHMM(row.startTime)} - ${fmtHHMM(row.endTime)}`;
            return {
              id: String(row.reservationsId ?? idx),
              cafe: `카페 #${row.cafeId ?? '-'}`, // TODO: 카페명 API 연동 가능
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
        if (!abort) setErrorRsv('예약을 불러오지 못했습니다.');
        console.error(err);
      } finally {
        if (!abort) setLoadingRsv(false);
      }
    };

    fetchReservations();
    return () => {
      abort = true;
    };
  }, [userId]);

  const visibleReservations = useMemo(
    () => reservations.filter((r) => ['inuse', 'scheduled', 'pending'].includes(r.status)),
    [reservations]
  );

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
        keyword={keyword}
        onPlacesFound={(results) =>
          setPlaces(results.map((p, i) => ({ ...p, id: p.id || `${p.place_name}-${i}` })))
        }
        onPlaceClick={setSelected}
      />

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

      <div className={styles.searchBar}>
        <img src={searchIcon} alt="" className={styles.icon} />
        <input
          className={styles.searchInput}
          placeholder="회의실 예약 원하는 카페를 검색해주세요."
          value={input}
          onChange={onInputChange}
          onKeyDown={(e) => e.key === 'Enter' && search()}
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
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
            aria-hidden
          />

          {/* 내 위치 버튼 */}
          <button
            className={`${styles.myLocationBtn} ${
              visibleReservations.length ? styles.withReserve : styles.noReserve
            }`}
            onClick={moveToMyLocation}
          >
            <img src={locationIcon} alt="내 위치" />
          </button>

          {/* 가로 스크롤 예약 스트립 */}
          {(loadingRsv || errorRsv || visibleReservations.length > 0) && (
            <div
              ref={stripRef}
              className={styles.reserveStrip}
              role="region"
              aria-label="예약 목록 가로 스크롤"
              onMouseDown={onStripMouseDown}
              onMouseMove={onStripMouseMove}
              onMouseUp={endStripDrag}
              onMouseLeave={endStripDrag}
              onWheel={onStripWheel}
            >
              {loadingRsv && (
                <div className={styles.cardGhost} style={{ minWidth: 220 }}>
                  예약을 불러오는 중…
                </div>
              )}

              {errorRsv && !loadingRsv && (
                <div className={styles.cardGhost} style={{ minWidth: 220 }}>
                  {errorRsv}
                </div>
              )}

              {!loadingRsv && !errorRsv && visibleReservations.length === 0 && (
                <div className={styles.cardGhost} style={{ minWidth: 220 }}>
                  표시할 예약이 없어요. (이용중/이용 예정/이용 요청만 표시)
                </div>
              )}

              {!loadingRsv &&
                !errorRsv &&
                visibleReservations.map((r) => (
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

          <div className={styles.sheetContent}>
            <div className={styles.sheetTitle}>회의 가능한 카페를 둘러보세요!</div>

            {filtered.length === 0 ? (
              <div className={styles.cardGhost}>
                조건에 맞는 검색 결과가 없어요. 검색어나 필터를 바꿔보세요.
              </div>
            ) : (
              filtered.map((cafe) => (
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
                      {cafe.mood}
                    </div>
                    <div className={styles.metaRow}>
                      <img src={peopleIcon} alt="" className={styles.metaIcon} />
                      {cafe.ppl}명
                    </div>
                  </div>
                  <button
                    className={styles.reserveBtn}
                    onClick={() => navigate('/user/reserve', { state: { cafe } })}
                  >
                    예약하기
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 상세 시트 — 상태별 레이아웃 */}
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
            {/* 예약 요청 중일 때만 첫 줄에 ‘카페명’에 */}
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

          {/* 버튼: 요청 중 => "요청 취소", 예정 => "예약 취소", 이용중 => 버튼 없음 */}
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

      {/* 취소 모달 */}
      {showCancelModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.cancelModal}>
            <div className={styles.modalHeader}>
              <h3>취소 사유</h3>
              <button
                className={styles.closeIcon}
                onClick={() => setShowCancelModal(false)}
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
                  onClick={() => setSelectedReason(reason)}
                  className={selectedReason === reason ? styles.reasonSelected : ''}
                >
                  {reason}
                </li>
              ))}
            </ul>
            {selectedReason && (
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  // 실제로는 취소 API 호출 필요
                  setReservations((prev) => prev.filter((r) => r.id !== activeReservation?.id));
                  setActiveReservation(null);
                  setShowCancelModal(false);
                  setShowResultModal(true);
                }}
              >
                확인
              </button>
            )}
          </div>
        </div>
      )}

      {/* 완료 모달 */}
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
                <strong>{selectedReason}</strong>
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

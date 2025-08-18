import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import KakaoMap from '../../components/map/KakaoMap'
import styles from './UserMain.module.css'
import { useAuth } from '../../context/AuthContext'

import searchIcon from '../../assets/Search.svg'
import filterIcon from '../../assets/filter.svg'
import menuIcon from '../../assets/tabler_menu-2.svg'
import chatIcon from '../../assets/tabler_message-circle2.svg'
import locationIcon from '../../assets/Group1.svg'
import clockIcon from '../../assets/clock.svg'
import peopleIcon from '../../assets/people.svg'
import chatIcon2 from '../../assets/chat.svg'

export default function MapExplore() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()
  const filters = location.state?.filters || { spaces: [], people: 0 }

  const [keyword, setKeyword] = useState('')
  const [input, setInput] = useState('')
  const [places, setPlaces] = useState([])
  const [selected, setSelected] = useState(null)

  const wrapRef = useRef(null)
  const mapRef = useRef(null)
  const [ch, setCh] = useState(800)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)

  const openMenu = () => {
    setMenuVisible(true)
    requestAnimationFrame(() => setIsMenuOpen(true))
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
    setTimeout(() => setMenuVisible(false), 250)
  }

  const [reservation, setReservation] = useState({
    cafe: '풍치커피익스프레스공릉점',
    time: '13:00 - 15:00',
    status: 'scheduled',
  })

  const [showDetailSheet, setShowDetailSheet] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [showResultModal, setShowResultModal] = useState(false)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setCh(Math.max(300, Math.round(e.contentRect.height)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const SNAP = useMemo(() => {
    const HEADER = 300
    const BUTTON_MARGIN = 120
    const FULL_TOP = HEADER + BUTTON_MARGIN
    const MID_TOP = Math.round(ch * 0.65)
    const PEEK = 140
    const PEEK_TOP = ch - PEEK
    return { FULL_TOP, MID_TOP, PEEK_TOP, MIN: FULL_TOP, MAX: PEEK_TOP }
  }, [ch])

  const [sheetTop, setSheetTop] = useState(SNAP.PEEK_TOP)
  useLayoutEffect(() => {
    setSheetTop(SNAP.PEEK_TOP)
  }, [SNAP.PEEK_TOP])

  const drag = useRef({ active: false, startY: 0, startTop: SNAP.PEEK_TOP })
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

  const onPointerDown = (e) => {
    const y = e.touches?.[0]?.clientY ?? e.clientY
    drag.current = { active: true, startY: y, startTop: sheetTop }
    e.currentTarget.setPointerCapture?.(e.pointerId ?? 1)
  }

  const onPointerMove = (e) => {
    if (!drag.current.active) return
    const y = e.touches?.[0]?.clientY ?? e.clientY
    const dy = y - drag.current.startY
    const next = clamp(drag.current.startTop + dy, SNAP.MIN, SNAP.MAX)
    setSheetTop(next)
    if (e.cancelable) e.preventDefault()
  }

  const onPointerUp = () => {
    if (!drag.current.active) return
    drag.current.active = false
    const mid1 = (SNAP.FULL_TOP + SNAP.MID_TOP) / 2
    const mid2 = (SNAP.MID_TOP + SNAP.PEEK_TOP) / 2
    let target
    if (sheetTop <= mid1) target = SNAP.FULL_TOP
    else if (sheetTop <= mid2) target = SNAP.MID_TOP
    else target = SNAP.PEEK_TOP
    setSheetTop(target)
  }

  const search = () => {
    if (!input.trim()) return
    setSelected(null)
    setKeyword(input.trim())
  }

  const onInputChange = (e) => setInput(e.target.value)

  const decorate = (p, i) => ({
    id: p.id ?? `${p.place_name}-${i}`,
    name: p.place_name ?? p.name ?? '이름없는 카페',
    addr: p.road_address_name || p.address_name || '주소 준비중',
    thumb: p.thumb || `https://picsum.photos/seed/cafe${i + 3}/300/300`,
    hours: i % 2 ? '12:00 - 18:00' : '09:00 - 21:00',
    mood: i % 3 ? '오픈된 공간' : '조용한 공간',
    ppl: i % 2 ? 6 : 2,
  })

  const spaceKeyFromCafe = (cafe) => {
    if (cafe.mood.includes('오픈')) return 'open'
    if (cafe.mood.includes('조용')) return 'quiet'
    if (cafe.name.includes('회의실')) return 'room'
    return 'limited'
  }

  const list = (selected ? [selected] : places).map(decorate)

  const filtered = list.filter((cafe) => {
    const matchSpace = filters.spaces.length === 0 || filters.spaces.includes(spaceKeyFromCafe(cafe))
    const matchPeople = filters.people === 0 || cafe.ppl >= filters.people
    return matchSpace && matchPeople
  })

  const sheetHeight = Math.max(0, ch - sheetTop)

  const moveToMyLocation = () => {
    if (!navigator.geolocation) {
      alert('위치 정보를 지원하지 않는 브라우저입니다.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        if (mapRef.current) {
          const loc = new window.kakao.maps.LatLng(latitude, longitude)
          mapRef.current.panTo(loc)
        }
      },
      () => alert('위치 정보를 가져올 수 없어요.')
    )
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
                closeMenu()
                logout()
                navigate('/login')
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

          <button
            className={`${styles.myLocationBtn} ${reservation ? styles.withReserve : styles.noReserve}`}
            onClick={moveToMyLocation}
          >
            <img src={locationIcon} alt="내 위치" />
          </button>

          {reservation && (
            <div
              className={`${styles.reserveStatus} ${
                reservation.status === 'scheduled'
                  ? styles.scheduled
                  : reservation.status === 'inuse'
                  ? styles.inuse
                  : styles.pending
              }`}
              onClick={() => {
                if (reservation.status === 'scheduled') setShowDetailSheet(true)
              }}
              role="button"
              tabIndex={0}
            >
              <div className={styles.reserveCafe}>{reservation.cafe}</div>
              <div className={styles.reserveInfo}>
                <span className={styles.time}>{reservation.time}</span> 회의실 이용 예정이에요!
              </div>
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

      {showDetailSheet && (
        <div className={styles.detailSheet}>
          <div
            className={styles.handle}
            onClick={() => setShowDetailSheet(false)}
            role="button"
            tabIndex={0}
          />
          <div className={styles.detailHeader}>
            <p>
              <span className={styles.today}>오늘</span>{' '}
              <span className={styles.time}>{reservation.time}</span>
            </p>
            <p>회의실 이용 예정이에요!</p>
          </div>
          <div className={styles.detailCafeCard}>
            <img
              className={styles.thumb}
              src="https://picsum.photos/seed/detailCafe/200/200"
              alt={reservation.cafe}
            />
            <div className={styles.info}>
              <div className={styles.cafeName}>{reservation.cafe}</div>
              <div className={styles.metaRow}>
                <img src={clockIcon} alt="" className={styles.metaIcon} />
                12:00 - 18:00
              </div>
              <div className={styles.metaRow}>
                <img src={chatIcon2} alt="" className={styles.metaIcon} />
                오픈된 공간
              </div>
              <div className={styles.metaRow}>
                <img src={peopleIcon} alt="" className={styles.metaIcon} />
                6명
              </div>
            </div>
          </div>
          <div className={styles.detailContent}>
            <h4>예약자 정보</h4>
            <p>
              <b>이름</b> 김민수
            </p>
            <p>
              <b>전화번호</b> 010-1234-1234
            </p>
            <p>
              <b>회의 인원</b> 5명
            </p>
            <h4>회의 종류</h4>
            <p>프로젝트 회의</p>
            <h4>예약 일정</h4>
            <p>
              <b>날짜</b> 2025.08.07 (목)
            </p>
            <p>
              <b>시간</b> 15:00 - 18:00 (3시간)
            </p>
            <h4>회의 인원</h4>
            <p>5명</p>
          </div>
          <button
            className={styles.cancelBtn}
            onClick={() => {
              setShowDetailSheet(false)
              setShowCancelModal(true)
            }}
          >
            예약 취소
          </button>
        </div>
      )}

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
                "일정 변경으로 인한 취소",
                "개인 사정(긴급 용무 등)",
                "예약 시간 착오",
                "장소 변경",
                "참석 인원 부족",
                "비용, 예산 문제",
                "중복 예약",
              ].map((reason) => (
                <li
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={selectedReason === reason ? styles.reasonSelected : ""}
                >
                  {reason}
                </li>
              ))}
            </ul>
            {selectedReason && (
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  setShowCancelModal(false)
                  setShowResultModal(true)
                }}
              >
                예약 취소
              </button>
            )}
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
                  setShowResultModal(false)
                  setSelectedReason('')
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
                setShowResultModal(false)
                setSelectedReason('')
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

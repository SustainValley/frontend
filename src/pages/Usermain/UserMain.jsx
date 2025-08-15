import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KakaoMap from '../../components/map/KakaoMap';
import styles from './UserMain.module.css';

import searchIcon from '../../assets/Search.svg';
import filterIcon from '../../assets/filter.svg';

export default function MapExplore() {
  const navigate = useNavigate();

  const [keyword, setKeyword]   = useState('');
  const [input, setInput]       = useState('');
  const [places, setPlaces]     = useState([]);
  const [selected, setSelected] = useState(null);

  const wrapRef = useRef(null);
  const [ch, setCh] = useState(800);

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
    const FULL_TOP = 96;
    const MID_TOP  = Math.round(ch * 0.52);
    const PEEK     = 140;
    const PEEK_TOP = ch - PEEK;
    return { FULL_TOP, MID_TOP, PEEK_TOP, MIN: FULL_TOP, MAX: PEEK_TOP };
  }, [ch]);

  const [sheetTop, setSheetTop] = useState(SNAP.PEEK_TOP);
  useLayoutEffect(() => { setSheetTop(SNAP.PEEK_TOP); }, [SNAP.PEEK_TOP]);

  const drag = useRef({ active:false, startY:0, startTop:SNAP.PEEK_TOP });
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const onPointerDown = (e) => {
    const y = (e.touches?.[0]?.clientY ?? e.clientY);
    drag.current = { active: true, startY: y, startTop: sheetTop };
    e.currentTarget.setPointerCapture?.(e.pointerId ?? 1);
  };

  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const y  = (e.touches?.[0]?.clientY ?? e.clientY);
    const dy = y - drag.current.startY;
    const next = clamp(drag.current.startTop + dy, SNAP.MIN, SNAP.MAX);
    setSheetTop(next);
    if (e.cancelable) e.preventDefault();
  };

  const onPointerUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;

    const mid1 = (SNAP.FULL_TOP + SNAP.MID_TOP) / 2;
    const mid2 = (SNAP.MID_TOP  + SNAP.PEEK_TOP) / 2;
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
    thumb: p.thumb || `https://picsum.photos/seed/cafe${i+3}/300/300`,
    hours: i % 2 ? '12:00 - 18:00' : '09:00 - 21:00',
    mood:  i % 3 ? '오픈된 공간' : '조용한 공간',
    ppl:   i % 2 ? 6 : 2,
  });

  const list = (selected ? [selected] : places).map(decorate);
  const nothing = !selected && places.length === 0;
  const sheetHeight = Math.max(0, ch - sheetTop);

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <KakaoMap
        keyword={keyword}
        onPlacesFound={setPlaces}
        onPlaceClick={setSelected}
      />

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
          onClick={() =>
            navigate('/user/filters', {
              state: { filters: { spaces: [], people: 1 } },
            })
          }
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
          <div className={styles.sheetTitle}>회의 가능한 카페를 둘러보세요!</div>

          {nothing ? (
            <div className={styles.cardGhost}>
              검색 결과가 아직 없어요. 검색하거나 지도의 마커를 눌러보세요.
            </div>
          ) : (
            list.map((cafe) => (
              <div key={cafe.id} className={styles.cafeCard}>
                <img className={styles.thumb} src={cafe.thumb} alt={cafe.name} />
                <div className={styles.info}>
                  <div className={styles.cafeName}>{cafe.name}</div>
                  <div className={styles.metaRow}><span className={styles.ico} aria-hidden>🕒</span>{cafe.hours}</div>
                  <div className={styles.metaRow}><span className={styles.ico} aria-hidden>💬</span>{cafe.mood}</div>
                  <div className={styles.metaRow}><span className={styles.ico} aria-hidden>👥</span>{cafe.ppl}명</div>
                </div>
                <button
                  className={styles.reserveBtn}
                  onClick={() =>
                    navigate('/user/reserve', {
                      state: {
                        cafe: {
                          id: cafe.id,
                          name: cafe.name,
                          addr: cafe.addr,
                          thumb: cafe.thumb,
                          hours: cafe.hours,
                          mood: cafe.mood,
                          ppl: cafe.ppl,
                        },
                      },
                    })
                  }
                >
                  예약하기
              </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

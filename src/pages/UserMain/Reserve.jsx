import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Reserve.module.css';

import backIcon from '../../assets/chevron.svg';

const defaultCafe = {
  name: '풍치커피익스프레스공릉점',
  addr: '서울 노원구 동일로176길 19-20',
  photos: [
    'https://picsum.photos/seed/meeting1/1200/900',
    'https://picsum.photos/seed/meeting2/1200/900',
    'https://picsum.photos/seed/meeting3/1200/900',
    'https://picsum.photos/seed/meeting4/1200/900',
  ],
  hours: '09:00 - 21:00',
  mood: '오픈된 공간',
  ppl: 5,
};

const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2,'0')}:00`);

export default function Reserve(){
  const navigate = useNavigate();
  const { state } = useLocation();
  const cafe = state?.cafe ?? defaultCafe;

  // 사진 배열 (없으면 단일 썸네일 사용)
  const photos = Array.isArray(cafe.photos) && cafe.photos.length > 0
    ? cafe.photos
    : [cafe.thumb ?? defaultCafe.photos[0]];

  // 캐러셀 인덱스
  const [idx, setIdx] = useState(0);
  const trackRef = useRef(null);

  // 스크롤 시 현재 인덱스 계산
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setIdx(Math.max(0, Math.min(photos.length - 1, i)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const onResize = () => onScroll();
    window.addEventListener('resize', onResize);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [photos.length]);

  // ===== 예약 폼 상태 =====
  const [type,setType] = useState('프로젝트 회의');
  const [date,setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate()+1);
    return d.toISOString().slice(0,10);
  });
  const [start,setStart] = useState('15:00');
  const [end,setEnd]     = useState('18:00');
  const [headcount,setHeadcount] = useState(1);

  const price = useMemo(() => {
    const [sH] = start.split(':').map(Number);
    const [eH] = end.split(':').map(Number);
    return Math.max(0, eH - sH) * 6000;
  }, [start,end]);

  const timeSlotsBar = (() => {
    const s = Number(start.slice(0,2));
    const e = Number(end.slice(0,2));
    return hours.map((h, j) => (
      <span key={h} className={j>=s && j<e ? styles.slotActive : styles.slot}/>
    ));
  })();

  const onSubmit = (e)=>{
    e.preventDefault();
    alert([
      `예약 요청`,
      `- 장소: ${cafe.name}`,
      `- 일자: ${date}`,
      `- 시간: ${start} ~ ${end}`,
      `- 인원: ${headcount}명`,
      `- 종류: ${type}`,
      `- 금액: ${price.toLocaleString()}원`,
    ].join('\n'));
  };

  return (
    <div className={styles.page}>
      {/* ===== 상단(앱바 + 사진 캐러셀) ===== */}
      <div className={styles.top}>
        <div className={styles.appbar}>
          <button className={styles.backBtn} aria-label="뒤로가기" onClick={()=>navigate(-1)}>
            <img className={styles.backIcon} src={backIcon} alt="" />
          </button>
          <h1 className={styles.title}>{cafe.name}</h1>
          <span /> {/* 우측 비워 중앙정렬 유지 */}
        </div>

        <div className={styles.hero}>
          <div className={styles.heroTrack} ref={trackRef}>
            {photos.map((src, i) => (
              <div className={styles.slide} key={i}>
                <img src={src} alt={`${cafe.name} 사진 ${i+1}`} />
              </div>
            ))}
          </div>
          <span className={styles.photoCount}>{idx + 1}/{photos.length}</span>
        </div>
      </div>

      {/* ===== 본문 ===== */}
      <main className={styles.body}>
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${styles.tabActive}`}>상세정보</button>
          <button type="button" className={`${styles.tab} ${styles.tabMuted}`} disabled>예약하기</button>
        </div>

        {/* 운영 정보 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>운영 정보</h2>
          <div className={styles.row}>
            <span className={styles.k}>위치</span>
            <span className={styles.v}>{cafe.addr}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.k}>운영 시간</span>
            <div className={styles.inline}>
              <span className={styles.tagGreen}>운영중</span>
              <span className={styles.gray}>{cafe.hours}</span>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.ghostBtn}><span className={styles.btnIcon} aria-hidden>📞</span>전화하기</button>
            <button className={styles.ghostBtn}><span className={styles.btnIcon} aria-hidden>💬</span>채팅 문의하기</button>
          </div>
        </section>

        {/* 회의실 이용 정보 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>회의실 이용 정보</h2>
          <div className={styles.row}><span className={styles.k}>최소 주문</span><span className={styles.v}>1인 1음료</span></div>
          <div className={styles.row}><span className={styles.k}>수용가능인원</span><span className={styles.v}>최대 {cafe.ppl}명</span></div>
          <div className={styles.row}><span className={styles.k}>공간</span><span className={styles.v}>오픈된 공간 (다른 사용자와 함께 사용)</span></div>
        </section>

        {/* 예약 입력 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>예약 정보 입력</h2>

          <div className={styles.rowCol}>
            <span className={styles.k}>회의 종류</span>
            <div className={styles.chips}>
              {['프로젝트 회의','과제/스터디','외부 미팅','면접/인터뷰','네트워킹','기타'].map((label)=>(
                <button key={label}
                        className={`${styles.chip} ${type===label?styles.chipActive:''}`}
                        onClick={()=>setType(label)}
                        type="button">{label}</button>
              ))}
            </div>
          </div>

          <div className={styles.rowCol}>
            <span className={styles.k}>일정</span>
            <div className={styles.card}>
              <div className={styles.dateRow}>
                <label className={styles.smallLabel}>날짜</label>
                <input className={styles.dateInput} type="date" value={date} onChange={(e)=>setDate(e.target.value)}/>
              </div>

              <div className={styles.timeRow}>
                <label className={styles.smallLabel}>시간</label>
                <div className={styles.timeline} aria-hidden>{timeSlotsBar}</div>
                <div className={styles.timePickers}>
                  <div className={styles.timePicker}>
                    <span className={styles.smallLabel}>시작시간</span>
                    <select value={start} onChange={(e)=>setStart(e.target.value)}>
                      {hours.map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className={styles.timePicker}>
                    <span className={styles.smallLabel}>종료시간</span>
                    <select value={end} onChange={(e)=>setEnd(e.target.value)}>
                      {hours.map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.countRow}>
                <span className={styles.smallLabel}>회의 인원</span>
                <div className={styles.counter}>
                  <button type="button" onClick={()=>setHeadcount(Math.max(1, headcount-1))}>-</button>
                  <span>{headcount} 명</span>
                  <button type="button" onClick={()=>setHeadcount(headcount+1)}>+</button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.notice}>
            <p className={styles.noticeTitle}>예약 전 꼭 확인해주세요</p>
            <ul>
              <li>예약 완료 안내가 없으면 이용 확정이 아닙니다.</li>
              <li>일정이 바뀌면 반드시 사전에 예약 취소를 해주세요.</li>
              <li>매장과 예약공간은 다른 고객에게 피해를 줄 수 있으니, 꼭 방문하셔서 문의해 주세요.</li>
            </ul>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryRow}><span className={styles.summaryK}>회의 종류</span><span className={styles.summaryV}>{type}</span></div>
            <div className={styles.summaryRow}><span className={styles.summaryK}>예약 인원</span><span className={styles.summaryV}>{headcount}명</span></div>
            <div className={styles.summaryRow}><span className={styles.summaryK}>예약 시간</span><span className={styles.summaryV}>{start} - {end}</span></div>
            <div className={styles.summaryRowStrong}><span className={styles.summaryK}>예약 금액</span><span className={styles.summaryVStrong}>{price.toLocaleString()} 원</span></div>
          </div>

          <form onSubmit={onSubmit} className={styles.ctaWrap}>
            <button className={styles.cta} type="submit">예약 요청하기</button>
          </form>
        </section>
      </main>
    </div>
  );
}

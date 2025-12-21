import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './MyReservations.module.css';

import backIcon from '../../assets/chevron.svg';
import peopleIcon from '../../assets/people.svg';
import calendarIcon from '../../assets/calendar.svg';
import clockIcon from '../../assets/clock.svg';

import { getUserId as getStoredUserId } from '../../lib/axios';

/* ===================== ✅ API 설정 (배포에서도 절대경로로 고정) ===================== */

const IS_DEV = process.env.NODE_ENV === 'development';
const PROD_API_HOST = process.env.REACT_APP_API_HOST || 'https://mocacafe.site';
const API_HOST = IS_DEV ? 'http://54.180.2.235:8080' : PROD_API_HOST;
const API_PREFIX = `${API_HOST}/hackathon/api`;

/* ===================== 유틸 ===================== */

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

const REJECTEDS = ['REJECTED', 'CANCELLED', 'CANCELED', 'DENIED'];
const groupOf = (row) => {
  if (row.attendanceStatus === 'COMPLETED') return 'completed';
  if (REJECTEDS.includes(row.reservationStatus)) return 'rejected';
  if (row.reservationStatus === 'APPROVED') return 'confirmed';
  return 'request';
};

export default function MyReservations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState('request');
  const [sub, setSub] = useState('ongoing');

  const userId = useMemo(() => getStoredUserId() || null, []);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = searchParams.get('tab');
    const s = searchParams.get('sub');
    if (t === 'request' || t === 'confirmed' || t === 'completed') setTab(t);
    if (s === 'ongoing' || s === 'rejected') setSub(s);
  }, [searchParams]);

  const goTab = (next) => {
    setTab(next);
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', next);
    if (next !== 'request') p.delete('sub');
    setSearchParams(p);
  };

  const goSub = (next) => {
    setSub(next);
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', 'request');
    p.set('sub', next);
    setSearchParams(p);
  };

  useEffect(() => {
    let abort = false;

    (async () => {
      try {
        setLoading(true);

        if (!userId) {
          if (!abort) setItems([]);
          return;
        }

        const res = await fetch(
          `${API_PREFIX}/reservation?userId=${encodeURIComponent(userId)}`,
          {
            headers: { accept: '*/*' },
            credentials: 'include', // ✅ 배포에서 인증/세션 쿠키 쓰면 필수
          }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const arr = Array.isArray(data?.result) ? data.result : [];

        const mapped = arr.map((r, idx) => ({
          key: String(r.reservationsId ?? idx),
          cafeName: r.cafeName || `카페 #${r.cafeId ?? '-'}`,
          people: r.peopleCount ?? 0,
          dateKey: r.date || '',
          dateText: dateWithWeekday(r.date),
          timeText: `${fmtHHMM(r.startTime)} - ${fmtHHMM(r.endTime)}`,
          reservationStatus: r.reservationStatus,
          attendanceStatus: r.attendanceStatus,
          immediate: !!r.immediate,
          cancelReason: r.cancelReason || '',
          group: groupOf(r),
        }));

        if (!abort) setItems(mapped);
      } catch (e) {
        console.error('my reservations error', e);
        if (!abort) setItems([]);
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => { abort = true; };
  }, [userId]);

  const list = useMemo(() => {
    let base = [];
    if (tab === 'confirmed') base = items.filter((x) => x.group === 'confirmed');
    else if (tab === 'completed') base = items.filter((x) => x.group === 'completed');
    else base = sub === 'rejected'
      ? items.filter((x) => x.group === 'rejected')
      : items.filter((x) => x.group === 'request');

    return base.sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0));
  }, [items, tab, sub]);

  return (
    <div className={styles.page}>
      <div className={styles.stickyTop}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="뒤로">
            <img src={backIcon} alt="" />
          </button>
          <span className={styles.title}>나의 예약</span>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'request' ? styles.active : ''}`} onClick={() => goTab('request')}>
            예약 요청
          </button>
          <button
            className={`${styles.tab} ${tab === 'confirmed' ? styles.active : ''}`}
            onClick={() => goTab('confirmed')}
          >
            이용 확정
          </button>
          <button
            className={`${styles.tab} ${tab === 'completed' ? styles.active : ''}`}
            onClick={() => goTab('completed')}
          >
            이용 완료
          </button>
        </div>

        {tab === 'request' ? (
          <div className={styles.subTabs}>
            <button
              className={`${styles.subTab} ${sub === 'ongoing' ? styles.subActive : ''}`}
              onClick={() => goSub('ongoing')}
            >
              요청 중
            </button>
            <button
              className={`${styles.subTab} ${sub === 'rejected' ? styles.subActive : ''}`}
              onClick={() => goSub('rejected')}
            >
              요청 거절 및 취소
            </button>
          </div>
        ) : (
          <div className={styles.subTabsSpacer} />
        )}
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.emptyText}>불러오는 중…</div>
        ) : list.length === 0 ? (
          <div className={styles.emptyText}>
            {tab === 'request' && sub === 'ongoing' && '요청 중인 예약이 없어요.'}
            {tab === 'request' && sub === 'rejected' && '거절/취소된 예약이 없어요.'}
            {tab === 'confirmed' && '이용 확정된 예약이 없어요.'}
            {tab === 'completed' && '이용 완료된 예약이 없어요.'}
          </div>
        ) : (
          list.map((it) => (
            <div key={it.key} className={`${styles.card} ${tab === 'completed' ? styles.cardDone : ''}`}>
              <div className={styles.cafeName}>{it.cafeName}</div>

              <div className={styles.metaRow}>
                <img className={styles.metaIcon} src={peopleIcon} alt="" />
                {it.people}명
                {it.immediate && <span className={styles.badge}>바로이용</span>}
              </div>
              <div className={styles.metaRow}>
                <img className={styles.metaIcon} src={calendarIcon} alt="" />
                {it.dateText}
              </div>
              <div className={styles.metaRow}>
                <img className={styles.metaIcon} src={clockIcon} alt="" />
                {it.timeText}
              </div>

              {tab === 'request' && sub === 'rejected' && it.cancelReason && (
                <div className={styles.cancelReason}>사유: {it.cancelReason}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

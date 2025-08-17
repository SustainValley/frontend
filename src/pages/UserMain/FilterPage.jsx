import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './FilterPage.module.css';

/* ▼ 이미지 아이콘 (프로젝트 경로에 맞게 조정) */
import backArrow   from '../../assets/chevron.svg';
import iconOpen    from '../../assets/tabler_messages.svg';
import iconQuiet   from '../../assets/tabler_messages-off.svg';
import iconRoom    from '../../assets/tabler_door.svg';
import iconLimited from '../../assets/tabler_message-dots.svg';

/* 아이콘은 단일 이미지만 사용(활성/비활성 동일) */
const SPACE_OPTIONS = [
  { key: 'open',    title: '오픈된 공간',      sub: '타 고객과 함께 사용', img: iconOpen },
  { key: 'quiet',   title: '조용한 공간',      sub: '집중 업무용',         img: iconQuiet },
  { key: 'room',    title: '회의실',          sub: '분리된 회의실',       img: iconRoom },
  { key: 'limited', title: '제한적 대화 공간',  sub: '소음 최소화',         img: iconLimited },
];

export default function FilterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initial = useMemo(() => location.state?.filters || {}, [location.state]);

  // 복수 선택은 Set으로 관리
  const [spaces, setSpaces] = useState(new Set(initial.spaces || []));
  const [people, setPeople] = useState(initial.people ?? 0);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const toggleSpace = (k) =>
    setSpaces(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const dec = () => setPeople(p => Math.max(0, p - 1));
  const inc = () => setPeople(p => Math.min(20, p + 1));

  const apply = () => {
    const filters = { spaces: Array.from(spaces), people };
    navigate('/user/home', { state: { filters } });
  };
  
  return (
    <div className={styles.wrap}>
      {/* 앱바 */}
      <header className={styles.appBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="뒤로가기">
          <img src={backArrow} alt="" aria-hidden className={styles.backIcon} />
          <span className={styles.srOnly}>뒤로가기</span>
        </button>
        <div className={styles.appBarTitle}>필터 적용</div>
        <div className={styles.appBarRight} />
      </header>

      {/* 본문 */}
      <main className={styles.body}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>공간</h2>
          <p className={styles.sectionSub}>원하는 회의 공간 유형을 선택해주세요.</p>

          <div className={styles.grid}>
            {SPACE_OPTIONS.map(({ key, title, sub, img }) => {
              const active = spaces.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  className={`${styles.optionCard} ${active ? styles.active : ''}`}
                  onClick={() => toggleSpace(key)}
                  aria-pressed={active}
                >
                  <div className={styles.optionIcon}>
                    <img className={styles.optionImg} src={img} alt="" aria-hidden />
                  </div>
                  <div className={styles.optionTexts}>
                    <div className={styles.optionTitle}>{title}</div>
                    <div className={styles.optionSub}>{sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>수용가능인원</h2>
          <p className={styles.sectionSub}>회의 참석 인원 수를 선택해주세요.</p>

          <div className={styles.rowBetween}>
            <div className={styles.peopleLabel}>
              회의 인원 <span className={styles.hl}>{people}</span> 명
            </div>
            <div className={styles.stepper}>
              <button 
                className={styles.stepBtn} 
                onClick={dec} 
                aria-label="감소" 
                disabled={people === 0}
              >
                –
              </button>
              <div className={styles.stepValue}>{people}</div>
              <button 
                className={styles.stepBtn} 
                onClick={inc} 
                aria-label="증가"
              >
                +
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 하단 고정 버튼 */}
      <footer className={styles.footer}>
        <button className={styles.applyBtn} onClick={apply}>필터 적용하기</button>
      </footer>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./StoreInfo.module.css";
import right from "../../assets/chevron-right.svg";
import cameraIcon from "../../assets/camera.svg";
import locIcon from "../../assets/location.svg";

export default function StoreInfo() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [name] = useState("풍치커피익스프레스공릉점");
  const [addr] = useState("서울 노원구 동일로176길 19-20");
  const disabled = useMemo(() => !open, [open]);

  const [minOrder, setMinOrder] = useState("");
  const [maxPeople, setMaxPeople] = useState(5);
  const inc = () => setMaxPeople((v) => Math.min(20, v + 1));
  const dec = () => setMaxPeople((v) => Math.max(1, v - 1));

  const SPACE_OPTIONS = [
    "오픈된 공간 (다른 이용자와 함께 이용)",
    "조용한 공간 (집중 업무용)",
    "회의실 (분리된 공간)",
    "제한적 대화 공간 (소음 최소화)",
    "기타 (직접 입력)",
  ];
  const [space, setSpace] = useState(SPACE_OPTIONS[0]);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [spaceCustom, setSpaceCustom] = useState("");
  const isEtc = space.startsWith("기타");

  const dropRef = useRef(null);
  useEffect(() => {
    const onClickOutside = (e) => {
      if (!dropRef.current) return;
      if (!dropRef.current.contains(e.target)) setSpaceOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const [photos, setPhotos] = useState([]);
  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const [replaceIndex, setReplaceIndex] = useState(null);

  const [current, setCurrent] = useState(0);
  const totalSlides = photos.length + 1;

  const pressTimer = useRef(null);
  const startLongPress = (idx) => {
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => openReplace(idx), 500);
  };
  const cancelLongPress = () => clearTimeout(pressTimer.current);

  const fileToDataURL = (file) =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

  const handleAddFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const startIndex = photos.length;
    const dataURLs = await Promise.all(files.map(fileToDataURL));
    const mapped = dataURLs.map((url, i) => ({ url, fileName: files[i].name }));
    setPhotos((prev) => [...prev, ...mapped]);
    setCurrent(startIndex);
    e.target.value = "";
  };

  const handleDelete = (index) => {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setCurrent((c) => Math.min(c, next.length));
      return next;
    });
  };

  const openReplace = (index) => {
    setReplaceIndex(index);
    replaceInputRef.current?.click();
  };

  const handleReplace = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = await fileToDataURL(f);
    setPhotos((prev) => {
      const next = [...prev];
      next[replaceIndex] = { url, fileName: f.name };
      return next;
    });
    e.target.value = "";
  };

  const goTo = (idx) => setCurrent(Math.max(0, Math.min(idx, totalSlides - 1)));
  const prevSlide = () => goTo(current - 1);
  const nextSlide = () => goTo(current + 1);

  useEffect(() => {
    setCurrent((c) => Math.min(c, photos.length));
  }, [photos.length]);

  const isAddSlide = current === photos.length;
  const hasAnyPhoto = photos.length > 0;
  const badgeText = isAddSlide
    ? `사진 추가 (${current + 1}/${totalSlides})`
    : `${current + 1}/${totalSlides}`;

  const [showModal, setShowModal] = useState(false);

  const handleSave = () => {
    setShowModal(true);
  };

  const handleModalConfirm = () => {
    setShowModal(false);
    navigate("/owner/home");
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="뒤로">‹</button>
        <div className={styles.title}>가게 정보</div>
        <div className={styles.headerRight} />
      </div>

      <div className={styles.scroll}>
        {/* 사진 캐러셀 */}
        <div className={styles.photoCarousel}>
          {hasAnyPhoto && <div className={styles.badge}>{badgeText}</div>}
          {hasAnyPhoto && (
            <>
              <button className={`${styles.navBtn} ${styles.navLeft}`} onClick={prevSlide} disabled={current === 0} aria-label="이전">
                <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className={`${styles.navBtn} ${styles.navRight}`} onClick={nextSlide} disabled={current === totalSlides - 1} aria-label="다음">
                <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </>
          )}
          <div className={styles.slides} style={{ transform: `translateX(-${current * 100}%)` }}>
            {photos.map((p, idx) => (
              <div
                className={styles.slide}
                key={`${p.url}-${idx}`}
                onMouseDown={() => startLongPress(idx)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onTouchStart={() => startLongPress(idx)}
                onTouchEnd={cancelLongPress}
              >
                <img className={styles.photo} src={p.url} alt={`사진 ${idx + 1}`} />
                <button className={styles.deleteBtn} onClick={() => handleDelete(idx)} aria-label="사진 삭제">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
            <div
              className={`${styles.slide} ${styles.addSlide}`}
              onClick={() => addInputRef.current?.click()}
              role="button"
              aria-label="사진 추가하기"
            >
              <div className={styles.addContent}>
                <img src={cameraIcon} alt="" className={styles.cameraIcon} />
                <div className={styles.addText}>사진 추가하기</div>
              </div>
            </div>
          </div>
          <input ref={addInputRef} type="file" accept="image/*" multiple className={styles.file} onChange={handleAddFiles} />
          <input ref={replaceInputRef} type="file" accept="image/*" className={styles.file} onChange={handleReplace} />
        </div>

        {/* 가게 정보 */}
        <div className={styles.infoBlock}>
          <div className={styles.shopName}>{name}</div>
          <div className={styles.addrRow}>
            <img src={locIcon} alt="" className={styles.locIcon} />
            <span className={styles.addrText}>위치</span>
            <span className={styles.addrValue}>{addr}</span>
          </div>
        </div>

        {/* 운영 상태 */}
        <div className={styles.section}>
          <div className={styles.stateRow}>
            <div className={styles.stateTitle}>MOCA 운영상태</div>
            <div className={styles.stateText}>{open ? "운영중" : "운영중지"}</div>
            <label className={styles.switch} aria-label="운영상태 스위치">
              <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
              <span className={styles.slider} />
            </label>
          </div>
          <div className={styles.linkGroup}>
            <button className={`${styles.linkItem} ${!open ? styles.linkItemDisabled : ""}`} onClick={() => open && navigate("/owner/store/hours")} disabled={!open}>
              <span>운영 정보 설정</span>
              <img src={right} alt="" />
            </button>
            <button
              className={`${styles.linkItem} ${!open ? styles.linkItemDisabled : ""}`}
              onClick={() => open && navigate("/owner/store/block-time")}
              disabled={!open}
            >
              <span>예약 가능 시간 설정</span>
              <img src={right} alt="" />
            </button>
          </div>
        </div>

        {/* 회의실 이용 정보 */}
        <div className={styles.section} ref={dropRef}>
          <div className={styles.caption}>회의실 이용 정보</div>
          <div className={styles.row}>
            <div className={styles.label}>최소 주문</div>
            <input className={styles.input} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} disabled={!open} placeholder="ex. 1인 1음료" />
          </div>
          <div className={styles.row}>
            <div className={styles.label}>한 예약 당 최대 수용가능인원</div>
            <div className={`${styles.block} ${styles.noBg}`}>
              <div className={styles.stepper}>
                <button onClick={dec} disabled={!open || maxPeople <= 1}>–</button>
                <span>{maxPeople}</span>
                <button onClick={inc} disabled={!open || maxPeople >= 20}>+</button>
              </div>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.label}>공간</div>
            <div className={styles.selectWrap}>
              <button type="button" className={styles.selectField} onClick={() => open && setSpaceOpen((v) => !v)} disabled={!open} aria-expanded={spaceOpen} aria-haspopup="listbox">
                <span>{space}</span>
                <svg viewBox="0 0 24 24" className={`${styles.caret} ${spaceOpen ? styles.open : ""}`} aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="#232526" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {spaceOpen && open && (
                <div className={styles.dropdown} role="listbox">
                  <div className={styles.ddHeader} onClick={() => setSpaceOpen(false)}>
                    <span className={styles.ddHeaderText}>{space}</span>
                    <svg viewBox="0 0 24 24" className={`${styles.caret} ${styles.open}`} aria-hidden="true">
                      <path d="M6 9l6 6 6-6" stroke="#232526" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <ul className={styles.ddList}>
                    {SPACE_OPTIONS.map((opt) => (
                      <li key={opt} role="option" aria-selected={space === opt} className={`${styles.ddItem} ${space === opt ? styles.active : ""}`} onClick={() => { setSpace(opt); setSpaceOpen(false); }}>
                        {opt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          {isEtc && (
            <div className={`${styles.row} ${styles.isEtcInput}`}>
              <input className={styles.input} placeholder="직접 입력(최대 20자)" maxLength={20} value={spaceCustom} onChange={(e) => setSpaceCustom(e.target.value)} disabled={!open}/>
            </div>
          )}
          <div className={styles.row}>
            <div className={styles.label}>이벤트</div>
            <input className={styles.input} placeholder="직접 입력(최대 20자)" maxLength={20} disabled={!open}/>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.saveBtn} onClick={handleSave} disabled={!open}>저장하기</button>
      </div>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>저장 완료</span>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalTitle}>가게 정보가 저장되었습니다.</div>
              <div className={styles.modalText}>변경된 내용이 정상적으로 반영되었습니다.</div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtn} onClick={handleModalConfirm}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

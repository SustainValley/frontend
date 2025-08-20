// src/pages/OwnerMain/StoreInfo.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./StoreInfo.module.css";

import backIcon from "../../assets/chevron.svg";
import right from "../../assets/chevron-right.svg";
import cameraIcon from "../../assets/camera.svg";
import locIcon from "../../assets/location.svg";
import instance from "../../lib/axios";

export default function StoreInfo() {
  const navigate = useNavigate();

  const [open, setOpen] = useState(true);
  useMemo(() => open, [open]);

  // ===== cafeId =====
  const cafeIdRef = useRef(null);
  const [cafeId, setCafeId] = useState(null);
  const [idError, setIdError] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem("cafe_id");
    const parsed = raw && raw !== "undefined" && raw !== "null" ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setIdError("카페 ID(cafe_id)를 찾을 수 없어요. 다시 로그인 후 시도해주세요.");
      cafeIdRef.current = null;
      setCafeId(null);
    } else {
      setIdError("");
      cafeIdRef.current = parsed;
      setCafeId(parsed);
    }
  }, []);

  // ===== 상단 정보 =====
  const [name, setName] = useState("");
  const [addr, setAddr] = useState("");

  // ===== 폼 상태 =====
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

  // ===== 사진 캐러셀 =====
  // Photo: { id: number|null, url: string, fileName: string }
  const [photos, setPhotos] = useState([]);
  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const [replaceIndex, setReplaceIndex] = useState(null);

  const [current, setCurrent] = useState(0);
  const totalSlides = photos.length + 1;

  const pressTimer = useRef(null);
  const startLongPress = (idx) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => openReplace(idx), 500);
  };
  const cancelLongPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  // objectURL 정리
  useEffect(() => {
    return () => {
      photos.forEach((p) => {
        if (p?.url?.startsWith("blob:")) URL.revokeObjectURL(p.url);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 통신 상태 =====
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [apiErr, setApiErr] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ===== 이미지 절대경로 변환 (baseURL pathname 포함) =====
  const toAbsoluteImageUrl = (path) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    try {
      const base = new URL(instance.defaults.baseURL || "", window.location.origin);
      let basePath = base.pathname || "/";
      if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);
      if (basePath === "/") basePath = "";
      const rel = path.startsWith("/") ? path : `/${path}`;
      return `${base.origin}${basePath}${rel}`;
    } catch {
      return path;
    }
  };

  // ===== 카페 정보 가져오기 =====
  useEffect(() => {
    if (!cafeId) return;
    (async () => {
      try {
        setFetching(true);
        const { data } = await instance.get(`/api/cafe/${cafeId}`);

        setName(data?.name || "");
        setAddr(data?.location || "");
        setMinOrder(data?.minOrder || "");
        if (typeof data?.maxSeats === "number") setMaxPeople(data.maxSeats);

        // 공간
        if (typeof data?.spaceType === "string" && data.spaceType.trim()) {
          const s = data.spaceType.trim();
          if (SPACE_OPTIONS.includes(s)) {
            setSpace(s);
            setSpaceCustom("");
          } else {
            setSpace("기타 (직접 입력)");
            setSpaceCustom(s);
          }
        }

        // 이미지: id+url 형식이 있을 수도, 없을 수도
        let mapped = [];
        if (Array.isArray(data?.imageInfos)) {
          mapped = data.imageInfos.map((it) => ({
            id: typeof it.id === "number" ? it.id : null,
            url: toAbsoluteImageUrl(it.url || it.path || ""),
            fileName: ((it.url || it.path || "").split("/").pop() || "image").split("?")[0],
          }));
        } else if (Array.isArray(data?.images)) {
          mapped = data.images.map((it) => ({
            id: typeof it.id === "number" ? it.id : null,
            url: toAbsoluteImageUrl(it.url || it.path || ""),
            fileName: ((it.url || it.path || "").split("/").pop() || "image").split("?")[0],
          }));
        } else if (Array.isArray(data?.imageUrls)) {
          mapped = data.imageUrls.map((p) => {
            const abs = toAbsoluteImageUrl(p);
            return {
              id: null, // 서버에서 id를 안 준 경우
              url: abs,
              fileName: (abs.split("/").pop() || "image").split("?")[0],
            };
          });
        }
        setPhotos(mapped);
        setCurrent(0);
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || "가게 정보를 불러오지 못했어요.";
        setApiErr(msg);
        setShowModal(true);
      } finally {
        setFetching(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafeId]);

  // ===== 업로드 (multipart/form-data) =====
  const uploadImageFile = async (file) => {
    if (!cafeIdRef.current) throw new Error("카페 ID가 없어 이미지를 업로드할 수 없어요.");
    const form = new FormData();
    form.append("image", file, file.name);
    const res = await instance.post(`/api/cafe/${cafeIdRef.current}/images`, form);
    // 서버가 id/url을 돌려줄 수도 있음
    const d = res?.data || {};
    return {
      id: d?.id ?? d?.imageId ?? null,
      url: d?.url ?? d?.imageUrl ?? null,
      message: d?.message,
    };
  };

  const handleAddFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      setUploading(true);

      // 미리보기 먼저
      const startIdx = photos.length;
      const previews = files.map((f) => ({
        id: null,
        url: URL.createObjectURL(f),
        fileName: f.name,
      }));
      setPhotos((prev) => [...prev, ...previews]);
      setCurrent(startIdx);

      // 순차 업로드하면서 id/서버URL 갱신
      for (let i = 0; i < files.length; i += 1) {
        const f = files[i];
        const result = await uploadImageFile(f);

        setPhotos((prev) => {
          const next = [...prev];
          const targetIdx = startIdx + i;
          if (!next[targetIdx]) return prev;

          const updated = { ...next[targetIdx] };
          if (result.id != null) updated.id = result.id;
          if (result.url) {
            // 서버가 저장 경로를 주면 절대경로화
            const abs = toAbsoluteImageUrl(result.url);
            // 로컬 blob 정리
            if (updated.url?.startsWith("blob:")) URL.revokeObjectURL(updated.url);
            updated.url = abs;
            updated.fileName = (abs.split("/").pop() || updated.fileName).split("?")[0];
          }
          next[targetIdx] = updated;
          return next;
        });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "이미지 업로드 중 오류가 발생했어요.";
      setApiErr(msg);
      setShowModal(true);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const openReplace = (index) => {
    setReplaceIndex(index);
    replaceInputRef.current && replaceInputRef.current.click();
  };

  const handleReplace = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      setUploading(true);
      const newUrl = URL.createObjectURL(f);

      // UI 먼저 교체
      setPhotos((prev) => {
        const next = [...prev];
        if (replaceIndex !== null && next[replaceIndex]) {
          const old = next[replaceIndex];
          if (old?.url?.startsWith("blob:")) URL.revokeObjectURL(old.url);
          next[replaceIndex] = { ...old, url: newUrl, fileName: f.name };
        }
        return next;
      });

      // 서버에도 새 이미지로 등록 (교체 API가 없다면 POST만)
      const result = await uploadImageFile(f);

      // 등록 결과(id/서버URL) 반영
      setPhotos((prev) => {
        const next = [...prev];
        if (replaceIndex !== null && next[replaceIndex]) {
          const cur = { ...next[replaceIndex] };
          if (result.id != null) cur.id = result.id;
          if (result.url) {
            const abs = toAbsoluteImageUrl(result.url);
            if (cur.url?.startsWith("blob:")) URL.revokeObjectURL(cur.url);
            cur.url = abs;
            cur.fileName = (abs.split("/").pop() || cur.fileName).split("?")[0];
          }
          next[replaceIndex] = cur;
        }
        return next;
      });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "이미지 교체 업로드 중 오류가 발생했어요.";
      setApiErr(msg);
      setShowModal(true);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const goTo = (idx) => setCurrent(Math.max(0, Math.min(idx, totalSlides - 1)));
  const prevSlide = () => goTo(current - 1);
  const nextSlide = () => goTo(current + 1);

  useEffect(() => {
    setCurrent((c) => Math.min(c, photos.length));
  }, [photos.length]);

  const isAddSlide = current === photos.length;
  const hasAnyPhoto = photos.length > 0;
  const badgeText = isAddSlide ? `사진 추가 (${current + 1}/${totalSlides})` : `${current + 1}/${totalSlides}`;

  // ===== 삭제 =====
  const handleDelete = async (index) => {
    const target = photos[index];
    if (!target) return;

    // id가 없으면 서버 호출 불가 → UI 에서만 제거
    if (target.id == null) {
      setPhotos((prev) => {
        const next = prev.filter((_, i) => i !== index);
        if (target.url?.startsWith("blob:")) URL.revokeObjectURL(target.url);
        setCurrent((c) => Math.min(c, next.length));
        return next;
      });
      return;
    }

    if (!cafeIdRef.current) {
      setApiErr("카페 ID를 확인할 수 없어 이미지를 삭제할 수 없어요.");
      setShowModal(true);
      return;
    }

    try {
      setDeleting(true);
      await instance.delete(`/api/cafe/${cafeIdRef.current}/images/${target.id}/delete`);

      setPhotos((prev) => {
        const next = prev.filter((_, i) => i !== index);
        if (target.url?.startsWith("blob:")) URL.revokeObjectURL(target.url);
        setCurrent((c) => Math.min(c, next.length));
        return next;
      });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "이미지 삭제 중 오류가 발생했어요.";
      setApiErr(msg);
      setShowModal(true);
    } finally {
      setDeleting(false);
    }
  };

  // ===== 저장(PATCH) =====
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!open) return;
    if (!cafeIdRef.current) {
      setApiErr("카페 ID를 확인할 수 없어 저장할 수 없어요.");
      setShowModal(true);
      return;
    }

    const payload = {
      minOrder: (minOrder || "").trim(),
      maxCapacity: Number(maxPeople), // 서버가 maxSeats를 받으면 키 변경
      spaceType: isEtc ? (spaceCustom || "").trim() || "기타 (직접 입력)" : space,
    };

    try {
      setSaving(true);
      setApiErr(null);

      const res = await instance.patch(`/api/cafe/${cafeIdRef.current}/update`, payload);
      const data = res?.data ?? {};

      setMinOrder(data.minOrder ?? minOrder);
      if (typeof data.maxSeats === "number") setMaxPeople(data.maxSeats);
      if (typeof data.spaceType === "string") {
        if (SPACE_OPTIONS.includes(data.spaceType)) {
          setSpace(data.spaceType);
          setSpaceCustom("");
        } else {
          setSpace("기타 (직접 입력)");
          setSpaceCustom(data.spaceType);
        }
      }

      setShowModal(true);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "저장 중 오류가 발생했어요.";
      setApiErr(msg);
      setShowModal(true);
    } finally {
      setSaving(false);
    }
  };

  const handleModalConfirm = () => setShowModal(false);

  return (
    <div className={styles.page} aria-busy={fetching}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={() => navigate(-1)} aria-label="뒤로">
          <img src={backIcon} alt="" className={styles.backIcon} />
        </button>
        <div className={styles.title}>가게 정보</div>
        <div className={styles.headerRight} />
      </div>

      <div className={styles.scroll}>
        {/* 사진 캐러셀 */}
        <div className={styles.photoCarousel} aria-busy={uploading || fetching || deleting}>
          {hasAnyPhoto && <div className={styles.badge}>{badgeText}</div>}
          {hasAnyPhoto && (
            <>
              <button
                className={`${styles.navBtn} ${styles.navLeft}`}
                onClick={prevSlide}
                disabled={current === 0}
                aria-label="이전"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M15 6l-6 6 6 6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                className={`${styles.navBtn} ${styles.navRight}`}
                onClick={nextSlide}
                disabled={current === totalSlides - 1}
                aria-label="다음"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
          <div className={styles.slides} style={{ transform: `translateX(-${current * 100}%)` }}>
            {photos.map((p, idx) => (
              <div
                className={styles.slide}
                key={`${p.url}-${p.id ?? "noid"}-${idx}`}
                onMouseDown={() => startLongPress(idx)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onTouchStart={() => startLongPress(idx)}
                onTouchEnd={cancelLongPress}
              >
                <img className={styles.photo} src={p.url} alt={`사진 ${idx + 1}`} />
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(idx)}
                  disabled={deleting || uploading || fetching}
                  aria-label="사진 삭제"
                  title={p.id == null ? "서버 ID 없음: UI에서만 제거" : `이미지 #${p.id} 삭제`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
            <div
              className={`${styles.slide} ${styles.addSlide}`}
              onClick={() => {
                if (!open || uploading || fetching) return;
                addInputRef.current && addInputRef.current.click();
              }}
              role="button"
              aria-label="사진 추가하기"
              aria-disabled={!open || uploading || fetching}
            >
              <div className={styles.addContent}>
                <img src={cameraIcon} alt="" className={styles.cameraIcon} />
                <div className={styles.addText}>{uploading ? "업로드 중..." : "사진 추가하기"}</div>
              </div>
            </div>
          </div>
          <input
            ref={addInputRef}
            type="file"
            accept="image/*"
            multiple
            className={styles.file}
            onChange={handleAddFiles}
            disabled={!open || uploading || !!idError || fetching}
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            className={styles.file}
            onChange={handleReplace}
            disabled={!open || uploading || !!idError || fetching}
          />
        </div>

        {/* 가게 정보 */}
        <div className={styles.infoBlock}>
          <div className={styles.shopName}>{name || "가게명"}</div>
          <div className={styles.addrRow}>
            <img src={locIcon} alt="" className={styles.locIcon} />
            <span className={styles.addrText}>위치</span>
            <span className={styles.addrValue}>{addr || "주소 미등록"}</span>
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
            <button
              className={`${styles.linkItem} ${!open ? styles.linkItemDisabled : ""}`}
              onClick={() => open && navigate("/owner/store/hours")}
              disabled={!open}
            >
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
            <input
              className={styles.input}
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              disabled={!open}
              placeholder="ex. 1인 1음료"
            />
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
              <button
                type="button"
                className={styles.selectField}
                onClick={() => open && setSpaceOpen((v) => !v)}
                disabled={!open}
                aria-expanded={spaceOpen}
                aria-haspopup="listbox"
              >
                <span>{isEtc && spaceCustom ? spaceCustom : space}</span>
                <svg viewBox="0 0 24 24" className={`${styles.caret} ${spaceOpen ? styles.open : ""}`} aria-hidden="true">
                  <path d="M6 9l6 6 6-6" stroke="#232526" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {spaceOpen && open && (
                <div className={styles.dropdown} role="listbox">
                  <div className={styles.ddHeader} onClick={() => setSpaceOpen(false)}>
                    <span className={styles.ddHeaderText}>
                      {isEtc && spaceCustom ? spaceCustom : space}
                    </span>
                    <svg viewBox="0 0 24 24" className={`${styles.caret} ${styles.open}`} aria-hidden="true">
                      <path d="M6 9l6 6 6-6" stroke="#232526" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <ul className={styles.ddList}>
                    {SPACE_OPTIONS.map((opt) => (
                      <li
                        key={opt}
                        role="option"
                        aria-selected={space === opt}
                        className={`${styles.ddItem} ${space === opt ? styles.active : ""}`}
                        onClick={() => {
                          setSpace(opt);
                          setSpaceOpen(false);
                        }}
                      >
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
              <input
                className={styles.input}
                placeholder="직접 입력(최대 20자)"
                maxLength={20}
                value={spaceCustom}
                onChange={(e) => setSpaceCustom(e.target.value)}
                disabled={!open}
              />
            </div>
          )}
          <div className={styles.row}>
            <div className={styles.label}>프로모션</div>
            <input className={styles.input} placeholder="직접 입력(최대 20자)" maxLength={20} disabled={!open} />
          </div>

          {idError && <div className={styles.errorBox}>{idError}</div>}
        </div>
      </div>

      <div className={styles.footer}>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={!open || saving || !!idError || uploading || fetching || deleting}
        >
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </div>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>{apiErr ? "실패" : "알림"}</span>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              {apiErr ? (
                <>
                  <div className={styles.modalTitle}>요청을 처리하지 못했어요.</div>
                  <div className={styles.modalText}>{apiErr}</div>
                </>
              ) : (
                <>
                  <div className={styles.modalTitle}>완료되었습니다.</div>
                  <div className={styles.modalText}>변경 사항이 정상 반영되었습니다.</div>
                </>
              )}
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './StoryShare.module.css';

/* ===================== 합성 유틸 ===================== */
const STORY_W = 1080;
const STORY_H = 1920;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// cover (배경 꽉 채우기)
function drawCover(ctx, img, x, y, w, h) {
  const iw = img.width;
  const ih = img.height;
  const ir = iw / ih;
  const rr = w / h;

  let dw = w;
  let dh = h;
  if (ir > rr) {
    dh = h;
    dw = dh * ir;
  } else {
    dw = w;
    dh = dw / ir;
  }

  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// contain (프레임 안에 맞추기)
function drawRoundedImageContain(ctx, img, x, y, w, h, r) {
  const iw = img.width;
  const ih = img.height;
  const ir = iw / ih;
  const rr = w / h;

  let dw = w;
  let dh = h;
  if (ir > rr) {
    dw = w;
    dh = dw / ir;
  } else {
    dh = h;
    dw = dh * ir;
  }

  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// 합성: 배경 cover + 가운데 작은 프레임(2번째 사진)
async function composeStory({ bgUrl, fgUrl, titleText }) {
  const canvas = document.createElement('canvas');
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, STORY_W, STORY_H);

  const [bgImg, fgImg] = await Promise.all([loadImage(bgUrl), loadImage(fgUrl)]);

  // 1) 배경
  drawCover(ctx, bgImg, 0, 0, STORY_W, STORY_H);

  // 2) 중앙 프레임(흰 카드 + 그림자)
  const frameW = Math.round(STORY_W * 0.62);
  const frameH = Math.round(STORY_H * 0.45);
  const frameX = Math.round((STORY_W - frameW) / 2);
  const frameY = Math.round((STORY_H - frameH) / 2);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;

  const radius = 28;
  roundRectPath(ctx, frameX, frameY, frameW, frameH, radius);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.restore();

  // 3) 프레임 내부 이미지(2번째 사진)
  const pad = 14;
  const innerX = frameX + pad;
  const innerY = frameY + pad;
  const innerW = frameW - pad * 2;
  const innerH = frameH - pad * 2;
  drawRoundedImageContain(ctx, fgImg, innerX, innerY, innerW, innerH, radius - 8);

  // 4) 상단 텍스트(원하는 디자인 있으면 여기만 바꾸면 됨)
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 46px Pretendard, system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const tx = 88;
  const ty = 140;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('남은시간', tx, ty);
  ctx.fillStyle = '#E74C3C';
  ctx.fillText('01:32', tx + 180, ty);

  ctx.fillStyle = '#111';
  ctx.font = '700 44px Pretendard, system-ui, -apple-system, sans-serif';
  ctx.fillText(titleText || '‘카페’를 이용중이에요', tx, ty + 80);
  ctx.restore();

  const blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 1.0);
  });

  return { blob, canvas };
}

/* ===================== 촬영/공유 유틸 ===================== */
function isMobileLike() {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

function isSecureContextForCamera() {
  return (
    window.isSecureContext ||
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost'
  );
}

function openInstagramFallback() {
  // 웹에서 “스토리 화면 + 파일 자동 주입”은 불가.
  // 최대한: 앱/웹 열기 정도만 제공.
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);

  if (isAndroid) {
    window.location.href =
      'intent://instagram.com/#Intent;package=com.instagram.android;scheme=https;end';
  } else {
    // iOS scheme
    window.location.href = 'instagram://app';
  }

  setTimeout(() => {
    window.location.href = 'https://www.instagram.com/';
  }, 800);
}

function canvasToFile(canvas, filename = 'capture.jpg', mime = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob], filename, { type: mime }));
    }, mime, quality);
  });
}

/* ===================== 컴포넌트 ===================== */
export default function StoryShare() {
  const navigate = useNavigate();
  const routerLoc = useLocation();
  const reservation = routerLoc.state?.reservation ?? null;

  const titleText = useMemo(() => {
    if (reservation?.cafe) return `‘${reservation.cafe}’을 이용중이에요`;
    return '‘카페’를 이용중이에요';
  }, [reservation]);

  // bg -> fg -> preview
  const [step, setStep] = useState('bg');

  const bgInputRef = useRef(null);
  const fgInputRef = useRef(null);

  const [bgFile, setBgFile] = useState(null);
  const [fgFile, setFgFile] = useState(null);

  const bgUrl = useMemo(() => (bgFile ? URL.createObjectURL(bgFile) : null), [bgFile]);
  const fgUrl = useMemo(() => (fgFile ? URL.createObjectURL(fgFile) : null), [fgFile]);

  const canPreview = Boolean(bgUrl && fgUrl);

  const [resultBlob, setResultBlob] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);

  const [busy, setBusy] = useState(false);

  // objectURL 정리
  useEffect(() => {
    return () => {
      if (bgUrl) URL.revokeObjectURL(bgUrl);
    };
  }, [bgUrl]);

  useEffect(() => {
    return () => {
      if (fgUrl) URL.revokeObjectURL(fgUrl);
    };
  }, [fgUrl]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  // bg/fg 바뀌면 결과 초기화
  useEffect(() => {
    setResultBlob(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgUrl, fgUrl]);

  const pickBgFile = () => bgInputRef.current?.click();
  const pickFgFile = () => fgInputRef.current?.click();

  const onBgChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgFile(file);
    setStep('fg');
    e.target.value = '';
  };

  const onFgChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFgFile(file);
    setStep('preview');
    e.target.value = '';
  };

  /* ===== 촬영 모달(WebRTC) ===== */
  const [camOpen, setCamOpen] = useState(false);
  const [camTarget, setCamTarget] = useState('bg'); // 'bg' | 'fg'
  const [camError, setCamError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const closeCamera = () => {
    setCamOpen(false);
    setCamError('');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const openCamera = async (target) => {
    setCamTarget(target);
    setCamError('');
    setCamOpen(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('이 브라우저는 카메라 촬영을 지원하지 않아요.');
      }
      if (!isSecureContextForCamera()) {
        throw new Error('카메라 촬영은 https 또는 localhost에서만 가능해요.');
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
    } catch (err) {
      console.error(err);
      setCamError(err?.message || '카메라를 열 수 없어요. 권한을 확인해 주세요.');
    }
  };

  const takePhoto = async () => {
    try {
      const video = videoRef.current;
      if (!video) return;

      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;

      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, vw, vh);

      const ts = Date.now();
      const file = await canvasToFile(canvas, `moca_${camTarget}_${ts}.jpg`, 'image/jpeg', 0.92);

      if (camTarget === 'bg') {
        setBgFile(file);
        setStep('fg');
      } else {
        setFgFile(file);
        setStep('preview');
      }
      closeCamera();
    } catch (err) {
      console.error(err);
      alert('촬영에 실패했어요. 다시 시도해 주세요.');
    }
  };

  /* ===== 결과 생성 ===== */
  const generate = async () => {
    if (!canPreview) return;
    try {
      const { blob } = await composeStory({ bgUrl, fgUrl, titleText });
      setResultBlob(blob);
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
    } catch (err) {
      console.error(err);
      alert('이미지 합성에 실패했어요. 다른 사진으로 다시 시도해 주세요.');
    }
  };

  useEffect(() => {
    if (step !== 'preview') return;
    if (!canPreview) return;
    if (resultBlob && resultUrl) return;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, canPreview]);

  /* ===== 버튼 액션 ===== */
  const resetAll = () => {
    setStep('bg');
    setBgFile(null);
    setFgFile(null);
    setResultBlob(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }
  };

  const resetFgOnly = () => {
    setStep('fg');
    setFgFile(null);
    setResultBlob(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }
  };

  const download = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = 'moca-story.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  /**
   * ✅ 내 인스타그램으로 “가게” 만들기
   * - 모바일: Web Share API로 이미지 파일 공유(공유 시트에서 Instagram 선택)
   * - PC: 자동 저장 + 인스타 웹 열기(파일 자동 주입은 불가)
   */
  const shareToMyInstagram = async () => {
    if (!resultBlob || busy) return;

    // PC: 파일 자동 전달이 사실상 불가 → 저장 유도 + 인스타 열기
    if (!isMobileLike()) {
      alert('PC에서는 인스타 스토리로 바로 넘기기가 어려워요.\n이미지를 저장한 뒤 인스타에서 업로드해 주세요.');
      download();
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      return;
    }

    // 모바일: Web Share API로 파일 공유 시도
    setBusy(true);
    try {
      const file = new File([resultBlob], 'moca-story.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: 'MOCA Story',
          text: 'MOCA에서 만든 스토리 이미지',
        });
        return; // 사용자가 공유 완료/취소 후 돌아옴
      }

      // Web Share가 안 되면 저장 + 인스타 열기
      alert('이 기기에서는 바로 공유가 어려워요.\n이미지를 저장한 뒤 인스타에서 업로드해 주세요.');
      download();
      openInstagramFallback();
    } catch (err) {
      // 사용자가 공유 취소하면 AbortError가 자주 발생함
      if (err?.name !== 'AbortError') {
        console.error(err);
        alert('공유를 열 수 없어요.\n이미지를 저장한 뒤 인스타에서 업로드해 주세요.');
        download();
        openInstagramFallback();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.top}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="뒤로가기">
          ←
        </button>
        <div className={styles.title}>스토리 공유</div>
        <div className={styles.right} />
      </header>

      {/* 파일 선택 input (모바일은 capture가 카메라 유도, 데스크탑은 무시될 수 있음) */}
      <input
        ref={bgInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onBgChange}
        className={styles.hiddenInput}
      />
      <input
        ref={fgInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFgChange}
        className={styles.hiddenInput}
      />

      {/* STEP 1: 배경 선택/촬영 */}
      {step === 'bg' && (
        <div className={styles.guide}>
          <div className={styles.guideInner}>
            <p className={styles.guideTopLine}>
              <span className={styles.bold}>첫 번째 사진</span>은 배경이 돼요
            </p>
            <p className={styles.sub}>컴퓨터/핸드폰 모두 사진 선택 또는 촬영이 가능해요.</p>

            <div className={styles.rowBtns}>
              <button className={styles.secondaryBtn} onClick={pickBgFile} type="button">
                사진 선택
              </button>
              <button className={styles.cameraBtn} onClick={() => openCamera('bg')} type="button">
                촬영하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: 두 번째 사진 선택/촬영 */}
      {step === 'fg' && (
        <div className={styles.guide}>
          <div className={styles.guideInner}>
            <p className={styles.guideTopLine}>
              <span className={styles.bold}>두 번째 사진</span>은 가운데 작게 올라가요
            </p>
            <p className={styles.sub}>사진 선택 또는 촬영해 주세요.</p>

            <div className={styles.previewHint}>
              {bgUrl ? <img src={bgUrl} alt="배경 미리보기" className={styles.bgThumb} /> : null}
            </div>

            <div className={styles.rowBtns}>
              <button className={styles.secondaryBtn} onClick={() => setStep('bg')} type="button">
                배경 다시
              </button>
              <button className={styles.secondaryBtn} onClick={pickFgFile} type="button">
                사진 선택
              </button>
              <button className={styles.cameraBtn} onClick={() => openCamera('fg')} type="button">
                촬영하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: 결과 미리보기 + 공유 */}
      {step === 'preview' && (
        <div className={styles.previewWrap}>
          <div className={styles.storyStage}>
            {resultUrl ? (
              <img src={resultUrl} alt="스토리 결과" className={styles.resultImg} />
            ) : (
              <div className={styles.layerPreview}>
                {bgUrl && <img src={bgUrl} alt="배경" className={styles.bgFull} />}
                {fgUrl && <img src={fgUrl} alt="오버레이" className={styles.overlay} />}
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button className={styles.secondaryBtn} onClick={resetFgOnly} type="button">
              두 번째 사진 다시
            </button>
            <button className={styles.secondaryBtn} onClick={resetAll} type="button">
              처음부터
            </button>
          </div>

          <div className={styles.bottomBar}>
            <button className={styles.bottomBtn} onClick={download} type="button" disabled={!resultUrl}>
              이미지 저장
            </button>

            <button
              className={styles.bottomBtnPrimary}
              onClick={shareToMyInstagram}
              type="button"
              disabled={!resultBlob || busy}
            >
              {busy ? '공유 준비 중…' : '내 인스타로 공유'}
            </button>
          </div>
        </div>
      )}

      {/* 촬영 모달 */}
      {camOpen && (
        <div className={styles.camOverlay} role="dialog" aria-modal="true">
          <div className={styles.camModal}>
            <div className={styles.camHeader}>
              <div className={styles.camTitle}>{camTarget === 'bg' ? '배경 촬영' : '두 번째 사진 촬영'}</div>
              <button className={styles.camClose} onClick={closeCamera} aria-label="닫기">
                ✕
              </button>
            </div>

            <div className={styles.camBody}>
              {camError ? (
                <div className={styles.camError}>
                  <p className={styles.camErrorTitle}>카메라를 열 수 없어요</p>
                  <p className={styles.camErrorText}>{camError}</p>
                  <p className={styles.camErrorText}>
                    데스크탑 촬영은 보통 <b>https</b> 또는 <b>localhost</b>에서만 가능합니다.
                  </p>
                </div>
              ) : (
                <video ref={videoRef} className={styles.camVideo} playsInline muted />
              )}
            </div>

            <div className={styles.camFooter}>
              <button className={styles.secondaryBtn} onClick={closeCamera} type="button">
                취소
              </button>
              <button className={styles.cameraBtn} onClick={takePhoto} type="button" disabled={!!camError}>
                촬영
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

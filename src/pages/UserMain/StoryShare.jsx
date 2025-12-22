import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './StoryShare.module.css';

/* ===================== API ===================== */
// ✅ 개발: EC2(8080) 직접 호출 / 배포: mocacafe.site
const IS_DEV = process.env.NODE_ENV === 'development';
const API_HOST =
  process.env.REACT_APP_API_HOST ||
  (IS_DEV ? 'http://54.180.2.235:8080' : 'https://mocacafe.site');

const API_PREFIX = `${API_HOST}/hackathon/api`;

async function uploadStoryToInstagram(imageFile) {
  const form = new FormData();
  form.append('image', imageFile);

  const res = await fetch(`${API_PREFIX}/instagram/story`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: { accept: '*/*' },
  });

  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => '');
    data = text ? { message: text } : null;
  }

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error?.message ||
      `스토리 업로드 실패 (HTTP ${res.status})`;

    const detail = data?.result ? `\n\n[서버 상세]\n${String(data.result)}` : '';
    throw new Error(`${msg}${detail}`);
  }

  if (data?.isSuccess === false) {
    const detail = data?.result ? `\n\n[서버 상세]\n${String(data.result)}` : '';
    throw new Error(`${data?.message || '스토리 업로드 실패'}${detail}`);
  }

  return data;
}

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

  // 2) 중앙 프레임
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

  // 3) 프레임 내부 이미지
  const pad = 14;
  const innerX = frameX + pad;
  const innerY = frameY + pad;
  const innerW = frameW - pad * 2;
  const innerH = frameH - pad * 2;
  drawRoundedImageContain(ctx, fgImg, innerX, innerY, innerW, innerH, radius - 8);

  // 4) 상단 텍스트 (원하면 제거 가능)
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const tx = 88;
  const ty = 140;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 46px Pretendard, system-ui, -apple-system, sans-serif';
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

/* ===================== 데스크탑 촬영 유틸 ===================== */
function canvasToFile(canvas, filename = 'capture.jpg', mime = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob], filename, { type: mime }));
    }, mime, quality);
  });
}

/* ===================== 내 인스타로 공유 유틸 ===================== */
function isMobileLike() {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

function openInstagramWebNow() {
  // ✅ 유저 제스처 안에서 열려야 팝업 차단이 덜함
  window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
}

function downloadBlob(blob, filename = 'moca-story.png') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canShareFiles(file) {
  // iOS Safari는 canShare가 없는 경우도 있어서 방어
  try {
    if (!navigator.share) return false;
    if (navigator.canShare) return navigator.canShare({ files: [file] });
    // canShare 없는 환경은 "해볼 수는 있음"
    return true;
  } catch {
    return false;
  }
}

/**
 * ✅ “내 인스타로 넘어가도록”
 * - 모바일: 공유 시트(Instagram 선택 가능)
 * - PC: 자동 업로드 불가 → 저장 + 인스타 웹 열기 안내
 */
async function shareToMyInstagramWithFile(file, resultBlob) {
  // PC
  if (!isMobileLike()) {
    downloadBlob(resultBlob, 'moca-story.png');
    openInstagramWebNow();
    alert(
      'PC에서는 인스타 스토리에 이미지를 자동으로 넣을 수 없어요.\n\n' +
        '1) 방금 저장된 moca-story.png 파일을\n' +
        '2) 인스타그램에서 + 만들기 → 스토리로 업로드해 주세요.'
    );
    return;
  }

  // 모바일: Web Share API
  if (canShareFiles(file)) {
    // 사용자가 공유 시트에서 Instagram을 선택하면 스토리/DM 등으로 전달 가능(기기/OS에 따라 다름)
    await navigator.share({
      files: [file],
      title: 'MOCA Story',
      text: 'MOCA에서 만든 스토리 이미지',
    });
    return;
  }

  // 공유 미지원 → 저장 + 인스타 웹
  downloadBlob(resultBlob, 'moca-story.png');
  openInstagramWebNow();
  alert('이 기기에서는 바로 공유가 어려워요.\n저장된 이미지를 인스타 스토리에 업로드해 주세요.');
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

  // ✅ 서버 업로드 로딩(유지)
  const [uploading, setUploading] = useState(false);

  // objectURL 정리
  useEffect(() => () => bgUrl && URL.revokeObjectURL(bgUrl), [bgUrl]);
  useEffect(() => () => fgUrl && URL.revokeObjectURL(fgUrl), [fgUrl]);
  useEffect(() => () => resultUrl && URL.revokeObjectURL(resultUrl), [resultUrl]);

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

  const ensureSecureContextForCamera = () => {
    const isSecure =
      window.isSecureContext ||
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost';
    if (!isSecure) {
      throw new Error('데스크탑 촬영은 https 또는 localhost에서만 가능해요.');
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
      ensureSecureContextForCamera();

      // 기존 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      // ✅ PC에서 facingMode 환경이 종종 실패 → 2단계 fallback
      const primaryConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const fallbackConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
      } catch {
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }

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
   * ✅ 공유하기 버튼:
   * 1) “내 인스타 공유 흐름”을 먼저 즉시 실행 (유저 제스처 유지)
   * 2) 동시에 서버 업로드 API도 병렬로 호출 (기능 유지)
   *
   * - 서버 업로드 실패해도 내 인스타 공유는 진행되게 함
   * - 배포에서 인스타 안 열리던 문제를 줄이기 위해 await 전에 실행
   */
  const share = () => {
    if (!resultBlob || uploading) return;

    setUploading(true);

    const file = new File([resultBlob], 'moca-story.png', { type: 'image/png' });

    // ✅ 1) 인스타 공유(또는 저장+인스타) 먼저 실행 (제스처 유지)
    const sharePromise = shareToMyInstagramWithFile(file, resultBlob);

    // ✅ 2) 서버 업로드도 동시에 실행
    const uploadPromise = uploadStoryToInstagram(file);

    Promise.allSettled([sharePromise, uploadPromise])
      .then(([shareRes, uploadRes]) => {
        // share는 사용자가 취소할 수 있음 → 과한 alert 금지
        if (shareRes.status === 'rejected' && shareRes.reason?.name !== 'AbortError') {
          console.error('share error:', shareRes.reason);
        }

        // 서버 업로드는 결과 알려주기(실패 시만)
        if (uploadRes.status === 'rejected') {
          console.error('upload error:', uploadRes.reason);
          alert(uploadRes.reason?.message || 'MOCA 인스타 스토리 업로드에 실패했어요.');
          return;
        }
        // 성공 시 굳이 alert 안 띄움 (사용자는 인스타로 이동했을 수 있음)
        console.log('upload success:', uploadRes.value);
      })
      .finally(() => {
        setUploading(false);
      });
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

      {/* 파일 선택 input (모바일은 capture가 카메라 유도, 데스크탑은 보통 무시) */}
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

      {/* STEP 3: 결과 미리보기 + 업로드/공유 */}
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
              onClick={share}
              type="button"
              disabled={!resultBlob || uploading}
            >
              {uploading ? '공유 중…' : '공유하기'}
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

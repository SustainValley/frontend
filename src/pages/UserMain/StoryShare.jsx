// src/pages/StoryShare/StoryShare.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './StoryShare.module.css';

/* ===================== ✅ 버튼 이미지 import (원하는 파일로 교체) ===================== */
import imgClose from '../../assets/x.svg';
import imgShutter from '../../assets/Button-camera.svg';
import imgFlip from '../../assets/Button-camera-2.svg';
import imgInfo from '../../assets/info.svg';

/* ✅ confirm(촬영 직후) 하단 버튼들: 너가 "사진"으로 교체할 곳 */
import imgRetakePill from '../../assets/Button-camera1.svg'; // 예: 다시찍기 pill 이미지 (없으면 fallback 텍스트)
import imgNextCircle from '../../assets/Button-camera-3.svg'; // 예: 오른쪽 원형 다음 버튼 이미지 (없으면 fallback)
import imgSquareLeft from '../../assets/Button-camera-2.svg'; // 예: 왼쪽 네모 버튼 이미지 (없으면 placeholder)
import imgArrowRight from '../../assets/arrow-right2.svg'; // preview 화면 오른쪽 화살표

/* ✅ 안내(핸드폰 모양) 오버레이 이미지: 너가 원하는 이미지로 교체 */
import imgGuidePhone from '../../assets/phone.svg';
import imgGuidePhone2 from '../../assets/phone2.svg';
import imgLocationPin from '../../assets/map-pin1.svg';
/* ================================================================================ */

/* ===================== API ===================== */
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
  if (ct.includes('application/json')) data = await res.json().catch(() => null);
  else {
    const text = await res.text().catch(() => '');
    data = text ? { message: text } : null;
  }

  if (!res.ok || data?.isSuccess === false) {
    const msg =
      data?.message ||
      data?.error?.message ||
      `스토리 업로드 실패 (HTTP ${res.status})`;
    const detail = data?.result ? `\n\n[서버 상세]\n${String(data.result)}` : '';
    throw new Error(`${msg}${detail}`);
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

function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height;
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

function drawRoundedImageContain(ctx, img, x, y, w, h, r) {
  const ir = img.width / img.height;
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

async function composeStory({ bgUrl, fgUrl, userName, cafeName }) {
  const canvas = document.createElement('canvas');
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d');

  // 위치 아이콘 로드
  const locationPinImg = await loadImage(imgLocationPin).catch(() => null);

  const [bgImg, fgImg] = await Promise.all([loadImage(bgUrl), loadImage(fgUrl)]);
  
  // 첫 번째 사진(bgImg)을 전체 배경으로 길게 쭉 배치
  drawCover(ctx, bgImg, 0, 0, STORY_W, STORY_H);

  // 두 번째 사진(fgImg)을 가운데 프레임에 배치 (세로가 길게, 더 크게)
  const frameW = 700; // 가로를 더 크게
  const frameH = 1100; // 세로를 더 크게
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

  // 두 번째 사진을 프레임 안에 여백 없이 확대하고 잘라서 꽉 채움 (cover 방식)
  ctx.save();
  roundRectPath(ctx, frameX, frameY, frameW, frameH, radius);
  ctx.clip();
  
  const imgRatio = fgImg.width / fgImg.height;
  const frameRatio = frameW / frameH;
  
  let drawWidth, drawHeight, drawX, drawY;
  
  if (imgRatio > frameRatio) {
    // 이미지가 더 넓으면 높이에 맞추고 가로를 잘라냄
    drawHeight = frameH;
    drawWidth = drawHeight * imgRatio;
    drawX = frameX - (drawWidth - frameW) / 2;
    drawY = frameY;
  } else {
    // 이미지가 더 길면 가로에 맞추고 세로를 잘라냄
    drawWidth = frameW;
    drawHeight = drawWidth / imgRatio;
    drawX = frameX;
    drawY = frameY - (drawHeight - frameH) / 2;
  }
  
  ctx.drawImage(fgImg, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();

  // 위쪽 말풍선: "~님이 카페를 추천했어요"
const bubblePadding = 28;
const bubbleRadius = 30; // border-radius: 12px
const recommendText = userName ? `${userName}님이 카페를 추천했어요` : '카페를 추천했어요';
const emoji = '☕';

ctx.save();
ctx.font = '600 36px Pretendard, system-ui, -apple-system, sans-serif';
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';

// 텍스트와 이모지 너비 측정
ctx.font = '400 30px Pretendard, system-ui, -apple-system, sans-serif';
const textMetrics = ctx.measureText(recommendText);
const emojiSize = 28;
const emojiSpacing = 0; // 텍스트 바로 옆에 붙이기
const totalTextWidth = textMetrics.width + emojiSize + emojiSpacing;

const bubbleWidth = Math.max(totalTextWidth + bubblePadding * 2, 320);
const bubbleHeight = 64;

// ✅ 말풍선 X: 프레임 왼쪽부터 시작
const bubbleX = frameX; // or frameX + 12
const bubbleY = frameY - bubbleHeight - 20;

const bubbleFill = '#EBF7CE'; // background: var(--limerick-00, #EBF7CE)
const bubbleStroke = 'rgba(0, 0, 0, 0.08)';
const bubbleLineW = 1.5;

// ===== 말풍선 본체 (그림자 없이 깔끔하게) =====
ctx.save();
roundRectPath(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, bubbleRadius);
ctx.fillStyle = bubbleFill;
ctx.fill();
ctx.restore();

// ===== 말풍선 테두리 =====
ctx.save();
ctx.strokeStyle = bubbleStroke;
ctx.lineWidth = bubbleLineW;
roundRectPath(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, bubbleRadius);
ctx.stroke();
ctx.restore();

// ===== 꼬리 (말풍선에 "붙어서" 아래로 내려가는 삼각형) =====
// 꼬리 중심 X: 말풍선 왼쪽에서 조금 떨어진 지점(원하는 위치로 조절)
const tailCenterX = bubbleX + 70;  // ✅ 숫자만 조절하면 꼬리 좌우 위치 이동
const tailTopY = bubbleY + bubbleHeight - 1; // ✅ 말풍선 바닥선에 겹치게(틈 방지)
const tailH = 18;
const tailW = 22;

ctx.save();
// 꼬리 (그림자 없이 깔끔하게)
ctx.beginPath();
// 윗변(말풍선 바닥)에 붙는 두 점
ctx.moveTo(tailCenterX - tailW / 2, tailTopY);
ctx.lineTo(tailCenterX + tailW / 2, tailTopY);
// 아래 꼭짓점
ctx.lineTo(tailCenterX, tailTopY + tailH);
ctx.closePath();

ctx.fillStyle = bubbleFill;
ctx.fill();
ctx.restore();

// 꼬리 테두리 (말풍선 테두리랑 동일)
ctx.save();
ctx.strokeStyle = bubbleStroke;
ctx.lineWidth = bubbleLineW;
ctx.beginPath();
ctx.moveTo(tailCenterX - tailW / 2, tailTopY);
ctx.lineTo(tailCenterX + tailW / 2, tailTopY);
ctx.lineTo(tailCenterX, tailTopY + tailH);
ctx.closePath();
ctx.stroke();
ctx.restore();

// ===== 텍스트 + 이모지 (바로 옆에 붙여서) =====
const textX = bubbleX + bubblePadding;
const textY = bubbleY + bubbleHeight / 2;

ctx.fillStyle = '#232526';
ctx.font = '400 30px Pretendard, system-ui, -apple-system, sans-serif';
ctx.fillText(recommendText, textX, textY);

// 이모지를 텍스트 옆에 띄어쓰기 2번 정도 간격으로 그리기
ctx.font = `${emojiSize}px Arial`;
// 띄어쓰기 2번 정도의 간격 (약 8px)
ctx.fillText(emoji, textX + textMetrics.width + 8, textY);

ctx.restore();


  // 아래쪽 구분선과 카페 이름 (사진과 간격을 더 넓게)
  const bottomY = frameY + frameH + 180; // 사진 아래 180px로 간격 더 넓히기
  const lineStartX = 40; // 왼쪽부터 시작
  const lineEndX = STORY_W - 40; // 오른쪽까지
  const cafeText = cafeName || '카페';
  
  // 구분선 (왼쪽부터 오른쪽까지 긴 가로선, 그림자 없이 깔끔하게)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lineStartX, bottomY);
  ctx.lineTo(lineEndX, bottomY);
  ctx.stroke();
  ctx.restore();
  
  // 지도 아이콘과 카페 이름 (구분선 아래에 배치, 오른쪽 정렬)
  const iconSize = 42; // 더 크게
  const iconY = bottomY + 50;
  
  // 텍스트 너비 측정
  ctx.save();
  ctx.font = '600 38px Pretendard, system-ui, -apple-system, sans-serif';
  const textMetrics2 = ctx.measureText(cafeText);
  const totalWidth = iconSize + 16 + textMetrics2.width;
  const startX = STORY_W - totalWidth - 40; // 오른쪽에 붙임
  ctx.restore();
  
  // 위치 아이콘 (map-pin1.svg 사용, 원본 비율 유지, 그림자 없이)
  if (locationPinImg) {
    ctx.save();
    // SVG 원본 비율 계산 (16:16 = 1:1)
    const svgAspectRatio = 16 / 16;
    let drawWidth = iconSize;
    let drawHeight = iconSize / svgAspectRatio;
    
    // 세로가 더 길면 가로를 조정
    if (drawHeight > iconSize) {
      drawHeight = iconSize;
      drawWidth = iconSize * svgAspectRatio;
    }
    
    const drawX = startX;
    const drawY = iconY - drawHeight / 2;
    
    ctx.drawImage(locationPinImg, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  } else {
    // SVG 로드 실패 시 fallback
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(startX + iconSize / 2, iconY, iconSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  
  // 카페 이름 텍스트 (그림자 없이 깔끔하게)
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 38px Pretendard, system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(cafeText, startX + iconSize + 16, iconY);
  ctx.restore();

  const blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 1.0);
  });

  return { blob };
}

/* ===================== 촬영 유틸 ===================== */
function canvasToFile(canvas, filename, mime = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(new File([blob], filename, { type: mime })),
      mime,
      quality
    );
  });
}

/* ===================== 공유 유틸 ===================== */
function isMobileLike() {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua);
}
function openInstagramWebNow() {
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
  try {
    if (!navigator.share) return false;
    if (navigator.canShare) return navigator.canShare({ files: [file] });
    return true;
  } catch {
    return false;
  }
}
async function shareToMyInstagramWithFile(file, resultBlob) {
  if (!isMobileLike()) {
    downloadBlob(resultBlob, 'moca-story.png');
    openInstagramWebNow();
    alert(
      'PC에서는 인스타 스토리에 이미지를 자동으로 넣을 수 없어요.\n\n' +
        '1) 저장된 moca-story.png 파일을\n' +
        '2) 인스타그램에서 스토리로 업로드해 주세요.'
    );
    return;
  }
  if (canShareFiles(file)) {
    await navigator.share({
      files: [file],
      title: 'MOCA Story',
      text: 'MOCA에서 만든 스토리 이미지',
    });
    return;
  }
  downloadBlob(resultBlob, 'moca-story.png');
  openInstagramWebNow();
  alert('이 기기에서는 바로 공유가 어려워요.\n저장된 이미지를 인스타 스토리에 업로드해 주세요.');
}

/* ===================== 카메라 ===================== */
function ensureSecureContextForCamera() {
  const isSecure =
    window.isSecureContext ||
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost';
  if (!isSecure) throw new Error('카메라 촬영은 https 또는 localhost에서만 가능해요.');
}

async function listVideoInputs() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

async function getStream({ facingMode, deviceId }) {
  ensureSecureContextForCamera();

  const video = deviceId
    ? {
        deviceId: { exact: deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      }
    : {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: false });
  } catch {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  }
}

/* ===================== 컴포넌트 ===================== */
export default function StoryShare() {
  const navigate = useNavigate();
  const routerLoc = useLocation();
  const reservation = routerLoc.state?.reservation ?? null;

  const userName = useMemo(() => {
    return reservation?.name || '';
  }, [reservation]);

  const cafeName = useMemo(() => {
    return reservation?.cafe || '카페';
  }, [reservation]);

  // ✅ 안내 오버레이(모달)
  const [infoOpen, setInfoOpen] = useState(true); // 처음에는 열려있음
  const openInfo = () => setInfoOpen(true);
  const closeInfo = () => setInfoOpen(false);

  const [step, setStep] = useState('bg'); // 'bg' | 'fg' | 'preview'
  const [screen, setScreen] = useState('camera'); // 'camera' | 'confirm'
  
  // step이 변경되고 camera 화면일 때 안내 모달 자동으로 열기
  useEffect(() => {
    if (screen === 'camera' && (step === 'bg' || step === 'fg')) {
      setInfoOpen(true);
    }
  }, [step, screen]);

  const [bgFile, setBgFile] = useState(null);
  const [fgFile, setFgFile] = useState(null);

  const bgUrl = useMemo(() => (bgFile ? URL.createObjectURL(bgFile) : null), [bgFile]);
  const fgUrl = useMemo(() => (fgFile ? URL.createObjectURL(fgFile) : null), [fgFile]);

  const canPreview = Boolean(bgUrl && fgUrl);
  const [resultBlob, setResultBlob] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 촬영/선택 확인용(= confirm에서 왼쪽 썸네일로도 사용)
  const [pendingFile, setPendingFile] = useState(null);
  const pendingUrl = useMemo(
    () => (pendingFile ? URL.createObjectURL(pendingFile) : null),
    [pendingFile]
  );

  // 카메라 화면에서 왼쪽 갤러리 썸네일로 사용
  const [thumbUrl, setThumbUrl] = useState(null);

  // 카메라
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [camError, setCamError] = useState('');
  const [camReady, setCamReady] = useState(false);

  // 전면/후면
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [videoDevices, setVideoDevices] = useState([]);
  const [activeDeviceId, setActiveDeviceId] = useState(null);

  // ✅ 전면(user)일 때만 좌우 반전(미리보기 + 저장)
  const mirrorOn = facingMode === 'user';

  // 갤러리 input
  const bgInputRef = useRef(null);
  const fgInputRef = useRef(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const refreshDevices = async () => {
    const vids = await listVideoInputs();
    setVideoDevices(vids);
    if (!activeDeviceId && vids.length > 0) setActiveDeviceId(vids[0].deviceId);
  };

  const startCamera = async () => {
    setCamError('');
    setCamReady(false);

    try {
      stopStream();
      await refreshDevices();

      const stream = await getStream({ facingMode, deviceId: activeDeviceId });
      streamRef.current = stream;

      refreshDevices().catch(() => {});

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;

      await new Promise((resolve) => {
        const onMeta = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          resolve();
        };
        video.addEventListener('loadedmetadata', onMeta);
      });

      await video.play().catch(() => {});
      setCamReady(true);
    } catch (e) {
      console.error(e);
      setCamError(e?.message || '카메라를 열 수 없어요.');
    }
  };

  // camera screen일 때만 카메라 켜기
  useEffect(() => {
    if (step === 'preview') return;
    if (screen !== 'camera') return;
    startCamera();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, screen, facingMode, activeDeviceId]);

  useEffect(() => () => stopStream(), []);

  // objectURL 정리
  useEffect(() => () => bgUrl && URL.revokeObjectURL(bgUrl), [bgUrl]);
  useEffect(() => () => fgUrl && URL.revokeObjectURL(fgUrl), [fgUrl]);
  useEffect(() => () => pendingUrl && URL.revokeObjectURL(pendingUrl), [pendingUrl]);
  useEffect(() => () => thumbUrl && URL.revokeObjectURL(thumbUrl), [thumbUrl]);
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

  /* ===================== 안내 문구 (info 눌렀을 때만) ===================== */
  const infoHintText = useMemo(() => {
    if (step === 'bg') return '첫 번째 사진은\n배경사진으로 사용돼요!';
    if (step === 'fg') return '두 번째 사진은\n꾸밈사진으로 사용돼요!';
    return '';
  }, [step]);

  /* ===================== 안내 이미지 (step에 따라 다르게) ===================== */
  const infoPhoneImg = useMemo(() => {
    if (step === 'fg') return imgGuidePhone2;
    return imgGuidePhone;
  }, [step]);

  /* ===================== 갤러리 ===================== */
  const openGallery = () => {
    if (step === 'bg') bgInputRef.current?.click();
    else fgInputRef.current?.click();
  };

  const onPickBg = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setThumbUrl(URL.createObjectURL(file)); // 다음 카메라 화면에서도 최근사진으로 보이게
    setScreen('confirm');
    stopStream();
    e.target.value = '';
  };

  const onPickFg = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setThumbUrl(URL.createObjectURL(file));
    setScreen('confirm');
    stopStream();
    e.target.value = '';
  };

  /* ===================== 촬영 ===================== */
  const capture = async () => {
    try {
      if (!camReady || camError) return;
      const video = videoRef.current;
      if (!video) return;

      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;

      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');

      // ✅ 전면(user)일 때만 미러링 저장
      if (mirrorOn) {
        ctx.save();
        ctx.translate(vw, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, vw, vh);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, vw, vh);
      }

      const file = await canvasToFile(
        canvas,
        `moca_${step}_${Date.now()}.jpg`,
        'image/jpeg',
        0.92
      );

      setPendingFile(file);
      setThumbUrl(URL.createObjectURL(file));
      setScreen('confirm'); // ✅ 찍자마자 confirm
      stopStream();
    } catch (e) {
      console.error(e);
      alert('촬영에 실패했어요. 다시 시도해 주세요.');
    }
  };

  /* ===================== 전/후면 전환 ===================== */
  const flipCamera = async () => {
    try {
      const vids = await listVideoInputs();
      setVideoDevices(vids);

      if (vids.length >= 2) {
        const idx = vids.findIndex((d) => d.deviceId === activeDeviceId);
        const next = vids[(idx + 1 + vids.length) % vids.length];
        setActiveDeviceId(next.deviceId);
        setFacingMode((p) => (p === 'user' ? 'environment' : 'user'));
        return;
      }

      setFacingMode((p) => (p === 'user' ? 'environment' : 'user'));
    } catch (e) {
      console.error(e);
      setFacingMode((p) => (p === 'user' ? 'environment' : 'user'));
    }
  };

  /* ===================== confirm ===================== */
  const retake = () => {
    setPendingFile(null);
    setScreen('camera');
  };

  const confirm = async () => {
    if (!pendingFile) return;

    if (step === 'bg') {
      setBgFile(pendingFile);
      setPendingFile(null);
      setStep('fg');
      setScreen('camera');
      return;
    }

    if (step === 'fg') {
      // 두 번째 사진 확인 후 바로 합성 및 인스타 공유
      if (!bgFile || !pendingFile) return;
      
      try {
        setUploading(true);
        const bgUrlTemp = URL.createObjectURL(bgFile);
        const fgUrlTemp = URL.createObjectURL(pendingFile);
        
        const { blob } = await composeStory({ bgUrl: bgUrlTemp, fgUrl: fgUrlTemp, userName, cafeName });
        
        URL.revokeObjectURL(bgUrlTemp);
        URL.revokeObjectURL(fgUrlTemp);
        
        const file = new File([blob], 'moca-story.png', { type: 'image/png' });
        const sharePromise = shareToMyInstagramWithFile(file, blob);
        const uploadPromise = uploadStoryToInstagram(file);

        await Promise.allSettled([sharePromise, uploadPromise]);
        
        setFgFile(pendingFile);
        setPendingFile(null);
      } catch (e) {
        console.error(e);
        alert('이미지 합성 또는 공유에 실패했어요.');
      } finally {
        setUploading(false);
      }
      return;
    }
  };

  /* ===================== 결과 생성 ===================== */
  const generate = async () => {
    if (!canPreview) return;
    const { blob } = await composeStory({ bgUrl, fgUrl, userName, cafeName });
    setResultBlob(blob);
    const url = URL.createObjectURL(blob);
    setResultUrl(url);
    return blob;
  };

  useEffect(() => {
    if (step !== 'preview') return;
    if (!canPreview) return;
    if (resultUrl) return;
    generate().catch((e) => {
      console.error(e);
      alert('이미지 합성에 실패했어요.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, canPreview]);

  /* ===================== 버튼 액션 ===================== */
  const resetAll = () => {
    setStep('bg');
    setScreen('camera');
    setBgFile(null);
    setFgFile(null);
    setPendingFile(null);
    setResultBlob(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }
  };

  const resetFgOnly = () => {
    setStep('fg');
    setScreen('camera');
    setFgFile(null);
    setPendingFile(null);
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

  const share = () => {
    if (!resultBlob || uploading) return;
    setUploading(true);

    const file = new File([resultBlob], 'moca-story.png', { type: 'image/png' });

    const sharePromise = shareToMyInstagramWithFile(file, resultBlob);
    const uploadPromise = uploadStoryToInstagram(file);

    Promise.allSettled([sharePromise, uploadPromise])
      .then(([, uploadRes]) => {
        if (uploadRes.status === 'rejected') {
          alert(uploadRes.reason?.message || 'MOCA 인스타 스토리 업로드에 실패했어요.');
        }
      })
      .finally(() => setUploading(false));
  };

  return (
    <div className={styles.wrap}>
      <main className={styles.stage}>
        {/* ✅ info 오버레이: 배경(여백) 클릭하면 닫힘 */}
        {infoOpen && (
          <div
            className={styles.infoBackdrop}
            role="dialog"
            aria-modal="true"
            aria-label="안내"
            onClick={closeInfo}
          >
            <div className={styles.infoModal} onClick={(e) => e.stopPropagation()}>
              {/* ✅ 문구는 위로 */}
              <div className={styles.infoHintText}>{infoHintText}</div>
              <img src={infoPhoneImg} alt="안내" className={styles.infoPhoneImg} />
            </div>
          </div>
        )}

        {/* ✅ 상단 버튼 오버레이 */}
        <div className={styles.topOverlay}>
          <button
            className={styles.overlayBtn}
            onClick={() => navigate(-1)}
            type="button"
            aria-label="닫기"
          >
            <img src={imgClose} alt="" className={styles.overlayIcon} />
          </button>

          <div className={styles.overlaySpacer} />

          <button
            className={styles.overlayBtn}
            onClick={openInfo}
            type="button"
            aria-label="안내"
          >
            <img src={imgInfo} alt="" className={styles.overlayIcon} />
          </button>
        </div>

        {/* ===================== preview ===================== */}
        {step === 'preview' && (
          <div className={styles.previewStage}>
            <div className={styles.previewCanvas}>
              {resultUrl ? (
                <img src={resultUrl} alt="스토리 결과" className={styles.previewImg} />
              ) : (
                <div className={styles.previewFallback}>합성 중…</div>
              )}
            </div>

            {/* 오른쪽 화살표 버튼 */}
            <div className={styles.previewShareBtn}>
              <button
                type="button"
                className={styles.previewArrowBtn}
                onClick={share}
                aria-label="인스타 공유"
                disabled={!resultBlob || uploading}
              >
                {imgArrowRight ? (
                  <img src={imgArrowRight} alt="" className={styles.previewArrowImg} />
                ) : (
                  <span className={styles.previewArrowFallback}>→</span>
                )}
              </button>
            </div>

            <div className={styles.previewActions}>
              <button className={styles.secondaryBtn} onClick={resetFgOnly} type="button">
                두 번째 사진 다시
              </button>
              <button className={styles.secondaryBtn} onClick={resetAll} type="button">
                처음부터
              </button>
            </div>
          </div>
        )}

        {/* ===================== camera / confirm ===================== */}
        {step !== 'preview' && (
          <div className={styles.cameraStage}>
            {/* ---------- camera ---------- */}
            {screen === 'camera' && (
              <>
                {camError ? (
                  <div className={styles.camError}>{camError}</div>
                ) : (
                  <video
                    ref={videoRef}
                    className={`${styles.camVideo} ${mirrorOn ? styles.mirrored : ''}`}
                    playsInline
                    muted
                    autoPlay
                  />
                )}

                <div className={styles.controls}>
                  {/* 왼쪽: 갤러리 썸네일 */}
                  <button
                    type="button"
                    className={styles.thumbBtn}
                    onClick={openGallery}
                    aria-label="갤러리"
                  >
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="최근 사진" className={styles.thumbImg} />
                    ) : (
                      <div className={styles.thumbPlaceholder} />
                    )}
                  </button>

                  {/* 가운데: 셔터 */}
                  <button
                    type="button"
                    className={styles.shutterBtn}
                    onClick={capture}
                    aria-label="촬영"
                    disabled={!!camError || !camReady}
                  >
                    <img src={imgShutter} alt="" className={styles.btnImg} />
                  </button>

                  {/* 오른쪽: 전/후면 */}
                  <button
                    type="button"
                    className={styles.flipBtn}
                    onClick={flipCamera}
                    aria-label="전면/후면 전환"
                    disabled={!!camError}
                  >
                    <img src={imgFlip} alt="" className={styles.btnImg} />
                  </button>
                </div>

                <input
                  ref={bgInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickBg}
                  className={styles.hiddenInput}
                />
                <input
                  ref={fgInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickFg}
                  className={styles.hiddenInput}
                />
              </>
            )}

            {/* ---------- confirm (왼쪽은 “버튼 없음” + 썸네일만, 가운데/오른쪽만 버튼) ---------- */}
            {screen === 'confirm' && (
              <>
                {pendingUrl ? (
                  <img src={pendingUrl} alt="촬영 결과" className={styles.confirmImg} />
                ) : (
                  <div className={styles.previewFallback}>이미지를 불러올 수 없어요.</div>
                )}

                <div className={styles.confirmBar2}>
                  {/* ✅ 왼쪽: 버튼 X, 그냥 썸네일(camera의 thumbBtn과 동일한 위치) */}
                  <div className={styles.confirmLeftThumb}>
                    {pendingUrl ? (
                      <img src={pendingUrl} alt="찍힌 사진" className={styles.thumbImg} />
                    ) : (
                      <div className={styles.thumbPlaceholder} />
                    )}
                  </div>

                  {/* ✅ 가운데: 다시 찍기 pill (양쪽 버튼 사이 중앙에 배치) */}
                  <button
                    type="button"
                    className={styles.confirmRetakePill2}
                    onClick={retake}
                    aria-label="다시 찍기"
                  >
                    {imgRetakePill ? (
                      <img src={imgRetakePill} alt="" className={styles.confirmBtnImg} />
                    ) : (
                      <span className={styles.confirmRetakeFallback2}>다시 찍기</span>
                    )}
                  </button>

                  {/* ✅ 오른쪽: 다음(원형) (camera의 flipBtn과 동일한 위치) */}
                  <button
                    type="button"
                    className={styles.confirmNextCircle2}
                    onClick={confirm}
                    aria-label="다음"
                  >
                    {imgNextCircle ? (
                      <img src={imgNextCircle} alt="" className={styles.confirmBtnImg} />
                    ) : (
                      <span className={styles.confirmNextFallback2}>→</span>
                    )}
                  </button>
                </div>

                <input
                  ref={bgInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickBg}
                  className={styles.hiddenInput}
                />
                <input
                  ref={fgInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickFg}
                  className={styles.hiddenInput}
                />
              </>
            )}
          </div>
        )}
      </main>

    </div>
  );
}
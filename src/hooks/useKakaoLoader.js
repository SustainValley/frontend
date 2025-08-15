import { useEffect, useState } from 'react';

export default function useKakaoLoader() {
  const [ready, setReady] = useState(false);

  const windowKey = typeof window !== 'undefined' ? window.__KAKAO_KEY__ : undefined;

  const craKey = process.env.REACT_APP_KAKAO_MAP_KEY;

  let viteKey;
  try {
    viteKey = (typeof import.meta !== 'undefined' && import.meta.env)
      ? import.meta.env.VITE_KAKAO_MAP_KEY
      : undefined;
  } catch (_) {
    viteKey = undefined;
  }

  const appkey = windowKey || craKey || viteKey;

  console.log('[KAKAO] windowKey =', windowKey);
  console.log('[KAKAO] CRA REACT_APP_KAKAO_MAP_KEY =', craKey);
  console.log('[KAKAO] VITE_KAKAO_MAP_KEY =', viteKey);
  console.log('[KAKAO] chosen appkey =', appkey);

  useEffect(() => {
    if (!appkey) {
      console.error('[KAKAO] appkey 누락: window.__KAKAO_KEY__ 또는 .env(REACT_APP_ / VITE_) 확인');
      return;
    }
    if (window.kakao?.maps) {
      setReady(true);
      return;
    }

    const SCRIPT_ID = 'kakao-maps-sdk';
    const exist = document.getElementById(SCRIPT_ID);
    if (!exist) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.async = true;
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false&libraries=services,clusterer`;
      s.onerror = () => console.error('[KAKAO] SDK 로드 실패: 키/도메인 등록 확인');
      s.onload = () => window.kakao.maps.load(() => setReady(true));
      document.head.appendChild(s);
    } else {
      const wait = () => (window.kakao?.maps?.load
        ? window.kakao.maps.load(() => setReady(true))
        : setTimeout(wait, 50));
      wait();
    }
  }, [appkey]);

  return ready;
}

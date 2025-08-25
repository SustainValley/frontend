/* global kakao */
import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import useKakaoLoader from '../../hooks/useKakaoLoader';
import pin from '../../assets/map-pin.svg';

/** 공릉역 좌표 (대략) */
const GONGNEUNG_STATION = { lat: 37.62385, lng: 127.07260 };

/* 주소→좌표 지오코딩(세션 캐시) */
const geocodeAddress = (() => {
  const key = (addr) => `geo:${addr}`;
  return (geocoder, address) =>
    new Promise((resolve) => {
      if (!address) return resolve(null);
      const k = key(address);
      const cached = sessionStorage.getItem(k);
      if (cached) {
        try { return resolve(JSON.parse(cached)); } catch {}
      }
      geocoder.addressSearch(address, (results, status) => {
        if (status === kakao.maps.services.Status.OK && results?.[0]) {
          const r = results[0];
          // x=lng(경도), y=lat(위도)
          resolve({ x: parseFloat(r.x), y: parseFloat(r.y) });
        } else {
          resolve(null);
        }
      });
    });
})();

/**
 * props:
 *  - cafes: [{ cafeId, name, address, operatingHours, imageUrl, maxSeats, spaceType }]
 *  - initialLevel? (기본 4)
 *  - initialCenter? (기본 공릉역)
 *  - onPlaceClick?: (cafeWithCoords) => void
 *
 * ref:
 *  - { map, centerToGongneung: () => void }
 */
const KakaoMap = forwardRef(function KakaoMap(
  { cafes = [], initialLevel = 4, initialCenter = GONGNEUNG_STATION, onPlaceClick },
  ref
) {
  const ready = useKakaoLoader();
  const mapContainerRef = useRef(null);
  const [map, setMap] = useState(null);

  const cafeMarkersRef = useRef([]); // [{ cafe, marker, pos }]
  const userMarkerRef = useRef(null);
  const gongneungMarkerRef = useRef(null);

  /** 공릉역으로 센터 이동 + (선택) 마커 표시 */
  const centerToGongneung = (opts = { level: null, showMarker: false }) => {
    if (!map) return;
    const { level, showMarker } = opts || {};
    const pos = new kakao.maps.LatLng(GONGNEUNG_STATION.lat, GONGNEUNG_STATION.lng);
    map.setCenter(pos);
    if (typeof level === 'number') map.setLevel(level);
    if (showMarker) {
      if (!gongneungMarkerRef.current) {
        gongneungMarkerRef.current = new kakao.maps.Marker({ position: pos, zIndex: 4 });
      } else {
        gongneungMarkerRef.current.setPosition(pos);
      }
      gongneungMarkerRef.current.setMap(map);
    }
  };

  // 부모에서 사용할 액션 노출
  useImperativeHandle(ref, () => ({ map, centerToGongneung }), [map]);

  /* 맵 초기화 (지도는 사용자 의도 유지: 자동 이동 X) */
  useEffect(() => {
    if (!ready || !mapContainerRef.current || map) return;

    const center =
      initialCenter?.lat && initialCenter?.lng
        ? new kakao.maps.LatLng(initialCenter.lat, initialCenter.lng)
        : new kakao.maps.LatLng(GONGNEUNG_STATION.lat, GONGNEUNG_STATION.lng);

    const m = new kakao.maps.Map(mapContainerRef.current, {
      center,
      level: initialLevel,
    });
    setMap(m);

    // 현재 위치 핀(지도 이동 없음)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const loc = new kakao.maps.LatLng(latitude, longitude);
          userMarkerRef.current = new kakao.maps.Marker({ map: m, position: loc, zIndex: 3 });
          // 주의: 여기서 map.setCenter 같은 자동 이동은 하지 않음
        },
        () => {},
        { enableHighAccuracy: true, timeout: 4000 }
      );
    }

    // 초기 렌더 후 안전 relayout
    setTimeout(() => { try { m.relayout?.(); } catch {} }, 0);
    const onResize = () => { try { m.relayout?.(); } catch {} };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [ready, initialLevel, initialCenter, map]);

  /* 리스트(cafes)만 마커 표시 — 자동 이동/확대 없음 */
  useEffect(() => {
    if (!map) return;

    // 기존 마커 제거
    cafeMarkersRef.current.forEach(({ marker }) => marker.setMap(null));
    cafeMarkersRef.current = [];

    if (!cafes.length) return;

    const geocoder = new kakao.maps.services.Geocoder();
    const markerImage = new kakao.maps.MarkerImage(
      pin, new kakao.maps.Size(36, 44), { offset: new kakao.maps.Point(18, 44) }
    );

    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        cafes.map(async (cafe) => {
          const coords = await geocodeAddress(geocoder, cafe.address);
          if (!coords) return null;
          const lat = Number(coords.y); // 위도
          const lng = Number(coords.x); // 경도
          const pos = new kakao.maps.LatLng(lat, lng);
          return { cafe, coords: { lat, lng }, pos };
        })
      );

      if (cancelled) return;

      const valid = results.filter(Boolean);
      valid.forEach(({ cafe, coords, pos }) => {
        const marker = new kakao.maps.Marker({ position: pos, image: markerImage, map });
        // ✅ 마커 클릭 → 상위에만 알려주고 지도는 그대로 둠
        kakao.maps.event.addListener(marker, 'click', () => {
          onPlaceClick?.({ ...cafe, latitude: coords.lat, longitude: coords.lng });
        });
        cafeMarkersRef.current.push({ cafe, marker, pos });
      });
    })();

    return () => { cancelled = true; };
  }, [map, cafes, onPlaceClick]);

  return (
    <div
      ref={mapContainerRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
});

export default KakaoMap;

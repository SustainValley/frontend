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
const GONGNEUNG_STATION = { lat: 37.62385, lng: 127.0726 };

/* 주소→좌표 지오코딩(세션 캐시) */
const geocodeAddress = (() => {
  const key = (addr) => `geo:${addr}`;
  return (geocoder, address) =>
    new Promise((resolve) => {
      if (!address) return resolve(null);
      const k = key(address);
      const cached = sessionStorage.getItem(k);
      if (cached) {
        try {
          return resolve(JSON.parse(cached));
        } catch {}
      }
      geocoder.addressSearch(address, (results, status) => {
        if (status === kakao.maps.services.Status.OK && results?.[0]) {
          const r = results[0];
          const payload = { x: parseFloat(r.x), y: parseFloat(r.y) }; // x=lng, y=lat
          try {
            sessionStorage.setItem(k, JSON.stringify(payload));
          } catch {}
          resolve(payload);
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
 *  - {
 *      getMap: () => kakao.maps.Map | null,
 *      panTo: ({lat,lng,level}) => void,
 *      panToGongneung: (opts?) => void,
 *      centerToGongneung: (opts?) => void,
 *      centerToMyLocation: (opts?) => Promise<{lat,lng}|null>,
 *    }
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

  const makeLatLng = (lat, lng) => new kakao.maps.LatLng(lat, lng);

  /** 공릉역으로 센터 이동 + (선택) 마커 표시 */
  const centerToGongneung = (opts = { level: null, showMarker: false }) => {
    if (!map) return;
    const { level, showMarker } = opts || {};
    const pos = makeLatLng(GONGNEUNG_STATION.lat, GONGNEUNG_STATION.lng);

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

  /** 공릉역으로 부드럽게 이동(panTo) */
  const panToGongneung = (opts = { level: 4, showMarker: false }) => {
    if (!map) return;
    const { level = 4, showMarker = false } = opts || {};
    const pos = makeLatLng(GONGNEUNG_STATION.lat, GONGNEUNG_STATION.lng);

    map.panTo(pos);
    if (typeof level === 'number' && map.getLevel && map.setLevel) {
      if (map.getLevel() > level) map.setLevel(level);
    }

    if (showMarker) {
      if (!gongneungMarkerRef.current) {
        gongneungMarkerRef.current = new kakao.maps.Marker({ position: pos, zIndex: 4 });
      } else {
        gongneungMarkerRef.current.setPosition(pos);
      }
      gongneungMarkerRef.current.setMap(map);
    }
  };

  /** 임의 좌표로 panTo */
  const panTo = ({ lat, lng, level = 4 } = {}) => {
    if (!map || typeof lat !== 'number' || typeof lng !== 'number') return;
    const pos = makeLatLng(lat, lng);
    map.panTo(pos);
    if (map.getLevel && map.setLevel && typeof level === 'number') {
      if (map.getLevel() > level) map.setLevel(level);
    }
  };

  /** 내 현재 위치로 이동 + 유저 마커 갱신 */
  const centerToMyLocation = (opts = { level: 4, showMarker: true }) =>
    new Promise((resolve) => {
      if (!map) return resolve(null);

      // HTTPS/localhost 아니면 대부분 위치 막힘
      if (!window.isSecureContext) return resolve(null);
      if (!navigator.geolocation) return resolve(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const loc = makeLatLng(latitude, longitude);

          // 마커
          if (!userMarkerRef.current) {
            userMarkerRef.current = new kakao.maps.Marker({ map, position: loc, zIndex: 3 });
          } else {
            userMarkerRef.current.setPosition(loc);
          }
          if (opts?.showMarker !== false) userMarkerRef.current.setMap(map);

          // 이동
          map.panTo(loc);
          if (map.getLevel && map.setLevel && typeof opts?.level === 'number') {
            if (map.getLevel() > opts.level) map.setLevel(opts.level);
          }

          resolve({ lat: latitude, lng: longitude });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
      );
    });

  // ✅ 부모에서 사용할 액션/맵 노출 (여기가 핵심 수정 포인트)
  useImperativeHandle(
    ref,
    () => ({
      getMap: () => map,
      panTo,
      centerToGongneung,
      panToGongneung,
      centerToMyLocation,
    }),
    [map]
  );

  /* 맵 초기화 (지도는 사용자 의도 유지: 자동 이동 X) */
  useEffect(() => {
    if (!ready || !mapContainerRef.current || map) return;

    const center =
      initialCenter?.lat && initialCenter?.lng
        ? makeLatLng(initialCenter.lat, initialCenter.lng)
        : makeLatLng(GONGNEUNG_STATION.lat, GONGNEUNG_STATION.lng);

    const m = new kakao.maps.Map(mapContainerRef.current, {
      center,
      level: initialLevel,
    });
    setMap(m);

    // 현재 위치 핀(지도 이동 없음)
    if (navigator.geolocation && window.isSecureContext) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const loc = makeLatLng(latitude, longitude);
          userMarkerRef.current = new kakao.maps.Marker({ map: m, position: loc, zIndex: 3 });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 4000 }
      );
    }

    // 초기 렌더 후 안전 relayout
    setTimeout(() => {
      try {
        m.relayout?.();
      } catch {}
    }, 0);

    const onResize = () => {
      try {
        m.relayout?.();
      } catch {}
    };

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
      pin,
      new kakao.maps.Size(36, 44),
      { offset: new kakao.maps.Point(18, 44) }
    );

    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        cafes.map(async (cafe) => {
          const coords = await geocodeAddress(geocoder, cafe.address);
          if (!coords) return null;
          const lat = Number(coords.y);
          const lng = Number(coords.x);
          const pos = makeLatLng(lat, lng);
          return { cafe, coords: { lat, lng }, pos };
        })
      );

      if (cancelled) return;

      const valid = results.filter(Boolean);
      valid.forEach(({ cafe, coords, pos }) => {
        const marker = new kakao.maps.Marker({ position: pos, image: markerImage, map });

        kakao.maps.event.addListener(marker, 'click', () => {
          onPlaceClick?.({ ...cafe, latitude: coords.lat, longitude: coords.lng });
        });

        cafeMarkersRef.current.push({ cafe, marker, pos });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [map, cafes, onPlaceClick]);

  return (
    <div
      ref={mapContainerRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
});

export default KakaoMap;

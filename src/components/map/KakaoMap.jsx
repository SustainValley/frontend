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

const KakaoMap = forwardRef(function KakaoMap(
  {
    keyword,
    initialLevel = 4,
    initialCenter,
    onPlacesFound,
    onPlaceClick,
    reSearchOnMove = true,
    idleDebounceMs = 400,
  },
  ref
) {
  const ready = useKakaoLoader();
  const mapContainerRef = useRef(null);
  const [map, setMap] = useState(null);

  const [markers, setMarkers] = useState([]); // [{ place, marker }]
  const markersRef = useRef([]);
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  const clustererRef = useRef(null);
  const idleTimerRef = useRef(null);

  // ✅ 부모에서 ref.current로 map 객체 접근 가능하게
  useImperativeHandle(ref, () => map, [map]);

  useEffect(() => {
    if (!ready || !mapContainerRef.current || map) return;
    const fallback = { lat: 37.5665, lng: 126.9780 };
    const center = initialCenter || fallback;

    const m = new kakao.maps.Map(mapContainerRef.current, {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level: initialLevel,
    });
    setMap(m);

    clustererRef.current = new kakao.maps.MarkerClusterer({
      map: m,
      averageCenter: true,
      minLevel: 6,
    });

    setTimeout(() => {
      try {
        m.relayout?.();
        m.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
      } catch {}
    }, 0);
    const onResize = () => {
      try {
        m.relayout?.();
      } catch {}
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [ready, initialCenter, initialLevel, map]);

  const esc = (s) => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const makeNameRegex = (kw) => {
    const k = esc((kw || '').trim());
    if (!k) return null;
    return new RegExp(`${k}(?!구)`, 'i');
  };

  const clearMarkers = () => {
    markersRef.current.forEach(({ marker }) => marker.setMap(null));
    clustererRef.current?.clear();
    setMarkers([]);
  };

  const searchCafesInBounds = (bounds) => {
    const places = new kakao.maps.services.Places();
    const collected = [];
    const nextMarkers = [];
    const resultBounds = new kakao.maps.LatLngBounds();

    const markerImage = new kakao.maps.MarkerImage(
      pin,
      new kakao.maps.Size(36, 44),
      { offset: new kakao.maps.Point(18, 44) }
    );

    const handle = (data, status, pagination) => {
      if (status === kakao.maps.services.Status.OK) {
        data.forEach((p) => {
          const pos = new kakao.maps.LatLng(+p.y, +p.x);
          if (bounds.contain(pos)) {
            collected.push(p);
          }
        });
        if (pagination?.hasNextPage) {
          pagination.nextPage();
          return;
        }
      }

      if (!collected.length) {
        onPlacesFound?.([]);
        return;
      }
      collected.forEach((place) => {
        const pos = new kakao.maps.LatLng(+place.y, +place.x);
        const marker = new kakao.maps.Marker({ position: pos, image: markerImage });
        kakao.maps.event.addListener(marker, 'click', () => onPlaceClick?.(place));
        nextMarkers.push({ place, marker });
        resultBounds.extend(pos);
      });
      clustererRef.current?.addMarkers(nextMarkers.map((m) => m.marker));
      setMarkers(nextMarkers);
      onPlacesFound?.(collected);
    };

    places.categorySearch('CE7', handle, { bounds });
  };

  const runBoundedSearch = useRef(null);
  runBoundedSearch.current = () => {
    if (!map) return;

    const qRaw = (keyword || '').trim();
    const bounds = map.getBounds();

    if (!qRaw) {
      clearMarkers();
      searchCafesInBounds(bounds);
      return;
    }
    const nameRx = makeNameRegex(qRaw);

    clearMarkers();

    const places = new kakao.maps.services.Places();
    const collected = [];
    const nextMarkers = [];
    const resultBounds = new kakao.maps.LatLngBounds();

    const markerImage = new kakao.maps.MarkerImage(
      pin,
      new kakao.maps.Size(36, 44),
      { offset: new kakao.maps.Point(18, 44) }
    );

    const passStrict = (p) => {
      if (!nameRx) return true;
      const name = p.place_name || '';
      return nameRx.test(name);
    };

    const finalize = () => {
      if (!collected.length) {
        searchCafesInBounds(bounds);
        return;
      }

      collected.forEach((place) => {
        const pos = new kakao.maps.LatLng(+place.y, +place.x);
        const marker = new kakao.maps.Marker({ position: pos, image: markerImage });
        kakao.maps.event.addListener(marker, 'click', () => onPlaceClick?.(place));
        nextMarkers.push({ place, marker });
        resultBounds.extend(pos);
      });

      clustererRef.current?.addMarkers(nextMarkers.map((m) => m.marker));
      setMarkers(nextMarkers);
      onPlacesFound?.(collected);
    };

    const handle = (data, status, pagination) => {
      if (status === kakao.maps.services.Status.OK) {
        data.forEach((p) => {
          const latlng = new kakao.maps.LatLng(+p.y, +p.x);
          if (bounds.contain(latlng) && passStrict(p)) {
            collected.push(p);
          }
        });
        if (pagination?.hasNextPage) {
          pagination.nextPage();
          return;
        }
      }
      finalize();
    };

    places.keywordSearch(qRaw, handle, { bounds });
  };

  useEffect(() => {
    if (map) runBoundedSearch.current?.();
  }, [map, keyword]);

  useEffect(() => {
    if (!map || !reSearchOnMove) return;
    const onIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => runBoundedSearch.current?.(), idleDebounceMs);
    };
    kakao.maps.event.addListener(map, 'idle', onIdle);
    return () => kakao.maps.event.removeListener(map, 'idle', onIdle);
  }, [map, keyword, reSearchOnMove, idleDebounceMs]);

  return (
    <div
      ref={mapContainerRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
});

export default KakaoMap;

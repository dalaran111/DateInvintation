import { useEffect, useRef, useState } from 'react';
import { Crosshair, Minus, Plus, MapPin, ArrowClockwise } from '@phosphor-icons/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CITY_BOUNDS, normalizePoint } from '../plan-utils.mjs';
import type { MeetingPoint } from '../model';

type Props = { point: MeetingPoint | null; active: boolean; onChange: (point: MeetingPoint) => void };

export default function MeetingMap({ point, active, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const pointRef = useRef(point);
  onChangeRef.current = onChange;
  pointRef.current = point;
  const [tileState, setTileState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!container.current || !active || mapRef.current) return;
    setTileState('loading');
    const map = L.map(container.current, {
      zoomControl: false, attributionControl: true, scrollWheelZoom: false,
      minZoom: 10, maxZoom: 18, maxBoundsViscosity: 0.9,
      maxBounds: [[CITY_BOUNDS.south, CITY_BOUNDS.west], [CITY_BOUNDS.north, CITY_BOUNDS.east]],
      tapHold: false,
    }).setView(pointRef.current ? [pointRef.current.lat, pointRef.current.lng] : [59.9343, 30.3158], 13);
    mapRef.current = map;
    map.attributionControl.setPrefix(false);
    const tiles = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      maxZoom: 19, keepBuffer: 1, updateWhenIdle: true,
    }).addTo(map);
    let loadedTiles = 0;
    let failedTiles = 0;
    tiles.on('tileload', () => { loadedTiles++; setTileState('ready'); });
    tiles.on('tileerror', () => { failedTiles++; if (!loadedTiles) setTileState('error'); });
    tiles.on('load', () => { if (failedTiles && !loadedTiles) setTileState('error'); });
    const timeout = setTimeout(() => { if (!loadedTiles) setTileState('error'); }, 12000);
    map.on('click', (event: L.LeafletMouseEvent) => {
      const next = normalizePoint({ lat: event.latlng.lat, lng: event.latlng.lng, label: '' });
      if (next) onChangeRef.current(next);
    });
    // Keyboard users can pan the map and select its center with Enter.
    const selectCenter = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.target !== container.current) return;
      const center = map.getCenter();
      const next = normalizePoint({ lat: center.lat, lng: center.lng, label: '' });
      if (next) { event.preventDefault(); onChangeRef.current(next); }
    };
    container.current.addEventListener('keydown', selectCenter);
    const element = container.current;
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(element);
    return () => {
      clearTimeout(timeout); observer.disconnect(); element.removeEventListener('keydown', selectCenter);
      map.remove(); mapRef.current = null; markerRef.current = null;
    };
  }, [active, attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !point) return;
    if (markerRef.current) markerRef.current.setLatLng([point.lat, point.lng]);
    else {
      const icon = L.divIcon({ className: 'chosen-map-pin', html: '<span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" fill="currentColor"/><circle cx="12" cy="10" r="3" fill="#101d22"/></svg></span>', iconSize: [44, 54], iconAnchor: [22, 47] });
      const marker = L.marker([point.lat, point.lng], { icon, draggable: true, title: 'Наша точка встречи — можно перетащить' }).addTo(map);
      marker.on('dragend', () => {
        const coordinates = marker.getLatLng();
        const next = normalizePoint({ lat: coordinates.lat, lng: coordinates.lng, label: '' });
        if (next) onChangeRef.current(next);
        else if (pointRef.current) marker.setLatLng([pointRef.current.lat, pointRef.current.lng]);
      });
      markerRef.current = marker;
    }
  }, [point?.lat, point?.lng, active, attempt]);

  return <div className="meeting-map-shell" data-gesture-lock>
    <div ref={container} className="meeting-map" aria-label="Карта Петербурга: коснись места встречи. С клавиатуры перемести карту стрелками и нажми Enter." tabIndex={0} />
    <div className="map-controls"><button aria-label="Приблизить карту" onClick={() => mapRef.current?.zoomIn()}><Plus size={17}/></button><button aria-label="Отдалить карту" onClick={() => mapRef.current?.zoomOut()}><Minus size={17}/></button><button aria-label="Вернуться к выбранному месту или центру Петербурга" onClick={() => mapRef.current?.setView(point ? [point.lat, point.lng] : [59.9343, 30.3158], 14, { animate: false })}><Crosshair size={18}/></button></div>
    {tileState === 'loading' && <div className="map-status" role="status"><span className="loading-dot"/>Открываем Петербург…</div>}
    {tileState === 'error' && <div className="map-error" role="alert"><MapPin size={25} weight="light"/><span>Карта не загрузилась</span><small>Проверь соединение и попробуй ещё раз</small><button onClick={() => setAttempt((value) => value + 1)}><ArrowClockwise size={15}/>Повторить</button></div>}
    {tileState === 'ready' && <span className="map-tap-hint">{point ? 'Точку можно передвинуть' : 'Коснись места встречи'}</span>}
  </div>;
}

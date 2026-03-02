'use client';

import { useEffect, useRef } from 'react';
import { loadVietMapGL } from '@/lib/loadVietmap';

export type VT = { ten?: string; so_luong?: number; don_vi?: string };
export type Media = { id: number; type: 'image' | 'video'; url: string };

export type TrangThaiCode =
  | 'tiep_nhan'
  | 'dang_xu_ly'
  | 'da_chuyen_cum'
  | 'da_hoan_thanh'
  | 'huy';

const TRANG_THAI_MAP: Record<TrangThaiCode, { label: string; bg: string }> = {
  tiep_nhan: { label: 'Tiếp nhận', bg: '#0ea5e9' },
  dang_xu_ly: { label: 'Đang xử lý', bg: '#f59e0b' },
  da_chuyen_cum: { label: 'Đã chuyển cụm', bg: '#6366f1' },
  da_hoan_thanh: { label: 'Đã hoàn thành', bg: '#10b981' },
  huy: { label: 'Hủy', bg: '#ef4444' },
};

export type MapPoint = {
  id: number;
  lat: number;
  lng: number;
  loai: 'cuu_nguoi' | 'nhu_yeu_pham';
  trang_thai: TrangThaiCode;
  ten?: string;
  sdt?: string;
  noidung?: string;
  so_nguoi?: number;
  vattu?: VT[];
  media?: Media[];
  createdAt?: string | null;
};

type Props = {
  styleUrl: string;
  points: MapPoint[];
  onSelect?: (id: number) => void;
  onPick?: (p: { lng: number; lat: number }) => void;
  view?: { center: [number, number]; zoom: number };
  onViewChange?: (v: { center: [number, number]; zoom: number }) => void;
  initialAutoLocate?: boolean;
  className?: string;
  hidePlaces?: boolean;
  selectedId?: number | null;
  onOpenMedia?: (items: Media[], index: number) => void;
  onTransfer?: (id: number) => void;
  onClaim?: (id: number) => void;
};

/** ===== Epsilon & helpers ===== */
const EPS_CENTER = 1e-5;
const EPS_ZOOM = 0.01;

const nearlyEqual = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;
const centerEqual = (c1: [number, number], c2: [number, number]) =>
  nearlyEqual(c1[0], c2[0], EPS_CENTER) && nearlyEqual(c1[1], c2[1], EPS_CENTER);

function safeParseJSON<T>(s: any, fallback: T): T {
  try {
    if (typeof s === 'string') return JSON.parse(s) as T;
    if (s == null) return fallback;
    return s as T;
  } catch {
    return fallback;
  }
}

function escHtml(input: any) {
  const s = String(input ?? '');
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Inject popup CSS once */
function ensurePopupCss(id = '__vmgl_popup_css__') {
  if (typeof document === 'undefined') return;
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
/* VietMapGL thường giống MapboxGL class names */
.mapboxgl-popup,
.vietmapgl-popup { z-index: 20; }

.mapboxgl-popup-content,
.vietmapgl-popup-content{
  padding:0 !important;
  border-radius:16px !important;
  overflow:hidden !important;
  box-shadow: 0 12px 30px rgba(0,0,0,.18) !important;
  border: 1px solid rgba(15,23,42,.08) !important;
}

.mapboxgl-popup-close-button,
.vietmapgl-popup-close-button{
  font-size:18px !important;
  line-height:1 !important;
  padding:8px 10px !important;
  color: rgba(15,23,42,.6) !important;
}

.vm-card{ width: 320px; background:#fff; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; }
.vm-head{ padding:12px 12px 8px; border-bottom:1px solid rgba(15,23,42,.06); display:flex; gap:8px; align-items:center; }
.vm-id{ font-weight:800; font-size:14px; color:#0f172a; }
.vm-chip{ font-size:11px; font-weight:800; color:#fff; padding:4px 8px; border-radius:999px; }
.vm-body{ padding:10px 12px 12px; max-height: 260px; overflow:auto; }
.vm-row{ font-size:12px; color:#0f172a; margin-top:6px; }
.vm-muted{ color: rgba(15,23,42,.6); }
.vm-divider{ height:1px; background: rgba(15,23,42,.06); margin:10px 0; }
.vm-kv{ display:flex; gap:8px; flex-wrap:wrap; margin-top:6px; }
.vm-pill{ font-size:11px; padding:4px 8px; border-radius:999px; border:1px solid rgba(15,23,42,.10); background: rgba(248,250,252,1); color:#0f172a; }
.vm-media{ display:flex; gap:8px; overflow:auto; padding:8px 0 4px; }
.vm-thumb{ width:64px; height:44px; border-radius:10px; object-fit:cover; border:1px solid rgba(15,23,42,.10); background:#f1f5f9; cursor:pointer; flex: 0 0 auto; }
.vm-video{ width:64px; height:44px; border-radius:10px; border:1px solid rgba(15,23,42,.10); background:#0f172a; color:#fff; display:grid; place-items:center; font-size:11px; font-weight:800; cursor:pointer; flex:0 0 auto; }
.vm-actions{ display:flex; gap:8px; margin-top:10px; }
.vm-btn{ flex:1; height:36px; border-radius:12px; border:1px solid rgba(15,23,42,.10); font-weight:800; font-size:12px; cursor:pointer; }
.vm-btn-ghost{ background:#fff; }
.vm-btn-blue{ background:#2563eb; color:#fff; border-color: #2563eb; }
.vm-btn-dark{ background:#0f172a; color:#fff; border-color: #0f172a; }
.vm-link{ color:#2563eb; font-weight:800; text-decoration:none; }
  `;
  document.head.appendChild(style);
}

export default function MapView({
  styleUrl,
  points,
  onSelect,
  onPick,
  view,
  onViewChange,
  initialAutoLocate = true,
  className = 'h-[calc(100vh-100px)] w-full',
  hidePlaces = false,
  selectedId = null,
  onOpenMedia,
  onTransfer,
  onClaim,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const popupRef = useRef<any>(null);
  const vietmapglRef = useRef<any>(null);
  const didLocateRef = useRef(false);

  /** chặn “vòng lặp” khi set view từ props */
  const suppressEmitRef = useRef(false);
  const clearSuppressTimeoutRef = useRef<any>(null);

  /** ===== Pulser icon ===== */
  const makePulsing = (color: string, dotColor: string) => {
    const size = 96;
    const pulsingDot = {
      width: size,
      height: size,
      data: new Uint8Array(size * size * 4),
      onAdd(this: any) {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        this.context = c.getContext('2d');
      },
      render(this: any) {
        const duration = 1200;
        const t = (performance.now() % duration) / duration;
        const r = (size / 2) * 0.35;
        const R = (size / 2) * (0.35 + t * 0.65);
        const ctx: CanvasRenderingContext2D = this.context;

        const toRgba = (hex: string, a: number) => {
          const h = hex.replace('#', '');
          const rr = parseInt(h.slice(0, 2), 16);
          const gg = parseInt(h.slice(2, 4), 16);
          const bb = parseInt(h.slice(4, 6), 16);
          return `rgba(${rr},${gg},${bb},${a})`;
        };

        ctx.clearRect(0, 0, size, size);

        ctx.beginPath();
        ctx.arc(size / 2, size / 2, R, 0, Math.PI * 2);
        ctx.fillStyle = toRgba(color, 1 - t);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 6;
        ctx.fill();
        ctx.stroke();

        this.data = ctx.getImageData(0, 0, size, size).data;
        mapRef.current?.triggerRepaint?.();
        return true;
      },
    } as any;
    return pulsingDot;
  };

  /** ===== Ẩn/hiện POI ===== */
  const applyPlaceVisibility = (hide: boolean) => {
    const m = mapRef.current;
    if (!m) return;
    const style = m.getStyle();
    if (!style?.layers) return;

    style.layers.forEach((l: any) => {
      const id = String(l.id || '').toLowerCase();
      const src = String(l['source-layer'] || '').toLowerCase();
      if (
        id.includes('poi') ||
        id.includes('amenity') ||
        id.includes('hospital') ||
        id.includes('fuel') ||
        id.includes('place') ||
        src.includes('poi') ||
        src.includes('amenity') ||
        src.includes('hospital') ||
        src.includes('fuel') ||
        src.includes('place')
      ) {
        try {
          m.setLayoutProperty(l.id, 'visibility', hide ? 'none' : 'visible');
        } catch {}
      }
    });
  };

  /** ===== Popup HTML builder (COMPACT) ===== */
  const buildPopupHTML = (p: Partial<MapPoint> & { vattu?: any; media?: any }) => {
    const vt: VT[] = safeParseJSON<VT[]>(p.vattu, Array.isArray(p.vattu) ? p.vattu : []);
    const media: Media[] = safeParseJSON<Media[]>(
      p.media,
      Array.isArray(p.media) ? p.media : [],
    );

    const tt =
      TRANG_THAI_MAP[(p.trang_thai || 'tiep_nhan') as TrangThaiCode] ??
      TRANG_THAI_MAP.tiep_nhan;

    const loaiLabel = p.loai === 'cuu_nguoi' ? 'Cứu người' : 'Cứu trợ';
    const loaiBg = p.loai === 'cuu_nguoi' ? '#ef4444' : '#2563eb';

    const rawNoiDung = (p.noidung || '—').toString().trim();
    const short = rawNoiDung.length > 90 ? rawNoiDung.slice(0, 90) + '…' : rawNoiDung;

    const phone = (p.sdt || '').toString().trim();
    const phoneHtml = phone
      ? `<a class="vm-link" href="tel:${escHtml(phone)}">${escHtml(phone)}</a>`
      : `<span class="vm-muted">—</span>`;

    // vật tư tóm tắt (max 2)
    const vtTop = vt.slice(0, 2);
    const vtMore = Math.max(0, vt.length - vtTop.length);

    const vtPills = vtTop
      .map((v) => {
        const t = `${v.ten ?? ''}${v.so_luong ? ` × ${v.so_luong}` : ''}${v.don_vi ? ` ${v.don_vi}` : ''}`.trim();
        return `<span class="vm-pill">${escHtml(t || 'Vật tư')}</span>`;
      })
      .join('');

    const vtSummary = vt.length
      ? `<div class="vm-kv">${vtPills}${vtMore ? `<span class="vm-pill">+${vtMore} khác</span>` : ''}</div>`
      : `<div class="vm-row vm-muted">Không có vật tư</div>`;

    // media tóm tắt (max 4 thumb)
    const mediaTop = media.slice(0, 4);
    const mediaMore = Math.max(0, media.length - mediaTop.length);

    const mediaHtml = media.length
      ? `
      <div class="vm-media">
        ${mediaTop
          .map((m, idx) =>
            m.type === 'image'
              ? `<img class="vm-thumb" data-media="${idx}" src="${escHtml(m.url)}" alt="m-${idx}" />`
              : `<div class="vm-video" data-media="${idx}">VIDEO</div>`,
          )
          .join('')}
        ${mediaMore ? `<div class="vm-video" data-media="0">+${mediaMore}</div>` : ''}
      </div>
    `
      : '';

    return `
      <div class="vm-card">
        <div class="vm-head">
          <div class="vm-id">#${escHtml(p.id)}</div>
          <span class="vm-chip" style="background:${loaiBg}">${loaiLabel}</span>
          <span class="vm-chip" style="background:${tt.bg}">${escHtml(tt.label)}</span>
        </div>

        <div class="vm-body">
          <div class="vm-row"><b>Người gửi:</b> ${escHtml(p.ten || '—')} • ${phoneHtml}</div>
          <div class="vm-row"><b>Nội dung:</b> ${escHtml(short || '—')}</div>

          <div class="vm-divider"></div>

          <div class="vm-row"><b>Vật tư:</b></div>
          ${vtSummary}

          ${mediaHtml}

          <div class="vm-actions">
            <button class="vm-btn vm-btn-ghost" data-action="open" data-id="${escHtml(p.id)}">Chi tiết</button>
            <button class="vm-btn vm-btn-blue" data-action="claim" data-id="${escHtml(p.id)}">Nhận</button>
            <button class="vm-btn vm-btn-dark" data-action="move" data-id="${escHtml(p.id)}">Chuyển</button>
          </div>
        </div>
      </div>
    `;
  };

  /** ===== Open popup with event delegation ===== */
  const openPopup = (lng: number, lat: number, p: any) => {
    const m = mapRef.current;
    const vietmapgl = vietmapglRef.current;
    if (!m || !vietmapgl) return;

    popupRef.current?.remove?.();

    const popup = new vietmapgl.Popup({
      offset: 14,
      maxWidth: '320px',
      closeOnClick: false,
    })
      .setLngLat([lng, lat])
      .setHTML(buildPopupHTML(p))
      .addTo(m);

    popupRef.current = popup;

    const el = popup.getElement?.();
    if (!el) return;

    const onClick = (ev: any) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;

      // media click
      const mediaIdxAttr = target.getAttribute('data-media');
      if (mediaIdxAttr != null && onOpenMedia) {
        const idx = Number(mediaIdxAttr);
        const mediaArr: Media[] = safeParseJSON<Media[]>(p.media, []);
        if (Number.isFinite(idx) && mediaArr[idx]) onOpenMedia(mediaArr, idx);
        return;
      }

      // actions
      const action = target.getAttribute('data-action');
      const idAttr = target.getAttribute('data-id');
      if (!action || !idAttr) return;

      const id = Number(idAttr);
      if (!Number.isFinite(id)) return;

      if (action === 'open') onSelect?.(id);
      if (action === 'claim') onClaim?.(id);
      if (action === 'move') onTransfer?.(id);
    };

    el.addEventListener('click', onClick);

    popup.on?.('close', () => {
      try {
        el.removeEventListener('click', onClick);
      } catch {}
    });
  };

  /** ===== Mount map ===== */
  useEffect(() => {
    let disposed = false;

    (async () => {
      const vietmapgl: any = await loadVietMapGL();
      if (disposed || !ref.current || mapRef.current) return;

      ensurePopupCss(); // ✅ CSS popup đẹp + nhỏ

      vietmapglRef.current = vietmapgl;

      const map = new vietmapgl.Map({
        container: ref.current!,
        style: styleUrl,
        center: view?.center ?? [105.85, 21.03],
        zoom: view?.zoom ?? 12,
        renderWorldCopies: false,
        fadeDuration: 0,
        transformRequest: (url: string) => ({ url }),
      });

      mapRef.current = map;

      map.on('error', (e: any) => {
        const msg = e?.error?.message || '';
        const name = e?.error?.name || '';
        if (name === 'AbortError' || /aborted|signal is aborted/i.test(msg)) e?.preventDefault?.();
      });

      map.addControl(new vietmapgl.NavigationControl(), 'bottom-right');

      const geo = new vietmapgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      });
      map.addControl(geo, 'bottom-right');

      map.on('load', () => {
        // auto locate 1 lần
        if (initialAutoLocate && !didLocateRef.current) {
          didLocateRef.current = true;
          geo.trigger?.();
          geo.once?.('geolocate', (e: any) =>
            map.easeTo({ center: [e.coords.longitude, e.coords.latitude], zoom: 12 }),
          );
        }

        // only emit view on moveend
        map.on('moveend', () => {
          if (suppressEmitRef.current) return;
          const c = map.getCenter().toArray() as [number, number];
          const z = map.getZoom();
          onViewChange?.({ center: c, zoom: z });
        });

        // source + cluster
        map.addSource('req', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 12,
        });

        // selected source (ring)
        map.addSource('selected', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'req',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#fca5a5',
            'circle-radius': ['step', ['get', 'point_count'], 16, 20, 22, 50, 28],
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          },
        });

        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'req',
          filter: ['has', 'point_count'],
          layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 },
        });

        // pulsing icons
        if (!map.hasImage('pulse-red'))
          map.addImage('pulse-red', makePulsing('#fecdd3', '#ef4444'), { pixelRatio: 1.5 });
        if (!map.hasImage('pulse-blue'))
          map.addImage('pulse-blue', makePulsing('#93c5fd', '#2563eb'), { pixelRatio: 1.5 });

        map.addLayer({
          id: 'req-dots',
          type: 'symbol',
          source: 'req',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': [
              'match',
              ['get', 'loai'],
              'cuu_nguoi',
              'pulse-red',
              'nhu_yeu_pham',
              'pulse-blue',
              'pulse-red',
            ],
            'icon-allow-overlap': true,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.45, 10, 0.6, 14, 0.75],
          },
        });

        // selected ring layer (rõ điểm đang chọn)
        map.addLayer({
          id: 'selected-ring',
          type: 'circle',
          source: 'selected',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 16, 14, 22],
            'circle-color': 'rgba(37,99,235,0.15)',
            'circle-stroke-color': '#2563eb',
            'circle-stroke-width': 3,
          },
        });

        map.on('click', 'clusters', (e: any) => {
          const fs = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
          const cid = fs[0].properties.cluster_id;
          (map.getSource('req') as any).getClusterExpansionZoom(cid, (err: any, zoom: number) => {
            if (err) return;
            map.easeTo({ center: (fs[0].geometry as any).coordinates, zoom });
          });
        });

        map.on('click', 'req-dots', (e: any) => {
          const f = e.features?.[0];
          if (!f) return;

          const [lng, lat] = (f.geometry?.coordinates || []) as [number, number];
          const props = f.properties || {};

          // open popup compact
          openPopup(lng, lat, {
            ...props,
            id: Number(props.id),
            so_nguoi: Number(props.so_nguoi),
          });

          // notify select
          const id = Number(props.id);
          if (Number.isFinite(id)) onSelect?.(id);
        });

        map.on('mouseenter', 'req-dots', () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', 'req-dots', () => (map.getCanvas().style.cursor = ''));

        // Ẩn POI
        applyPlaceVisibility(hidePlaces);

        /** Resize debounce */
        let lastW = 0,
          lastH = 0,
          resizeTimer: any = null;

        const ro = new ResizeObserver((entries) => {
          const cr = entries[0]?.contentRect;
          if (!cr) return;
          const w = Math.round(cr.width),
            h = Math.round(cr.height);
          if (w === lastW && h === lastH) return;
          lastW = w;
          lastH = h;
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            try {
              map.resize();
            } catch {}
          }, 80);
        });

        if (ref.current) ro.observe(ref.current);

        const onWinResize = () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            try {
              map.resize();
            } catch {}
          }, 80);
        };
        window.addEventListener('resize', onWinResize);

        map.once('remove', () => {
          try {
            ro.disconnect();
            window.removeEventListener('resize', onWinResize);
          } catch {}
        });
      });

      // click nền map (pick)
      map.on('click', (e: any) => onPick?.(e.lngLat));
    })();

    return () => {
      try {
        popupRef.current?.remove?.();
      } catch {}
      const m: any = mapRef.current;
      mapRef.current = null;

      try {
        m?.remove?.();
      } catch {}

      clearTimeout(clearSuppressTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  /** Cập nhật data points */
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const src = m.getSource('req');
    if (!src) return;

    (src as any).setData({
      type: 'FeatureCollection',
      features: (points || []).map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          loai: p.loai,
          trang_thai: p.trang_thai,
          ten: p.ten || '',
          sdt: p.sdt || '',
          noidung: p.noidung || '',
          so_nguoi: p.so_nguoi || 0,
          vattu: JSON.stringify(p.vattu || []),
          media: JSON.stringify(p.media || []),
        },
      })),
    });
  }, [points]);

  /** Update selected ring source */
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const src = m.getSource('selected');
    if (!src) return;

    if (!selectedId) {
      (src as any).setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const p = points.find((x) => x.id === selectedId);
    if (!p) return;

    (src as any).setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: {},
        },
      ],
    });
  }, [selectedId, points]);

  /** Nhận view từ props — chỉ animate khi thực sự khác */
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !view) return;

    const currCenter = m.getCenter().toArray() as [number, number];
    const currZoom = m.getZoom();

    if (centerEqual(currCenter, view.center) && nearlyEqual(currZoom, view.zoom, EPS_ZOOM)) return;

    suppressEmitRef.current = true;

    m.easeTo({ center: view.center, zoom: view.zoom, duration: 250 });

    const release = () => {
      suppressEmitRef.current = false;
      clearTimeout(clearSuppressTimeoutRef.current);
    };

    clearTimeout(clearSuppressTimeoutRef.current);
    clearSuppressTimeoutRef.current = setTimeout(release, 400);
    m.once('moveend', release);

    return () => {
      try {
        m.off('moveend', release);
      } catch {}
    };
  }, [view?.center?.[0], view?.center?.[1], view?.zoom]);

  /** Ẩn/hiện POI khi đổi flag */
  useEffect(() => {
    applyPlaceVisibility(hidePlaces);
  }, [hidePlaces]);

  /** Mở popup theo selectedId */
  useEffect(() => {
    if (!selectedId) return;
    const m = mapRef.current;
    if (!m) return;

    const p = points.find((x) => x.id === selectedId);
    if (!p) return;

    try {
      m.easeTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 12), duration: 250 });
    } catch {}

    openPopup(p.lng, p.lat, {
      id: p.id,
      loai: p.loai,
      trang_thai: p.trang_thai,
      ten: p.ten || '',
      sdt: p.sdt || '',
      noidung: p.noidung || '',
      so_nguoi: p.so_nguoi || 0,
      vattu: JSON.stringify(p.vattu || []),
      media: JSON.stringify(p.media || []),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return <div ref={ref} className={className} />;
}

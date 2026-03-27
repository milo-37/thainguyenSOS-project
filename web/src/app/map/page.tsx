'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView, { MapPoint, Media, TrangThaiCode } from '@/components/MapView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  Filter,
  LocateFixed,
  MapPin,
  RotateCcw,
  Search,
  SquareArrowOutUpRight,
  X,
} from 'lucide-react';

const BASE = process.env.NEXT_PUBLIC_VIETMAP_STYLE_BASE!;
const IS_ADMIN = process.env.NEXT_PUBLIC_IS_ADMIN === 'true';

const DEFAULT_VIEW = {
  center: [105.85, 21.03] as [number, number],
  zoom: 5,
};

const STATUS_ENTRIES: Array<{ code: TrangThaiCode; label: string; color: string }> = [
  { code: 'tiep_nhan', label: 'Tiếp nhận', color: '#0ea5e9' },
  { code: 'dang_xu_ly', label: 'Đang xử lý', color: '#f59e0b' },
  { code: 'da_chuyen_cum', label: 'Đã chuyển cụm', color: '#6366f1' },
  { code: 'da_hoan_thanh', label: 'Đã hoàn thành', color: '#10b981' },
  { code: 'huy', label: 'Hủy', color: '#ef4444' },
];

type SortMode = 'newest' | 'nearest' | 'most_people';

function timeAgo(iso?: string | null) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s} giây trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

const typeLabel = (t: 'all' | 'cuu_nguoi' | 'nhu_yeu_pham') =>
  t === 'all' ? 'Tất cả' : t === 'cuu_nguoi' ? 'Cứu người' : 'Nhu yếu phẩm';

function useDebouncedValue<T>(value: T, delay = 500) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function normalizeMediaUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/storage/')) return url;
  if (url.startsWith('storage/')) return `/${url}`;
  if (url.startsWith('/')) return url;
  return `/storage/${url.replace(/^\/+/, '')}`;
}

function normalizePoint(it: any): MapPoint {
  return {
    id: Number(it.id),
    lat: Number(it.lat),
    lng: Number(it.lng),
    loai: it.loai === 'nhu_yeu_pham' ? 'nhu_yeu_pham' : 'cuu_nguoi',
    trang_thai: (it.trang_thai || 'tiep_nhan') as TrangThaiCode,
    ten: it.ten_nguoigui || it.ten || '',
    sdt: it.sdt_nguoigui || it.so_dien_thoai || '',
    noidung: it.noidung || it.noi_dung || '',
    so_nguoi: Number(it.so_nguoi || it.songuoi || 0),
    vattu: (it.vattu || it.vattu_chi_tiet || []).map((v: any) => ({
      ten: v.ten || v?.vattu?.ten || 'Vật tư',
      so_luong: v.so_luong,
      don_vi: v.don_vi || v?.vattu?.don_vi || '',
    })),
    media: (it.media || [])
      .map((m: any) => {
        const mediaType: 'image' | 'video' =
          m.type === 'image' || (m.mime || '').startsWith('image/') ? 'image' : 'video';

        return {
          id: m.id ?? m.media_id,
          type: mediaType,
          url: normalizeMediaUrl(m.url || m.file_url || m.path || m.duong_dan || ''),
        };
      })
      .filter((m: Media) => !!m.url),
    createdAt: it.created_at || it.tao_luc || null,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceKm(distance?: number | null) {
  if (distance === null || distance === undefined || Number.isNaN(distance)) return '';
  if (distance < 1) return `${Math.round(distance * 1000)} m`;
  return `${distance.toFixed(distance < 10 ? 1 : 0)} km`;
}

export default function MapPage() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [view, setView] = useState<{ center: [number, number]; zoom: number }>(DEFAULT_VIEW);

  const [type, setType] = useState<'all' | 'cuu_nguoi' | 'nhu_yeu_pham'>('all');
  const [q, setQ] = useState('');
  const [hidePOI, setHidePOI] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<number | null>(null);
  const [radius, setRadius] = useState<number>(50);
  const [statusFilter, setStatusFilter] = useState<TrangThaiCode[]>(['tiep_nhan']);

  const [sortBy, setSortBy] = useState<SortMode>('newest');

  const [lightbox, setLightbox] = useState<{ items: Media[]; index: number } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [locating, setLocating] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const debouncedQ = useDebouncedValue(q.trim(), 450);
  const debouncedCenter = useDebouncedValue(view.center, 500);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const check = () => setAuthed(!!localStorage.getItem('token'));
    check();

    window.addEventListener('storage', check);
    window.addEventListener('focus', check);

    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  useEffect(() => {
    if (!authed) setStatusFilter(['tiep_nhan']);
  }, [authed]);

  const api = useCallback((path: string, init?: RequestInit) => {
    return fetch(`/api${path}`, init);
  }, []);

  const safeStatusFilter = useMemo<TrangThaiCode[]>(() => {
    if (!authed) return ['tiep_nhan'];
    return statusFilter.length ? statusFilter : ['tiep_nhan'];
  }, [authed, statusFilter]);

  const load = useCallback(async () => {
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError('');

      const qs = new URLSearchParams();

      if (type !== 'all') qs.set('loai', type);
      if (debouncedQ) qs.set('q', debouncedQ);
      if (typeof timeRange === 'number' && timeRange > 0) qs.set('hours', String(timeRange));

      qs.set('radius_km', String(radius));
      qs.set('center_lat', String(debouncedCenter[1]));
      qs.set('center_lng', String(debouncedCenter[0]));
      qs.set('trang_thai', safeStatusFilter.join(','));

      const r = await api(`/yeucau?${qs.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!r.ok) {
        throw new Error(`HTTP ${r.status}`);
      }

      const data = await r.json();
      const raw = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const pts = raw
        .map(normalizePoint)
        .filter((p: MapPoint) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));

      setPoints(pts);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError('Không tải được dữ liệu bản đồ.');
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [api, type, debouncedQ, timeRange, radius, debouncedCenter, safeStatusFilter]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const onSelect = useCallback((id: number) => {
    window.open(`/xemyeucau/${id}`, '_blank', 'noopener,noreferrer');
  }, []);

  const focusAndOpen = useCallback((p: MapPoint) => {
    setSelectedId(p.id);
    setView((v) => ({
      center: [p.lng, p.lat],
      zoom: Math.max(v.zoom, 14),
    }));
  }, []);

  const statusLabel = useCallback(
    (code: TrangThaiCode) => STATUS_ENTRIES.find((s) => s.code === code)?.label || code,
    []
  );

  const statusColor = useCallback(
    (code: TrangThaiCode) => STATUS_ENTRIES.find((s) => s.code === code)?.color || '#111827',
    []
  );

  const toggleStatus = (code: TrangThaiCode) => {
    if (!authed) return;

    setStatusFilter((prev) => {
      const next = prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code];
      return next.length ? (next as TrangThaiCode[]) : ['tiep_nhan'];
    });
  };

  const activeTags = useMemo(() => {
    const tags: string[] = [];
    tags.push(typeLabel(type));
    tags.push(timeRange !== null ? `${timeRange}h` : 'Tất cả thời gian');
    tags.push(`${radius}km`);
    tags.push(authed ? `TT: ${safeStatusFilter.map(statusLabel).join(', ')}` : 'TT: Tiếp nhận');
    if (hidePOI) tags.push('Ẩn POI');
    tags.push(
      sortBy === 'newest'
        ? 'Sắp xếp: Mới nhất'
        : sortBy === 'nearest'
        ? 'Sắp xếp: Gần nhất'
        : 'Sắp xếp: Nhiều người nhất'
    );
    return tags;
  }, [type, timeRange, radius, authed, safeStatusFilter, statusLabel, hidePOI, sortBy]);

  const rescueCount = useMemo(
    () => points.filter((p) => p.loai === 'cuu_nguoi').length,
    [points]
  );

  const supplyCount = useMemo(
    () => points.filter((p) => p.loai === 'nhu_yeu_pham').length,
    [points]
  );

  const sortedPoints = useMemo(() => {
    const centerLat = view.center[1];
    const centerLng = view.center[0];

    const enriched = points.map((p) => ({
      ...p,
      distanceKm: haversineKm(centerLat, centerLng, p.lat, p.lng),
      createdAtTs: p.createdAt ? new Date(p.createdAt).getTime() : 0,
    }));

    switch (sortBy) {
      case 'nearest':
        return enriched.sort((a, b) => a.distanceKm - b.distanceKm);
      case 'most_people':
        return enriched.sort((a, b) => (b.so_nguoi || 0) - (a.so_nguoi || 0));
      case 'newest':
      default:
        return enriched.sort((a, b) => b.createdAtTs - a.createdAtTs);
    }
  }, [points, sortBy, view.center]);

  const goToDefaultView = useCallback(() => {
    setSelectedId(null);
    setView(DEFAULT_VIEW);
  }, []);

  const goToMyLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Thiết bị không hỗ trợ định vị.');
      return;
    }

    setLocating(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;

        setView({
          center: [lng, lat],
          zoom: 15,
        });
        setLocating(false);
      },
      () => {
        setError('Không lấy được vị trí hiện tại. Hãy kiểm tra quyền truy cập vị trí.');
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  const FilterContent = (
    <div className="mt-4 grid gap-6">
      <div className="grid gap-2">
        <div className="text-sm font-semibold">Khoảng thời gian</div>
        <div className="grid grid-cols-3 gap-2">
          <button
            className={`px-3 py-2 rounded-lg border text-sm ${
              timeRange === null ? 'bg-black text-white border-black' : 'hover:bg-gray-50'
            }`}
            onClick={() => setTimeRange(null)}
          >
            Tất cả
          </button>

          {[1, 3, 6, 12, 24, 48, 72].map((h) => (
            <button
              key={h}
              className={`px-3 py-2 rounded-lg border text-sm ${
                timeRange === h ? 'bg-black text-white border-black' : 'hover:bg-gray-50'
              }`}
              onClick={() => setTimeRange(h)}
            >
              {h} giờ
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-semibold">Bán kính</div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 5, 10, 50, 100, 200].map((km) => (
            <button
              key={km}
              className={`px-3 py-2 rounded-lg border text-sm ${
                radius === km ? 'bg-black text-white border-black' : 'hover:bg-gray-50'
              }`}
              onClick={() => setRadius(km)}
            >
              {km} km
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500">* Lọc theo bán kính từ tâm bản đồ hiện tại.</div>
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-semibold flex items-center justify-between">
          <span>Trạng thái</span>
          {!authed && <span className="text-xs text-gray-500">Đăng nhập để lọc</span>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {STATUS_ENTRIES.map((s) => (
            <button
              key={s.code}
              className={`px-3 py-2 rounded-lg border text-left text-sm ${
                safeStatusFilter.includes(s.code)
                  ? 'bg-black text-white border-black'
                  : 'hover:bg-gray-50'
              } ${!authed ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}`}
              onClick={() => toggleStatus(s.code)}
              disabled={!authed}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setStatusFilter(['tiep_nhan'])}>
            Chỉ “Tiếp nhận”
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => authed && setStatusFilter(STATUS_ENTRIES.map((s) => s.code))}
            disabled={!authed}
          >
            Tất cả
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border rounded-lg p-3">
        <div className="text-sm">Ẩn POI (bệnh viện, trạm xăng,…)</div>
        <input
          type="checkbox"
          checked={hidePOI}
          onChange={(e) => setHidePOI(e.target.checked)}
        />
      </div>

      <Button onClick={() => setSheetOpen(false)}>Đóng bộ lọc</Button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-6">
      <div className="relative rounded-2xl overflow-hidden border bg-white min-h-[75vh]">
        <div className="absolute left-4 right-4 top-4 z-[5] flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                className="pl-9 pr-9 bg-white/90 backdrop-blur"
                placeholder="Tìm theo nội dung / tên / sđt..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {!!q && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                  onClick={() => setQ('')}
                  title="Xóa"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              )}
            </div>

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="bg-white/90 backdrop-blur">
                  <Filter className="h-4 w-4 mr-2" />
                  Bộ lọc
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[420px] p-6">
                <SheetHeader>
                  <SheetTitle>Bộ lọc sự kiện</SheetTitle>
                </SheetHeader>
                {FilterContent}
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border bg-white/90 backdrop-blur p-1 shadow-sm">
              {(['all', 'cuu_nguoi', 'nhu_yeu_pham'] as const).map((t) => (
                <button
                  key={t}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                    type === t ? 'bg-black text-white' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => setType(t)}
                >
                  {t === 'all' ? '🛟 Tất cả' : t === 'cuu_nguoi' ? '🚑 Cứu người' : '📦 Nhu yếu phẩm'}
                </button>
              ))}
            </div>

            <Badge className="bg-red-500 text-white hover:bg-red-500">
              Cứu người: {rescueCount}
            </Badge>

            <Badge className="bg-blue-600 text-white hover:bg-blue-600">
              Cứu trợ: {supplyCount}
            </Badge>

            <Button
              variant="outline"
              size="sm"
              className="bg-white/90 backdrop-blur"
              onClick={goToDefaultView}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Về vị trí mặc định
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="bg-white/90 backdrop-blur"
              onClick={goToMyLocation}
              disabled={locating}
            >
              <LocateFixed className="h-4 w-4 mr-2" />
              {locating ? 'Đang lấy vị trí...' : 'Vị trí của tôi'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeTags.slice(0, 6).map((t) => (
              <Badge key={t} variant="secondary" className="bg-white/90 backdrop-blur">
                {t}
              </Badge>
            ))}
            {loading && <Badge className="bg-amber-500 text-white">Đang tải...</Badge>}
            {error && <Badge className="bg-red-500 text-white">{error}</Badge>}
          </div>
        </div>

        <MapView
          styleUrl={BASE}
          points={points}
          view={view}
          onViewChange={setView}
          onSelect={onSelect}
          hidePlaces={hidePOI}
          selectedId={selectedId}
          onOpenMedia={(items, index) => setLightbox({ items, index })}
        />
      </div>

      <div className="rounded-2xl border bg-white flex flex-col h-[calc(100vh-110px)] overflow-hidden">
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-bold">Danh sách</div>
              <div className="text-xs text-gray-500">{sortedPoints.length} sự kiện</div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortMode)}
                className="h-9 rounded-lg border px-3 text-sm bg-white"
              >
                <option value="newest">Mới nhất</option>
                <option value="nearest">Gần nhất</option>
                <option value="most_people">Nhiều người nhất</option>
              </select>

              <div className="lg:hidden">
                <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
                  <Filter className="h-4 w-4 mr-2" />
                  Lọc
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-auto flex-1 px-3 py-3 space-y-3">
          {loading && points.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-sm text-gray-500 text-center">
              Đang tải dữ liệu...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 text-center">
              {error}
            </div>
          )}

          {!loading && !error && sortedPoints.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-sm text-gray-500 text-center">
              Không có sự kiện phù hợp với bộ lọc hiện tại.
            </div>
          )}

          {sortedPoints.map((p) => {
            const isActive = selectedId === p.id;
            const media = p.media || [];
            const showThumb = media.slice(0, 2);
            const distanceKm = haversineKm(view.center[1], view.center[0], p.lat, p.lng);

            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 transition cursor-pointer hover:bg-gray-50 ${
                  isActive
                    ? 'border-slate-300 bg-slate-50 shadow-sm ring-1 ring-slate-200'
                    : 'border-gray-200'
                }`}
                onClick={() => focusAndOpen(p)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">#{p.id}</span>

                      <span
                        className="inline-flex items-center px-2 py-[2px] rounded-full text-white text-[12px] font-semibold"
                        style={{ background: p.loai === 'cuu_nguoi' ? '#ef4444' : '#2563eb' }}
                      >
                        {p.loai === 'cuu_nguoi' ? 'Cứu người' : 'Cứu trợ'}
                      </span>

                      <span
                        className="inline-flex items-center px-2 py-[2px] rounded-full text-white text-[12px] font-semibold"
                        style={{ background: statusColor(p.trang_thai) }}
                      >
                        {statusLabel(p.trang_thai)}
                      </span>

                      {!!p.createdAt && (
                        <span className="text-xs text-gray-500">• {timeAgo(p.createdAt)}</span>
                      )}

                      <span className="text-xs text-gray-500">• {formatDistanceKm(distanceKm)}</span>
                    </div>

                    <div className="mt-1 font-semibold leading-5 line-clamp-2">
                      {p.noidung || '(Không có nội dung)'}
                    </div>

                    <div className="mt-1 text-sm text-gray-600 line-clamp-1">
                      {p.ten || '—'} • {p.sdt || '—'} • {p.so_nguoi || 0} người
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Xem trên bản đồ"
                      onClick={(e) => {
                        e.stopPropagation();
                        focusAndOpen(p);
                      }}
                    >
                      <MapPin className="h-5 w-5" />
                    </Button>

                    {IS_ADMIN && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Chi tiết"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(p.id);
                        }}
                      >
                        <SquareArrowOutUpRight className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                </div>

                {media.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    {showThumb.map((m, idx) => {
                      const key = m.id ?? m.url ?? `idx-${idx}`;

                      return m.type === 'image' ? (
                        <button
                          key={key}
                          className="relative"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightbox({ items: media, index: idx });
                          }}
                        >
                          <img
                            src={m.url}
                            alt=""
                            loading="lazy"
                            className="w-24 h-16 object-cover rounded-lg border"
                          />
                        </button>
                      ) : (
                        <button
                          key={key}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightbox({ items: media, index: idx });
                          }}
                          className="w-24 h-16 rounded-lg border bg-black/5 grid place-items-center text-xs font-semibold"
                        >
                          Video
                        </button>
                      );
                    })}

                    {media.length > 2 && (
                      <span className="text-xs text-gray-500">+{media.length - 2}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] grid place-items-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            {lightbox.items[lightbox.index].type === 'image' ? (
              <img
                src={lightbox.items[lightbox.index].url}
                alt=""
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={lightbox.items[lightbox.index].url}
                controls
                className="w-full max-h-[80vh] rounded-lg"
              />
            )}

            <div className="flex justify-between mt-3 gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setLightbox((v) =>
                    v ? { ...v, index: (v.index - 1 + v.items.length) % v.items.length } : v
                  )
                }
              >
                Trước
              </Button>

              <Button
                variant="outline"
                onClick={() =>
                  setLightbox((v) =>
                    v ? { ...v, index: (v.index + 1) % v.items.length } : v
                  )
                }
              >
                Sau
              </Button>

              <Button onClick={() => setLightbox(null)}>Đóng</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Package2,
  X,
  ArrowLeft,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import {
  listClusters,
  listYeuCauAdmin,
  thongKe,
  quickUpdateTrangThai,
  transferAssignment,
  listUsers,
  getYeuCauHistory,
  claimYeuCau,
  getCurrentUser,
} from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
import type { MapPoint, TrangThaiCode, Media } from '@/components/MapView';

const STYLE_URL =
  process.env.NEXT_PUBLIC_VIETMAP_STYLE_BASE ||
  'https://maps.vietmap.vn/mt/tm/style.json';

const API_BASE = 'http://127.0.0.1:8000';

const STATUS_MAP: Record<
  TrangThaiCode,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  tiep_nhan: { label: 'Tiếp nhận', variant: 'secondary' },
  dang_xu_ly: { label: 'Đang xử lý', variant: 'default' },
  da_chuyen_cum: { label: 'Đã chuyển cụm', variant: 'outline' },
  da_hoan_thanh: { label: 'Đã hoàn thành', variant: 'outline' },
  huy: { label: 'Hủy', variant: 'destructive' },
};

function statusClass(code: TrangThaiCode) {
  if (code === 'da_hoan_thanh') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (code === 'da_chuyen_cum') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (code === 'huy') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (code === 'dang_xu_ly') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}



function normalizeMediaUrl(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';

  const value = raw.trim();
  if (!value) return '';

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const u = new URL(value);

      if (u.pathname.startsWith('/yeucau/')) {
        u.pathname = `/storage${u.pathname}`;
        return u.toString();
      }

      return value;
    } catch {
      return value;
    }
  }

  if (value.startsWith('//')) {
    return `http:${value}`;
  }

  if (value.startsWith('/yeucau/')) {
    return `${API_BASE}/storage${value}`;
  }

  if (value.startsWith('yeucau/')) {
    return `${API_BASE}/storage/${value}`;
  }

  if (value.startsWith('/storage/')) {
    return `${API_BASE}${value}`;
  }

  return `${API_BASE}/storage/yeucau/${value}`;
}

function inferMediaType(m: any): 'image' | 'video' {
  if (m?.type === 'image' || m?.loai === 'image') return 'image';
  if (m?.type === 'video' || m?.loai === 'video') return 'video';

  const mime = String(m?.mime || m?.mime_type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';

  const url = String(
    m?.url ||
    m?.file_url ||
    m?.path ||
    m?.duong_dan ||
    m?.file_name ||
    m?.ten_file ||
    ''
  ).toLowerCase();

  if (/\.(mp4|mov|avi|webm|mkv)(\?|$)/.test(url)) return 'video';
  return 'image';
}

function normalizeMediaItem(m: any): Media | null {
  const raw =
    m?.url ||
    m?.file_url ||
    m?.path ||
    m?.duong_dan ||
    m?.file_name ||
    m?.ten_file ||
    '';

  const url = normalizeMediaUrl(raw);
  if (!url) return null;

  return {
    id: m?.id ?? m?.media_id ?? url,
    type: inferMediaType(m),
    url,
  };
}

function buildMediaList(list: any[]): Media[] {
  return (list || []).map(normalizeMediaItem).filter(Boolean) as Media[];
}

const Donut = ({ value, total, size = 72 }: { value: number; total: number; size?: number }) => {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, total ? value / total : 0));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth="10" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#10b981"
        strokeWidth="10"
        fill="none"
        strokeDasharray={`${c * v} ${c * (1 - v)}`}
        strokeDashoffset={c * 0.25}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="round"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="14"
        fontWeight={800}
      >
        {Math.round(v * 100)}%
      </text>
    </svg>
  );
};

export default function AdminDashboard() {
  const [mode, setMode] = useState<'unassigned' | 'assigned' | 'all'>('unassigned');
  const [cumId, setCumId] = useState<string>('');
  const [statusSel, setStatusSel] = useState<'' | TrangThaiCode>('tiep_nhan');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingCurrentUser, setLoadingCurrentUser] = useState(true);

  const [clusters, setClusters] = useState<any[]>([]);
  const [viewableCums, setViewableCums] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingTransferUsers, setLoadingTransferUsers] = useState(false);
  const [loadedTransferUsers, setLoadedTransferUsers] = useState(false);

  const [stats, setStats] = useState<any>(null);
  const [yc, setYc] = useState<any[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [mapView, setMapView] = useState<{ center: [number, number]; zoom: number }>({
    center: [105.85, 21.03],
    zoom: 12,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [vatTuOpen, setVatTuOpen] = useState(false);
  const [vatTuTheoCumOpen, setVatTuTheoCumOpen] = useState(false);

  const [openTransfer, setOpenTransfer] = useState<{ open: boolean; row: any | null }>({
    open: false,
    row: null,
  });
  const [transferToUser, setTransferToUser] = useState<string>('');
  const [transferToCum, setTransferToCum] = useState<string>('');
  const [transferNote, setTransferNote] = useState('');

  const [openStatus, setOpenStatus] = useState<{ open: boolean; row: any | null }>({
    open: false,
    row: null,
  });
  const [statusValue, setStatusValue] = useState<TrangThaiCode>('dang_xu_ly');
  const [statusNote, setStatusNote] = useState('');

  const [historyOpen, setHistoryOpen] = useState<{ open: boolean; items: any[]; id: number | null }>({
    open: false,
    items: [],
    id: null,
  });

  const [detailOpen, setDetailOpen] = useState(false);

  const [lbOpen, setLbOpen] = useState(false);
  const [lbItems, setLbItems] = useState<Media[]>([]);
  const [lbIndex, setLbIndex] = useState(0);

  const vatTuItems = useMemo(() => {
    const raw = stats?.vat_tu?.du_thieu || [];

    type VatTuState = 'thieu' | 'du' | 'du_vua';
    type VatTuItem = {
      vattu_id?: number | string;
      ten?: string;
      ton: number;
      can: number;
      du: number;
      absDu: number;
      state: VatTuState;
      [key: string]: any;
    };

    const priority: Record<VatTuState, number> = {
      thieu: 0,
      du_vua: 1,
      du: 2,
    };

    return [...raw]
      .map((x: any): VatTuItem => {
        const ton = Number(x.ton ?? 0);
        const can = Number(x.can ?? 0);
        const duRaw = x.du != null ? Number(x.du) : ton - can;

        const state: VatTuState =
          duRaw < 0 ? 'thieu' : duRaw > 0 ? 'du' : 'du_vua';

        return {
          ...x,
          ton,
          can,
          du: duRaw,
          absDu: Math.abs(duRaw),
          state,
        };
      })
      .sort((a, b) => {
        if (priority[a.state] !== priority[b.state]) {
          return priority[a.state] - priority[b.state];
        }

        return b.absDu - a.absDu;
      });
  }, [stats]);

  const vatTuSummary = useMemo(() => {
    const thieuItems = vatTuItems.filter((x) => x.state === 'thieu');
    const duItems = vatTuItems.filter((x) => x.state === 'du');
    const duVuaItems = vatTuItems.filter((x) => x.state === 'du_vua');

    return {
      soMatHangThieu: thieuItems.length,
      soMatHangDu: duItems.length,
      soMatHangDuVua: duVuaItems.length,
      tongSoLuongThieu: thieuItems.reduce((sum, x) => sum + x.absDu, 0),
      tongSoLuongDu: duItems.reduce((sum, x) => sum + x.du, 0),
      tongMatHang: vatTuItems.length,
    };
  }, [vatTuItems]);

  const lbPrev = useCallback(() => {
    setLbIndex((i) => (i - 1 + lbItems.length) % lbItems.length);
  }, [lbItems.length]);

  const lbNext = useCallback(() => {
    setLbIndex((i) => (i + 1) % lbItems.length);
  }, [lbItems.length]);

  useEffect(() => {
    Promise.all([getCurrentUser(), listClusters('')])
      .then(([currentUser, clustersData]) => {
        setIsAdmin(!!currentUser?.is_admin);

        const allClusters = clustersData?.data ?? [];
        const myViewableCums = currentUser?.viewable_cums ?? [];

        setClusters(allClusters);
        setViewableCums(!!currentUser?.is_admin ? allClusters : myViewableCums);
      })
      .catch(console.error)
      .finally(() => setLoadingCurrentUser(false));
  }, []);

  useEffect(() => {
    setStatusSel('');
    setPage(1);
  }, [mode]);

  const reload = useCallback(async () => {
    const params: any = { per_page: 100, page };

    if (mode === 'unassigned') params.chua_phan_cong = 1;
    if (mode === 'assigned') params.assigned_to_me = 1;
    if (cumId) params.cum_id = +cumId;
    if (statusSel) params.trang_thai = statusSel;

    const s = await thongKe(params);
    setStats(s);

    const list = await listYeuCauAdmin(params);
    const data = list?.data ?? list;
    setYc(data?.data ?? data ?? []);
    setTotalPages(data?.last_page ?? list?.last_page ?? 1);
  }, [mode, cumId, statusSel, page]);

  useEffect(() => {
    if (loadingCurrentUser) return;
    reload().catch(console.error);
  }, [reload, loadingCurrentUser]);

  const points: MapPoint[] = useMemo(
    () =>
      (yc ?? [])
        .filter((r: any) => r.lat != null && r.lng != null)
        .map((r: any) => {
          const loai = String(r.loai || r.loai_yeu_cau || '').toLowerCase();
          const media: Media[] = buildMediaList(r.media || []);

          const dsVatTu = r.vattu_chi_tiet || r.vattuChiTiet || [];

          const vattu =
            dsVatTu.map((vt: any) => ({
              ten: vt?.vattu?.ten ?? vt.vattu_ten ?? vt.ten ?? 'Vật tư',
              so_luong: vt.so_luong,
              don_vi: vt.don_vi ?? vt?.vattu?.don_vi ?? vt?.vattu?.donvi ?? vt.donvi ?? '',
            })) ?? [];

          return {
            id: Number(r.id),
            lat: Number(r.lat),
            lng: Number(r.lng),
            loai: loai === 'nhu_yeu_pham' ? 'nhu_yeu_pham' : 'cuu_nguoi',
            trang_thai: (r.trang_thai ?? 'tiep_nhan') as MapPoint['trang_thai'],
            ten: r.ten ?? r.ten_nguoigui ?? '',
            sdt: r.so_dien_thoai ?? r.sdt_nguoigui ?? '',
            noidung: r.noi_dung ?? r.noidung ?? '',
            so_nguoi: r.so_nguoi ?? r.songuoi ?? undefined,
            vattu,
            media,
            createdAt: r.created_at ?? null,
          } as MapPoint;
        }),
    [yc]
  );

  const selectedRow = useMemo(() => {
    if (!selectedId) return null;
    return yc.find((r) => Number(r.id) === Number(selectedId)) ?? null;
  }, [yc, selectedId]);

  const filteredTransferUsers = useMemo(() => {
    if (!transferToCum) return users;
    const selectedCumId = Number(transferToCum);

    return users.filter((u: any) =>
      (u.cums ?? []).some((c: any) => Number(c.id) === selectedCumId)
    );
  }, [users, transferToCum]);

  useEffect(() => {
    if (selectedId) setDetailOpen(true);
  }, [selectedId]);

  const ensureTransferUsers = useCallback(async () => {
    if (loadedTransferUsers) return;

    setLoadingTransferUsers(true);
    try {
      const usersData = await listUsers({ for_transfer: 1 });
      setUsers(usersData?.data ?? []);
      setLoadedTransferUsers(true);
    } catch (err) {
      console.error('Load transfer users failed:', err);
      setUsers([]);
    } finally {
      setLoadingTransferUsers(false);
    }
  }, [loadedTransferUsers]);

  const openTransferDialog = async (row: any) => {
    await ensureTransferUsers();

    setOpenTransfer({ open: true, row });
    setTransferToUser('');
    setTransferToCum(row?.cum_id ? String(row.cum_id) : '');
    setTransferNote('');
  };

  const submitTransfer = async () => {
    const r = openTransfer.row;
    if (!r) return;

    const payload: any = {
      ghi_chu: transferNote || undefined,
    };

    if (!transferToCum) {
      alert('Bắt buộc chọn cụm xử lý.');
      return;
    }

    payload.cum_id = +transferToCum;

    if (transferToUser) {
      payload.user_id = +transferToUser;
    }

    await transferAssignment(r.id, payload);
    setOpenTransfer({ open: false, row: null });
    await reload();
  };

  useEffect(() => {
    if (!lbOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLbOpen(false);
      if (e.key === 'ArrowLeft') lbPrev();
      if (e.key === 'ArrowRight') lbNext();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lbOpen, lbPrev, lbNext]);

  const openLightboxFromRow = (row: any, index: number) => {
    const items: Media[] = buildMediaList(row.media || []);
    if (!items.length) return;

    setLbItems(items);
    setLbIndex(index);
    setLbOpen(true);
  };



  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-4">
        <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-slate-50/80 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60">
          <div className="rounded-2xl border bg-white shadow-sm p-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="border rounded-xl h-10 px-3 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                  value={cumId}
                  onChange={(e) => {
                    setCumId(e.target.value);
                    setPage(1);
                  }}
                  disabled={loadingCurrentUser}
                >
                  <option value="">
                    {isAdmin ? '— Tất cả cụm —' : '— Tất cả cụm trong phạm vi —'}
                  </option>

                  {viewableCums.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.ten}
                    </option>
                  ))}
                </select>

                <select
                  className="border rounded-xl h-10 px-3 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  value={statusSel}
                  onChange={(e) => {
                    setStatusSel(e.target.value as TrangThaiCode | '');
                    setPage(1);
                  }}
                  title="Lọc theo trạng thái"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="tiep_nhan">Tiếp nhận</option>
                  <option value="dang_xu_ly">Đang xử lý</option>
                  <option value="da_chuyen_cum">Đã chuyển cụm</option>
                  <option value="da_hoan_thanh">Đã hoàn thành</option>
                  <option value="huy">Hủy</option>
                </select>
              </div>

              <div className="lg:ml-auto flex items-center gap-2">
                <div className="inline-flex rounded-xl border bg-slate-50 p-1">
                  <Button
                    variant={mode === 'unassigned' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => {
                      setMode('unassigned');
                      setPage(1);
                    }}
                  >
                    Chưa có người xử lý
                  </Button>

                  <Button
                    variant={mode === 'assigned' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => {
                      setMode('assigned');
                      setPage(1);
                    }}
                  >
                    Được giao
                  </Button>

                  <Button
                    variant={mode === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => {
                      setMode('all');
                      setPage(1);
                    }}
                  >
                    {isAdmin ? 'Toàn hệ thống' : 'Tất cả trong phạm vi'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="rounded-xl border bg-white shadow-sm px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-muted-foreground leading-none">Tổng số yêu cầu</div>
                <div className="text-2xl font-bold leading-tight">{stats.tong_so_yeu_cau}</div>
              </div>
              <ClipboardList className="w-5 h-5 text-slate-500" />
            </div>

            <div className="rounded-xl border bg-white shadow-sm px-4 py-3 flex items-center gap-3">
              <Donut
                value={Number(stats.so_da_xu_ly || 0)}
                total={Number(stats.tong_so_yeu_cau || 0)}
                size={54}
              />
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground leading-none">Tỉ lệ hoàn thành</div>
                <div className="text-sm font-semibold leading-tight truncate">
                  {stats.so_da_xu_ly} đã xử lý · {stats.so_chua_xu_ly} chưa xử lý
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white shadow-sm px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground leading-none">
                  Nhu yếu phẩm đang thiếu
                </div>
                <div className="text-2xl font-bold leading-tight">
                  {vatTuSummary.tongSoLuongThieu.toLocaleString('vi-VN')}
                </div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {vatTuSummary.soMatHangThieu} mặt hàng thiếu theo tồn kho & nhu cầu
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-9 px-3"
                  onClick={() => setVatTuOpen(true)}
                >
                  <Package2 className="w-4 h-4 mr-2" />
                  Tổng
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-9 px-3"
                  onClick={() => setVatTuTheoCumOpen(true)}
                >
                  Theo cụm
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="relative">
            <MapView
              styleUrl={STYLE_URL}
              points={points}
              view={mapView}
              onViewChange={setMapView}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(Number(id))}
              onOpenMedia={(items, index) => {
                setLbItems(items);
                setLbIndex(index);
                setLbOpen(true);
              }}
              onTransfer={async (id) => {
                const row = yc.find((r) => Number(r.id) === Number(id));
                if (row?.permissions?.can_transfer) {
                  await openTransferDialog(row);
                }
              }}
              onClaim={async (id) => {
                const row = yc.find((r) => Number(r.id) === Number(id));
                if (!row?.permissions?.can_claim) return;

                try {
                  if (!confirm(`Bạn muốn nhận xử lý yêu cầu #${id}?`)) return;
                  await claimYeuCau(Number(id));
                  await reload();
                } catch (err: any) {
                  alert(err?.message || 'Không thể nhận xử lý yêu cầu này.');
                }
              }}
              className="h-[250px] md:h-[350px] w-full"
              initialAutoLocate
              hidePlaces
            />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-black/5" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Danh sách yêu cầu</div>
              <div className="text-xs text-muted-foreground">
                Đang hiển thị {yc.length} mục · Trang {page}/{totalPages}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>

          {!yc.length && (
            <div className="border rounded-2xl bg-white p-10 text-center text-sm text-muted-foreground shadow-sm">
              Không có yêu cầu phù hợp bộ lọc hiện tại.
            </div>
          )}

          <div className="grid gap-3">
            {yc.map((r: any) => {
              const created = r.created_at ? new Date(r.created_at) : null;
              const code = ((r.trang_thai as TrangThaiCode) ?? 'tiep_nhan') as TrangThaiCode;
              const st = STATUS_MAP[code] ?? STATUS_MAP.tiep_nhan;
              const rowMedia = buildMediaList(r.media || []);

              return (
                <div
                  key={r.id}
                  className={[
                    'border rounded-2xl p-3 md:p-4 bg-white shadow-sm',
                    'grid md:grid-cols-12 gap-3',
                    'hover:shadow-md hover:border-slate-200 transition cursor-pointer',
                    Number(selectedId) === Number(r.id) ? 'ring-2 ring-slate-200' : '',
                  ].join(' ')}
                  onClick={() => {
                    setSelectedId(Number(r.id));
                    setDetailOpen(true);
                    if (r.lng != null && r.lat != null) {
                      setMapView({ center: [Number(r.lng), Number(r.lat)], zoom: 15 });
                    }
                  }}
                >
                  <div className="md:col-span-3">
                    {rowMedia.length ? (
                      <div className="grid grid-cols-2 gap-2">
                        {rowMedia.map((m: Media, idx: number) => {
                          const key = m.id ?? m.url ?? `m-${r.id}-${idx}`;
                          const isImage = m.type === 'image';

                          return isImage ? (
                            <button
                              key={key}
                              onClick={(e) => {
                                e.stopPropagation();
                                openLightboxFromRow(r, idx);
                              }}
                              className="group"
                              type="button"
                            >
                              <img
                                src={m.url}
                                alt=""
                                className="w-full aspect-video object-cover rounded-xl border bg-slate-50 group-hover:opacity-95"
                              />
                            </button>
                          ) : (
                            <button
                              key={key}
                              onClick={(e) => {
                                e.stopPropagation();
                                openLightboxFromRow(r, idx);
                              }}
                              className="group"
                              type="button"
                            >
                              <video
                                src={m.url}
                                className="w-full aspect-video rounded-xl border bg-black/10 group-hover:opacity-95"
                                muted
                              />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="w-full aspect-video rounded-xl border bg-slate-50 grid place-items-center text-xs text-muted-foreground">
                        Không media
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-6 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          #{r.id} · {r.ten ?? r.ten_nguoigui} · {r.so_dien_thoai ?? r.sdt_nguoigui}
                        </div>
                        <div className="text-sm text-slate-700">{r.noi_dung ?? r.noidung}</div>
                      </div>

                      {r.lat != null && r.lng != null && (
                        <a
                          className="ml-auto mt-0.5 opacity-80 hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                          target="_blank"
                          rel="noreferrer"
                          href={`https://maps.google.com/?q=${r.lat},${r.lng}`}
                          title="Mở Google Maps"
                        >
                          <MapPin className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {!!(r.vattu_chi_tiet || r.vattuChiTiet)?.length && (
                      <div className="flex flex-wrap gap-1.5">
                        {(r.vattu_chi_tiet || r.vattuChiTiet).map((vt: any, i: number) => (
                          <span
                            key={vt.id || `${vt.vattu_id}-${i}`}
                            className="px-2 py-0.5 rounded-full border text-xs bg-slate-50"
                            title={`${vt?.vattu?.ten ?? vt.vattu_ten ?? vt.ten ?? 'Vật tư'}`}
                          >
                            {vt?.vattu?.ten ?? vt.vattu_ten ?? vt.ten ?? 'Vật tư'}
                            {vt.so_luong ? ` × ${vt.so_luong}` : ''}
                            {vt.don_vi || vt?.vattu?.don_vi || vt?.vattu?.donvi
                              ? ` ${vt.don_vi ?? vt?.vattu?.don_vi ?? vt?.vattu?.donvi ?? ''}`
                              : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3 flex flex-col items-end gap-2">
                    <Badge variant="outline" className={`rounded-full ${statusClass(code)}`}>
                      {st.label}
                    </Badge>

                    <div className="text-xs text-muted-foreground">
                      {created ? created.toLocaleString('vi-VN') : ''}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {r.permissions?.can_claim && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              if (!confirm('Bạn có chắc muốn nhận xử lý yêu cầu này?')) return;
                              await claimYeuCau(Number(r.id));
                              await reload();
                            } catch (err: any) {
                              alert(err?.message || 'Không thể nhận xử lý yêu cầu này.');
                            }
                          }}
                        >
                          Nhận xử lý
                        </Button>
                      )}

                      {r.permissions?.can_update_status && (
                        <Button
                          size="sm"
                          className="rounded-xl"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenStatus({ open: true, row: r });
                            setStatusValue((r.trang_thai as TrangThaiCode) ?? 'dang_xu_ly');
                            setStatusNote('');
                          }}
                        >
                          Cập nhật
                        </Button>
                      )}

                      {r.permissions?.can_transfer && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-xl"
                          title="Chuyển xử lý"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await openTransferDialog(r);
                          }}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      )}

                      {r.permissions?.can_view_history && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-xl"
                          title="Lịch sử"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const data = await getYeuCauHistory(Number(r.id));
                              const items = data?.data ?? data ?? [];
                              setHistoryOpen({ open: true, items, id: Number(r.id) });
                            } catch (err: any) {
                              alert(err?.message || 'Không lấy được lịch sử');
                            }
                          }}
                        >
                          <ClipboardList className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Dialog open={vatTuOpen} onOpenChange={setVatTuOpen}>
          <DialogContent className="sm:max-w-[720px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Nhu yếu phẩm (Thiếu / Dư)</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-xl border bg-rose-50 px-3 py-2">
                  <div className="text-xs text-rose-700">Vật tư thiếu</div>
                  <div className="text-lg font-bold text-rose-800">
                    {vatTuSummary.soMatHangThieu.toLocaleString('vi-VN')}
                  </div>
                </div>

                <div className="rounded-xl border bg-emerald-50 px-3 py-2">
                  <div className="text-xs text-emerald-700">Vật tư dư</div>
                  <div className="text-lg font-bold text-emerald-800">
                    {vatTuSummary.soMatHangDu.toLocaleString('vi-VN')}
                  </div>
                </div>

                <div className="rounded-xl border bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-600">Đủ nhu cầu</div>
                  <div className="text-lg font-bold text-slate-800">
                    {vatTuSummary.soMatHangDuVua.toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-auto space-y-2 pr-1">
                {vatTuItems.map((x: any, idx: number) => {
                  const badgeCls =
                    x.state === 'thieu'
                      ? 'bg-rose-100 text-rose-700 border-rose-200'
                      : x.state === 'du'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200';

                  const badgeText =
                    x.state === 'thieu'
                      ? `Thiếu ${x.absDu}`
                      : x.state === 'du'
                        ? `Dư ${x.du}`
                        : 'Đủ';

                  return (
                    <div key={x.vattu_id ?? idx} className="rounded-xl border p-3 bg-white">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold truncate">{x.ten ?? '—'}</div>
                        <Badge variant="outline" className={`rounded-full ${badgeCls}`}>
                          {badgeText}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground mt-1">
                        Còn: <b className="text-foreground">{x.ton.toLocaleString('vi-VN')}</b> ·
                        Cần: <b className="text-foreground"> {x.can.toLocaleString('vi-VN')}</b>
                      </div>
                    </div>
                  );
                })}

                {!vatTuItems.length && (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Không có dữ liệu thiếu/dư.
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={vatTuTheoCumOpen} onOpenChange={setVatTuTheoCumOpen}>
          <DialogContent className="sm:max-w-[900px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Thiếu / Dư nhu yếu phẩm theo cụm</DialogTitle>
            </DialogHeader>

            <div className="max-h-[70vh] overflow-auto space-y-3 pr-1">
              {(stats?.vat_tu_theo_cum || []).map((cum: any) => (
                <div key={cum.cum_id} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <div className="font-semibold text-base">{cum.cum_ten}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Thiếu {Number(cum.mat_hang_thieu || 0).toLocaleString('vi-VN')} mặt hàng ·
                        Dư {Number(cum.mat_hang_du || 0).toLocaleString('vi-VN')} mặt hàng ·
                        Đủ {Number(cum.mat_hang_du_vua || 0).toLocaleString('vi-VN')} mặt hàng
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full bg-rose-100 text-rose-700 border-rose-200">
                        Thiếu {Number(cum.tong_so_luong_thieu || 0).toLocaleString('vi-VN')}
                      </Badge>
                      <Badge variant="outline" className="rounded-full bg-emerald-100 text-emerald-700 border-emerald-200">
                        Dư {Number(cum.tong_so_luong_du || 0).toLocaleString('vi-VN')}
                      </Badge>
                    </div>
                  </div>

                  {!!cum.items?.length ? (
                    <div className="mt-3 grid gap-2">
                      {cum.items.map((item: any, idx: number) => {
                        const du = Number(item.du ?? 0);

                        const badgeCls =
                          du < 0
                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                            : du > 0
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200';

                        const badgeText =
                          du < 0 ? `Thiếu ${Math.abs(du)}` : du > 0 ? `Dư ${du}` : 'Đủ';

                        return (
                          <div
                            key={`${cum.cum_id}-${item.vattu_id ?? idx}`}
                            className="rounded-xl border p-3 bg-slate-50"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium truncate">
                                {item.ten ?? '—'}
                                {item.donvi ? ` (${item.donvi})` : ''}
                              </div>

                              <Badge variant="outline" className={`rounded-full ${badgeCls}`}>
                                {badgeText}
                              </Badge>
                            </div>

                            <div className="text-xs text-muted-foreground mt-1">
                              Tồn: <b className="text-foreground">{Number(item.ton ?? 0).toLocaleString('vi-VN')}</b> ·
                              Cần: <b className="text-foreground"> {Number(item.can ?? 0).toLocaleString('vi-VN')}</b>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-muted-foreground">
                      Cụm này hiện chưa có dữ liệu tồn kho hoặc nhu cầu vật tư.
                    </div>
                  )}
                </div>
              ))}

              {!(stats?.vat_tu_theo_cum || []).length && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Không có dữ liệu theo cụm.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Sheet
          open={detailOpen && !!selectedRow}
          onOpenChange={(o) => {
            setDetailOpen(o);
            if (!o) setSelectedId(null);
          }}
        >
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-auto">
            <SheetHeader>
              <SheetTitle>Chi tiết yêu cầu #{selectedRow?.id ?? ''}</SheetTitle>
            </SheetHeader>

            {selectedRow ? (
              <div className="mt-3 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`rounded-full ${statusClass(
                      ((selectedRow.trang_thai as TrangThaiCode) ?? 'tiep_nhan') as TrangThaiCode
                    )}`}
                  >
                    {STATUS_MAP[
                      ((selectedRow.trang_thai as TrangThaiCode) ?? 'tiep_nhan') as TrangThaiCode
                    ]?.label ?? 'Tiếp nhận'}
                  </Badge>

                  <div className="text-sm text-muted-foreground">
                    {selectedRow.created_at ? new Date(selectedRow.created_at).toLocaleString('vi-VN') : ''}
                  </div>

                  {selectedRow.lat != null && selectedRow.lng != null && (
                    <a
                      className="ml-auto inline-flex items-center gap-2 text-sm text-blue-600 font-semibold"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://maps.google.com/?q=${selectedRow.lat},${selectedRow.lng}`}
                    >
                      <MapPin className="w-4 h-4" /> Mở Google Maps
                    </a>
                  )}
                </div>

                <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
                  <div className="text-sm">
                    <b>Người gửi:</b> {selectedRow.ten ?? selectedRow.ten_nguoigui ?? '—'}
                  </div>
                  <div className="text-sm">
                    <b>SĐT:</b> {selectedRow.so_dien_thoai ?? selectedRow.sdt_nguoigui ?? '—'}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">
                    <b>Nội dung:</b> {selectedRow.noi_dung ?? selectedRow.noidung ?? '—'}
                  </div>
                  <div className="text-sm">
                    <b>Số người:</b> {selectedRow.so_nguoi ?? selectedRow.songuoi ?? '—'}
                  </div>
                  <div className="text-sm">
                    <b>Cụm hiện tại:</b> {selectedRow.cum_id ?? '—'}
                  </div>
                  <div className="text-sm">
                    <b>Được giao cho:</b> {selectedRow.duoc_giao_cho ?? '—'}
                  </div>
                </div>

                {!!(selectedRow.vattu_chi_tiet || selectedRow.vattuChiTiet)?.length && (
                  <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="font-semibold mb-2">Vật tư cần</div>
                    <div className="flex flex-wrap gap-2">
                      {(selectedRow.vattu_chi_tiet || selectedRow.vattuChiTiet).map((vt: any, i: number) => (
                        <span
                          key={vt.id || `${vt.vattu_id}-${i}`}
                          className="px-2 py-1 rounded-full border text-xs bg-slate-50"
                        >
                          {vt?.vattu?.ten ?? vt.vattu_ten ?? vt.ten ?? 'Vật tư'}
                          {vt.so_luong ? ` × ${vt.so_luong}` : ''}
                          {vt.don_vi || vt?.vattu?.don_vi || vt?.vattu?.donvi
                            ? ` ${vt.don_vi ?? vt?.vattu?.don_vi ?? vt?.vattu?.donvi ?? ''}`
                            : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!!buildMediaList(selectedRow.media || []).length && (
                  <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="font-semibold mb-2">Media</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {buildMediaList(selectedRow.media || []).map((m: Media, idx: number) => {
                        const key = m.id ?? m.url ?? `m-${selectedRow.id}-${idx}`;
                        const isImage = m.type === 'image';

                        return isImage ? (
                          <button
                            key={key}
                            onClick={() => openLightboxFromRow(selectedRow, idx)}
                            className="group"
                            type="button"
                          >
                            <img
                              src={m.url}
                              alt=""
                              className="w-full aspect-video object-cover rounded-xl border bg-slate-50 group-hover:opacity-95"
                            />
                          </button>
                        ) : (
                          <button
                            key={key}
                            onClick={() => openLightboxFromRow(selectedRow, idx)}
                            className="group"
                            type="button"
                          >
                            <video
                              src={m.url}
                              className="w-full aspect-video rounded-xl border bg-black/10 group-hover:opacity-95"
                              muted
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="font-semibold mb-3">Thao tác</div>

                  <div className="flex flex-wrap gap-2">
                    {selectedRow.permissions?.can_claim && (
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={async () => {
                          try {
                            if (!confirm('Bạn có chắc muốn nhận xử lý yêu cầu này?')) return;
                            await claimYeuCau(Number(selectedRow.id));
                            await reload();
                          } catch (err: any) {
                            alert(err?.message || 'Không thể nhận xử lý yêu cầu này.');
                          }
                        }}
                      >
                        Nhận xử lý
                      </Button>
                    )}

                    {selectedRow.permissions?.can_transfer && (
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={async () => {
                          await openTransferDialog(selectedRow);
                        }}
                      >
                        Chuyển xử lý
                      </Button>
                    )}

                    {selectedRow.permissions?.can_update_status && (
                      <Button
                        className="rounded-xl"
                        onClick={() => {
                          setOpenStatus({ open: true, row: selectedRow });
                          setStatusValue(
                            ((selectedRow.trang_thai as TrangThaiCode) ?? 'dang_xu_ly') as TrangThaiCode
                          );
                          setStatusNote('');
                        }}
                      >
                        Cập nhật trạng thái
                      </Button>
                    )}

                    {selectedRow.permissions?.can_view_history && (
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={async () => {
                          try {
                            const data = await getYeuCauHistory(Number(selectedRow.id));
                            const items = data?.data ?? data ?? [];
                            setHistoryOpen({ open: true, items, id: Number(selectedRow.id) });
                          } catch (err: any) {
                            alert(err?.message || 'Không lấy được lịch sử');
                          }
                        }}
                      >
                        Lịch sử
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">Không có dữ liệu.</div>
            )}
          </SheetContent>
        </Sheet>

        <Dialog
          open={openTransfer.open}
          onOpenChange={(o) => setOpenTransfer((v) => ({ open: o, row: o ? v.row : null }))}
        >
          <DialogContent className="sm:max-w-[520px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Chuyển xử lý yêu cầu #{openTransfer.row?.id}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="text-sm text-muted-foreground">
                Bắt buộc chọn cụm. Nếu chọn thêm người thì yêu cầu sẽ được giao đích danh cho người đó và đồng bộ vào cụm đã chọn. Nếu chỉ chọn cụm thì yêu cầu sẽ được chuyển về cụm.
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Cụm nhận</label>
                  <select
                    className="mt-1 border rounded-xl h-10 px-3 w-full bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                    value={transferToCum}
                    onChange={(e) => {
                      setTransferToCum(e.target.value);

                      if (
                        transferToUser &&
                        !users
                          .find((u: any) => Number(u.id) === Number(transferToUser))
                          ?.cums?.some((c: any) => Number(c.id) === Number(e.target.value))
                      ) {
                        setTransferToUser('');
                      }
                    }}
                  >
                    <option value="">— Chọn cụm —</option>
                    {clusters.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.ten}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Người nhận (tùy chọn)</label>
                  <select
                    className="mt-1 border rounded-xl h-10 px-3 w-full bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                    value={transferToUser}
                    onChange={(e) => {
                      setTransferToUser(e.target.value);
                    }}
                    disabled={loadingTransferUsers}
                  >
                    <option value="">
                      {loadingTransferUsers
                        ? 'Đang tải danh sách người nhận...'
                        : '— Chuyển về cụm, không chọn người —'}
                    </option>
                    {filteredTransferUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Ghi chú</label>
                <Textarea
                  className="mt-1 rounded-xl"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Nhập ghi chú (tùy chọn)"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setOpenTransfer({ open: false, row: null })}
              >
                Hủy
              </Button>
              <Button className="rounded-xl" onClick={submitTransfer}>
                Chuyển
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={openStatus.open}
          onOpenChange={(o) => setOpenStatus((v) => ({ open: o, row: o ? v.row : null }))}
        >
          <DialogContent className="sm:max-w-[520px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Cập nhật trạng thái yêu cầu #{openStatus.row?.id}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-3">
              <div>
                <label className="text-sm font-medium">Trạng thái</label>
                <select
                  className="mt-1 w-full h-10 px-3 border rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  value={statusValue}
                  onChange={(e) => setStatusValue(e.target.value as TrangThaiCode)}
                >
                  <option value="tiep_nhan">Tiếp nhận</option>
                  <option value="dang_xu_ly">Đang xử lý</option>
                  <option value="da_chuyen_cum">Đã chuyển cụm</option>
                  <option value="da_hoan_thanh">Đã hoàn thành</option>
                  <option value="huy">Hủy</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Ghi chú</label>
                <Textarea
                  className="mt-1 rounded-xl"
                  placeholder="Nhập ghi chú để lưu lịch sử"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setOpenStatus({ open: false, row: null })}
              >
                Hủy
              </Button>
              <Button
                className="rounded-xl"
                onClick={async () => {
                  if (!openStatus.row) return;
                  await quickUpdateTrangThai(openStatus.row.id, statusValue, statusNote);
                  setOpenStatus({ open: false, row: null });
                  await reload();
                }}
              >
                Lưu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={historyOpen.open} onOpenChange={(o) => setHistoryOpen((v) => ({ ...v, open: o }))}>
          <DialogContent className="sm:max-w-[640px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Lịch sử xử lý yêu cầu #{historyOpen.id ?? ''}</DialogTitle>
            </DialogHeader>

            <div className="max-h-[60vh] overflow-auto divide-y">
              {(historyOpen.items || []).map((h: any, idx: number) => (
                <div key={h.id ?? idx} className="py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-full">
                      {h.trang_thai_hien_thi ?? h.hanh_dong ?? h.trang_thai ?? ''}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {h.created_at ? new Date(h.created_at).toLocaleString('vi-VN') : ''}
                    </div>
                    <div className="ml-auto text-xs">
                      {h.nguoi_thuc_hien ?? h.user?.name ?? ''}
                    </div>
                  </div>
                  {(h.mo_ta_hien_thi || h.ghi_chu) ? (
                    <div className="mt-1 whitespace-pre-wrap">
                      {h.mo_ta_hien_thi || h.ghi_chu}
                    </div>
                  ) : null}
                </div>
              ))}
              {!historyOpen.items?.length && (
                <div className="py-6 text-center text-sm text-muted-foreground">Chưa có lịch sử.</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {lbOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
            <button
              className="absolute top-4 right-4 text-white/80 hover:text-white"
              onClick={() => setLbOpen(false)}
              title="Đóng"
              type="button"
            >
              <X />
            </button>
            <button
              className="absolute left-4 text-white/80 hover:text-white"
              onClick={lbPrev}
              title="Trước"
              type="button"
            >
              <ArrowLeft />
            </button>
            <button
              className="absolute right-12 text-white/80 hover:text-white"
              onClick={lbNext}
              title="Sau"
              type="button"
            >
              <ArrowRight />
            </button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm">
              {lbIndex + 1} / {lbItems.length}
            </div>

            <div className="max-w-5xl w-full px-6">
              {(() => {
                const m = lbItems[lbIndex];
                if (!m) return null;

                return m.type === 'image' ? (
                  <img
                    src={m.url}
                    alt=""
                    className="w-full max-h-[80vh] object-contain rounded-2xl"
                  />
                ) : (
                  <video
                    src={m.url}
                    className="w-full max-h-[80vh] rounded-2xl"
                    controls
                    autoPlay
                  />
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
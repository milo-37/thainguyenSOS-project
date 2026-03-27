'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Search,
  MapPin,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import {
  listClusters,
  listUsers,
  listYeuCauAdmin,
  getCurrentUser,
  claimYeuCau,
  transferAssignment,
  quickUpdateTrangThai,
  getYeuCauHistory,
} from '@/lib/api';

type TrangThaiCode =
  | 'tiep_nhan'
  | 'dang_xu_ly'
  | 'da_chuyen_cum'
  | 'da_hoan_thanh'
  | 'huy';

function useDebounce<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const STATUS_UI: Record<
  TrangThaiCode,
  { label: string; cls: string }
> = {
  tiep_nhan: {
    label: 'Tiếp nhận',
    cls: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  dang_xu_ly: {
    label: 'Đang xử lý',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  da_chuyen_cum: {
    label: 'Đã chuyển cụm',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  da_hoan_thanh: {
    label: 'Đã hoàn thành',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  huy: {
    label: 'Hủy',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

function formatDateTimeVN(dateStr?: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function highlight(text: string, keyword: string) {
  const q = keyword.trim();
  if (!q) return text;

  try {
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
    const parts = text.split(re);

    return (
      <>
        {parts.map((p, i) =>
          re.test(p) ? (
            <mark key={i} className="bg-yellow-100 rounded px-1">
              {p}
            </mark>
          ) : (
            <span key={i}>{p}</span>
          )
        )}
      </>
    );
  } catch {
    return text;
  }
}

export default function YeuCauPage() {
  const [items, setItems] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [viewableCums, setViewableCums] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [loadingInit, setLoadingInit] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingTransferUsers, setLoadingTransferUsers] = useState(false);
  const [loadedTransferUsers, setLoadedTransferUsers] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [q, setQ] = useState('');
  const qDebounced = useDebounce(q, 400);

  const [statusSel, setStatusSel] = useState<'' | TrangThaiCode>('');
  const [cumId, setCumId] = useState('');
  const [assignedToMe, setAssignedToMe] = useState<0 | 1>(0);

  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  const [openTransfer, setOpenTransfer] = useState<{ open: boolean; row: any | null }>({
    open: false,
    row: null,
  });
  const [transferToCum, setTransferToCum] = useState('');
  const [transferToUser, setTransferToUser] = useState('');
  const [transferNote, setTransferNote] = useState('');

  const [openStatus, setOpenStatus] = useState<{ open: boolean; row: any | null }>({
    open: false,
    row: null,
  });
  const [statusValue, setStatusValue] = useState<TrangThaiCode>('dang_xu_ly');
  const [statusNote, setStatusNote] = useState('');

  const [historyOpen, setHistoryOpen] = useState<{
    open: boolean;
    id: number | null;
    items: any[];
  }>({
    open: false,
    id: null,
    items: [],
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await getCurrentUser();
        const myViewableCums = currentUser?.viewable_cums ?? [];

        setIsAdmin(!!currentUser?.is_admin);
        setViewableCums(myViewableCums);

        try {
          const clustersData = await listClusters('');
          const allClusters = clustersData?.data ?? [];
          setClusters(allClusters);
          setViewableCums(currentUser?.is_admin ? allClusters : myViewableCums);
        } catch (err) {
          console.error('Load clusters failed:', err);
          setClusters([]);
          setViewableCums(myViewableCums);
        }

        setUsers([]);
      } catch (e) {
        console.error('Load current user failed:', e);
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);

  const filtersKey = useMemo(
    () => JSON.stringify({ q: qDebounced, statusSel, cumId, assignedToMe }),
    [qDebounced, statusSel, cumId, assignedToMe]
  );

  useEffect(() => {
    setPage(1);
  }, [filtersKey]);

  const loadData = useCallback(async () => {
    const ac = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ac;

    setLoading(true);

    try {
      const params: any = {
        q: qDebounced || undefined,
        page,
        per_page: 12,
      };

      if (statusSel) params.trang_thai = statusSel;
      if (cumId) params.cum_id = Number(cumId);
      if (assignedToMe) params.assigned_to_me = 1;

      const d = await listYeuCauAdmin(params, {
        signal: ac.signal,
        cache: 'no-store',
      });

      if (ac.signal.aborted) return;

      const root = d?.data ?? d;
      const rows = root?.data ?? root?.items ?? root ?? [];

      setItems(Array.isArray(rows) ? rows : []);
      setLastPage(root?.last_page ?? d?.last_page ?? 1);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      console.error(e?.message || e);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [qDebounced, statusSel, cumId, assignedToMe, page]);

  useEffect(() => {
    if (loadingInit) return;
    loadData();
    return () => abortRef.current?.abort();
  }, [loadData, loadingInit]);

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

  const filteredTransferUsers = useMemo(() => {
    if (!transferToCum) return users;
    const selectedCumId = Number(transferToCum);

    return users.filter((u: any) =>
      (u.cums ?? []).some((c: any) => Number(c.id) === selectedCumId)
    );
  }, [users, transferToCum]);

  const openTransferDialog = async (row: any) => {
    await ensureTransferUsers();
    setOpenTransfer({ open: true, row });
    setTransferToCum(row?.cum_id ? String(row.cum_id) : '');
    setTransferToUser('');
    setTransferNote('');
  };

  const submitTransfer = async () => {
    const row = openTransfer.row;
    if (!row) return;

    if (!transferToCum) {
      alert('Bắt buộc chọn cụm nhận.');
      return;
    }

    const payload: any = {
      cum_id: Number(transferToCum),
      ghi_chu: transferNote || undefined,
    };

    if (transferToUser) payload.user_id = Number(transferToUser);

    await transferAssignment(Number(row.id), payload);
    setOpenTransfer({ open: false, row: null });
    await loadData();
  };

  const openStatusDialog = (row: any) => {
    setOpenStatus({ open: true, row });
    setStatusValue((row?.trang_thai ?? 'dang_xu_ly') as TrangThaiCode);
    setStatusNote('');
  };

  const submitStatus = async () => {
    if (!openStatus.row) return;
    await quickUpdateTrangThai(Number(openStatus.row.id), statusValue, statusNote);
    setOpenStatus({ open: false, row: null });
    await loadData();
  };

  const openHistoryDialog = async (row: any) => {
    try {
      const data = await getYeuCauHistory(Number(row.id));
      const rows = data?.data ?? data ?? [];
      setHistoryOpen({
        open: true,
        id: Number(row.id),
        items: Array.isArray(rows) ? rows : [],
      });
    } catch (err: any) {
      alert(err?.message || 'Không lấy được lịch sử.');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 bg-slate-50 min-h-screen">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div>
            <div className="text-lg font-semibold">Quản lý yêu cầu</div>
            <div className="text-sm text-muted-foreground">
              Danh sách tác nghiệp chuyên sâu để tìm kiếm, lọc và xử lý yêu cầu.
            </div>
          </div>

          <div className="xl:ml-auto flex flex-col md:flex-row gap-2 w-full xl:w-auto">
            <div className="relative w-full md:w-[320px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Tìm theo nội dung / tên / SĐT..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <select
              className="border rounded-xl h-10 px-3 bg-white text-sm"
              value={cumId}
              onChange={(e) => setCumId(e.target.value)}
              disabled={loadingInit}
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
              className="border rounded-xl h-10 px-3 bg-white text-sm"
              value={statusSel}
              onChange={(e) => setStatusSel(e.target.value as TrangThaiCode | '')}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="tiep_nhan">Tiếp nhận</option>
              <option value="dang_xu_ly">Đang xử lý</option>
              <option value="da_chuyen_cum">Đã chuyển cụm</option>
              <option value="da_hoan_thanh">Đã hoàn thành</option>
              <option value="huy">Hủy</option>
            </select>

            <Button
              variant={assignedToMe ? 'default' : 'outline'}
              onClick={() => setAssignedToMe((v) => (v ? 0 : 1))}
            >
              {assignedToMe ? 'Đang lọc: Được giao' : 'Được giao tôi'}
            </Button>

            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Tải lại
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
            Trang: {page}/{lastPage}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
            Từ khóa: {qDebounced.trim() ? `“${qDebounced.trim()}”` : '—'}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
            Trạng thái: {statusSel || 'Tất cả'}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
            Cụm: {cumId || 'Tất cả'}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
            {assignedToMe ? 'Được giao: ON' : 'Được giao: OFF'}
          </span>
          {loading && (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
              Đang tải...
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-2xl p-4 bg-white animate-pulse">
              <div className="h-4 w-1/3 bg-slate-100 rounded" />
              <div className="mt-3 h-3 w-2/3 bg-slate-100 rounded" />
              <div className="mt-2 h-3 w-1/2 bg-slate-100 rounded" />
              <div className="mt-4 h-9 w-40 bg-slate-100 rounded" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="border rounded-2xl p-10 text-center bg-white shadow-sm">
            <div className="text-lg font-semibold">Không có dữ liệu</div>
            <div className="text-sm text-slate-500 mt-1">
              Thử đổi từ khóa hoặc bộ lọc hiện tại.
            </div>
          </div>
        ) : (
          items.map((r: any) => {
            const id = r.id;
            const ten = r.ten_nguoigui ?? r.ten ?? '—';
            const sdt = r.sdt_nguoigui ?? r.so_dien_thoai ?? '—';
            const nd = r.noi_dung ?? r.noidung ?? '(Không có nội dung)';
            const status = (r.trang_thai ?? 'tiep_nhan') as TrangThaiCode;
            const createdAt = r.created_at ?? null;
            const ui = STATUS_UI[status] ?? {
              label: status,
              cls: 'bg-gray-50 text-gray-700 border-gray-200',
            };

            return (
              <div
                key={id}
                className="border rounded-2xl p-4 bg-white hover:shadow-sm transition"
              >
                <div className="flex flex-col xl:flex-row xl:items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">#{id}</span>
                      <Badge variant="outline" className={`rounded-full ${ui.cls}`}>
                        {ui.label}
                      </Badge>

                      {!!createdAt && (
                        <span className="text-xs text-slate-500">
                          • {formatDateTimeVN(createdAt)} ({timeAgo(createdAt)} trước)
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-sm text-slate-700">
                      <span className="font-medium">{ten}</span>
                      <span className="text-slate-400"> • </span>
                      <span className="font-mono text-[13px]">{sdt}</span>
                    </div>

                    <div className="mt-2 text-sm text-slate-600 leading-6 line-clamp-3">
                      {typeof nd === 'string' ? highlight(nd, qDebounced) : nd}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="px-2 py-1 rounded-full bg-slate-100">
                        Cụm: {r.cum_id ?? '—'}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-100">
                        Giao cho: {r.duoc_giao_cho ?? '—'}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-100">
                        Loại: {r.loai ?? '—'}
                      </span>
                    </div>

                    {r.lat != null && r.lng != null && (
                      <a
                        className="inline-flex items-center mt-3 text-sm underline text-slate-700 hover:text-black"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://maps.google.com/?q=${r.lat},${r.lng}`}
                      >
                        <MapPin className="w-4 h-4 mr-1" />
                        Mở Google Maps
                      </a>
                    )}
                  </div>

                  <div className="flex flex-wrap xl:flex-col gap-2 xl:items-end shrink-0">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedRow(r);
                        setDetailOpen(true);
                      }}
                    >
                      Xem chi tiết
                    </Button>

                    {r.permissions?.can_claim && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            if (!confirm(`Bạn muốn nhận xử lý yêu cầu #${id}?`)) return;
                            await claimYeuCau(Number(id));
                            await loadData();
                          } catch (err: any) {
                            alert(err?.message || 'Không thể nhận xử lý.');
                          }
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Nhận xử lý
                      </Button>
                    )}

                    {r.permissions?.can_transfer && (
                      <Button variant="outline" onClick={() => openTransferDialog(r)}>
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Chuyển xử lý
                      </Button>
                    )}

                    {r.permissions?.can_update_status && (
                      <Button onClick={() => openStatusDialog(r)}>
                        Cập nhật trạng thái
                      </Button>
                    )}

                    {r.permissions?.can_view_history && (
                      <Button variant="outline" onClick={() => openHistoryDialog(r)}>
                        <ClipboardList className="w-4 h-4 mr-2" />
                        Lịch sử
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border rounded-2xl p-3 bg-white shadow-sm">
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={loading || page <= 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Trang trước
        </Button>

        <div className="text-sm text-slate-600">
          Trang <b>{page}</b> / <b>{lastPage}</b>
        </div>

        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          disabled={loading || page >= lastPage}
        >
          Trang sau
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <Sheet
        open={detailOpen && !!selectedRow}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setSelectedRow(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-auto">
          <SheetHeader>
            <SheetTitle>Chi tiết yêu cầu #{selectedRow?.id ?? ''}</SheetTitle>
          </SheetHeader>

          {selectedRow && (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border bg-white p-4 space-y-2">
                <div className="text-sm">
                  <b>Người gửi:</b> {selectedRow.ten_nguoigui ?? selectedRow.ten ?? '—'}
                </div>
                <div className="text-sm">
                  <b>SĐT:</b> {selectedRow.sdt_nguoigui ?? selectedRow.so_dien_thoai ?? '—'}
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  <b>Nội dung:</b> {selectedRow.noi_dung ?? selectedRow.noidung ?? '—'}
                </div>
                <div className="text-sm">
                  <b>Trạng thái:</b>{' '}
                  {STATUS_UI[(selectedRow.trang_thai ?? 'tiep_nhan') as TrangThaiCode]?.label ??
                    selectedRow.trang_thai}
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
                <div className="text-sm">
                  <b>Thời gian tạo:</b> {formatDateTimeVN(selectedRow.created_at)}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedRow.permissions?.can_claim && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        if (!confirm(`Bạn muốn nhận xử lý yêu cầu #${selectedRow.id}?`)) return;
                        await claimYeuCau(Number(selectedRow.id));
                        await loadData();
                        setDetailOpen(false);
                      } catch (err: any) {
                        alert(err?.message || 'Không thể nhận xử lý.');
                      }
                    }}
                  >
                    Nhận xử lý
                  </Button>
                )}

                {selectedRow.permissions?.can_transfer && (
                  <Button
                    variant="outline"
                    onClick={() => openTransferDialog(selectedRow)}
                  >
                    Chuyển xử lý
                  </Button>
                )}

                {selectedRow.permissions?.can_update_status && (
                  <Button onClick={() => openStatusDialog(selectedRow)}>
                    Cập nhật trạng thái
                  </Button>
                )}

                {selectedRow.permissions?.can_view_history && (
                  <Button
                    variant="outline"
                    onClick={() => openHistoryDialog(selectedRow)}
                  >
                    Lịch sử
                  </Button>
                )}
              </div>
            </div>
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
              Bắt buộc chọn cụm. Nếu chọn thêm người thì yêu cầu sẽ được giao đích danh cho người đó trong cụm đã chọn.
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Cụm nhận</label>
                <select
                  className="mt-1 border rounded-xl h-10 px-3 w-full bg-white"
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
                  className="mt-1 border rounded-xl h-10 px-3 w-full bg-white disabled:bg-slate-100 disabled:text-slate-500"
                  value={transferToUser}
                  onChange={(e) => setTransferToUser(e.target.value)}
                  disabled={loadingTransferUsers}
                >
                  <option value="">
                    {loadingTransferUsers
                      ? 'Đang tải danh sách người nhận...'
                      : '— Chỉ chuyển về cụm —'}
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
              onClick={() => setOpenTransfer({ open: false, row: null })}
            >
              Hủy
            </Button>
            <Button onClick={submitTransfer}>Chuyển</Button>
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
                className="mt-1 w-full h-10 px-3 border rounded-xl bg-white"
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
              onClick={() => setOpenStatus({ open: false, row: null })}
            >
              Hủy
            </Button>
            <Button onClick={submitStatus}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={historyOpen.open}
        onOpenChange={(o) => setHistoryOpen((v) => ({ ...v, open: o }))}
      >
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
                    {h.created_at ? formatDateTimeVN(h.created_at) : ''}
                  </div>
                  <div className="ml-auto text-xs">
                    {h.nguoi_thuc_hien ?? h.user?.name ?? ''}
                  </div>
                </div>

                {(h.mo_ta_hien_thi || h.ghi_chu) && (
                  <div className="mt-1 whitespace-pre-wrap">
                    {h.mo_ta_hien_thi || h.ghi_chu}
                  </div>
                )}
              </div>
            ))}

            {!historyOpen.items?.length && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Chưa có lịch sử.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
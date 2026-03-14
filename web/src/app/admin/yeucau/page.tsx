'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AssignSheet from '@/components/AssignSheet';
import { listYeuCauAdmin } from '@/lib/api';

type TrangThai =
  | 'tiep_nhan'
  | 'dang_xu_ly'
  | 'da_chuyen_cum'
  | 'da_hoan_thanh'
  | 'huy'
  | string;

function useDebounce<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ✅ label + màu cho trạng thái
const STATUS_UI: Record<
  string,
  { label: string; cls: string; dot: string }
> = {
  tiep_nhan: {
    label: 'Tiếp nhận',
    cls: 'bg-sky-50 text-sky-700 ring-sky-200',
    dot: 'bg-sky-500',
  },
  dang_xu_ly: {
    label: 'Đang xử lý',
    cls: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
  },
  da_chuyen_cum: {
    label: 'Đã chuyển cụm',
    cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    dot: 'bg-indigo-500',
  },
  da_hoan_thanh: {
    label: 'Hoàn thành',
    cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  huy: {
    label: 'Hủy',
    cls: 'bg-rose-50 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
  },
};

function StatusBadge({ status }: { status: TrangThai }) {
  const ui = STATUS_UI[status] || {
    label: status || '—',
    cls: 'bg-gray-50 text-gray-700 ring-gray-200',
    dot: 'bg-gray-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${ui.cls}`}
      title={String(status)}
    >
      <span className={`h-2 w-2 rounded-full ${ui.dot}`} />
      {ui.label}
    </span>
  );
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

// highlight keyword trong nội dung (nhẹ, đẹp khi demo)
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

export default function YeuCauPage() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const qDebounced = useDebounce(q, 400);

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{ assigned_to_me?: 0 | 1 }>({});
  const [loading, setLoading] = useState(false);
  const filtersKey = useMemo(() => JSON.stringify(filters || {}), [filters]);

  const abortRef = useRef<AbortController | null>(null);

  // ✅ 1 sheet
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignId, setAssignId] = useState<number | null>(null);

  useEffect(() => setPage(1), [qDebounced, filtersKey]);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ac;

    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const d = await listYeuCauAdmin(
          { q: qDebounced, page, ...filters },
          { signal: ac.signal, cache: 'no-store' }
        );

        if (!alive || ac.signal.aborted) return;

        const list = d?.data ?? d?.items ?? d ?? [];
        setItems(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (ac.signal.aborted) return;
        console.error(e?.message || e);
      } finally {
        if (!alive || ac.signal.aborted) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [qDebounced, page, filtersKey]);

  const toggleAssigned = () => {
    setFilters((s) => ({ ...s, assigned_to_me: s.assigned_to_me ? 0 : 1 }));
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold">Quản lý yêu cầu</div>
          <div className="text-sm text-gray-500">
            Tìm kiếm, lọc và phân công xử lý nhanh.
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <Input
            placeholder="Tìm theo nội dung / tên / SĐT..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-[320px] max-w-full"
          />
          <Button
            variant={filters.assigned_to_me ? 'default' : 'outline'}
            onClick={toggleAssigned}
          >
            {filters.assigned_to_me ? 'Đang lọc: Được giao' : 'Được giao'}
          </Button>
        </div>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
          Trang: {page}
        </span>
        {qDebounced.trim() ? (
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            Từ khoá: “{qDebounced.trim()}”
          </span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            Từ khoá: —
          </span>
        )}
        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
          {filters.assigned_to_me ? 'Được giao: ON' : 'Được giao: OFF'}
        </span>
        {loading && (
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            Đang tải…
          </span>
        )}
      </div>

      {/* List */}
      <div className="grid gap-3">
        {loading ? (
          // Skeleton
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border rounded-2xl p-4 animate-pulse bg-white"
            >
              <div className="h-4 w-1/3 bg-gray-100 rounded" />
              <div className="mt-3 h-3 w-2/3 bg-gray-100 rounded" />
              <div className="mt-2 h-3 w-1/2 bg-gray-100 rounded" />
              <div className="mt-4 h-8 w-24 bg-gray-100 rounded" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="border rounded-2xl p-8 text-center bg-white">
            <div className="text-lg font-semibold">Không có dữ liệu</div>
            <div className="text-sm text-gray-500 mt-1">
              Thử đổi từ khoá hoặc tắt bộ lọc “Được giao”.
            </div>
          </div>
        ) : (
          items.map((r: any) => {
            const id = r.id;
            const ten = r.ten_nguoigui ?? '—';
            const sdt = r.sdt_nguoigui ?? '—';
            const nd = r.noi_dung ?? r.noidung ?? '(Không có nội dung)';
            const status: TrangThai = r.trang_thai ?? '—';
            const createdAt = r.created_at ?? r.tao_luc ?? null;

            return (
              <div
                key={id}
                className="border rounded-2xl p-4 bg-white hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/* line 1 */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">#{id}</span>
                      <StatusBadge status={status} />
                      {!!createdAt && (
  <span className="text-xs text-gray-500">
    • {formatDateTimeVN(createdAt)} ({timeAgo(createdAt)} trước)
  </span>
)}
                    </div>

                    {/* line 2 */}
                    <div className="mt-1 text-sm text-gray-700">
                      <span className="font-medium">{ten}</span>
                      <span className="text-gray-400"> • </span>
                      <span className="font-mono text-[13px]">{sdt}</span>
                    </div>

                    {/* content */}
                    <div className="mt-2 text-sm text-gray-600 leading-6 line-clamp-3">
                      {typeof nd === 'string' ? highlight(nd, qDebounced) : nd}
                    </div>

                    {/* map */}
                    {r.lat && r.lng && (
                      <a
                        className="inline-flex mt-2 text-sm underline text-gray-700 hover:text-black"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://maps.google.com/?q=${r.lat},${r.lng}`}
                      >
                        Mở Google Map
                      </a>
                    )}
                  </div>

                  {/* actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAssignId(id);
                        setAssignOpen(true);
                      }}
                    >
                      Giao
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2 border rounded-2xl p-3 bg-white">
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={loading || page <= 1}
        >
          Trang trước
        </Button>

        <div className="text-sm text-gray-600">
          Trang <b>{page}</b>
        </div>

        <Button
          variant="outline"
          onClick={() => setPage((p) => p + 1)}
          disabled={loading}
        >
          Trang sau
        </Button>
      </div>

      {/* 1 sheet duy nhất */}
      {assignId !== null && (
        <AssignSheet
          yeuCauId={assignId}
          open={assignOpen}
          onOpenChange={setAssignOpen}
          onDone={() => setAssignOpen(false)}
          hideTrigger
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
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
    claimYeuCau,              // ← thêm import
} from '@/lib/api';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// MapView cũ (đã cập nhật nhận onTransfer & onClaim)
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
import type { MapPoint, TrangThaiCode, Media } from '@/components/MapView';

const IS_ADMIN = process.env.NEXT_PUBLIC_IS_ADMIN === 'true';
const STYLE_URL =
    process.env.NEXT_PUBLIC_VIETMAP_STYLE_BASE ||
    'https://maps.vietmap.vn/mt/tm/style.json';

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

export default function AdminDashboard() {
    // ====== bộ lọc / dữ liệu ======
    const [mode, setMode] = useState<'unassigned' | 'assigned' | 'all'>('unassigned');
    const [cumId, setCumId] = useState<string>('');
    const [statusSel, setStatusSel] = useState<'' | TrangThaiCode>(''); // giữ kiểu cũ

    const [clusters, setClusters] = useState<any>([]);
    const [users, setUsers] = useState<any[]>([]);

    const [stats, setStats] = useState<any>(null);
    const [yc, setYc] = useState<any[]>([]);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);

    // ====== map state (phù hợp MapView cũ) ======
    const [mapView, setMapView] = useState<{ center: [number, number]; zoom: number }>({
        center: [105.85, 21.03],
        zoom: 12,
    });
    const [selectedId, setSelectedId] = useState<number | null>(null);

    // ====== chuyển xử lý dialog ======
    const [openTransfer, setOpenTransfer] = useState<{ open: boolean; row: any | null }>({
        open: false,
        row: null,
    });
    const [transferToUser, setTransferToUser] = useState<string>(''); // id
    const [transferToCum, setTransferToCum] = useState<string>(''); // id
    const [transferNote, setTransferNote] = useState('');

    // ====== cập nhật trạng thái dialog ======
    const [openStatus, setOpenStatus] = useState<{ open: boolean; row: any | null }>({
        open: false,
        row: null,
    });
    const [statusValue, setStatusValue] = useState<TrangThaiCode>('dang_xu_ly');
    const [statusNote, setStatusNote] = useState('');

    // ====== lịch sử dialog ======
    const [historyOpen, setHistoryOpen] = useState<{ open: boolean; items: any[]; id: number | null }>({
        open: false,
        items: [],
        id: null,
    });

    // ====== lightbox ======
    const [lbOpen, setLbOpen] = useState(false);
    const [lbItems, setLbItems] = useState<Media[]>([]);
    const [lbIndex, setLbIndex] = useState(0);
    const lbPrev = useCallback(() => setLbIndex((i) => (i - 1 + lbItems.length) % lbItems.length), [lbItems.length]);
    const lbNext = useCallback(() => setLbIndex((i) => (i + 1) % lbItems.length), [lbItems.length]);

    useEffect(() => {
        listClusters('').then((d) => setClusters(d.data || d));
        listUsers('').then((d) => setUsers(d.data || d));
    }, []);

    // Khi vào tab "Chưa phân công" thì mặc định lọc trạng thái = tiếp nhận (giữ hành vi bạn yêu cầu)
    useEffect(() => {
        if (mode === 'unassigned') setStatusSel('tiep_nhan');
    }, [mode]);

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, cumId, statusSel, page]);

    const reload = async () => {
        const params: any = { per_page: 100, page };
        if (mode === 'unassigned') params.chua_phan_cong = 1;
        if (mode === 'assigned') params.assigned_to_me = 1;
        if (cumId) params.cum_id = +cumId;
        if (statusSel) params.trang_thai = statusSel;

        const s = await thongKe(params);
        setStats(s);

        const list = await listYeuCauAdmin(params);
        const data = list.data ?? list;
        setYc(data.data ?? data);
        setTotalPages(data.last_page ?? list.last_page ?? 1);
    };

    // ====== build MapPoint[] cho MapView cũ ======
    const points: MapPoint[] = useMemo(
        () =>
            (yc ?? [])
                .filter((r: any) => r.lat != null && r.lng != null)
                .map((r: any) => {
                    const loai = String(r.loai || r.loai_yeu_cau || '').toLowerCase();

                    // Sửa xác định type media — đảm bảo ưu tiên đúng
                    const media: Media[] = (r.media || []).map((m: any) => {
                        const type: 'image' | 'video' =
                            m.type ?? ((m.mime || '').startsWith('image/') ? 'image' : 'video');
                        return { id: m.id, type, url: m.url };
                    });

                    const vattu =
                        (r.vattu_chi_tiet || []).map((vt: any) => ({
                            ten: vt?.vattu?.ten ?? vt.vattu_ten ?? 'Vật tư',
                            so_luong: vt.so_luong,
                            don_vi: vt.don_vi ?? vt?.vattu?.don_vi ?? '',
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
        [yc],
    );

    // ====== mở dialog chuyển xử lý ======
    const openTransferDialog = (row: any) => {
        setOpenTransfer({ open: true, row });
        setTransferToUser('');
        setTransferToCum('');
        setTransferNote('');
    };

    const submitTransfer = async () => {
        const r = openTransfer.row;
        if (!r) return;
        const payload: any = { ghi_chu: transferNote || undefined };
        if (transferToUser) payload.user_id = +transferToUser;
        if (!transferToUser && transferToCum) payload.cum_id = +transferToCum;
        if (!payload.user_id && !payload.cum_id) {
            alert('Chọn 1 người hoặc 1 cụm để chuyển.');
            return;
        }
        await transferAssignment(r.id, payload);
        setOpenTransfer({ open: false, row: null });
        reload();
    };

    // lightbox phím tắt
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

    // ====== helper vẽ Donut SVG ======
    const Donut = ({ value, total, size = 82 }: { value: number; total: number; size?: number }) => {
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
                <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="14" fontWeight={700}>
                    {Math.round(v * 100)}%
                </text>
            </svg>
        );
    };

    return (
        <div className="p-4 space-y-4">
            {/* FILTER */}
            <div className="flex flex-wrap items-center gap-2">
                <select
                    className="border rounded h-10 px-2"
                    value={cumId}
                    onChange={(e) => {
                        setCumId(e.target.value);
                        setPage(1);
                    }}
                >
                    <option value="">{IS_ADMIN ? '— Tất cả cụm —' : '— Cụm của tôi —'}</option>
                    {(((clusters as any)?.data) ?? clusters ?? []).map((c: any) => (
                        <option key={c.id} value={c.id}>
                            {c.ten}
                        </option>
                    ))}

                </select>

                <Button
                    variant={mode === 'unassigned' ? 'default' : 'outline'}
                    onClick={() => {
                        setMode('unassigned');
                        setPage(1);
                    }}
                >
                    Chưa phân công
                </Button>
                <Button
                    variant={mode === 'assigned' ? 'default' : 'outline'}
                    onClick={() => {
                        setMode('assigned');
                        setPage(1);
                    }}
                >
                    Được giao
                </Button>
                <Button
                    variant={mode === 'all' ? 'default' : 'outline'}
                    onClick={() => {
                        setMode('all');
                        setPage(1);
                    }}
                >
                    Toàn hệ thống
                </Button>

                <select
                    className="ml-auto border rounded h-10 px-2"
                    value={statusSel}
                    onChange={(e) => {
                        setStatusSel(e.target.value as any);
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

            {/* MAP + OVERLAY STATS */}
            <div className="relative rounded-xl border overflow-hidden">
                <MapView
                    styleUrl={STYLE_URL}
                    points={points}
                    view={mapView}
                    onViewChange={setMapView}
                    selectedId={selectedId}
                    onSelect={(id) => setSelectedId(id)}
                    onOpenMedia={(items, index) => {
                        setLbItems(items);
                        setLbIndex(index);
                        setLbOpen(true);
                    }}
                    // 👇 thêm 2 callback cho popup Map
                    onTransfer={(id) => {
                        const row = yc.find((r) => Number(r.id) === Number(id));
                        if (row) openTransferDialog(row);
                    }}
                    onClaim={async (id) => {
                        if (!confirm(`Bạn muốn nhận xử lý yêu cầu #${id}?`)) return;
                        await claimYeuCau(Number(id));
                        reload();
                    }}
                    className="h-[420px] md:h-[520px] w-full"
                    initialAutoLocate
                    hidePlaces
                />

                {stats && (
                    <div className="absolute left-4 top-4 flex flex-wrap gap-3 pointer-events-auto">
                        {/* card tổng */}
                        <div className="bg-white/90 backdrop-blur border rounded-xl p-3 flex items-center gap-3 shadow-sm">
                            <ClipboardList />
                            <div>
                                <div className="text-xs text-muted-foreground">Tổng số yêu cầu</div>
                                <div className="text-xl font-bold">{stats.tong_so_yeu_cau}</div>
                            </div>
                        </div>

                        {/* donut đã xử lý */}
                        <div className="bg-white/90 backdrop-blur border rounded-xl p-3 flex items-center gap-3 shadow-sm">
                            <Donut value={Number(stats.so_da_xu_ly || 0)} total={Number(stats.tong_so_yeu_cau || 0)} size={72} />
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Tỉ lệ hoàn thành</div>
                                <div className="text-sm">
                                    <span className="font-semibold">{stats.so_da_xu_ly}</span> đã xử lý /{' '}
                                    <span className="font-semibold">{stats.so_chua_xu_ly}</span> chưa xử lý
                                </div>
                            </div>
                        </div>

                        {/* bảng vật tư rút gọn */}
                        <div className="bg-white/90 backdrop-blur border rounded-xl p-3 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <Package2 className="w-4 h-4" />
                                <div className="text-sm font-semibold">Nhu yếu phẩm</div>
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">
                                Chưa xử lý: <b>{stats.vat_tu?.tong_nhu_yeu_pham_chua_xu_ly ?? 0}</b>
                            </div>
                            <div className="max-h-28 overflow-y-auto">
                                <table className="text-xs">
                                    <tbody>
                                    {(stats.vat_tu?.du_thieu || []).map((x: any, idx: number) => {
                                        const du = Number(x.du ?? 0);
                                        const label = du > 0 ? 'Dư' : du < 0 ? 'Thiếu' : 'Đủ';
                                        const color =
                                            du > 0
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : du < 0
                                                    ? 'bg-rose-100 text-rose-700'
                                                    : 'bg-slate-100 text-slate-700';
                                        return (
                                            <tr key={x.vattu_id ?? idx}>
                                                <td className="pr-2">#{x.vattu_id}</td>
                                                <td className="pr-2">{x.ton ?? 0}</td>
                                                <td className="pr-2">{x.can ?? 0}</td>
                                                <td className="pr-2">{du}</td>
                                                <td>
                                                    <span className={`px-2 py-0.5 rounded ${color}`}>{label}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* LIST */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">Danh sách yêu cầu</div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                            <ChevronLeft />
                        </Button>
                        <div className="text-sm">
                            {page} / {totalPages}
                        </div>
                        <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                            <ChevronRight />
                        </Button>
                    </div>
                </div>

                <div className="grid gap-2">
                    {yc.map((r: any) => {
                        const created = r.created_at ? new Date(r.created_at) : null;
                        const st = STATUS_MAP[(r.trang_thai as TrangThaiCode) ?? 'tiep_nhan'] ?? STATUS_MAP.tiep_nhan;

                        return (
                            <div
                                key={r.id}
                                className="border rounded p-3 grid md:grid-cols-12 gap-3 hover:bg-black/[0.02] cursor-pointer"
                                onClick={() => {
                                    setSelectedId(Number(r.id));
                                    if (r.lng && r.lat) {
                                        setMapView({ center: [Number(r.lng), Number(r.lat)], zoom: 15 });
                                    }
                                }}
                            >
                                {/* MEDIA */}
                                <div className="md:col-span-3">
                                    {r.media?.length ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {r.media.map((m: any, idx: number) => {
                                                const key = m.id ?? m.media_id ?? m.url ?? `m-${r.id}-${idx}`;
                                                const isImage = m.type === 'image' || (m.mime ?? '').startsWith('image/');
                                                return isImage ? (
                                                    <button
                                                        key={key}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const items: Media[] = (r.media || []).map((mm: any) => {
                                                                const type: 'image' | 'video' =
                                                                    mm.type ?? ((mm.mime || '').startsWith('image/') ? 'image' : 'video');
                                                                return { id: mm.id, type, url: mm.url };
                                                            });
                                                            setLbItems(items);
                                                            setLbIndex(idx);
                                                            setLbOpen(true);
                                                        }}
                                                    >
                                                        <Image
                                                            src={m.url}
                                                            alt=""
                                                            width={320}
                                                            height={240}
                                                            className="w-full aspect-video object-cover rounded-md"
                                                        />
                                                    </button>
                                                ) : (
                                                    <button
                                                        key={key}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const items: Media[] = (r.media || []).map((mm: any) => {
                                                                const type: 'image' | 'video' =
                                                                    mm.type ?? ((mm.mime || '').startsWith('image/') ? 'image' : 'video');
                                                                return { id: mm.id, type, url: mm.url };
                                                            });
                                                            setLbItems(items);
                                                            setLbIndex(idx);
                                                            setLbOpen(true);
                                                        }}
                                                    >
                                                        <video src={m.url} className="w-full aspect-video rounded-md bg-black/10" muted />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="w-full aspect-video rounded-md bg-black/5 grid place-items-center text-xs text-muted-foreground">
                                            Không media
                                        </div>
                                    )}
                                </div>

                                <div className="md:col-span-6 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="font-medium">
                                            #{r.id} – {r.ten ?? r.ten_nguoigui} – {r.so_dien_thoai ?? r.sdt_nguoigui}
                                        </div>
                                        {r.lat && r.lng && (
                                            <a
                                                className="ml-auto opacity-80 hover:opacity-100"
                                                onClick={(e) => { e.stopPropagation(); }}
                                                target="_blank"
                                                href={`https://maps.google.com/?q=${r.lat},${r.lng}`}
                                                title="Mở Google Maps"
                                            >
                                                <MapPin className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                    <div className="text-sm">{r.noi_dung ?? r.noidung}</div>

                                    {!!r.vattu_chi_tiet?.length && (
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {r.vattu_chi_tiet.map((vt: any, i: number) => (
                                                <span
                                                    key={vt.id || `${vt.vattu_id}-${i}`}
                                                    className="px-2 py-0.5 rounded-full border text-xs bg-slate-50"
                                                    title={`${vt?.vattu?.ten ?? vt.vattu_ten ?? 'Vật tư'}`}
                                                >
                          {(vt?.vattu?.ten ?? vt.vattu_ten ?? 'Vật tư')}
                                                    {vt.so_luong ? ` × ${vt.so_luong}` : ''}
                                                    {vt.don_vi || vt?.vattu?.don_vi ? ` ${vt.don_vi ?? vt?.vattu?.don_vi}` : ''}
                        </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="md:col-span-3 flex flex-col items-end gap-2">
                                    <Badge variant={st.variant}>{st.label}</Badge>
                                    <div className="text-xs text-muted-foreground">{created ? created.toLocaleString() : ''}</div>

                                    {/* Hàng nút thao tác */}
                                    <div className="flex gap-2">
                                        {/* Nhận xử lý (thêm mới) */}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (!confirm('Bạn có chắc muốn nhận xử lý yêu cầu này?')) return;
                                                await claimYeuCau(Number(r.id));
                                                reload();
                                            }}
                                        >
                                            Nhận xử lý
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openTransferDialog(r);
                                            }}
                                        >
                                            Chuyển xử lý
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenStatus({ open: true, row: r });
                                                setStatusValue((r.trang_thai as TrangThaiCode) ?? 'dang_xu_ly');
                                                setStatusNote('');
                                            }}
                                        >
                                            Cập nhật
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
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
                                            Lịch sử
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* DIALOG chuyển xử lý */}
            <Dialog open={openTransfer.open} onOpenChange={(o) => setOpenTransfer((v) => ({ open: o, row: o ? v.row : null }))}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Chuyển xử lý yêu cầu #{openTransfer.row?.id}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <div className="text-sm text-muted-foreground">
                            Chọn 1 trong 2: chuyển cho <b>một người</b> hoặc <b>một cụm</b>.
                        </div>

                        <div className="grid md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">Người nhận</label>
                                <select
                                    className="mt-1 border rounded h-10 px-2 w-full"
                                    value={transferToUser}
                                    onChange={(e) => {
                                        setTransferToUser(e.target.value);
                                        if (e.target.value) setTransferToCum('');
                                    }}
                                >
                                    <option value="">— Không chọn —</option>
                                    {users.map((u: any) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name} ({u.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Cụm nhận</label>
                                <select
                                    className="mt-1 border rounded h-10 px-2 w-full"
                                    value={transferToCum}
                                    onChange={(e) => {
                                        setTransferToCum(e.target.value);
                                        if (e.target.value) setTransferToUser('');
                                    }}
                                >
                                    <option value="">— Không chọn —</option>
                                    {(clusters?.data ?? clusters)?.map((c: any) => (
                                        <option key={c.id} value={c.id}>
                                            {c.ten}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Ghi chú</label>
                            <Textarea className="mt-1" value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Nhập ghi chú (tùy chọn)" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenTransfer({ open: false, row: null })}>
                            Hủy
                        </Button>
                        <Button onClick={submitTransfer}>Chuyển</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DIALOG cập nhật trạng thái */}
            <Dialog open={openStatus.open} onOpenChange={(o) => setOpenStatus((v) => ({ open: o, row: o ? v.row : null }))}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Cập nhật trạng thái yêu cầu #{openStatus.row?.id}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-3">
                        <div>
                            <label className="text-sm font-medium">Trạng thái</label>
                            <select className="mt-1 w-full h-10 px-2 border rounded" value={statusValue} onChange={(e) => setStatusValue(e.target.value as TrangThaiCode)}>
                                <option value="tiep_nhan">Tiếp nhận</option>
                                <option value="dang_xu_ly">Đang xử lý</option>
                                <option value="da_chuyen_cum">Đã chuyển cụm</option>
                                <option value="da_hoan_thanh">Đã hoàn thành</option>
                                <option value="huy">Hủy</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Ghi chú</label>
                            <Textarea className="mt-1" placeholder="Nhập ghi chú để lưu lịch sử" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenStatus({ open: false, row: null })}>
                            Hủy
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!openStatus.row) return;
                                await quickUpdateTrangThai(openStatus.row.id, statusValue as any, statusNote);
                                setOpenStatus({ open: false, row: null });
                                reload();
                            }}
                        >
                            Lưu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DIALOG lịch sử */}
            <Dialog open={historyOpen.open} onOpenChange={(o) => setHistoryOpen((v) => ({ ...v, open: o }))}>
                <DialogContent className="sm:max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle>Lịch sử xử lý yêu cầu #{historyOpen.id ?? ''}</DialogTitle>
                    </DialogHeader>

                    <div className="max-h-[60vh] overflow-auto divide-y">
                        {(historyOpen.items || []).map((h: any, idx: number) => (
                            <div key={h.id ?? idx} className="py-3 text-sm">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">{h.trang_thai_hien_thi ?? h.trang_thai ?? ''}</Badge>
                                    <div className="text-xs text-muted-foreground">
                                        {h.created_at ? new Date(h.created_at).toLocaleString() : ''}
                                    </div>
                                    <div className="ml-auto text-xs">{h.user?.name ?? h.nguoi_thuc_hien ?? ''}</div>
                                </div>
                                {h.ghi_chu ? <div className="mt-1 whitespace-pre-wrap">{h.ghi_chu}</div> : null}
                            </div>
                        ))}
                        {!historyOpen.items?.length && (
                            <div className="py-6 text-center text-sm text-muted-foreground">Chưa có lịch sử.</div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* LIGHTBOX */}
            {lbOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                    <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLbOpen(false)} title="Đóng">
                        <X />
                    </button>
                    <button className="absolute left-4 text-white/80 hover:text-white" onClick={lbPrev} title="Trước">
                        <ArrowLeft />
                    </button>
                    <button className="absolute right-12 text-white/80 hover:text-white" onClick={lbNext} title="Sau">
                        <ArrowRight />
                    </button>
                    <div className="max-w-5xl w-full px-6">
                        {(() => {
                            const m = lbItems[lbIndex];
                            if (!m) return null;
                            return m.type === 'image' ? (
                                <img src={m.url} alt="" className="w-full max-h-[80vh] object-contain rounded-lg" />
                            ) : (
                                <video src={m.url} className="w-full max-h-[80vh] rounded-lg" controls autoPlay />
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}

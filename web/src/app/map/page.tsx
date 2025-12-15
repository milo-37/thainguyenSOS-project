'use client';
import { useEffect, useState } from 'react';
import MapView, { MapPoint, Media, TrangThaiCode } from '@/components/MapView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { MapPin, SquareArrowOutUpRight } from 'lucide-react';

const BASE = process.env.NEXT_PUBLIC_VIETMAP_STYLE_BASE!;
const IS_ADMIN = process.env.NEXT_PUBLIC_IS_ADMIN === 'true';

const STATUS_ENTRIES: Array<{code:TrangThaiCode; label:string}> = [
    { code:'tiep_nhan',     label:'Tiếp nhận' },
    { code:'dang_xu_ly',    label:'Đang xử lý' },
    { code:'da_chuyen_cum', label:'Đã chuyển cụm' },
    { code:'da_hoan_thanh', label:'Đã hoàn thành' },
    { code:'huy',           label:'Hủy' },
];

// ==== helper hiển thị "x phút trước" ====
function timeAgo(iso?: string) {
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

export default function MapPage(){
    const [points, setPoints] = useState<MapPoint[]>([]);
    const [view, setView]   = useState<{center:[number,number]; zoom:number}>({ center:[105.85,21.03], zoom:5 });
    const [type, setType]   = useState<'all'|'cuu_nguoi'|'nhu_yeu_pham'>('all');
    const [q, setQ]         = useState('');
    const [hidePOI, setHidePOI] = useState(false);

    const [sheetOpen, setSheetOpen] = useState(false);
    const [timeRange, setTimeRange] = useState<number|null>(null);
    const [radius, setRadius] = useState<number>(50);

    const [statusFilter, setStatusFilter] = useState<TrangThaiCode[]>(['tiep_nhan']);

    const [lightbox, setLightbox] = useState<{items:Media[], index:number} | null>(null);
    const [selectedId, setSelectedId] = useState<number|null>(null);

    // 🔐 Theo "cách như menu trên": tự phát hiện đăng nhập bằng localStorage
    const [authed, setAuthed] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const check = () => setAuthed(!!localStorage.getItem('token'));
        check();
        window.addEventListener('storage', check); // sync giữa các tab
        return () => window.removeEventListener('storage', check);
    }, []);

    // Nếu KHÔNG đăng nhập, khóa bộ lọc trạng thái về 'tiep_nhan'
    useEffect(() => {
        if (!authed) setStatusFilter(['tiep_nhan']);
    }, [authed]);

    const api = (path:string, init?:RequestInit)=> fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, init);

    const load = async ()=>{
        const qs = new URLSearchParams();
        if (type!=='all') qs.set('loai', type);
        if (q.trim()) qs.set('q', q.trim());
        if (typeof timeRange === 'number' && timeRange > 0) qs.set('hours', String(timeRange));
        qs.set('radius', String(radius));
        qs.set('center', `${view.center[1]},${view.center[0]}`);

        // chỉ member mới được truyền trạng thái đã chọn
        const listStatus = authed ? statusFilter : ['tiep_nhan'];
        qs.set('trang_thai', listStatus.join(','));

        const r = await api(`/yeucau?${qs.toString()}`, { cache:'no-store' });
        const data = await r.json();

        const pts:MapPoint[] = (data?.data || data || []).map((it:any)=>({
            id: it.id,
            lat: it.lat, lng: it.lng,
            loai: it.loai, trang_thai: it.trang_thai as TrangThaiCode,
            ten: it.ten_nguoigui, sdt: it.sdt_nguoigui,
            noidung: it.noidung, so_nguoi: it.so_nguoi,
            vattu: (it.vattu||[]).map((v:any)=>({ ten:v.ten, so_luong:v.so_luong, don_vi:v.don_vi })),
            media: (it.media||[]) as Media[],
            createdAt: it.created_at || it.tao_luc || null,
        }));
        setPoints(pts);
    };

    useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [type, timeRange, radius, statusFilter, authed]);
    useEffect(()=>{
        const t = setTimeout(()=> load(), 500);
        return ()=> clearTimeout(t);
        // eslint-disable-next-line
    }, [q]);

    const onSelect = (id:number)=> window.open(`/xemyeucau/${id}`, '_blank');
    const focusAndOpen = (p:MapPoint)=>{ setView(v=>({ center:[p.lng,p.lat], zoom: Math.max(v.zoom, 14) })); setSelectedId(p.id); };
    const statusLabel = (code:TrangThaiCode)=> STATUS_ENTRIES.find(s=>s.code===code)?.label || code;
    const toggleStatus = (code:TrangThaiCode)=>{
        if (!authed) return; // khách không được bật/tắt
        setStatusFilter(prev=> prev.includes(code) ? prev.filter(x=>x!==code) as TrangThaiCode[] : [...prev, code] as TrangThaiCode[]);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-6">
            {/* MAP */}
            <div className="relative rounded-2xl overflow-hidden border">
                <div className="absolute left-1/2 -translate-x-1/2 top-3 z-[5] flex gap-2 bg-white/90 backdrop-blur rounded-full p-1 shadow">
                    {(['all','cuu_nguoi','nhu_yeu_pham'] as const).map(t=>(
                        <button
                            key={t}
                            className={`px-3 py-1 rounded-full text-sm ${type===t?'bg-black text-white':'hover:bg-gray-100'}`}
                            onClick={()=> setType(t)}
                        >
                            {t==='all'?'🛟 Tất cả':t==='cuu_nguoi'?' 🚑 Cứu người':'📦 Nhu yếu phẩm'}
                        </button>
                    ))}
                </div>

                <MapView
                    styleUrl={BASE}
                    points={points}
                    view={view}
                    onViewChange={setView}
                    onSelect={onSelect}
                    hidePlaces={hidePOI}
                    selectedId={selectedId}
                    onOpenMedia={(items, index)=> setLightbox({ items, index })}
                />
            </div>

            {/* PANEL PHẢI */}
            <div className="rounded-2xl border p-3 flex flex-col h-[calc(100vh-100px)]">
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Tìm kiếm sự kiện..."
                        value={q}
                        onChange={(e)=>setQ(e.target.value)}
                        onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); load(); } }}
                    />

                    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                        <SheetTrigger asChild><Button variant="outline">Bộ lọc</Button></SheetTrigger>
                        <SheetContent side="right" className="w-[420px] p-6">
                            <SheetHeader><SheetTitle>Bộ lọc sự kiện</SheetTitle></SheetHeader>
                            <div className="mt-4 grid gap-5">

                                {/* Thời gian */}
                                <div className="grid gap-2">
                                    <div className="text-sm font-medium">Khoảng thời gian</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            className={`px-3 py-2 rounded-lg border ${timeRange===null?'bg-black text-white border-black':''}`}
                                            onClick={()=>setTimeRange(null)}
                                        >Tất cả</button>
                                        {[1,3,6,12,24,48,72].map(h=>(
                                            <button key={h}
                                                    className={`px-3 py-2 rounded-lg border ${timeRange===h?'bg-black text-white border-black':''}`}
                                                    onClick={()=>setTimeRange(h)}
                                            >{h} giờ</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Khoảng cách */}
                                <div className="grid gap-2">
                                    <div className="text-sm font-medium">Khoảng cách</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[1,5,10,50,100,200].map(km=>(
                                            <button key={km}
                                                    className={`px-3 py-2 rounded-lg border ${radius===km?'bg-black text-white border-black':''}`}
                                                    onClick={()=>setRadius(km)}
                                            >{km} km</button>
                                        ))}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">* Lọc theo bán kính từ vị trí bản đồ hiện tại.</div>
                                </div>

                                {/* 🔐 Trạng thái: chỉ tương tác khi đã đăng nhập */}
                                <div className="grid gap-2">
                                    <div className="text-sm font-medium flex items-center justify-between">
                                        <span>Trạng thái</span>
                                        {!authed && <span className="text-xs text-gray-500">Đăng nhập để lọc</span>}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        {STATUS_ENTRIES.map(s=>(
                                            <button
                                                key={s.code}
                                                className={`px-3 py-2 rounded-lg border text-left ${
                                                    statusFilter.includes(s.code)?'bg-black text-white border-black':''
                                                } ${!authed ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                onClick={()=>toggleStatus(s.code)}
                                                title={s.code}
                                                disabled={!authed}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={()=>setStatusFilter(['tiep_nhan'])}>
                                            Chỉ “Tiếp nhận”
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={()=> authed
                                                ? setStatusFilter(STATUS_ENTRIES.map(s=>s.code))
                                                : setStatusFilter(['tiep_nhan'])
                                            }
                                            disabled={!authed}
                                        >
                                            Tất cả
                                        </Button>
                                    </div>
                                </div>

                                {/* Ẩn POI */}
                                <div className="flex items-center justify-between border rounded-lg p-3">
                                    <div>Ẩn địa điểm (Bệnh viện, Trạm xăng,…)</div>
                                    <input type="checkbox" checked={hidePOI} onChange={(e)=>setHidePOI(e.target.checked)} />
                                </div>

                                <Button onClick={()=>{ setSheetOpen(false); load(); }}>Áp dụng</Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                {/* Tags filter */}
                <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{type==='all'?'Tất cả': type==='cuu_nguoi'?'Cứu người':'Cứu trợ'}</Badge>
                    {timeRange!==null ? <Badge variant="secondary">{timeRange}h</Badge> : <Badge variant="secondary">Tất cả</Badge>}
                    <Badge variant="secondary">{radius} km</Badge>
                    {authed
                        ? <Badge variant="secondary">Trạng thái: {statusFilter.map(s=>STATUS_ENTRIES.find(x=>x.code===s)?.label).join(', ')}</Badge>
                        : <Badge variant="secondary">Trạng thái: Tiếp nhận</Badge>}
                    {hidePOI && <Badge variant="secondary">Ẩn POI</Badge>}
                </div>

                {/* LIST */}
                <div className="mt-3 overflow-auto divide-y flex-1 pr-1">
                    {points.map(p => (
                        <div
                            key={p.id}
                            className="relative py-3 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                            title="Bấm để xem trên bản đồ"
                            onClick={() => focusAndOpen(p)}
                        >
                            {/* góc phải */}
                            <div className="absolute right-0 top-2 flex items-center gap-1">
                <span
                    className="inline-flex items-center px-2 py-[2px] rounded-full text-white text-[12px]"
                    style={{
                        background:
                            p.trang_thai === 'tiep_nhan' ? '#0ea5e9' :
                                p.trang_thai === 'dang_xu_ly' ? '#f59e0b' :
                                    p.trang_thai === 'da_chuyen_cum' ? '#6366f1' :
                                        p.trang_thai === 'da_hoan_thanh' ? '#10b981' : '#ef4444',
                    }}
                >
                  {statusLabel(p.trang_thai)}
                </span>

                                <Button size="icon" variant="ghost" title="Xem trên bản đồ"
                                        onClick={(e) => { e.stopPropagation(); focusAndOpen(p); }}>
                                    <MapPin className="h-5 w-5" />
                                </Button>

                                {/* 🔒 Chỉ admin mới thấy nút Chi tiết */}
                                {IS_ADMIN && (
                                    <Button size="icon" variant="ghost" title="Chi tiết"
                                            onClick={(e) => { e.stopPropagation(); onSelect(p.id); }}>
                                        <SquareArrowOutUpRight className="h-5 w-5" />
                                    </Button>
                                )}
                            </div>

                            {/* dòng trên */}
                            <div className="text-[12px] text-gray-500 flex items-center gap-2 flex-wrap">
                                <span>#{p.id}</span>
                                <span className="inline-flex items-center px-2 py-[2px] rounded-full text-white text-[12px]"
                                      style={{ background: p.loai === 'cuu_nguoi' ? '#ef4444' : '#2563eb' }}>
                  {p.loai === 'cuu_nguoi' ? 'Cứu người' : 'Cứu trợ'}
                </span>
                                {!!p.createdAt && <span>• {timeAgo(p.createdAt)}</span>}
                            </div>

                            <div className="mt-1 text-[15px] font-semibold leading-5">
                                {p.noidung || '(Không có nội dung)'}
                            </div>

                            <div className="pr-28 mt-1 text-sm text-gray-600">
                                {p.ten || '—'} • {p.sdt || '—'} • {p.so_nguoi || 0} người
                            </div>

                            {p.media?.length ? (
                                <div className="mt-2 grid grid-cols-3 gap-2 pr-28">
                                    {p.media.map((m: any, idx: number) => {
                                        const key = m.id ?? m.media_id ?? m.url ?? m.duong_dan ?? `idx-${idx}`;
                                        return m.type === 'image' ? (
                                            <button
                                                key={key}
                                                onClick={(e) => { e.stopPropagation(); setLightbox({ items: p.media!, index: idx }); }}
                                            >
                                                <Image
                                                    src={m.url}
                                                    alt=""
                                                    width={600}
                                                    height={400}
                                                    className="w-full h-24 object-cover rounded-md"
                                                />
                                            </button>
                                        ) : (
                                            <button
                                                key={key}
                                                onClick={(e) => { e.stopPropagation(); setLightbox({ items: p.media!, index: idx }); }}
                                                className="w-full h-24 bg-black/5 rounded-md grid place-items-center text-xs"
                                            >
                                                Xem video
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>

            {/* LIGHTBOX */}
            {lightbox && (
                <div className="fixed inset-0 bg-black/70 z-[60] grid place-items-center p-4" onClick={()=>setLightbox(null)}>
                    <div className="max-w-4xl w-full" onClick={e=>e.stopPropagation()}>
                        {lightbox.items[lightbox.index].type==='image'
                            ? <Image src={lightbox.items[lightbox.index].url} alt="" width={1600} height={1000} className="w-full h-auto rounded-lg" />
                            : <video src={lightbox.items[lightbox.index].url} controls className="w-full rounded-lg" />}
                        <div className="flex justify-between mt-3">
                            <Button variant="outline" onClick={()=> setLightbox(v=> v ? ({...v, index: (v.index-1+v.items.length)%v.items.length}) : v)}>Trước</Button>
                            <Button variant="outline" onClick={()=> setLightbox(v=> v ? ({...v, index: (v.index+1)%v.items.length}) : v)}>Sau</Button>
                            <Button onClick={()=>setLightbox(null)}>Đóng</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

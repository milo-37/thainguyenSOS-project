'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';

// ===== API
async function getDetail(id: string) {
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/xemyeucau/${id}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('Không lấy được chi tiết');
    return r.json();
}

// ===== Lightbox (ảnh / video)
function Lightbox({
                      items,
                      index,
                      onClose,
                      onIndex,
                  }: {
    items: { id: number | string; type: 'image' | 'video'; url: string }[];
    index: number;
    onClose: () => void;
    onIndex: (i: number) => void;
}) {
    const total = items.length;

    // điều hướng
    const prev = () => onIndex((index - 1 + total) % total);
    const next = () => onIndex((index + 1) % total);

    // khóa scroll nền khi mở
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prevOverflow; };
    }, []);

    // phím tắt
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [index]);

    const cur = items[index];

    return (
        <div
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            {/* vùng chứa media: luôn canh giữa, padding để tránh sát mép */}
            <div className="absolute inset-0 grid place-items-center p-4" onClick={(e)=>e.stopPropagation()}>
                <div className="relative w-full max-w-[96vw] max-h-[86vh]">
                    {/* Khung media chiếm tối đa viewport, ảnh/video object-contain */}
                    <div className="w-full h-full grid place-items-center rounded-lg overflow-hidden bg-black/40">
                        {cur.type === 'image' ? (
                            <img
                                src={cur.url}
                                alt=""
                                className="max-w-full max-h-full w-auto h-auto object-contain select-none"
                                // tránh kéo ảnh trên mobile
                                draggable={false}
                            />
                        ) : (
                            <video
                                src={cur.url}
                                controls
                                className="max-w-full max-h-full w-auto h-auto object-contain bg-black"
                            />
                        )}
                    </div>

                    {/* nút đóng */}
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 rounded-full bg-white/90 hover:bg-white px-3 py-1 text-sm shadow"
                        aria-label="Đóng lightbox"
                    >
                        Đóng ✕
                    </button>

                    {/* điều hướng trái/phải — chỉ hiện khi có >1 media */}
                    {total > 1 && (
                        <>
                            <button
                                onClick={prev}
                                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 hover:bg-white px-3 py-2 font-medium shadow"
                                aria-label="Trước"
                            >
                                ‹
                            </button>
                            <button
                                onClick={next}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 hover:bg-white px-3 py-2 font-medium shadow"
                                aria-label="Sau"
                            >
                                ›
                            </button>
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-2 text-xs text-white/80">
                                {index + 1}/{total}
                            </div>
                        </>
                    )}
                </div>

                {/* dải thumbnail cuộn ngang, không vượt màn hình */}
                {total > 1 && (
                    <div className="mt-3 w-full max-w-[96vw] overflow-x-auto">
                        <div className="flex gap-2">
                            {items.map((m, i) => (
                                <button
                                    key={String(m.id) + i}
                                    onClick={() => onIndex(i)}
                                    className={`h-16 w-24 flex-shrink-0 rounded-md overflow-hidden ring-2 ${
                                        i === index ? 'ring-white' : 'ring-transparent'
                                    }`}
                                    aria-label={`Xem mục ${i + 1}`}
                                >
                                    {m.type === 'image' ? (
                                        <img src={m.url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full grid place-items-center bg-black/40 text-white text-[11px]">
                                            Video
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ===== VietMap GL (không dùng Leaflet)
function VietMapSingle({ lat, lng }: { lat: number; lng: number }) {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!ref.current) return;
        const apiKey = process.env.NEXT_PUBLIC_VIETMAP_API_KEY!;
        const styleUrl = process.env.NEXT_PUBLIC_VIETMAP_STYLE_BASE;//`https://maps.vietmap.vn/maps/styles/vietmap/style.json?apikey=${apiKey}`;
        let map: any;

        const load = async () => {
            if (!(window as any).vietmapgl) {
                const css = document.createElement('link');
                css.rel = 'stylesheet';
                css.href = 'https://unpkg.com/@vietmap/vietmap-gl-js@latest/dist/vietmap-gl.css';
                document.head.appendChild(css);

                const script = document.createElement('script');
                script.src = 'https://unpkg.com/@vietmap/vietmap-gl-js@latest/dist/vietmap-gl.js';
                await new Promise<void>((resolve) => {
                    script.onload = () => resolve();
                    document.body.appendChild(script);
                });
            }

            const vietmapgl = (window as any).vietmapgl;
            map = new vietmapgl.Map({
                container: ref.current!,
                style: styleUrl,
                center: [lng, lat],
                zoom: 14,
            });

            new vietmapgl.Marker({ color: '#ff0000' }).setLngLat([lng, lat]).addTo(map);
            setTimeout(() => map.resize(), 300);
        };

        load();
        return () => {
            try { map?.remove(); } catch {}
        };
    }, [lat, lng]);

    return <div ref={ref} className="h-80 w-full rounded-xl border" />;
}

// ===== Badge trạng thái
function StatusBadge({ value }: { value: string }) {
    const map: Record<string, { label: string; color: string }> = {
        tiep_nhan: { label: 'Tiếp nhận', color: 'bg-blue-500' },
        dang_xu_ly: { label: 'Đang xử lý', color: 'bg-amber-500' },
        hoan_thanh: { label: 'Hoàn thành', color: 'bg-emerald-500' },
        huy: { label: 'Hủy', color: 'bg-rose-500' },
    };
    const it = map[value] ?? { label: value, color: 'bg-gray-500' };
    return <span className={`px-3 py-1 rounded-full text-white text-sm ${it.color}`}>{it.label}</span>;
}

// ===== Trang chi tiết
export default function YeuCauDetail({ params }: { params: Promise<{ id: string }> }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [lbIndex, setLbIndex] = useState<number | null>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { id } = await params;
                const d = await getDetail(id);
                if (active) setData(d);
            } catch (e: any) {
                setError(e?.message || 'Không lấy được dữ liệu');
            } finally {
                setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [params]);

    if (loading) return <div className="p-6 text-gray-500">Đang tải...</div>;
    if (error) return <div className="p-6 text-red-600">{error}</div>;
    if (!data) return null;

    const loaiLabel = data.loai === 'cuu_nguoi' ? 'Cứu người' : 'Nhu yếu phẩm';
    const media = (data.media || []) as { id: number | string; type: 'image' | 'video'; url: string }[];

    return (
        <div className="max-w-6xl mx-auto py-6 grid gap-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">
                        Yêu cầu #{data.id} • {loaiLabel}
                    </h1>
                    <p className="text-sm text-gray-500">Tọa độ: {data.lat}, {data.lng}</p>
                </div>
                <StatusBadge value={data.trang_thai} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-2xl border p-5 bg-white shadow-sm grid gap-3">
                    <div><b>Người gửi:</b> {data.ten_nguoigui || '—'} • {data.sdt_nguoigui || '—'}</div>
                    <div><b>Nội dung:</b> {data.noidung || '—'}</div>
                    <div><b>Số người:</b> {data.so_nguoi ?? 0}</div>
                    <div><b>Vật tư cần:</b></div>
                    {data.vattu?.length ? (
                        <ul className="list-disc pl-5">
                            {data.vattu.map((v: any, i: number) => (
                                <li key={i}>{v.ten} — {v.so_luong} {v.don_vi || ''}</li>
                            ))}
                        </ul>
                    ) : <div>Không có</div>}
                </div>

                <div className="rounded-2xl border p-5 bg-white shadow-sm">
                    <div className="text-sm text-gray-600 mb-2">Ảnh / Video</div>
                    <div className="grid grid-cols-2 gap-3">
                        {media.length ? (
                            media.map((m, i) =>
                                m.type === 'image' ? (
                                    <button key={m.id} onClick={() => setLbIndex(i)} className="rounded-lg overflow-hidden">
                                        <Image src={m.url} alt="" width={800} height={600} className="w-full h-40 object-cover" />
                                    </button>
                                ) : (
                                    <button key={m.id} onClick={() => setLbIndex(i)} className="w-full h-40 rounded-lg bg-black/5 grid place-items-center text-xs">
                                        Xem video
                                    </button>
                                )
                            )
                        ) : (
                            <div className="text-sm text-gray-500">Không có</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bản đồ VietMap + nút Google Maps */}
            <div className="rounded-2xl border p-5 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-sm text-gray-600">Bản đồ VietMap</div>
                    <a
                        href={`https://www.google.com/maps?q=${data.lat},${data.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                    >
                        Mở bằng Google Maps
                    </a>
                </div>
                <VietMapSingle lat={data.lat} lng={data.lng} />
            </div>

            {/* LIGHTBOX */}
            {lbIndex !== null && (
                <Lightbox
                    items={media}
                    index={lbIndex}
                    onClose={() => setLbIndex(null)}
                    onIndex={(i) => setLbIndex(i)}
                />
            )}
        </div>
    );
}

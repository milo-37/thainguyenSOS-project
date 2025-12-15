'use client';

import { useEffect, useRef } from 'react';
import { loadVietMapGL } from "@/lib/loadVietmap";

export type VT = { ten?: string; so_luong?: number; don_vi?: string };
export type Media = { id:number; type:'image'|'video'; url:string };

export type TrangThaiCode =
    | 'tiep_nhan'
    | 'dang_xu_ly'
    | 'da_chuyen_cum'
    | 'da_hoan_thanh'
    | 'huy';

const TRANG_THAI_MAP: Record<TrangThaiCode, {label:string; bg:string}> = {
    tiep_nhan:      { label: 'Tiếp nhận',       bg: '#0ea5e9' },
    dang_xu_ly:     { label: 'Đang xử lý',      bg: '#f59e0b' },
    da_chuyen_cum:  { label: 'Đã chuyển cụm',   bg: '#6366f1' },
    da_hoan_thanh:  { label: 'Đã hoàn thành',   bg: '#10b981' },
    huy:            { label: 'Hủy',             bg: '#ef4444' },
};

export type MapPoint = {
    id: number; lat: number; lng: number;
    loai: 'cuu_nguoi'|'nhu_yeu_pham';
    trang_thai: TrangThaiCode;
    ten?: string; sdt?: string; noidung?: string; so_nguoi?: number;
    vattu?: VT[];
    media?: Media[];
    createdAt?: string | null;
};

type Props = {
    styleUrl: string;
    points: MapPoint[];
    onSelect?: (id:number)=>void;
    onPick?: (p:{lng:number;lat:number})=>void;
    view?: { center:[number,number]; zoom:number };
    onViewChange?: (v:{ center:[number,number]; zoom:number })=>void;
    initialAutoLocate?: boolean;
    className?: string;
    hidePlaces?: boolean;
    selectedId?: number|null;
    onOpenMedia?: (items:Media[], index:number)=>void;
    onTransfer?: (id:number)=>void;
    onClaim?: (id:number)=>void;
};

/** ===== Epsilon & helpers ===== */
const EPS_CENTER = 1e-5;   // chặt hơn để tránh easeTo thừa (~1m)
const EPS_ZOOM   = 0.01;

const nearlyEqual = (a:number, b:number, eps:number)=> Math.abs(a-b) <= eps;
const centerEqual = (c1:[number,number], c2:[number,number]) =>
    nearlyEqual(c1[0], c2[0], EPS_CENTER) && nearlyEqual(c1[1], c2[1], EPS_CENTER);

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
                                }: Props){
    const ref = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const popupRef = useRef<any>(null);
    const didLocateRef = useRef(false);

    /** chặn “vòng lặp” khi set view từ props */
    const suppressEmitRef = useRef(false);
    const clearSuppressTimeoutRef = useRef<any>(null);

    /** ===== Pulser icon (nhẹ) ===== */
    const makePulsing = (color:string, dotColor:string) => {
        const size = 96;
        const pulsingDot = {
            width: size, height: size, data: new Uint8Array(size * size * 4),
            onAdd(this:any){
                const c = document.createElement('canvas');
                c.width = size; c.height = size;
                this.context = c.getContext('2d');
            },
            render(this:any){
                const duration = 1200;
                const t = (performance.now() % duration) / duration;
                const r = (size / 2) * 0.35;
                const R = (size / 2) * (0.35 + t * 0.65);
                const ctx:CanvasRenderingContext2D = this.context;
                const toRgba=(hex:string,a:number)=>{ const h=hex.replace('#',''); const rr=parseInt(h.slice(0,2),16), gg=parseInt(h.slice(2,4),16), bb=parseInt(h.slice(4,6),16); return `rgba(${rr},${gg},${bb},${a})`; };

                ctx.clearRect(0,0,size,size);
                ctx.beginPath(); ctx.arc(size/2,size/2,R,0,Math.PI*2); ctx.fillStyle=toRgba(color, 1-t); ctx.fill();
                ctx.beginPath(); ctx.arc(size/2,size/2,r,0,Math.PI*2); ctx.fillStyle=dotColor; ctx.strokeStyle='#fff'; ctx.lineWidth=6; ctx.fill(); ctx.stroke();

                // @ts-ignore
                this.data = ctx.getImageData(0,0,size,size).data;
                // @ts-ignore
                mapRef.current?.triggerRepaint?.();
                return true;
            }
        } as any;
        return pulsingDot;
    };

    /** ===== Ẩn/hiện POI ===== */
    const applyPlaceVisibility = (hide:boolean) => {
        const m = mapRef.current; if (!m) return;
        const style = m.getStyle(); if (!style?.layers) return;
        style.layers.forEach((l:any)=>{
            const id = String(l.id||'').toLowerCase();
            const src = String(l['source-layer']||'').toLowerCase();
            if (id.includes('poi') || id.includes('amenity') || id.includes('hospital') || id.includes('fuel') || id.includes('place') ||
                src.includes('poi')|| src.includes('amenity')|| src.includes('hospital')|| src.includes('fuel')|| src.includes('place')) {
                try{ m.setLayoutProperty(l.id,'visibility', hide ? 'none':'visible'); }catch{}
            }
        });
    };

    /** ===== Mount map ===== */
    useEffect(()=>{
        let disposed = false;
        (async()=>{
            const vietmapgl:any = await loadVietMapGL();
            if (disposed || !ref.current || mapRef.current) return;

            const map = new vietmapgl.Map({
                container: ref.current!,
                style: styleUrl,
                center: view?.center ?? [105.85, 21.03],
                zoom: view?.zoom ?? 12,
                renderWorldCopies: false,
                fadeDuration: 0,
                transformRequest: (url:string)=>({ url }),
            });
            mapRef.current = map;

            map.on('error',(e:any)=>{
                const msg = e?.error?.message||''; const name = e?.error?.name||'';
                if (name==='AbortError' || /aborted|signal is aborted/i.test(msg)) e?.preventDefault?.();
            });

            map.addControl(new vietmapgl.NavigationControl(), 'bottom-right');
            const geo = new vietmapgl.GeolocateControl({ positionOptions:{ enableHighAccuracy:true }, trackUserLocation:false });
            map.addControl(geo, 'bottom-right');

            map.on('load', ()=>{
                // auto locate 1 lần
                if (initialAutoLocate && !didLocateRef.current) {
                    didLocateRef.current = true;
                    (geo as any).trigger?.();
                    geo.once('geolocate', (e:any)=> map.easeTo({ center:[e.coords.longitude,e.coords.latitude], zoom: 12 }));
                }

                // 👉 CHỈ BẮN view khi moveend (ổn định, không chen vào lúc user đang zoom)
                map.on('moveend', ()=>{
                    if (suppressEmitRef.current) return; // đang easeTo theo props, không bắn ngược
                    const c = map.getCenter().toArray() as [number,number];
                    const z = map.getZoom();
                    onViewChange?.({ center: c, zoom: z });
                });

                // nguồn + cluster
                map.addSource('req',{
                    type:'geojson',
                    data:{ type:'FeatureCollection', features:[] },
                    cluster:true, clusterRadius:48, clusterMaxZoom:12,
                });

                map.addLayer({ id:'clusters', type:'circle', source:'req', filter:['has','point_count'],
                    paint:{
                        'circle-color':'#fca5a5',
                        'circle-radius':['step',['get','point_count'],16,20,22,50,28],
                        'circle-stroke-color':'#fff','circle-stroke-width':2
                    }
                });
                map.addLayer({ id:'cluster-count', type:'symbol', source:'req', filter:['has','point_count'],
                    layout:{ 'text-field':'{point_count_abbreviated}','text-size':12 }
                });

                // Pulsing icons
                if (!map.hasImage('pulse-red'))  map.addImage('pulse-red',  makePulsing('#fecdd3', '#ef4444'), { pixelRatio: 1.5 }); // rose-200
                if (!map.hasImage('pulse-blue')) map.addImage('pulse-blue', makePulsing('#93c5fd', '#2563eb'), { pixelRatio: 1.5 });

                map.addLayer({
                    id:'req-dots',
                    type:'symbol',
                    source:'req',
                    filter:['!',['has','point_count']],
                    layout:{
                        'icon-image': ['match', ['get','loai'], 'cuu_nguoi', 'pulse-red', 'nhu_yeu_pham', 'pulse-blue', 'pulse-red'],
                        'icon-allow-overlap': true,
                        'icon-size': ['interpolate',['linear'],['zoom'], 0, 0.45, 10, 0.6, 14, 0.75]
                    }
                });

                map.on('click','clusters',(e:any)=>{
                    const fs = map.queryRenderedFeatures(e.point,{layers:['clusters']});
                    const cid = fs[0].properties.cluster_id;
                    (map.getSource('req') as any).getClusterExpansionZoom(cid,(err:any,zoom:number)=>{
                        if(err) return;
                        map.easeTo({ center:(fs[0].geometry as any).coordinates, zoom });
                    });
                });

                const buildPopupHTML = (p:any)=>{
                    const vt = p.vattu ? JSON.parse(p.vattu) : [];
                    const vtHtml = vt.length
                        ? `<ul style="margin:6px 0;padding-left:18px">${vt.map((v:VT)=>`<li>${v.ten||''}${v.so_luong?` - ${v.so_luong}`:''} ${v.don_vi||''}</li>`).join('')}</ul>`
                        : "<div style='color:#6b7280'>Không có vật tư</div>";
                    const media = p.media ? JSON.parse(p.media) as Media[] : [];

                    const tt = TRANG_THAI_MAP[(p.trang_thai || 'tiep_nhan') as TrangThaiCode] ?? TRANG_THAI_MAP.tiep_nhan;
                    const badgeTT = `<span style="padding:2px 8px;border-radius:999px;background:${tt.bg};color:#fff;font:600 12px system-ui">${tt.label}</span>`;

                    const mediaHtml = media.length ? `
            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px">
              ${media.map((m,idx)=> m.type==='image'
                        ? `<img data-media="${idx}" src="${m.url}" style="width:100%;height:84px;object-fit:cover;border-radius:8px;cursor:pointer" />`
                        : `<div data-media="${idx}" style="height:84px;border-radius:8px;background:#f3f4f6;display:grid;place-items:center;cursor:pointer">Video</div>`
                    ).join('')}
            </div>` : '';

                    return `
          <div style="max-width:380px;font:13px system-ui">
            <div style="font:700 16px system-ui;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span>#${p.id}</span>
              <span style="padding:2px 8px;border-radius:999px;background:${p.loai==='cuu_nguoi'?'#ef4444':'#2563eb'};color:#fff;font:600 12px system-ui">
                ${p.loai==='cuu_nguoi'?'Cần cứu':'Cứu trợ'}
              </span>
              ${badgeTT}
            </div>
            <div style="margin-top:8px;line-height:1.5">
              <div><b>Người gửi:</b> ${p.ten||'—'} • ${p.sdt||'—'}</div>
              <div><b>Nội dung:</b> ${p.noidung||'—'}</div>
              <div><b>Số người:</b> ${p.so_nguoi||'—'}</div>
              <div><b>Vật tư cần:</b> ${vtHtml}</div>
              ${mediaHtml}
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button id="open-${p.id}"    …>Xem chi tiết</button>
              <button id="claim-${p.id}"   style="padding:8px 12px;border-radius:10px;background:#2563eb;color:#fff;border:none;cursor:pointer">Nhận xử lý</button>
              <button id="move-${p.id}"    style="padding:8px 12px;border-radius:10px;background:#111827;color:#fff;border:none;cursor:pointer">Chuyển xử lý</button>
            </div>
          </div>`;
                };

                map.on('click','req-dots',(e:any)=>{
                    const f = e.features[0];
                    const [lng,lat] = f.geometry.coordinates;
                    const p = f.properties||{};

                    popupRef.current?.remove();
                    popupRef.current = new vietmapgl.Popup({ offset:16, maxWidth: '420px' })
                        .setLngLat([lng,lat])
                        .setHTML(buildPopupHTML(p))
                        .addTo(map);

                    setTimeout(()=>{
                        document.getElementById(`open-${p.id}`)?.addEventListener('click',()=> onSelect?.(Number(p.id)));
                        document.getElementById(`move-${p.id}`)?.addEventListener('click',()=> onTransfer?.(Number(p.id)));
                        document.getElementById(`claim-${p.id}`)?.addEventListener('click',()=> onClaim?.(Number(p.id)));

                        const media = p.media ? JSON.parse(p.media) as Media[] : [];
                        if (media.length && onOpenMedia) {
                            media.forEach((_m, idx)=>{
                                const el = document.querySelector(`[data-media="${idx}"]`);
                                el?.addEventListener('click', ()=> onOpenMedia(media, idx));
                            });
                        }
                    },0);
                });

                map.on('mouseenter','req-dots',()=> map.getCanvas().style.cursor='pointer');
                map.on('mouseleave','req-dots',()=> map.getCanvas().style.cursor='');

                // Ẩn POI lần đầu
                applyPlaceVisibility(hidePlaces);

                /** Resize debounce */
                let lastW = 0, lastH = 0, resizeTimer:any=null;
                const ro = new ResizeObserver(entries=>{
                    const cr = entries[0]?.contentRect;
                    if (!cr) return;
                    const w = Math.round(cr.width), h = Math.round(cr.height);
                    if (w===lastW && h===lastH) return;
                    lastW = w; lastH = h;
                    clearTimeout(resizeTimer);
                    resizeTimer = setTimeout(()=>{ try{ map.resize(); }catch{} }, 80);
                });
                if (ref.current) ro.observe(ref.current);

                const onWinResize = ()=>{
                    clearTimeout(resizeTimer);
                    resizeTimer = setTimeout(()=>{ try{ map.resize(); }catch{} }, 80);
                };
                window.addEventListener('resize', onWinResize);

                map.once('remove',()=>{ try{ ro.disconnect(); window.removeEventListener('resize',onWinResize); }catch{} });
            });

            // click nền map
            map.on('click',(e:any)=> onPick?.(e.lngLat));
        })();

        return ()=> {
            try{ popupRef.current?.remove(); }catch{}
            const m:any = mapRef.current; mapRef.current = null;
            try{ m?.remove?.(); }catch{}
            clearTimeout(clearSuppressTimeoutRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [styleUrl]);

    /** Cập nhật data */
    useEffect(()=>{
        const m = mapRef.current; if (!m) return;
        const src = m.getSource('req'); if (!src) return;
        (src as any).setData({
            type:'FeatureCollection',
            features: (points||[]).map(p=>({
                type:'Feature',
                geometry:{ type:'Point', coordinates:[p.lng,p.lat] },
                properties:{
                    id:p.id, loai:p.loai, trang_thai:p.trang_thai,
                    ten:p.ten||'', sdt:p.sdt||'', noidung:p.noidung||'',
                    so_nguoi:p.so_nguoi||0, vattu: JSON.stringify(p.vattu||[]),
                    media: JSON.stringify(p.media||[])
                }
            }))
        });
    }, [points]);

    /** Nhận view từ props — chỉ animate khi thực sự khác */
    useEffect(()=>{
        const m = mapRef.current; if (!m || !view) return;

        const currCenter = m.getCenter().toArray() as [number,number];
        const currZoom   = m.getZoom();

        if (centerEqual(currCenter, view.center) && nearlyEqual(currZoom, view.zoom, EPS_ZOOM)) {
            // không khác → không easeTo để khỏi chen vào zoom của user
            return;
        }

        // trong lúc easeTo thì không bắn moveend ngược ra ngoài
        suppressEmitRef.current = true;

        m.easeTo({ center:view.center, zoom:view.zoom, duration: 250 });

        const release = () => {
            suppressEmitRef.current = false;
            clearTimeout(clearSuppressTimeoutRef.current);
        };

        // an toàn: nếu bị ngắt animation, vẫn nhả cờ sau 400ms
        clearTimeout(clearSuppressTimeoutRef.current);
        clearSuppressTimeoutRef.current = setTimeout(release, 400);
        m.once('moveend', release);

        return () => { try{ m.off('moveend', release); }catch{} };
    }, [view?.center?.[0], view?.center?.[1], view?.zoom]);

    /** Ẩn/hiện POI khi đổi flag */
    useEffect(()=>{ applyPlaceVisibility(hidePlaces); }, [hidePlaces]);

    /** Mở popup theo selectedId (giữ nguyên) */
    useEffect(()=>{
        if (!selectedId) return;
        const m = mapRef.current; if (!m) return;
        const p = points.find(x=>x.id===selectedId);
        if (!p) return;

        const vietmapgl = (window as any).vietmapgl;
        if (!vietmapgl) return;

        const vtHtml = (p.vattu?.length)
            ? `<ul style="margin:6px 0;padding-left:18px">${p.vattu!.map(v=>`<li>${v.ten||''}${v.so_luong?` - ${v.so_luong}`:''} ${v.don_vi||''}</li>`).join('')}</ul>`
            : "<div style='color:#6b7280'>Không có vật tư</div>";

        const tt = TRANG_THAI_MAP[p.trang_thai] ?? TRANG_THAI_MAP.tiep_nhan;
        const badgeTT = `<span style="padding:2px 8px;border-radius:999px;background:${tt.bg};color:#fff;font:600 12px system-ui">${tt.label}</span>`;

        const mediaHtml = (p.media?.length)
            ? `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px">${
                p.media!.map((m,idx)=> m.type==='image'
                    ? `<img data-media="${idx}" src="${m.url}" style="width:100%;height:84px;object-fit:cover;border-radius:8px;cursor:pointer" />`
                    : `<div data-media="${idx}" style="height:84px;border-radius:8px;background:#f3f4f6;display:grid;place-items:center;cursor:pointer">Video</div>`
                ).join('')
            }</div>` : '';

        const html = `
      <div style="max-width:380px;font:13px system-ui">
        <div style="font:700 16px system-ui;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span>#${p.id}</span>
          <span style="padding:2px 8px;border-radius:999px;background:${p.loai==='cuu_nguoi'?'#ef4444':'#2563eb'};color:#fff;font:600 12px system-ui">
            ${p.loai==='cuu_nguoi'?'Cần cứu':'Cứu trợ'}
          </span>
          ${badgeTT}
        </div>
        <div style="margin-top:8px;line-height:1.5">
          <div><b>Người gửi:</b> ${p.ten||'—'} • ${p.sdt||'—'}</div>
          <div><b>Nội dung:</b> ${p.noidung||'—'}</div>
          <div><b>Số người:</b> ${p.so_nguoi||'—'}</div>
          <div><b>Vật tư cần:</b> ${vtHtml}</div>
          ${mediaHtml}
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button id="open-${p.id}"    …>Xem chi tiết</button>
          <button id="claim-${p.id}"   style="padding:8px 12px;border-radius:10px;background:#2563eb;color:#fff;border:none;cursor:pointer">Nhận xử lý</button>
          <button id="move-${p.id}"    style="padding:8px 12px;border-radius:10px;background:#111827;color:#fff;border:none;cursor:pointer">Chuyển xử lý</button>
        </div>
      </div>`;

        popupRef.current?.remove();
        popupRef.current = new vietmapgl.Popup({ offset:16, maxWidth:'420px' })
            .setLngLat([p.lng,p.lat])
            .setHTML(html)
            .addTo(m);

        setTimeout(()=>{
            document.getElementById(`open-${p.id}`)?.addEventListener('click',()=> onSelect?.(Number(p.id)));
            document.getElementById(`move-${p.id}`)?.addEventListener('click',()=> onTransfer?.(Number(p.id)));
            document.getElementById(`claim-${p.id}`)?.addEventListener('click',()=> onClaim?.(Number(p.id)));

            if (p.media?.length && onOpenMedia) {
                p.media.forEach((_m, idx)=>{
                    const el = document.querySelector(`[data-media="${idx}"]`);
                    el?.addEventListener('click', ()=> onOpenMedia(p.media!, idx));
                });
            }
        },0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    return <div ref={ref} className={className} />;
}

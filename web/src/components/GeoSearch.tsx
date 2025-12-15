'use client';
import { useEffect, useRef, useState } from "react";

export default function GeoSearch({ onPick }:{ onPick:(p:{lat:number,lng:number,label?:string})=>void }) {
    const [q,setQ]=useState('');
    const [items,setItems]=useState<any[]>([]);
    const [open,setOpen]=useState(false);
    const timer = useRef<any>(null);

    useEffect(()=>{
        if (timer.current) clearTimeout(timer.current);
        if (!q) { setItems([]); setOpen(false); return; }
        timer.current = setTimeout(async ()=>{
            const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vietmap/geocode?text=${encodeURIComponent(q)}`);
            if (!r.ok) return;
            const data = await r.json();
            // VietMap trả về features/places; tuỳ cấu trúc API của bạn.
            const list = (data?.data || data?.features || []).map((x:any)=>({
                name: x.name || x.properties?.name || x.display || x.address,
                lat: + (x.lat || x.geometry?.coordinates?.[1] || x.y),
                lng: + (x.lng || x.geometry?.coordinates?.[0] || x.x),
            })).filter((x:any)=>isFinite(x.lat)&&isFinite(x.lng));
            setItems(list); setOpen(true);
        }, 300);
    },[q]);

    return (
        <div className="relative">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nhập địa điểm (VietMap)" className="border p-2 rounded w-full mt-1"/>
            {open && !!items.length && (
                <div className="absolute z-20 bg-white border rounded-lg mt-1 w-full max-h-64 overflow-auto shadow-lg">
                    {items.map((it,idx)=>(
                        <div key={idx} className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                             onClick={()=>{ onPick({lat:it.lat,lng:it.lng,label:it.name}); setQ(it.name); setOpen(false); }}>
                            {it.name} <span className="text-gray-500">({it.lat.toFixed(5)}, {it.lng.toFixed(5)})</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

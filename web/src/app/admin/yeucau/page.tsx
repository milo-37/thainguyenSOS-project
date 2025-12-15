'use client';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AssignSheet from '@/components/AssignSheet';
import { listYeuCauAdmin } from '@/lib/api';


export default function YeuCauPage(){
    const [items,setItems] = useState<any[]>([]);
    const [q,setQ] = useState('');
    const [page,setPage] = useState(1);
    const [filters,setFilters] = useState<any>({});


    const load = async()=>{
        const d = await listYeuCauAdmin({ q, page, ...filters });
        setItems(d.data ?? d.items ?? d);
    };
    useEffect(()=>{ load(); },[q,page,filters]);


    return (
        <div className="p-4 space-y-4">
            <div className="flex gap-2 items-center">
                <Input placeholder="Tìm nhanh" value={q} onChange={e=>setQ(e.target.value)} className="max-w-xs" />
                <Button variant={filters.assigned_to_me? 'default':'outline'} onClick={()=>setFilters((s:any)=>({...s,assigned_to_me: s.assigned_to_me?0:1}))}>Được giao</Button>
            </div>


            <div className="grid gap-3">
                {items.map((r:any)=> (
                    <div key={r.id} className="border rounded-xl p-4 grid md:grid-cols-12 gap-3">
                        <div className="md:col-span-7">
                            <div className="font-semibold">#{r.id} · {r.ten} · {r.so_dien_thoai}</div>
                            <div className="text-sm line-clamp-3">{r.noi_dung}</div>
                            {r.lat && r.lng && (
                                <a className="text-sm underline" target="_blank" href={`https://maps.google.com/?q=${r.lat},${r.lng}`}>Mở Google Map</a>
                            )}
                        </div>
                        <div className="md:col-span-3 flex items-center">Trạng thái: <b className="ml-2">{r.trang_thai}</b></div>
                        <div className="md:col-span-2 flex items-center justify-end">
                            {/* Cột Phân công */}
                            <AssignSheet yeuCauId={r.id} />
                        </div>
                    </div>
                ))}
            </div>


            <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={()=>setPage(p=>Math.max(1,p-1))}>Trang trước</Button>
                <Button variant="outline" onClick={()=>setPage(p=>p+1)}>Trang sau</Button>
            </div>
        </div>
    );
}
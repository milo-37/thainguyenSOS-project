'use client';
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type VatTu = { id:number; ten:string; don_vi?:string };

export default function VatTuPicker({
                                        value, onChange
                                    }:{ value: Record<number, number>; onChange:(v:Record<number,number>)=>void }) {
    const [list,setList]=useState<VatTu[]>([]);

    useEffect(()=>{
        (async ()=>{
            const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dsvattu`).then(r=>r.json());
            setList(r?.data || r || []);
        })();
    },[]);

    return (
        <Card className="p-3 grid gap-2 max-h-[300px] overflow-auto">
            {list.map(vt=>(
                <div key={vt.id} className="flex items-center justify-between gap-3">
                    <div className="text-sm">{vt.ten} {vt.don_vi && <span className="text-gray-500">({vt.don_vi})</span>}</div>
                    <Input
                        className="w-28"
                        type="number" min={0}
                        value={value[vt.id] ?? 0}
                        onChange={e=>{
                            const n = Math.max(0, Number(e.target.value || 0));
                            const next = { ...value }; if (n===0) delete next[vt.id]; else next[vt.id]=n;
                            onChange(next);
                        }}
                    />
                </div>
            ))}
        </Card>
    );
}

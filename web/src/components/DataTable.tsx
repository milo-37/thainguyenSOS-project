'use client';
import { useMemo, useState } from "react";

export default function DataTable<T>({
                                         rows, columns, pageSize=10
                                     }:{ rows:T[]; columns:{ key: keyof T; header:string; render?:(v:any,row:T)=>React.ReactNode }[]; pageSize?:number; }) {
    const [page,setPage]=useState(1);
    const [sort,setSort]=useState<{key:keyof T; dir:'asc'|'desc'}|null>(null);

    const data = useMemo(()=>{
        let d = [...rows];
        if (sort) d.sort((a:any,b:any)=>{
            const av = a[sort.key], bv = b[sort.key];
            if (av===bv) return 0;
            return (av>bv?1:-1)*(sort.dir==='asc'?1:-1);
        });
        return d;
    },[rows,sort]);

    const total = data.length;
    const start = (page-1)*pageSize, end = start+pageSize;
    const pageRows = data.slice(start,end);

    return (
        <div className="border rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
                <thead className="bg-gray-50">
                <tr>
                    {columns.map(c=>(
                        <th key={String(c.key)} className="text-left p-3 cursor-pointer"
                            onClick={()=>setSort(s=> s && s.key===c.key ? {key:c.key, dir: s.dir==='asc'?'desc':'asc'} : {key:c.key, dir:'asc'})}>
                            {c.header}{sort?.key===c.key ? (sort.dir==='asc'?' ▲':' ▼') : ''}
                        </th>
                    ))}
                </tr>
                </thead>
                <tbody>
                {pageRows.map((r,idx)=>(
                    <tr key={idx} className="border-t">
                        {columns.map(c=>(
                            <td key={String(c.key)} className="p-3">{c.render? c.render((r as any)[c.key], r) : String((r as any)[c.key] ?? '')}</td>
                        ))}
                    </tr>
                ))}
                {!pageRows.length && <tr><td className="p-6 text-center text-gray-500" colSpan={columns.length}>Không có dữ liệu</td></tr>}
                </tbody>
            </table>
            <div className="flex items-center justify-between p-3">
                <div className="text-xs text-gray-500">Tổng: {total}</div>
                <div className="flex gap-2">
                    <button className="px-2 py-1 border rounded" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Trước</button>
                    <span className="text-xs">Trang {page} / {Math.max(1, Math.ceil(total/pageSize))}</span>
                    <button className="px-2 py-1 border rounded" disabled={end>=total} onClick={()=>setPage(p=>p+1)}>Sau</button>
                </div>
            </div>
        </div>
    );
}

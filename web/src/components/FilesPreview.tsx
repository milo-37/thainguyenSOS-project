'use client';
import { useEffect, useState } from "react";

export default function FilesPreview({ files }:{ files: File[] }) {
    const [urls, setUrls] = useState<{name:string; url:string; type:string}[]>([]);
    useEffect(()=>{
        const list = files.map(f=>({ name:f.name, url:URL.createObjectURL(f), type:f.type }));
        setUrls(list);
        return ()=> list.forEach(x=>URL.revokeObjectURL(x.url));
    },[files]);

    if (!files?.length) return null;
    return (
        <div className="grid grid-cols-3 gap-2">
            {urls.map(x=>(
                <div key={x.url} className="border rounded-lg overflow-hidden bg-white">
                    {x.type.startsWith('image/')
                        ? <img src={x.url} className="w-full h-24 object-cover" />
                        : <div className="h-24 grid place-content-center text-xs text-gray-600">📹 {x.name}</div>}
                    <div className="text-[11px] p-2 truncate">{x.name}</div>
                </div>
            ))}
        </div>
    );
}

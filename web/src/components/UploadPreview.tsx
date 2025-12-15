'use client';
import { useMemo, useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

export default function UploadPreview({
                                          files, setFiles
                                      }:{ files: File[]; setFiles:(f:File[])=>void }) {
    const [preview,setPreview]=useState<string|null>(null);
    const urls = useMemo(()=> files.map(f=>({ f, url: URL.createObjectURL(f), isImg: f.type.startsWith('image/') })),[files]);

    return (
        <div className="grid gap-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {urls.map(({f,url,isImg},i)=>(
                    <div key={i} className="relative border rounded-lg overflow-hidden">
                        <button
                            className="absolute right-2 top-2 z-10 bg-black/60 text-white rounded-full p-1"
                            onClick={()=> setFiles(files.filter((_,idx)=>idx!==i))}
                            title="Xóa"
                        >
                            <X size={14}/>
                        </button>
                        {isImg ? (
                            <button onClick={()=>setPreview(url)} className="block w-full h-36 relative">
                                <Image src={url} alt={f.name} fill className="object-cover" />
                            </button>
                        ) : (
                            <a href={url} target="_blank" className="block p-4 text-sm">Xem tệp: {f.name}</a>
                        )}
                    </div>
                ))}
            </div>

            <Dialog open={!!preview} onOpenChange={(o)=>!o && setPreview(null)}>
                <DialogContent className="max-w-3xl">
                    {preview && <img src={preview} alt="" className="w-full h-auto rounded-lg" />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

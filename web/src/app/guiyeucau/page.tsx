'use client';
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import MapPicker from "@/components/MapPicker";
import UploadPreview from "@/components/UploadPreview";
import { useRouter } from "next/navigation";
import VatTuPicker from "@/components/VatTuPicker";


const STYLE = process.env.NEXT_PUBLIC_VIETMAP_STYLE_BASE!;

function parseGoogleMaps(url: string): {lat:number; lng:number} | null {
    try {
        const u = new URL(url);
        const at = u.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
        const q = u.searchParams.get('q');
        if (q) {
            const [lat,lng] = q.split(',').map(Number);
            if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
        }
    } catch {}
    return null;
}

export default function ReportPage(){
    const router = useRouter();

    const [loai,setLoai]=useState<'cuu_nguoi'|'nhu_yeu_pham'>('cuu_nguoi');
    const [ten,setTen]=useState('');
    const [sdt,setSdt]=useState('');
    const [noidung,setNoidung]=useState('');
    const [soNguoi,setSoNguoi]=useState<number>(1);

    // BỎ gợi ý địa chỉ VietMap => chỉ còn link Google Maps (tùy chọn)
    const [gmap,setGmap]=useState('');
    const [pos,setPos]=useState<{lat:number;lng:number}|null>(null);

    const [vattuMap,setVattuMap]=useState<Record<number,number>>({});
    const vattuArr = useMemo(()=> Object.entries(vattuMap).map(([id,sl])=>({ vattu_id:Number(id), so_luong:Number(sl) })),[vattuMap]);

    const [files,setFiles]=useState<File[]>([]);
    const [sending,setSending]=useState(false);
    const token = typeof window!=='undefined' ? localStorage.getItem('token') : null;

    useEffect(()=>{ // parse link google nếu dán
        const p = parseGoogleMaps(gmap);
        if (p) setPos(p);
    },[gmap]);

    async function submit(){
        // bắt buộc 3 trường
        if (!ten.trim()) return alert('Vui lòng nhập tên người gửi.');
        if (!sdt.trim()) return alert('Vui lòng nhập số điện thoại.');
        if (!noidung.trim()) return alert('Vui lòng nhập nội dung.');
        if (!pos) return alert('Vui lòng chọn vị trí trên bản đồ.');

        const fd = new FormData();
        fd.append('loai', loai);
        fd.append('ten_nguoigui', ten.trim());
        fd.append('sdt_nguoigui', sdt.trim());
        fd.append('noidung', noidung.trim());
        fd.append('lat', String(pos.lat));
        fd.append('lng', String(pos.lng));
        fd.append('so_nguoi', String(soNguoi));
        fd.append('vattu_chitiet', JSON.stringify(vattuArr));
        files.forEach((f)=> fd.append('files[]', f, f.name));

        setSending(true);
        try{
            const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/yeucau`,{
                method:'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                body: fd
            });

            // 3) Trùng SĐT => 409: hỏi người dùng có xem yêu cầu không
            if (r.status === 409) {
                const j = await r.json();
                if (confirm('Số điện thoại này đã có yêu cầu đang tiếp nhận. Bạn muốn xem trạng thái yêu cầu không?')) {
                    router.push(`/xemyeucau/${j.existing_id}`);
                }
                return;
            }

            if (!r.ok) throw new Error(await r.text());
            const j = await r.json();
            alert('Đã gửi yêu cầu. Cảm ơn bạn!');
            router.push(`/xemyeucau/${j.id}`); // chuyển sang trang chi tiết

        } catch(e:any){
            alert('Lỗi gửi yêu cầu: ' + (e?.message || ''));
        } finally { setSending(false); }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="order-2 lg:order-1">
                <CardHeader><CardTitle>Gửi yêu cầu cứu trợ</CardTitle></CardHeader>
                <CardContent className="grid gap-4">
                    {/* Loại */}
                    <div className="flex items-center justify-center gap-3">
                        <button type="button"
                                onClick={()=>setLoai('cuu_nguoi')}
                                className={`px-4 py-2 rounded-full border ${loai==='cuu_nguoi'?'bg-red-600 text-white border-red-600':'bg-white hover:bg-red-50'}`}>
                            🚑 Cứu người
                        </button>
                        <button type="button"
                                onClick={()=>setLoai('nhu_yeu_pham')}
                                className={`px-4 py-2 rounded-full border ${loai==='nhu_yeu_pham'?'bg-blue-600 text-white border-blue-600':'bg-white hover:bg-blue-50'}`}>
                            📦 Nhu yếu phẩm
                        </button>
                    </div>

                    {/* Link Google Map (tùy chọn) */}
                    <div className="grid gap-2">
                        <label className="text-sm text-gray-600">Link Google Maps (tùy chọn)</label>
                        <Input value={gmap} onChange={(e)=>setGmap(e.target.value)} placeholder="Dán link vị trí Google Maps..." />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <label className="text-sm text-gray-600">Tên người gửi *</label>
                            <Input value={ten} onChange={(e)=>setTen(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm text-gray-600">Số điện thoại *</label>
                            <Input value={sdt} onChange={(e)=>setSdt(e.target.value)} required />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <label className="text-sm text-gray-600">Nội dung *</label>
                        <Textarea rows={4} value={noidung} onChange={(e)=>setNoidung(e.target.value)} required />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <label className="text-sm text-gray-600">Số người cần cứu</label>
                            <Input type="number" min={1} value={soNguoi} onChange={(e)=>setSoNguoi(Number(e.target.value||1))} />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm text-gray-600">Vật tư cần hỗ trợ</label>
                            <VatTuPicker value={vattuMap} onChange={setVattuMap}/>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <label className="text-sm text-gray-600">Ảnh / video đính kèm</label>
                        <Input type="file" multiple onChange={(e)=> setFiles(Array.from(e.target.files||[]))}/>
                        <UploadPreview files={files} setFiles={setFiles}/>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={submit} disabled={sending}>{sending?'Đang gửi...':'Gửi yêu cầu'}</Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="order-1 lg:order-2">
                <CardHeader><CardTitle>Chọn vị trí trên bản đồ</CardTitle></CardHeader>
                <CardContent>
                    <MapPicker styleUrl={STYLE} value={pos} onChange={setPos}/>
                </CardContent>
            </Card>
        </div>
    );
}

'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { assignYeuCau } from '@/lib/api';


export default function AssignSheet({yeuCauId}:{yeuCauId:number}){
    const [open,setOpen] = useState(false);
    const [clusters,setClusters] = useState<any[]>([]);
    const [users,setUsers] = useState<any[]>([]);
    const [cumId,setCumId] = useState<string>('');
    const [userId,setUserId] = useState<string>('');


    useEffect(()=>{ fetch('/api/cum').then(r=>r.json()).then(setClusters); fetch('/api/users').then(r=>r.json()).then(setUsers); },[]);
    const onAssign = async()=>{
        await assignYeuCau(yeuCauId, { cum_id: cumId? +cumId : undefined, user_id: userId? +userId : undefined });
        setOpen(false);
    };


    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild><Button size="sm" variant="secondary">Giao</Button></SheetTrigger>
            <SheetContent>
                <SheetHeader><SheetTitle>Giao xử lý yêu cầu #{yeuCauId}</SheetTitle></SheetHeader>
                <div className="space-y-3 mt-4">
                    <div>
                        <div className="text-sm font-medium">Giao cho Cụm</div>
                        <select className="border rounded w-full h-10 px-2" value={cumId} onChange={e=>setCumId(e.target.value)}>
                            <option value="">-- Không --</option>
                            {clusters?.data?.map?.((c:any)=> <option key={c.id} value={c.id}>{c.ten}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="text-sm font-medium">Hoặc giao cho Thành viên</div>
                        <select className="border rounded w-full h-10 px-2" value={userId} onChange={e=>setUserId(e.target.value)}>
                            <option value="">-- Không --</option>
                            {users?.data?.map?.((u:any)=> <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <Button onClick={onAssign}>Xác nhận</Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
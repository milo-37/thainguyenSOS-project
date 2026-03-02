'use client';
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type VatTu = { id:number; ten:string; donvi?:string; don_vi?:string };

function parseQty(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return null;          // đang trống (user đang xoá)
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, n);
}

export default function VatTuPicker({
  value, onChange
}:{ value: Record<number, number>; onChange:(v:Record<number,number>)=>void }) {

  const [list,setList]=useState<VatTu[]>([]);
  // draft để user xoá/sửa tự nhiên
  const [draft, setDraft] = useState<Record<number, string>>({});

  useEffect(()=>{
    (async ()=>{
      const j = await fetch(`/api/dsvattu`, { cache: "no-store" }).then(r=>r.json());
      setList(j?.data || j || []);
    })();
  },[]);

  // sync draft khi value thay đổi (lần đầu load)
  useEffect(() => {
    setDraft(prev => {
      const next = { ...prev };
      for (const vt of list) {
        const v = value[vt.id];
        if (next[vt.id] == null) next[vt.id] = v != null ? String(v) : "";
      }
      return next;
    });
  }, [list, value]);

  return (
    <Card className="p-3 grid gap-2 max-h-[300px] overflow-auto">
      {list.map(vt=>{
        const display = draft[vt.id] ?? "";

        return (
          <div key={vt.id} className="flex items-center justify-between gap-3">
            <div className="text-sm">
              {vt.ten} {(vt.don_vi || vt.donvi) && (
                <span className="text-gray-500">({vt.don_vi || vt.donvi})</span>
              )}
            </div>

            <Input
              className={[
                "w-28 text-right",
                "[appearance:textfield]",
                "[&::-webkit-outer-spin-button]:appearance-none",
                "[&::-webkit-inner-spin-button]:appearance-none",
              ].join(" ")}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={display}
              onChange={(e) => {
                const raw = e.target.value;
                // cho xoá/sửa tự nhiên: lưu draft trước
                const nextDraft = raw.replace(/[^\d]/g, "");
                setDraft(d => ({ ...d, [vt.id]: nextDraft }));

                // cập nhật value realtime nếu parse được
                const n = parseQty(nextDraft);
                if (n == null) return; // đang trống => chưa commit, KHÔNG ép về 0

                const next = { ...value };
                if (n === 0) delete next[vt.id];
                else next[vt.id] = n;
                onChange(next);
              }}
              onBlur={() => {
                // rời ô: commit chuẩn
                const n = parseQty(draft[vt.id] ?? "");
                const next = { ...value };

                if (n == null || n === 0) {
                  delete next[vt.id];
                  onChange(next);
                  setDraft(d => ({ ...d, [vt.id]: "" }));
                } else {
                  next[vt.id] = n;
                  onChange(next);
                  setDraft(d => ({ ...d, [vt.id]: String(n) }));
                }
              }}
            />
          </div>
        );
      })}
    </Card>
  );
}

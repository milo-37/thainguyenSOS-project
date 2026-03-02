'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { listClusters } from '@/lib/api';

export default function ClustersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    listClusters(q).then((d: any) => setItems(d.data || d.items || d));
  }, [q]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Tìm theo tên/mô tả"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Link href="/admin/clusters/new">
          <Button>+ Thêm cụm</Button>
        </Link>
      </div>

      <div className="grid gap-3">
        {items?.map((c: any) => (
          <div
            key={c.id}
            className="border rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <div className="font-semibold text-lg">{c.ten}</div>
              <div className="text-sm text-muted-foreground">{c.mo_ta}</div>
              <div className="text-xs text-muted-foreground">
                Thành viên: {c.thanh_viens_count ?? c.members_count ?? 0}
              </div>
            </div>
            <Link className="text-sm underline" href={`/admin/clusters/${c.id}`}>
              Sửa
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { api, assignYeuCau } from '@/lib/api';

type Cluster = { id: number; ten?: string; name?: string };
type User = { id: number; name?: string; ten?: string; email?: string };

type Props = {
  yeuCauId: number;

  // controlled mode
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  onDone?: () => void;

  // optional
  hideTrigger?: boolean;
};

let CACHE_CLUSTERS: Cluster[] | null = null;
let CACHE_USERS: User[] | null = null;

export default function AssignSheet({
  yeuCauId,
  open,
  onOpenChange,
  onDone,
  hideTrigger,
}: Props) {
  const controlled = typeof open === 'boolean' && typeof onOpenChange === 'function';

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlled ? (open as boolean) : internalOpen;
  const setOpen = controlled ? (onOpenChange as (v: boolean) => void) : setInternalOpen;

  const [clusters, setClusters] = useState<Cluster[]>(CACHE_CLUSTERS ?? []);
  const [users, setUsers] = useState<User[]>(CACHE_USERS ?? []);

  const [cumId, setCumId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  const [qCum, setQCum] = useState('');
  const [qUser, setQUser] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // ✅ CHỈ LOAD KHI OPEN + dùng api() để có token + accept json
  useEffect(() => {
    if (!isOpen) return;

    // reset lựa chọn khi mở (nếu muốn giữ lại thì bỏ 2 dòng)
    setCumId('');
    setUserId('');

    const needClusters = !CACHE_CLUSTERS || CACHE_CLUSTERS.length === 0;
    const needUsers = !CACHE_USERS || CACHE_USERS.length === 0;
    if (!needClusters && !needUsers) return;

    const ac = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ac;

    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [cRes, uRes] = await Promise.all([
          needClusters ? api('/cum', { signal: ac.signal, cache: 'no-store' }) : Promise.resolve(null),
          needUsers ? api('/users', { signal: ac.signal, cache: 'no-store' }) : Promise.resolve(null),
        ]);

        if (!alive || ac.signal.aborted) return;

        if (needClusters) {
          const list: Cluster[] = (cRes as any)?.data ?? (cRes as any)?.items ?? (cRes as any) ?? [];
          CACHE_CLUSTERS = Array.isArray(list) ? list : [];
          setClusters(CACHE_CLUSTERS);
        } else {
          setClusters(CACHE_CLUSTERS ?? []);
        }

        if (needUsers) {
          const list: User[] = (uRes as any)?.data ?? (uRes as any)?.items ?? (uRes as any) ?? [];
          CACHE_USERS = Array.isArray(list) ? list : [];
          setUsers(CACHE_USERS);
        } else {
          setUsers(CACHE_USERS ?? []);
        }
      } catch (e: any) {
        if (ac.signal.aborted) return;
        console.error('AssignSheet load failed:', e?.message || e);
      } finally {
        if (!alive || ac.signal.aborted) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [isOpen]);

  const filteredClusters = useMemo(() => {
    const s = qCum.trim().toLowerCase();
    if (!s) return clusters;
    return clusters.filter((c) => (c.ten || c.name || '').toLowerCase().includes(s));
  }, [clusters, qCum]);

  const filteredUsers = useMemo(() => {
    const s = qUser.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => {
      const name = (u.name || u.ten || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(s) || email.includes(s);
    });
  }, [users, qUser]);

  const onAssign = async () => {
    if (saving) return;

    // Cho phép chọn 1 trong 2. Nếu muốn bắt buộc chọn, giữ alert này.
    if (!cumId && !userId) {
      alert('Vui lòng chọn Cụm hoặc Thành viên.');
      return;
    }

    setSaving(true);
    try {
      await assignYeuCau(yeuCauId, {
        cum_id: cumId ? +cumId : undefined,
        user_id: userId ? +userId : undefined,
      });

      setOpen(false);
      onDone?.();
    } catch (e: any) {
      alert(e?.message || 'Lỗi phân công');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      {/* Nếu dùng kiểu cũ: tự render nút trigger */}
      {!controlled && !hideTrigger && (
        <SheetTrigger asChild>
          <Button size="sm" variant="secondary">
            Giao
          </Button>
        </SheetTrigger>
      )}

      <SheetContent className="w-[420px] p-6">
        <SheetHeader>
          <SheetTitle>Giao xử lý yêu cầu #{yeuCauId}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {loading ? (
            <div className="text-sm text-gray-500">Đang tải danh sách…</div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-sm font-medium">Giao cho Cụm</div>
                <Input
                  placeholder="Tìm cụm…"
                  value={qCum}
                  onChange={(e) => setQCum(e.target.value)}
                />
                <select
                  className="border rounded w-full h-10 px-2"
                  value={cumId}
                  onChange={(e) => setCumId(e.target.value)}
                >
                  <option value="">-- Không --</option>
                  {filteredClusters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ten || c.name || `Cụm #${c.id}`}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-gray-500">
                  * Nếu chọn cụm, có thể bỏ trống thành viên.
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Hoặc giao cho Thành viên</div>
                <Input
                  placeholder="Tìm thành viên…"
                  value={qUser}
                  onChange={(e) => setQUser(e.target.value)}
                />
                <select
                  className="border rounded w-full h-10 px-2"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                >
                  <option value="">-- Không --</option>
                  {filteredUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.name || u.ten || `User #${u.id}`) + (u.email ? ` (${u.email})` : '')}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-gray-500">
                  * Nếu chọn thành viên, có thể bỏ trống cụm.
                </div>
              </div>

              <Button onClick={onAssign} disabled={saving}>
                {saving ? 'Đang lưu…' : 'Xác nhận'}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

type User = { id: number | string; name?: string; email?: string };

export default function MemberSheet({
  users,
  valueIds,
  onChange,
  triggerLabel = 'Chọn thành viên',
}: {
  users: User[];
  valueIds: string[];                // ids dạng string
  onChange: (ids: string[]) => void;
  triggerLabel?: string;
}) {
  const [kw, setKw] = useState('');

  const selectedSet = useMemo(() => new Set(valueIds), [valueIds]);

  const selectedUsers = useMemo(
    () => users.filter((u) => selectedSet.has(String(u.id))),
    [users, selectedSet]
  );

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    if (!k) return users;
    return users.filter((u) => {
      const s = `${u.name ?? ''} ${u.email ?? ''}`.toLowerCase();
      return s.includes(k);
    });
  }, [users, kw]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(valueIds.filter((x) => x !== id));
    else onChange([...valueIds, id]);
  };

  const remove = (id: string) => {
    onChange(valueIds.filter((x) => x !== id));
  };

  const clearAll = () => onChange([]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline">
          {triggerLabel} ({valueIds.length})
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Chọn thành viên cụm</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <Input
            placeholder="Tìm theo tên/email..."
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />

          {/* Chips selected */}
          <div className="flex flex-wrap gap-2">
            {selectedUsers.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Chưa chọn thành viên nào
              </div>
            )}
            {selectedUsers.map((u) => (
              <span
                key={String(u.id)}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
              >
                {u.name ?? '(no name)'}
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-black"
                  onClick={() => remove(String(u.id))}
                  aria-label="Xóa"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Đã chọn: {valueIds.length} / {users.length}
            </div>
            <Button type="button" variant="ghost" onClick={clearAll}>
              Xóa hết
            </Button>
          </div>

          {/* List users */}
          <div className="border rounded-xl overflow-hidden">
            <div className="max-h-[55vh] overflow-auto divide-y">
              {filtered.map((u) => {
                const uid = String(u.id);
                const checked = selectedSet.has(uid);
                return (
                  <label
                    key={uid}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(uid)}
                    />
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {u.name ?? '(no name)'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {u.email ?? ''}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Tip: dùng ô tìm kiếm để lọc nhanh, tick để thêm/bỏ.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createCluster, getCluster, updateCluster } from '@/lib/api';
import MapPicker from '@/components/MapPicker';
import MemberSheet from '@/components/MemberSheet';

type FormState = {
  ten: string;
  mo_ta: string;
  chi_huy_id: string | null;
  thanh_vien_ids: string[];
  lat: number | null;
  lng: number | null;
  dia_chi_text: string;
};

const emptyForm: FormState = {
  ten: '',
  mo_ta: '',
  chi_huy_id: null,
  thanh_vien_ids: [],
  lat: null,
  lng: null,
  dia_chi_text: '',
};

function normalizeCluster(raw: any): Partial<FormState> {
  const chiHuyId = raw?.chi_huy_id != null ? String(raw.chi_huy_id) : null;

  const memberIdsRaw =
    raw?.thanh_vien_ids ??
    raw?.member_ids ??
    raw?.thanh_viens?.map((x: any) => x.id) ??
    raw?.members?.map((x: any) => x.id) ??
    raw?.users?.map((x: any) => x.id) ??
    [];

  const memberIds = Array.from(
    new Set<string>(
      [
        ...(memberIdsRaw || []).map((x: unknown) => String(x)),
        ...(chiHuyId ? [chiHuyId] : []),
      ]
    )
  );

  return {
    ten: raw?.ten ?? '',
    mo_ta: raw?.mo_ta ?? '',
    chi_huy_id: chiHuyId,
    thanh_vien_ids: memberIds,
    lat: raw?.lat ?? null,
    lng: raw?.lng ?? null,
    dia_chi_text: raw?.dia_chi_text ?? '',
  };
}

function SectionCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="px-5 py-4 border-b">
        <div className="font-semibold text-gray-900">{title}</div>
        {desc && <div className="text-sm text-muted-foreground mt-1">{desc}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function ClusterForm() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string | undefined) ?? undefined;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL;
  const STYLE = process.env.NEXT_PUBLIC_VIETMAP_STYLE_BASE!;

  useEffect(() => {
    fetchUsers();

    if (id) {
      getCluster(+id).then((raw: any) => {
        const normalized = normalizeCluster(raw);
        setForm((prev) => ({ ...prev, ...normalized }));
      });
    } else {
      setForm(emptyForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchUsers = async () => {
  try {
    if (!API) throw new Error('Missing NEXT_PUBLIC_API_URL. Check .env.local then restart dev server.');

    setLoadingUsers(true);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/users`, {
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(await res.text());
    const d = await res.json();
    setUsers(d?.data ?? []);
  } catch (err) {
    console.error('Load users failed', err);
  } finally {
    setLoadingUsers(false);
  }
};

  const selectedUsers = useMemo(() => {
    const set = new Set(form.thanh_vien_ids);
    return users.filter((u) => set.has(String(u.id)));
  }, [users, form.thanh_vien_ids]);

  const commander = useMemo(() => {
    if (!form.chi_huy_id) return null;
    return users.find((u) => String(u.id) === String(form.chi_huy_id)) ?? null;
  }, [users, form.chi_huy_id]);

  const submit = async () => {
    if (!form.ten.trim()) {
      alert('Vui lòng nhập tên cụm');
      return;
    }

    const payload = {
      ten: form.ten.trim(),
      mo_ta: form.mo_ta,
      chi_huy_id: form.chi_huy_id ? +form.chi_huy_id : null,
      thanh_vien_ids: form.thanh_vien_ids.map((x) => +x),
      lat: form.lat,
      lng: form.lng,
      dia_chi_text: form.dia_chi_text,
    };

    try {
      setSaving(true);
      if (id) await updateCluster(+id, payload);
      else await createCluster(payload);
      router.push('/admin/clusters');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">
              <button className="hover:underline" onClick={() => router.push('/admin/clusters')} type="button">
                Cụm cứu hộ
              </button>
              <span className="mx-2">/</span>
              <span>{id ? 'Sửa cụm' : 'Tạo cụm mới'}</span>
            </div>
            <div className="text-lg font-semibold text-gray-900 truncate">
              {id ? `Cập nhật cụm #${id}` : 'Tạo cụm cứu hộ'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button type="button" onClick={submit} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary strip */}
        <div className="rounded-2xl border bg-white shadow-sm px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium text-gray-900">Tóm tắt</div>
            <div className="text-muted-foreground">
              Chỉ huy: <span className="text-gray-900">{commander?.name ?? 'Chưa chọn'}</span> ·{' '}
              Thành viên: <span className="text-gray-900">{selectedUsers.length}</span> ·{' '}
              Vị trí: <span className="text-gray-900">{form.lat != null && form.lng != null ? 'Đã chọn' : 'Chưa chọn'}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedUsers.slice(0, 6).map((u) => (
              <span key={u.id} className="rounded-full border bg-gray-50 px-3 py-1 text-xs">
                {u.name}
              </span>
            ))}
            {selectedUsers.length > 6 && (
              <span className="rounded-full border bg-gray-50 px-3 py-1 text-xs">
                +{selectedUsers.length - 6}
              </span>
            )}
          </div>
        </div>

        {/* Two columns */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: Info */}
          <div className="lg:col-span-2 space-y-6">
            <SectionCard
              title="Thông tin cụm"
              desc="Nhập tên, mô tả và thiết lập chỉ huy."
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Tên cụm <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={form.ten}
                    onChange={(e) => setForm((prev) => ({ ...prev, ten: e.target.value }))}
                    placeholder="VD: Cụm trung tâm TP Thái Nguyên"
                  />
                  <div className="text-xs text-muted-foreground">
                    Tên rõ ràng giúp phân công & thống kê dễ hơn.
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Mô tả</label>
                  <Textarea
                    value={form.mo_ta || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, mo_ta: e.target.value }))}
                    placeholder="Mô tả phạm vi phụ trách, năng lực, phương tiện..."
                    className="min-h-28"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Chỉ huy cụm</label>
                  <select
  className="border rounded-lg h-10 px-3 w-full bg-white"
  value={form.chi_huy_id ?? ''}
  onChange={(e) => {
    const value = e.target.value || null;

    setForm((prev) => {
      const nextMemberIds = value
        ? Array.from(new Set([...prev.thanh_vien_ids, value]))
        : prev.thanh_vien_ids;

      return {
        ...prev,
        chi_huy_id: value,
        thanh_vien_ids: nextMemberIds,
      };
    });
  }}
  disabled={loadingUsers}
>
                    <option value="">
                      {loadingUsers ? 'Đang tải danh sách...' : '-- Chọn --'}
                    </option>
                    {users.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>

                  {commander && (
                    <div className="text-xs text-muted-foreground">
                      Đã chọn: <span className="text-gray-900">{commander.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Thành viên"
              desc="Mở bảng chọn để thêm/bớt thành viên. Có tìm kiếm và checkbox."
            >
              <div className="flex items-center justify-between gap-3">
                <MemberSheet
  users={users}
  valueIds={form.thanh_vien_ids?.map(String) || []}
  onChange={(ids) =>
    setForm((prev: any) => {
      const nextIds = prev.chi_huy_id
        ? Array.from(new Set([...ids, String(prev.chi_huy_id)]))
        : ids;

      return { ...prev, thanh_vien_ids: nextIds };
    })
  }
  triggerLabel={loadingUsers ? 'Đang tải...' : 'Chọn thành viên'}
/>

                <Button type="button" variant="ghost" onClick={fetchUsers} disabled={loadingUsers}>
                  Làm mới
                </Button>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                Đã chọn: <span className="text-gray-900">{selectedUsers.length}</span> thành viên
              </div>

              {selectedUsers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedUsers.map((u) => (
                    <span key={u.id} className="inline-flex items-center rounded-full border px-3 py-1 text-xs bg-gray-50">
                      {u.name}
                    </span>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Right: Map */}
          <div className="lg:col-span-3 space-y-6">
            <SectionCard
              title="Vị trí cụm"
              desc="Chọn vị trí trên bản đồ hoặc nhập toạ độ thủ công."
            >
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border">
                  <MapPicker
                    styleUrl={STYLE}
                    value={
                      form.lat != null && form.lng != null
                        ? { lat: form.lat, lng: form.lng }
                        : undefined
                    }
                    onChange={(p) => setForm((prev) => ({ ...prev, lat: p.lat, lng: p.lng }))}
                    heightClass="h-[380px]"
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Vĩ độ (lat)</label>
                    <Input
  value={form.lat ?? ''}
  onChange={(e) => {
    const val = e.target.value.trim();

    setForm((prev) => ({
      ...prev,
      lat: val === '' ? null : Number.isNaN(Number(val)) ? prev.lat : Number(val),
    }));
  }}
  placeholder="21.0278"
/>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Kinh độ (lng)</label>
                    <Input
  value={form.lng ?? ''}
  onChange={(e) => {
    const val = e.target.value.trim();

    setForm((prev) => ({
      ...prev,
      lng: val === '' ? null : Number.isNaN(Number(val)) ? prev.lng : Number(val),
    }));
  }}
  placeholder="105.8342"
/>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Địa chỉ (tùy chọn)</label>
                    <Input
                      value={form.dia_chi_text ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          dia_chi_text: e.target.value,
                        }))
                      }
                      placeholder="VD: P. Hoàng Văn Thụ..."
                    />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Tip: click trên bản đồ để set lat/lng nhanh, sau đó bổ sung “địa chỉ” để dễ đọc.
                </div>
              </div>
            </SectionCard>

            {/* Bottom actions (non-sticky fallback for mobile) */}
            <div className="lg:hidden flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={saving} className="flex-1">
                Hủy
              </Button>
              <Button type="button" onClick={submit} disabled={saving} className="flex-1">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

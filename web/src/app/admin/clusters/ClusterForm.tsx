'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createCluster, getCluster, updateCluster } from '@/lib/api';
import MapPicker from '@/components/MapPicker';

export default function ClusterForm() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string | undefined;
    const [form, setForm] = useState<any>({
        ten: '',
        mo_ta: '',
        chi_huy_id: null,
        thanh_vien_ids: [],
        lat: null,
        lng: null,
        dia_chi_text: '',
    });
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        fetchUsers();
        if (id) getCluster(+id).then(setForm);
    }, [id]);

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
                headers: {
                    Authorization: `Bearer ${token ?? ''}`,
                    Accept: 'application/json',
                },
                cache: 'no-store',
            });
            if (!res.ok) throw new Error(await res.text());
            const d = await res.json();
            setUsers(d.data || d);
        } catch (err) {
            console.error('Load users failed', err);
        }
    };

    const submit = async () => {
        if (!form.ten?.trim()) {
            alert('Vui lòng nhập tên cụm');
            return;
        }

        const payload = {
            ...form,
            ten: form.ten.trim(),
            chi_huy_id: form.chi_huy_id ? +form.chi_huy_id : null,
            thanh_vien_ids: form.thanh_vien_ids?.map((x: any) => +x) ?? [],
        };

        if (id) await updateCluster(+id, payload);
        else await createCluster(payload);

        router.push('/admin/clusters');
    };

    const STYLE = process.env.NEXT_PUBLIC_VIETMAP_STYLE_BASE!;

    return (
        <div className="p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Tên cụm</label>
                    <Input
                        value={form.ten}
                        onChange={(e) =>
                            setForm((prev: any) => ({ ...prev, ten: e.target.value }))
                        }
                        placeholder="Nhập tên cụm"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Chỉ huy cụm</label>
                    <select
                        className="border rounded h-10 px-2 w-full"
                        value={form.chi_huy_id || ''}
                        onChange={(e) =>
                            setForm((prev: any) => ({
                                ...prev,
                                chi_huy_id: e.target.value || null,
                            }))
                        }
                    >
                        <option value="">-- Chọn --</option>
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name} ({u.email})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Mô tả</label>
                    <Textarea
                        value={form.mo_ta || ''}
                        onChange={(e) =>
                            setForm((prev: any) => ({ ...prev, mo_ta: e.target.value }))
                        }
                        placeholder="Mô tả cụm cứu hộ"
                    />
                </div>

                <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Thành viên cụm</label>
                    <select
                        multiple
                        className="border rounded min-h-32 p-2 w-full"
                        value={form.thanh_vien_ids?.map(String) || []}
                        onChange={(e) => {
                            const opts = Array.from(e.target.selectedOptions).map(
                                (o) => o.value
                            );
                            setForm((prev: any) => ({ ...prev, thanh_vien_ids: opts }));
                        }}
                    >
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Vị trí cụm (VietMap)</label>

                <MapPicker
                    styleUrl={STYLE}
                    value={
                        form.lat != null && form.lng != null
                            ? { lat: form.lat, lng: form.lng }
                            : undefined
                    }
                    onChange={(p) =>
                        setForm((prev: any) => ({ ...prev, lat: p.lat, lng: p.lng }))
                    }
                    heightClass="h-[380px]"
                />

                <div className="grid md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-xs text-muted-foreground">Vĩ độ (lat)</label>
                        <Input
                            value={form.lat ?? ''}
                            onChange={(e) =>
                                setForm((prev: any) => ({
                                    ...prev,
                                    lat: e.target.value ? +e.target.value : null,
                                }))
                            }
                            placeholder="21.0278"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">
                            Kinh độ (lng)
                        </label>
                        <Input
                            value={form.lng ?? ''}
                            onChange={(e) =>
                                setForm((prev: any) => ({
                                    ...prev,
                                    lng: e.target.value ? +e.target.value : null,
                                }))
                            }
                            placeholder="105.8342"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">
                            Địa chỉ (tùy chọn)
                        </label>
                        <Input
                            value={form.dia_chi_text ?? ''}
                            onChange={(e) =>
                                setForm((prev: any) => ({
                                    ...prev,
                                    dia_chi_text: e.target.value,
                                }))
                            }
                            placeholder="Nhập mô tả địa chỉ"
                        />
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <Button onClick={submit}>Lưu</Button>
                <Button variant="outline" onClick={() => router.back()}>
                    Hủy
                </Button>
            </div>
        </div>
    );
}

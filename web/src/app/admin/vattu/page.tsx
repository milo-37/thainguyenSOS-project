'use client';

import { useEffect, useMemo, useState } from 'react';
import { listVatTu, createVatTu, updateVatTu, deleteVatTu } from '@/lib/api';

type VatTu = {
    id: number; ten: string; donvi?: string | null; ma?: string | null; ghichu?: string | null;
    ton?: number; can?: number; du?: number; // từ API
};
type Meta = { current_page: number; per_page: number; last_page: number; total: number };
type Stat = { tong: number; du: number; thieu: number; thieu_chi_tiet: { vattu_id: number; ten: string; ton: number; can: number; du: number }[] };

export default function VatTuPage() {
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [perPage] = useState(20);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    const [rows, setRows] = useState<VatTu[]>([]);
    const [meta, setMeta] = useState<Meta>({ current_page: 1, per_page: 20, last_page: 1, total: 0 });
    const [stat, setStat] = useState<Stat>({ tong: 0, du: 0, thieu: 0, thieu_chi_tiet: [] });

    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<VatTu | null>(null);
    const [frm, setFrm] = useState<{ ten: string; donvi?: string; ma?: string; ghichu?: string }>({ ten: '' });

    const load = async (_page = page) => {
        try {
            setLoading(true);
            const res = await listVatTu({ q, page: _page, per_page: perPage });
            setRows(res.data || []);
            setMeta(res.meta);
            setStat(res.thongke);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(1); }, []);

    const onSearch = async (e: React.FormEvent) => { e.preventDefault(); setPage(1); await load(1); };

    const openCreate = () => {
        setEditing(null);
        setFrm({ ten: '', donvi: '', ma: '', ghichu: '' });
        setErrors({});
        setOpen(true);
    };

    const openEdit = (r: VatTu) => {
        setEditing(r);
        setFrm({
            ten: r.ten,
            donvi: r.donvi || '',
            ma: r.ma || '',
            ghichu: r.ghichu || '',
        });
        setErrors({});
        setOpen(true);
    };

    const validateForm = () => {
        const nextErrors: Record<string, string> = {};

        if (!frm.ten?.trim()) nextErrors.ten = 'Tên vật tư là bắt buộc';
        if (!frm.ma?.trim()) nextErrors.ma = 'Mã vật tư là bắt buộc';
        if (!frm.donvi?.trim()) nextErrors.donvi = 'Đơn vị tính là bắt buộc';

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const save = async () => {
        if (!validateForm()) return;

        try {
            setSaving(true);
            setErrors({});

            const payload = {
                ten: frm.ten.trim(),
                ma: (frm.ma || '').trim().toLowerCase().replace(/\s+/g, ''),
                donvi: (frm.donvi || '').trim(),
                ghichu: (frm.ghichu || '').trim(),
            };

            if (editing) await updateVatTu(editing.id, payload);
            else await createVatTu(payload);

            setOpen(false);
            await load(editing ? meta.current_page : 1);
            alert(editing ? 'Đã cập nhật' : 'Đã thêm');
        } catch (err: any) {
            if (err?.errors) {
                setErrors(err.errors);
            } else {
                alert(err?.message || 'Lỗi lưu');
            }
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: number) => {
        if (!confirm('Xóa vật tư này?')) return;

        try {
            await deleteVatTu(id);
            await load(meta.current_page);
            alert('Đã xóa vật tư');
        } catch (e: any) {
            alert(e?.message || 'Không thể xóa vật tư đã phát sinh dữ liệu');
        }
    };

    const duPercent = useMemo(() => {
        if (!stat.tong) return 0;
        return Math.round((stat.du / stat.tong) * 100);
    }, [stat]);

    return (
        <div className="p-4 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border p-4">
                    <div className="text-sm text-gray-500">Tổng vật tư</div>
                    <div className="text-2xl font-semibold">{stat.tong}</div>
                </div>
                <div className="rounded-xl border p-4">
                    <div className="text-sm text-gray-500">Đủ/Dư</div>
                    <div className="text-2xl font-semibold">{stat.du}</div>
                    <div className="text-xs text-gray-500 mt-1">{duPercent}% đủ</div>
                </div>
                <div className="rounded-xl border p-4">
                    <div className="text-sm text-gray-500">Thiếu</div>
                    <div className="text-2xl font-semibold text-red-600">{stat.thieu}</div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2">
                <form onSubmit={onSearch} className="flex items-center gap-2">
                    <input className="h-10 border rounded px-3" placeholder="Tìm tên/mã…" value={q} onChange={e => setQ(e.target.value)} />
                    <button className="h-10 px-3 rounded border">Tìm</button>
                </form>
                <div className="ml-auto">
                    <button className="h-10 px-3 rounded border" onClick={openCreate}>+ Thêm vật tư</button>
                </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b">
                            <th className="p-2 text-left w-[36px]">#</th>
                            <th className="p-2 text-left">Tên</th>
                            <th className="p-2 text-left">Mã</th>
                            <th className="p-2 text-left">Đơn vị</th>
                            <th className="p-2 text-right">Tồn</th>
                            <th className="p-2 text-right">Cần</th>
                            <th className="p-2 text-right">Dư (±)</th>
                            <th className="p-2 text-center">Trạng thái</th>
                            <th className="p-2 text-right w-[140px]"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, idx) => (
                            <tr key={r.id} className="border-b last:border-0">
                                <td className="p-2">{(meta.current_page - 1) * meta.per_page + idx + 1}</td>
                                <td className="p-2">{r.ten}</td>
                                <td className="p-2">{r.ma || ''}</td>
                                <td className="p-2">{r.donvi || ''}</td>
                                <td className="p-2 text-right">{Number(r.ton || 0)}</td>
                                <td className="p-2 text-right">{Number(r.can || 0)}</td>
                                <td className={`p-2 text-right font-semibold ${(r.du || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>{Number(r.du || 0)}</td>
                                <td className="p-2 text-center">
                                    {(r.du || 0) < 0 ? (
                                        <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                                            Thiếu
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                                            Đủ
                                        </span>
                                    )}
                                </td>
                                <td className="p-2 text-right">
                                    <button className="px-2 py-1 rounded border mr-2" onClick={() => openEdit(r)}>Sửa</button>
                                    <button className="px-2 py-1 rounded border text-red-600" onClick={() => remove(r.id)}>Xóa</button>
                                </td>
                            </tr>
                        ))}
                        {loading && (
                            <tr>
                                <td colSpan={9} className="p-4 text-center text-gray-500">
                                    Đang tải dữ liệu...
                                </td>
                            </tr>
                        )}
                        {!loading && !rows.length && (
                            <tr>
                                <td colSpan={9} className="p-4 text-center text-gray-500">
                                    Không có dữ liệu.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {meta.last_page > 1 && (
                <div className="flex items-center gap-2 justify-end">
                    <button
                        className="px-3 py-1.5 rounded border disabled:opacity-50"
                        onClick={() => { const p = Math.max(1, meta.current_page - 1); setPage(p); load(p); }}
                        disabled={meta.current_page <= 1}
                    >Trước</button>
                    <div className="text-sm">Trang {meta.current_page}/{meta.last_page}</div>
                    <button
                        className="px-3 py-1.5 rounded border disabled:opacity-50"
                        onClick={() => { const p = Math.min(meta.last_page, meta.current_page + 1); setPage(p); load(p); }}
                        disabled={meta.current_page >= meta.last_page}
                    >Sau</button>
                </div>
            )}

            {/* Modal */}
            {open && (
                <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center">
                    <div className="bg-white rounded-lg w-full max-w-lg p-4 space-y-3">
                        <div className="text-lg font-semibold">{editing ? 'Sửa vật tư' : 'Thêm vật tư'}</div>

                        <div className="grid gap-3">
                            <div>
                                <label className="text-sm">Tên</label>
                                <input
                                    className="mt-1 h-10 border rounded px-3 w-full"
                                    value={frm.ten}
                                    onChange={e => setFrm({ ...frm, ten: e.target.value })}
                                />
                                {errors.ten && <div className="mt-1 text-sm text-red-600">{errors.ten}</div>}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm">Mã</label>
                                    <input
                                        className="mt-1 h-10 border rounded px-3 w-full"
                                        value={frm.ma || ''}
                                        onChange={e =>
                                            setFrm({
                                                ...frm,
                                                ma: e.target.value.toLowerCase().replace(/\s+/g, ''),
                                            })
                                        }
                                    />
                                    {errors.ma && <div className="mt-1 text-sm text-red-600">{errors.ma}</div>}
                                </div>
                                <div>
                                    <label className="text-sm">Đơn vị tính</label>
                                    <input
                                        placeholder="Cái/chai/thùng"
                                        className="mt-1 h-10 border rounded px-3 w-full"
                                        value={frm.donvi || ''}
                                        onChange={e => setFrm({ ...frm, donvi: e.target.value })}
                                    />
                                    {errors.donvi && <div className="mt-1 text-sm text-red-600">{errors.donvi}</div>}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm">Ghi chú</label>
                                <textarea className="mt-1 w-full border rounded p-2" value={frm.ghichu || ''} onChange={e => setFrm({ ...frm, ghichu: e.target.value })} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button className="px-3 py-1.5 rounded border" onClick={() => setOpen(false)} disabled={saving}>Hủy</button>
                            <button className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-60" onClick={save} disabled={saving}>
                                {saving ? 'Đang lưu…' : 'Lưu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

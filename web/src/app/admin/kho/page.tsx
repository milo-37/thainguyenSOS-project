'use client';

import { useEffect, useState } from 'react';
import {
    listWarehouses,
    stockByWarehouse,
    historyWarehouse,
    nhapKho,
    xuatKho,
    chuyenKho,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    listClusters,
    listVatTu,
} from '@/lib/api';

type Cluster = { id:number; ten:string };
type Warehouse = { id:number; ten:string; mo_ta?:string; dia_chi?:string; ghichu?:string; cum_id?:number|null };

// TỒN trả về từ BE (/admin/kho/{id}/ton)
type TonItem = { id:number; ten:string; donvi?:string; so_luong:number };

// Vật tư master (đổ dropdown cho nhập/xuất/chuyển)
type VattuMaster = { id:number; ten:string; donvi?:string };

type Row = { vat_tu_id:number; ten?:string; so_luong:number; don_vi?:string };

type HistoryDetail = { vat_tu_id:number; ten?:string; so_luong:number; don_vi?:string };
type HistoryItem = {
    id:number;
    loai:'nhap'|'xuat'|'chuyen';
    kho_from_id?: number|null;
    kho_to_id?: number|null;
    ghi_chu?: string|null;
    created_at: string;
    chi_tiet: HistoryDetail[];
};

export default function KhoPage() {
    const [khos, setKhos] = useState<Warehouse[]>([]);
    const [selectedKho, setSelectedKho] = useState<number | ''>('');
    const [tab, setTab] = useState<'ton'|'nhap'|'xuat'|'chuyen'|'lichsu'>('ton');

    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [vatTuMaster, setVatTuMaster] = useState<VattuMaster[]>([]);

    const [ton, setTon] = useState<TonItem[]>([]);
    const [lichsu, setLichsu] = useState<HistoryItem[]>([]);

    const [rows, setRows] = useState<Row[]>([{ vat_tu_id: 0, so_luong: 1 }]);
    const [note, setNote] = useState('');
    const [toKho, setToKho] = useState<number | ''>('');

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Warehouse | null>(null);
    const [saving, setSaving] = useState(false);
    const [frm, setFrm] = useState<{ten:string; mo_ta?:string; dia_chi?:string; ghichu?:string; cum_id?:string}>({ ten: '' });

    // ======= load danh sách kho + cụm + vật tư master
    useEffect(() => {
        (async () => {
            const k = await listWarehouses();
            setKhos((k?.data ?? k) as Warehouse[]);

            const c = await listClusters('');
            setClusters((c?.data ?? c) as Cluster[]);

            // vật tư master để luôn chọn được khi kho chưa có tồn
            const vt = await listVatTu({ per_page: 1000 });
            const arr = (vt?.data ?? vt) as any[];
            setVatTuMaster(arr.map(x => ({ id: x.id, ten: x.ten, donvi: x.donvi })));
        })().catch(console.error);
    }, []);

    // ======= load tồn/lich sử theo kho + tab
    async function loadTon(khoId:number) {
        const res = await stockByWarehouse(khoId);
        setTon((res?.data ?? res) as TonItem[]);
    }
    async function loadHistory(khoId:number) {
        const res = await historyWarehouse(khoId, { per_page: 100 });
        setLichsu((res?.data ?? res) as HistoryItem[]);
    }

    useEffect(() => {
        if (!selectedKho) return;
        if (tab === 'ton' || tab === 'nhap' || tab === 'xuat' || tab === 'chuyen') {
            loadTon(Number(selectedKho)).catch(console.error);
        }
        if (tab === 'lichsu') {
            loadHistory(Number(selectedKho)).catch(console.error);
        }
    }, [selectedKho, tab]);

    // ======= helpers UI
    const addRow = () => setRows(r => [...r, { vat_tu_id: 0, so_luong: 1 }]);
    const removeRow = (i:number) => setRows(r => r.filter((_,idx)=> idx!==i));
    const changeRow = (i:number, patch:Partial<Row>) => setRows(r => r.map((x,idx)=> idx===i ? { ...x, ...patch } : x));

    // ======= submit
    const submitNhap = async () => {
        if (!selectedKho) return alert('Chọn kho nhận');
        const items = rows
            .filter(r => r.vat_tu_id && r.so_luong > 0)
            .map(r => ({ vat_tu_id: r.vat_tu_id, so_luong: r.so_luong, don_vi: r.don_vi || undefined }));
        if (!items.length) return alert('Thêm vật tư');

        await nhapKho({ kho_to_id: Number(selectedKho), ghi_chu: note || undefined, items });
        setNote(''); setRows([{ vat_tu_id: 0, so_luong: 1 }]);
        await loadTon(Number(selectedKho));
        alert('Đã nhập kho.');
    };

    const submitXuat = async () => {
        if (!selectedKho) return alert('Chọn kho xuất');
        const items = rows
            .filter(r => r.vat_tu_id && r.so_luong > 0)
            .map(r => ({ vat_tu_id: r.vat_tu_id, so_luong: r.so_luong, don_vi: r.don_vi || undefined }));
        if (!items.length) return alert('Thêm vật tư');

        await xuatKho({ kho_from_id: Number(selectedKho), ghi_chu: note || undefined, items });
        setNote(''); setRows([{ vat_tu_id: 0, so_luong: 1 }]);
        await loadTon(Number(selectedKho));
        alert('Đã xuất kho.');
    };

    const submitChuyen = async () => {
        if (!selectedKho) return alert('Chọn kho xuất');
        if (!toKho) return alert('Chọn kho nhận');

        const items = rows
            .filter(r => r.vat_tu_id && r.so_luong > 0)
            .map(r => ({ vat_tu_id: r.vat_tu_id, so_luong: r.so_luong, don_vi: r.don_vi || undefined }));
        if (!items.length) return alert('Thêm vật tư');

        await chuyenKho({ kho_from_id: Number(selectedKho), kho_to_id: Number(toKho), ghi_chu: note || undefined, items });
        setNote(''); setRows([{ vat_tu_id: 0, so_luong: 1 }]);
        await loadTon(Number(selectedKho));
        alert('Đã chuyển kho.');
    };

    // ======= CRUD kho
    const openCreate = () => {
        setEditing(null);
        setFrm({ ten: '', mo_ta: '', dia_chi: '', ghichu: '', cum_id: '' });
        setFormOpen(true);
    };
    const openEdit = () => {
        const k = khos.find(k => k.id === selectedKho);
        if (!k) return;
        setEditing(k);
        setFrm({
            ten: k.ten || '',
            mo_ta: k.mo_ta || '',
            dia_chi: k.dia_chi || '',
            ghichu: k.ghichu || '',
            cum_id: k.cum_id ? String(k.cum_id) : '',
        });
        setFormOpen(true);
    };
    const doDelete = async () => {
        if (!selectedKho) return;
        if (!confirm('Xóa kho này?')) return;
        await deleteWarehouse(Number(selectedKho));
        const k = await listWarehouses();
        const arr = (k?.data ?? k) as Warehouse[];
        setKhos(arr);
        setSelectedKho('');
        alert('Đã xóa kho.');
    };
    const saveWarehouse = async () => {
        try {
            setSaving(true);
            if (editing) {
                await updateWarehouse(editing.id, {
                    ten: frm.ten.trim(),
                    mo_ta: frm.mo_ta?.trim() || undefined,
                    dia_chi: frm.dia_chi?.trim() || undefined,
                    ghichu: frm.ghichu?.trim() || undefined,
                    cum_id: frm.cum_id ? Number(frm.cum_id) : undefined,
                });
                alert('Đã cập nhật kho.');
            } else {
                const created = await createWarehouse({
                    ten: frm.ten.trim(),
                    mo_ta: frm.mo_ta?.trim() || undefined,
                    dia_chi: frm.dia_chi?.trim() || undefined,
                    ghichu: frm.ghichu?.trim() || undefined,
                    cum_id: frm.cum_id ? Number(frm.cum_id) : undefined,
                });
                alert('Đã tạo kho.');
                const newId = created?.data?.id ?? created?.id;
                if (newId) setSelectedKho(newId);
            }
            const k = await listWarehouses();
            setKhos((k?.data ?? k) as Warehouse[]);
            setFormOpen(false);
        } catch (e:any) {
            alert(e?.message || 'Lưu kho thất bại');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <select
                        className="h-10 border rounded px-2 min-w-[260px]"
                        value={selectedKho}
                        onChange={e => setSelectedKho(e.target.value ? Number(e.target.value) : '')}
                    >
                        <option value="">-- Chọn kho --</option>
                        {khos.map(k => <option key={k.id} value={k.id}>
                            {k.ten}{k.cum_id ? ` (cụm #${k.cum_id})` : ''}
                        </option>)}
                    </select>

                    <button className="h-10 px-3 rounded border" onClick={openCreate}>+ Thêm kho</button>

                    {!!selectedKho && (
                        <>
                            <button className="h-10 px-3 rounded border" onClick={openEdit}>Sửa</button>
                            <button className="h-10 px-3 rounded border text-red-600" onClick={doDelete}>Xóa</button>
                        </>
                    )}
                </div>

                <div className="ml-auto flex gap-2">
                    {(['ton','nhap','xuat','chuyen','lichsu'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-3 py-1.5 rounded-full border ${tab===t?'bg-black text-white':'bg-white'}`}
                        >
                            {t==='ton'?'TỒN':t==='nhap'?'NHẬP':t==='xuat'?'XUẤT':t==='chuyen'?'CHUYỂN':'LỊCH SỬ'}
                        </button>
                    ))}
                </div>
            </div>

            {!selectedKho && <div className="text-sm text-muted-foreground">Chọn 1 kho để xem dữ liệu.</div>}

            {/* ========= TỒN ========= */}
            {selectedKho && tab === 'ton' && (
                <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="bg-gray-50 border-b">
                            <th className="text-left p-2">Vật tư</th>
                            <th className="text-left p-2">Đơn vị</th>
                            <th className="text-right p-2">Số lượng</th>
                        </tr>
                        </thead>
                        <tbody>
                        {(ton || []).map(r => (
                            <tr key={r.id} className="border-b last:border-0">
                                <td className="p-2">{r.ten}</td>
                                <td className="p-2">{r.donvi || ''}</td>
                                <td className="p-2 text-right font-semibold">{Number(r.so_luong || 0)}</td>
                            </tr>
                        ))}
                        {!ton?.length && (
                            <tr><td colSpan={3} className="p-4 text-center text-sm text-muted-foreground">Chưa có dữ liệu tồn.</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ========= NHẬP / XUẤT / CHUYỂN ========= */}
            {selectedKho && (tab === 'nhap' || tab === 'xuat' || tab === 'chuyen') && (
                <div className="grid gap-3">
                    <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="p-2 text-left">Vật tư</th>
                                <th className="p-2 text-left">Đơn vị</th>
                                <th className="p-2 text-right">Số lượng</th>
                                <th className="p-2"></th>
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map((r, i) => (
                                <tr key={i} className="border-b last:border-0">
                                    <td className="p-2">
                                        <select
                                            className="h-9 border rounded px-2 min-w-[240px]"
                                            value={r.vat_tu_id}
                                            onChange={e => {
                                                const id = Number(e.target.value);
                                                const vt = vatTuMaster.find(v => v.id === id);
                                                changeRow(i, { vat_tu_id: id, ten: vt?.ten, don_vi: vt?.donvi });
                                            }}
                                        >
                                            <option value={0}>-- Chọn vật tư --</option>
                                            {vatTuMaster.map(v => (
                                                <option key={v.id} value={v.id}>{v.ten}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <input
                                            className="h-9 border rounded px-2 w-28"
                                            value={r.don_vi || ''}
                                            onChange={e => changeRow(i, { don_vi: e.target.value })}
                                            placeholder="đơn vị"
                                        />
                                    </td>
                                    <td className="p-2 text-right">
                                        <input
                                            type="number" min={0} step="0.0001"
                                            className="h-9 border rounded px-2 w-32 text-right"
                                            value={r.so_luong}
                                            onChange={e => changeRow(i, { so_luong: Number(e.target.value) })}
                                        />
                                    </td>
                                    <td className="p-2">
                                        <button className="text-red-600 text-xs" onClick={() => removeRow(i)}>Xóa</button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={addRow} className="px-3 py-1.5 rounded border">Thêm dòng</button>

                        {tab === 'chuyen' && (
                            <div className="flex items-center gap-2 ml-4">
                                <span className="text-sm">Tới kho</span>
                                <select
                                    className="h-9 border rounded px-2"
                                    value={toKho}
                                    onChange={e => setToKho(e.target.value ? Number(e.target.value) : '')}
                                >
                                    <option value="">-- chọn kho nhận --</option>
                                    {khos.filter(k => k.id !== selectedKho).map(k => (
                                        <option key={k.id} value={k.id}>{k.ten}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div>
            <textarea
                className="w-full border rounded p-2 min-h-[80px]"
                placeholder="Ghi chú…"
                value={note}
                onChange={e => setNote(e.target.value)}
            />
                    </div>

                    <div className="flex gap-2">
                        {tab === 'nhap'   && <button onClick={submitNhap}   className="px-4 py-2 rounded bg-black text-white">Ghi phiếu nhập</button>}
                        {tab === 'xuat'   && <button onClick={submitXuat}   className="px-4 py-2 rounded bg-black text-white">Ghi phiếu xuất</button>}
                        {tab === 'chuyen' && <button onClick={submitChuyen} className="px-4 py-2 rounded bg-black text-white">Ghi phiếu chuyển</button>}
                    </div>
                </div>
            )}

            {/* ========= LỊCH SỬ ========= */}
            {selectedKho && tab === 'lichsu' && (
                <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="bg-gray-50 border-b">
                            <th className="p-2 text-left">Thời gian</th>
                            <th className="p-2 text-left">Loại</th>
                            <th className="p-2 text-left">Từ kho</th>
                            <th className="p-2 text-left">Đến kho</th>
                            <th className="p-2 text-left">Ghi chú</th>
                            <th className="p-2 text-left">Chi tiết</th>
                        </tr>
                        </thead>
                        <tbody>
                        {(lichsu || []).map(p => (
                            <tr key={p.id} className="border-b last:border-0 align-top">
                                <td className="p-2">{new Date(p.created_at).toLocaleString()}</td>
                                <td className="p-2 font-medium uppercase">{p.loai}</td>
                                <td className="p-2">{p.kho_from_id ?? ''}</td>
                                <td className="p-2">{p.kho_to_id ?? ''}</td>
                                <td className="p-2">{p.ghi_chu ?? ''}</td>
                                <td className="p-2">
                                    <ul className="list-disc pl-5">
                                        {(p.chi_tiet || []).map((d, idx) => (
                                            <li key={idx}>{d.ten} × {d.so_luong} {d.don_vi || ''}</li>
                                        ))}
                                    </ul>
                                </td>
                            </tr>
                        ))}
                        {!lichsu?.length && (
                            <tr><td colSpan={6} className="p-4 text-center text-sm text-muted-foreground">Chưa có lịch sử.</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ========= MODAL THÊM/SỬA KHO ========= */}
            {formOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center">
                    <div className="bg-white rounded-lg w-full max-w-lg p-4 space-y-3">
                        <div className="text-lg font-semibold">{editing ? 'Sửa kho' : 'Thêm kho'}</div>

                        <div className="grid gap-3">
                            <div>
                                <label className="text-sm">Tên kho</label>
                                <input
                                    className="mt-1 w-full h-10 border rounded px-2"
                                    value={frm.ten}
                                    onChange={e => setFrm({ ...frm, ten: e.target.value })}
                                />
                            </div>

                            <div className="grid md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm">Địa chỉ</label>
                                    <input
                                        className="mt-1 w-full h-10 border rounded px-2"
                                        value={frm.dia_chi || ''}
                                        onChange={e => setFrm({ ...frm, dia_chi: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm">Cụm</label>
                                    <select
                                        className="mt-1 w-full h-10 border rounded px-2"
                                        value={frm.cum_id || ''}
                                        onChange={e => setFrm({ ...frm, cum_id: e.target.value })}
                                    >
                                        <option value="">-- Không gắn cụm --</option>
                                        {clusters.map(c => (
                                            <option key={c.id} value={c.id}>{c.ten}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm">Mô tả</label>
                                <textarea
                                    className="mt-1 w-full border rounded p-2"
                                    value={frm.mo_ta || ''}
                                    onChange={e => setFrm({ ...frm, mo_ta: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-sm">Ghi chú</label>
                                <textarea
                                    className="mt-1 w-full border rounded p-2"
                                    value={frm.ghichu || ''}
                                    onChange={e => setFrm({ ...frm, ghichu: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button className="px-3 py-1.5 rounded border" onClick={() => setFormOpen(false)} disabled={saving}>Hủy</button>
                            <button className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-60" onClick={saveWarehouse} disabled={saving}>
                                {saving ? 'Đang lưu…' : 'Lưu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

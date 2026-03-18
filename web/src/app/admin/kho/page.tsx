'use client';

import { useEffect, useMemo, useState } from 'react';
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

type Cluster = { id: number; ten: string };
type Warehouse = { id: number; ten: string; mo_ta?: string; dia_chi?: string; ghichu?: string; cum_id?: number | null };

// TỒN trả về từ BE (/admin/kho/{id}/ton)
type TonItem = { id: number; ten: string; donvi?: string; so_luong: number };

// Vật tư master (đổ dropdown cho nhập/xuất/chuyển)
type VattuMaster = { id: number; ten: string; donvi?: string };

type Row = { vat_tu_id: number; ten?: string; so_luong: number; don_vi?: string };

type HistoryActor = {
  id: number;
  ten: string;
  email?: string;
};

type HistoryDetail = {
  vat_tu_id: number;
  ten?: string;
  so_luong: number;
  don_vi?: string;
};

type HistoryItem = {
  id: number;
  loai: 'nhap' | 'xuat' | 'chuyen';
  kho_from_id?: number | null;
  kho_to_id?: number | null;
  nguoi_tao_id?: number | null;
  nguoi_tao?: HistoryActor | null;
  ghi_chu?: string | null;
  created_at: string;
  chi_tiet: HistoryDetail[];
};

type TabKey = 'ton' | 'nhap' | 'xuat' | 'chuyen' | 'lichsu';

function cx(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(' ');
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function badgeLoai(loai: HistoryItem['loai']) {
  if (loai === 'nhap') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (loai === 'xuat') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
}

export default function KhoPage() {
  const [khos, setKhos] = useState<Warehouse[]>([]);
  const [selectedKho, setSelectedKho] = useState<number | ''>('');
  const [tab, setTab] = useState<TabKey>('ton');

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [vatTuMaster, setVatTuMaster] = useState<VattuMaster[]>([]);

  const [ton, setTon] = useState<TonItem[]>([]);
  const [lichsu, setLichsu] = useState<HistoryItem[]>([]);

  const [rows, setRows] = useState<Row[]>([{ vat_tu_id: 0, so_luong: 0 }]);
  const [note, setNote] = useState('');
  const [toKho, setToKho] = useState<number | ''>('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [saving, setSaving] = useState(false);
  const [frm, setFrm] = useState<{ ten: string; mo_ta?: string; dia_chi?: string; ghichu?: string; cum_id?: string }>({ ten: '' });

  const [loadingKhos, setLoadingKhos] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // map khoId -> ten (để lịch sử hiển thị đẹp)
  const khoNameMap = useMemo(() => {
    const m = new Map<number, string>();
    khos.forEach(k => m.set(k.id, k.ten));
    return m;
  }, [khos]);

  const selectedKhoObj = useMemo(() => khos.find(k => k.id === selectedKho) ?? null, [khos, selectedKho]);

  // ======= tồn map: vat_tu_id -> so_luong tồn
  const tonMap = useMemo(() => {
    const m = new Map<number, number>();
    (ton || []).forEach(t => m.set(t.id, Number(t.so_luong || 0)));
    return m;
  }, [ton]);

  // ======= load danh sách kho + cụm + vật tư master
  useEffect(() => {
    (async () => {
      setLoadingKhos(true);
      try {
        const [k, c, vt] = await Promise.all([listWarehouses(), listClusters(''), listVatTu({ per_page: 1000 })]);
        setKhos((k?.data ?? k) as Warehouse[]);
        setClusters((c?.data ?? c) as Cluster[]);

        const arr = (vt?.data ?? vt) as any[];
        setVatTuMaster(arr.map(x => ({ id: x.id, ten: x.ten, donvi: x.donvi })));
      } catch (e) {
        console.error(e);
        alert('Không tải được dữ liệu khởi tạo.');
      } finally {
        setLoadingKhos(false);
      }
    })();
  }, []);

  // ======= load tồn/lich sử theo kho + tab
  async function loadTon(khoId: number) {
    const res = await stockByWarehouse(khoId);
    setTon((res?.data ?? res) as TonItem[]);
  }
  async function loadHistory(khoId: number) {
    const res = await historyWarehouse(khoId, { per_page: 100 });
    setLichsu((res?.data ?? res) as HistoryItem[]);
  }

  useEffect(() => {
    if (!selectedKho) return;
    (async () => {
      setLoadingData(true);
      try {
        if (tab === 'lichsu') await loadHistory(Number(selectedKho));
        else await loadTon(Number(selectedKho));
      } catch (e) {
        console.error(e);
        alert('Không tải được dữ liệu kho.');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [selectedKho, tab]);

  // ======= helpers UI
  const addRow = () => setRows(r => [...r, { vat_tu_id: 0, so_luong: 0 }]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const changeRow = (i: number, patch: Partial<Row>) => setRows(r => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const resetPhieu = () => {
    setNote('');
    setRows([{ vat_tu_id: 0, so_luong: 0 }]);
    setToKho('');
  };

  // ======= nghiệp vụ: gom + check vượt tồn (tính theo tổng nếu trùng vật tư)
  function buildItems() {
    return rows
      .filter(r => r.vat_tu_id && r.so_luong > 0)
      .map(r => ({ vat_tu_id: r.vat_tu_id, so_luong: Number(r.so_luong || 0), don_vi: r.don_vi || undefined }));
  }

  function aggregateRequested(items: Array<{ vat_tu_id: number; so_luong: number }>) {
    const m = new Map<number, number>();
    for (const it of items) {
      m.set(it.vat_tu_id, (m.get(it.vat_tu_id) || 0) + Number(it.so_luong || 0));
    }
    return m;
  }

  function checkOverStock(items: Array<{ vat_tu_id: number; so_luong: number }>) {
    const req = aggregateRequested(items);
    const overs: Array<{ vat_tu_id: number; ten: string; req: number; avail: number }> = [];

    req.forEach((reqQty, vtId) => {
      const avail = tonMap.get(vtId) ?? 0;
      if (reqQty > avail) {
        const name =
          vatTuMaster.find(v => v.id === vtId)?.ten ||
          ton.find(t => t.id === vtId)?.ten ||
          `#${vtId}`;
        overs.push({ vat_tu_id: vtId, ten: name, req: reqQty, avail });
      }
    });

    return overs;
  }

  // ======= “tối đa có thể xuất” theo tồn (phân bổ theo thứ tự dòng)
  // Với mỗi dòng i, max = tồn(vt) - tổng đã dùng ở các dòng < i (cùng vt)
  const rowCaps = useMemo(() => {
    const used = new Map<number, number>();
    const caps = rows.map(r => {
      const vtId = r.vat_tu_id;
      if (!vtId) return { avail: 0, usedBefore: 0, maxForRow: 0, remainingAfterThisRow: 0 };

      const avail = tonMap.get(vtId) ?? 0;
      const usedBefore = used.get(vtId) ?? 0;
      const maxForRow = Math.max(0, avail - usedBefore);

      // cập nhật used theo qty hiện tại (để dòng sau tính đúng)
      const qty = Number(r.so_luong || 0);
      used.set(vtId, usedBefore + Math.max(0, qty));

      const remainingAfterThisRow = Math.max(0, avail - (usedBefore + Math.max(0, qty)));
      return { avail, usedBefore, maxForRow, remainingAfterThisRow };
    });

    return caps;
  }, [rows, tonMap]);

  const overStockList = useMemo(() => {
    if (!(tab === 'xuat' || tab === 'chuyen')) return [];
    const items = rows
      .filter(r => r.vat_tu_id && r.so_luong > 0)
      .map(r => ({ vat_tu_id: r.vat_tu_id, so_luong: Number(r.so_luong || 0) }));
    return checkOverStock(items);
  }, [rows, tab, tonMap, vatTuMaster, ton]);

  const hasOverStock = (tab === 'xuat' || tab === 'chuyen') && overStockList.length > 0;

  const canSubmit = useMemo(() => {
    const items = rows.filter(r => r.vat_tu_id && r.so_luong > 0);
    if (!selectedKho) return false;
    if (!items.length) return false;
    if (tab === 'chuyen' && !toKho) return false;
    if (tab === 'xuat' || tab === 'chuyen') {
      if (hasOverStock) return false;
    }
    return true;
  }, [rows, selectedKho, tab, toKho, hasOverStock]);

  // clamp khi blur (trải nghiệm “nhập thoải mái rồi tự chỉnh”)
  const clampRowToMax = (i: number) => {
    if (!(tab === 'xuat' || tab === 'chuyen')) return;
    const r = rows[i];
    if (!r?.vat_tu_id) return;
    const cap = rowCaps[i]?.maxForRow ?? 0;
    const next = clamp(Number(r.so_luong || 0), 0, cap);
    if (next !== Number(r.so_luong || 0)) changeRow(i, { so_luong: next });
  };

  // nút “Tối đa” cho dòng i
  const fillMaxForRow = (i: number) => {
    if (!(tab === 'xuat' || tab === 'chuyen')) return;
    const r = rows[i];
    if (!r?.vat_tu_id) return;
    const cap = rowCaps[i]?.maxForRow ?? 0;
    changeRow(i, { so_luong: cap });
  };

  // ======= submit
  const submitNhap = async () => {
    if (!selectedKho) return alert('Chọn kho nhận');
    const items = buildItems();
    if (!items.length) return alert('Thêm vật tư');

    setSubmitting(true);
    try {
      await nhapKho({ kho_to_id: Number(selectedKho), ghi_chu: note || undefined, items });
      resetPhieu();
      await loadTon(Number(selectedKho));
      alert('Đã nhập kho.');
    } catch (e: any) {
      alert(e?.message || 'Nhập kho thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const submitXuat = async () => {
    if (!selectedKho) return alert('Chọn kho xuất');
    const items = buildItems();
    if (!items.length) return alert('Thêm vật tư');

    // ✅ check vượt tồn (theo tổng)
    const overs = checkOverStock(items.map(x => ({ vat_tu_id: x.vat_tu_id, so_luong: x.so_luong })));
    if (overs.length) {
      alert('Xuất vượt tồn:\n' + overs.map(o => `- ${o.ten}: yêu cầu ${o.req} > tồn ${o.avail}`).join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      await xuatKho({ kho_from_id: Number(selectedKho), ghi_chu: note || undefined, items });
      resetPhieu();
      await loadTon(Number(selectedKho));
      alert('Đã xuất kho.');
    } catch (e: any) {
      alert(e?.message || 'Xuất kho thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const submitChuyen = async () => {
    if (!selectedKho) return alert('Chọn kho xuất');
    if (!toKho) return alert('Chọn kho nhận');
    const items = buildItems();
    if (!items.length) return alert('Thêm vật tư');

    // ✅ check vượt tồn ở kho xuất (theo tổng)
    const overs = checkOverStock(items.map(x => ({ vat_tu_id: x.vat_tu_id, so_luong: x.so_luong })));
    if (overs.length) {
      alert('Chuyển vượt tồn ở kho xuất:\n' + overs.map(o => `- ${o.ten}: yêu cầu ${o.req} > tồn ${o.avail}`).join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      await chuyenKho({ kho_from_id: Number(selectedKho), kho_to_id: Number(toKho), ghi_chu: note || undefined, items });
      resetPhieu();
      await loadTon(Number(selectedKho));
      alert('Đã chuyển kho.');
    } catch (e: any) {
      alert(e?.message || 'Chuyển kho thất bại');
    } finally {
      setSubmitting(false);
    }
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

    try {
      await deleteWarehouse(Number(selectedKho));
      const k = await listWarehouses();
      setKhos((k?.data ?? k) as Warehouse[]);
      setSelectedKho('');
      alert('Đã xóa kho.');
    } catch (e: any) {
      alert(e?.message || 'Xóa kho thất bại');
    }
  };

  const saveWarehouse = async () => {
    const ten = frm.ten.trim();
    if (!ten) return alert('Tên kho không được trống');

    try {
      setSaving(true);
      if (editing) {
        await updateWarehouse(editing.id, {
          ten,
          mo_ta: frm.mo_ta?.trim() || undefined,
          dia_chi: frm.dia_chi?.trim() || undefined,
          ghichu: frm.ghichu?.trim() || undefined,
          cum_id: frm.cum_id ? Number(frm.cum_id) : undefined,
        });
        alert('Đã cập nhật kho.');
      } else {
        const created = await createWarehouse({
          ten,
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
    } catch (e: any) {
      alert(e?.message || 'Lưu kho thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur border rounded-2xl p-3 md:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-gray-900">Kho</div>
              <span className="text-xs text-gray-500">({khos.length})</span>
            </div>

            <select
              className="h-11 border rounded-xl px-3 min-w-[280px] bg-white shadow-sm"
              value={selectedKho}
              disabled={loadingKhos}
              onChange={e => setSelectedKho(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">{loadingKhos ? 'Đang tải kho…' : '-- Chọn kho --'}</option>
              {khos.map(k => (
                <option key={k.id} value={k.id}>
                  {k.ten}
                  {k.cum_id ? ` (Cụm #${k.cum_id})` : ''}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <button className="h-11 px-3 rounded-xl border bg-white hover:bg-gray-50" onClick={openCreate}>
                + Thêm kho
              </button>

              {!!selectedKho && (
                <>
                  <button className="h-11 px-3 rounded-xl border bg-white hover:bg-gray-50" onClick={openEdit}>
                    Sửa
                  </button>
                  <button className="h-11 px-3 rounded-xl border text-rose-600 hover:bg-rose-50" onClick={doDelete}>
                    Xóa
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap justify-start md:justify-end">
            {(['ton', 'nhap', 'xuat', 'chuyen', 'lichsu'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cx(
                  'px-3 py-2 rounded-full border text-sm transition',
                  tab === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50'
                )}
                disabled={!selectedKho && t !== 'ton'}
              >
                {t === 'ton' ? 'TỒN' : t === 'nhap' ? 'NHẬP' : t === 'xuat' ? 'XUẤT' : t === 'chuyen' ? 'CHUYỂN' : 'LỊCH SỬ'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-600 flex flex-wrap items-center gap-2">
          {!selectedKhoObj ? (
            <span className="text-gray-500">Chọn 1 kho để xem dữ liệu.</span>
          ) : (
            <>
              <span className="font-semibold text-gray-900">{selectedKhoObj.ten}</span>
              {selectedKhoObj.dia_chi ? <span className="text-gray-500">• {selectedKhoObj.dia_chi}</span> : null}
              {selectedKhoObj.cum_id ? <span className="text-gray-500">• Cụm #{selectedKhoObj.cum_id}</span> : null}
              {loadingData ? <span className="ml-auto text-gray-500">Đang tải…</span> : null}
            </>
          )}
        </div>
      </div>

      {!selectedKho && <div className="text-sm text-gray-500">Chọn 1 kho để xem dữ liệu.</div>}

      {/* ===== TỒN ===== */}
      {selectedKho && tab === 'ton' && (
        <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">Tồn kho</div>
            <div className="text-sm text-gray-500">{ton?.length || 0} vật tư</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3">Vật tư</th>
                  <th className="text-left p-3 w-[140px]">Đơn vị</th>
                  <th className="text-right p-3 w-[160px]">Số lượng</th>
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-500">
                      Đang tải dữ liệu tồn…
                    </td>
                  </tr>
                ) : (ton || []).length ? (
                  ton.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50/60">
                      <td className="p-3 font-medium text-gray-900">{r.ten}</td>
                      <td className="p-3 text-gray-600">{r.donvi || ''}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">{Number(r.so_luong || 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">
                      Chưa có dữ liệu tồn.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== NHẬP / XUẤT / CHUYỂN ===== */}
      {selectedKho && (tab === 'nhap' || tab === 'xuat' || tab === 'chuyen') && (
        <div className="grid gap-4">
          <div className="border rounded-2xl shadow-sm bg-white overflow-hidden">
            <div className="px-4 py-3 border-b flex flex-wrap items-center gap-2 justify-between">
              <div className="font-semibold">{tab === 'nhap' ? 'Lập phiếu nhập' : tab === 'xuat' ? 'Lập phiếu xuất' : 'Lập phiếu chuyển'}</div>

              {tab === 'chuyen' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Tới kho</span>
                  <select
                    className="h-10 border rounded-xl px-3 bg-white"
                    value={toKho}
                    onChange={e => setToKho(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">-- chọn kho nhận --</option>
                    {khos.filter(k => k.id !== selectedKho).map(k => (
                      <option key={k.id} value={k.id}>
                        {k.ten}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Cảnh báo vượt tồn */}
            {(tab === 'xuat' || tab === 'chuyen') && overStockList.length > 0 && (
              <div className="m-4 border border-rose-200 bg-rose-50 text-rose-700 rounded-xl p-3 text-sm">
                <div className="font-semibold mb-1">Cảnh báo: vượt tồn (đã tính cả trường hợp trùng vật tư nhiều dòng)</div>
                <ul className="list-disc pl-5 space-y-1">
                  {overStockList.map(o => (
                    <li key={o.vat_tu_id}>
                      {o.ten}: yêu cầu <b>{o.req}</b> &gt; tồn <b>{o.avail}</b>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3 text-left min-w-[320px]">Vật tư</th>
                    <th className="p-3 text-left w-[160px]">Đơn vị</th>
                    <th className="p-3 text-right w-[180px]">Số lượng</th>
                    {(tab === 'xuat' || tab === 'chuyen') && <th className="p-3 text-left min-w-[260px]">Tồn / Tối đa</th>}
                    <th className="p-3 w-[90px]"></th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r, i) => {
                    const cap = rowCaps[i] || { avail: 0, usedBefore: 0, maxForRow: 0, remainingAfterThisRow: 0 };
                    const isStockMode = tab === 'xuat' || tab === 'chuyen';
                    const overThisRow = isStockMode && r.vat_tu_id ? Number(r.so_luong || 0) > cap.maxForRow : false;

                    return (
                      <tr key={i} className="border-b last:border-0 align-top">
                        <td className="p-3">
                          <select
                            className="h-10 border rounded-xl px-3 w-full bg-white"
                            value={r.vat_tu_id}
                            onChange={e => {
                              const id = Number(e.target.value);
                              const vt = vatTuMaster.find(v => v.id === id);
                              // đổi vật tư thì reset qty về 1 cho sạch UX (có thể chỉnh theo bạn)
                              changeRow(i, { vat_tu_id: id, ten: vt?.ten, don_vi: vt?.donvi, so_luong: 0 });
                            }}
                          >
                            <option value={0}>-- Chọn vật tư --</option>
                            {vatTuMaster.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.ten}
                              </option>
                            ))}
                          </select>

                          {isStockMode && r.vat_tu_id ? (
                            <div className="mt-1 text-xs text-gray-500">
                              Còn lại sau các dòng trước: <b className="text-gray-700">{cap.maxForRow}</b>
                            </div>
                          ) : null}
                        </td>

                        <td className="p-3">
                          <input
                            className="h-10 border rounded-xl px-3 w-full"
                            value={r.don_vi || ''}
                            onChange={e => changeRow(i, { don_vi: e.target.value })}
                            placeholder="vd: kg, thùng…"
                          />
                        </td>

                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min={0}
                            step="1"
                            className={cx(
                              'h-10 border rounded-xl px-3 w-full text-right tabular-nums',
                              overThisRow ? 'border-rose-300 ring-2 ring-rose-100' : ''
                            )}
                            value={r.so_luong}
                            onChange={e => changeRow(i, { so_luong: Number(e.target.value) })}
                            onBlur={() => clampRowToMax(i)}
                          />

                          {(tab === 'xuat' || tab === 'chuyen') && r.vat_tu_id ? (
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                className="px-2 py-1 rounded-lg border text-xs hover:bg-gray-50"
                                onClick={() => fillMaxForRow(i)}
                                disabled={!r.vat_tu_id}
                                title="Tự điền số lượng tối đa có thể xuất ở dòng này"
                              >
                                Tối đa
                              </button>
                            </div>
                          ) : null}
                        </td>

                        {(tab === 'xuat' || tab === 'chuyen') && (
                          <td className="p-3">
                            {!r.vat_tu_id ? (
                              <span className="text-xs text-gray-500">Chọn vật tư để xem tồn.</span>
                            ) : (
                              <div className="text-xs space-y-1">
                                <div className="text-gray-600">
                                  Tồn: <b className="text-gray-800">{cap.avail}</b>
                                </div>
                                <div className="text-gray-600">
                                  Đã dùng (dòng trước): <b className="text-gray-800">{cap.usedBefore}</b>
                                </div>
                                <div className={cx('text-gray-600', overThisRow ? 'text-rose-700' : '')}>
                                  Tối đa dòng này: <b>{cap.maxForRow}</b>
                                </div>
                                <div className="text-gray-600">
                                  Còn lại (sau dòng này): <b className="text-gray-800">{cap.remainingAfterThisRow}</b>
                                </div>
                              </div>
                            )}
                          </td>
                        )}

                        <td className="p-3 text-right">
                          <button className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50" onClick={() => removeRow(i)} title="Xóa dòng">
                            Xóa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={addRow} className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50">
                  + Thêm dòng
                </button>
                <button onClick={resetPhieu} className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50">
                  Reset
                </button>

                {(tab === 'xuat' || tab === 'chuyen') && (
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50"
                    onClick={() => {
                      // điền “tối đa” cho tất cả dòng theo thứ tự (phân bổ tồn)
                      rows.forEach((_, idx) => fillMaxForRow(idx));
                    }}
                  >
                    Điền tối đa tất cả
                  </button>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Ghi chú</label>
                <textarea
                  className="mt-1 w-full border rounded-2xl p-3 min-h-[90px] focus:outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder="Ví dụ: xuất theo yêu cầu #…, chuyển kho phục vụ điểm cứu trợ…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                {tab === 'nhap' && (
                  <button
                    onClick={submitNhap}
                    disabled={!canSubmit || submitting}
                    className="px-4 py-2 rounded-xl bg-gray-900 text-white disabled:opacity-60"
                  >
                    {submitting ? 'Đang ghi…' : 'Ghi phiếu nhập'}
                  </button>
                )}

                {tab === 'xuat' && (
                  <button
                    onClick={submitXuat}
                    disabled={!canSubmit || submitting}
                    className="px-4 py-2 rounded-xl bg-gray-900 text-white disabled:opacity-60"
                    title={hasOverStock ? 'Đang vượt tồn — hãy giảm số lượng hoặc bấm Tối đa' : ''}
                  >
                    {submitting ? 'Đang ghi…' : 'Ghi phiếu xuất'}
                  </button>
                )}

                {tab === 'chuyen' && (
                  <button
                    onClick={submitChuyen}
                    disabled={!canSubmit || submitting}
                    className="px-4 py-2 rounded-xl bg-gray-900 text-white disabled:opacity-60"
                    title={hasOverStock ? 'Đang vượt tồn — hãy giảm số lượng hoặc bấm Tối đa' : ''}
                  >
                    {submitting ? 'Đang ghi…' : 'Ghi phiếu chuyển'}
                  </button>
                )}
              </div>

              {(tab === 'xuat' || tab === 'chuyen') && (
                <div className="text-xs text-gray-500">

                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== LỊCH SỬ ===== */}
      {selectedKho && tab === 'lichsu' && (
        <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">Lịch sử kho</div>
            <button
              className="text-sm px-3 py-2 rounded-xl border hover:bg-gray-50"
              onClick={() => selectedKho && loadHistory(Number(selectedKho))}
              disabled={loadingData}
            >
              Làm mới
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3 text-left w-[190px]">Thời gian</th>
                  <th className="p-3 text-left w-[110px]">Loại</th>
                  <th className="p-3 text-left w-[180px]">Người thực hiện</th>
                  <th className="p-3 text-left w-[180px]">Từ kho</th>
                  <th className="p-3 text-left w-[180px]">Đến kho</th>
                  <th className="p-3 text-left min-w-[240px]">Ghi chú</th>
                  <th className="p-3 text-left min-w-[320px]">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-500">
                      Đang tải lịch sử…
                    </td>
                  </tr>
                ) : (lichsu || []).length ? (
                  lichsu.map(p => (
                    <tr key={p.id} className="border-b last:border-0 align-top hover:bg-gray-50/60">
                      <td className="p-3 text-gray-700 tabular-nums">
                        {new Date(p.created_at).toLocaleString()}
                      </td>

                      <td className="p-3">
                        <span className={cx('inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ring-1', badgeLoai(p.loai))}>
                          {p.loai.toUpperCase()}
                        </span>
                      </td>

                      <td className="p-3 text-gray-800">
                        {p.nguoi_tao ? (
                          <div>
                            <div className="font-medium">{p.nguoi_tao.ten}</div>
                            {p.nguoi_tao.email ? (
                              <div className="text-xs text-gray-500">{p.nguoi_tao.email}</div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-gray-400">Không rõ</span>
                        )}
                      </td>

                      <td className="p-3 text-gray-800">
                        {p.kho_from_id ? (khoNameMap.get(p.kho_from_id) ?? `#${p.kho_from_id}`) : ''}
                      </td>

                      <td className="p-3 text-gray-800">
                        {p.kho_to_id ? (khoNameMap.get(p.kho_to_id) ?? `#${p.kho_to_id}`) : ''}
                      </td>

                      <td className="p-3 text-gray-700">{p.ghi_chu ?? ''}</td>

                      <td className="p-3">
                        <ul className="space-y-1">
                          {(p.chi_tiet || []).map((d, idx) => (
                            <li key={idx} className="text-gray-800">
                              <span className="font-medium">{d.ten}</span>
                              <span className="text-gray-600"> • </span>
                              <span className="tabular-nums">{d.so_luong}</span> {d.don_vi || ''}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      Chưa có lịch sử.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== MODAL THÊM/SỬA KHO ===== */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-4 md:p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{editing ? 'Sửa kho' : 'Thêm kho'}</div>
                <div className="text-sm text-gray-500">Điền thông tin cơ bản để quản lý kho theo cụm.</div>
              </div>
              <button className="h-9 w-9 rounded-xl border hover:bg-gray-50" onClick={() => setFormOpen(false)} disabled={saving}>
                ✕
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Tên kho *</label>
                <input
                  className="mt-1 w-full h-11 border rounded-xl px-3"
                  value={frm.ten}
                  onChange={e => setFrm({ ...frm, ten: e.target.value })}
                  placeholder="Ví dụ: Kho trung tâm, Kho xã A…"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Địa chỉ</label>
                  <input
                    className="mt-1 w-full h-11 border rounded-xl px-3"
                    value={frm.dia_chi || ''}
                    onChange={e => setFrm({ ...frm, dia_chi: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Cụm</label>
                  <select
                    className="mt-1 w-full h-11 border rounded-xl px-3 bg-white"
                    value={frm.cum_id || ''}
                    onChange={e => setFrm({ ...frm, cum_id: e.target.value })}
                  >
                    <option value="">-- Không gắn cụm --</option>
                    {clusters.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.ten}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Mô tả</label>
                <textarea className="mt-1 w-full border rounded-2xl p-3 min-h-[90px]" value={frm.mo_ta || ''} onChange={e => setFrm({ ...frm, mo_ta: e.target.value })} />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Ghi chú</label>
                <textarea className="mt-1 w-full border rounded-2xl p-3 min-h-[90px]" value={frm.ghichu || ''} onChange={e => setFrm({ ...frm, ghichu: e.target.value })} />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 rounded-xl border hover:bg-gray-50" onClick={() => setFormOpen(false)} disabled={saving}>
                Hủy
              </button>
              <button className="px-4 py-2 rounded-xl bg-gray-900 text-white disabled:opacity-60" onClick={saveWarehouse} disabled={saving}>
                {saving ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\VatTu;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VatTuController extends Controller
{
    /**
     * GET /api/admin/vattu
     * Trả về: danh sách phân trang + số tồn (sum kho_ton) + nhu cầu đang "tiep_nhan"
     * kèm thống kê đủ/thiếu.
     */
    public function index(Request $req)
    {
        $q = trim((string) $req->query('q', ''));
        $perPage = max(1, min((int)$req->query('per_page', 20), 100));

        $subTon = DB::table('kho_ton')
            ->selectRaw('vattu_id, SUM(so_luong) AS ton')
            ->groupBy('vattu_id');

        $subCan = DB::table('yeu_cau_vattu AS yct')
            ->join('yeu_cau AS yc', 'yc.id', '=', 'yct.yeu_cau_id')
            ->where('yc.trang_thai', 'tiep_nhan')
            ->selectRaw('yct.vattu_id, SUM(yct.so_luong) AS can')
            ->groupBy('yct.vattu_id');

        $baseQuery = VatTu::query()
            ->leftJoinSub($subTon, 't', 't.vattu_id', '=', 'vattu.id')
            ->leftJoinSub($subCan, 'c', 'c.vattu_id', '=', 'vattu.id')
            ->selectRaw('vattu.*, COALESCE(t.ton,0) AS ton, COALESCE(c.can,0) AS can, (COALESCE(t.ton,0) - COALESCE(c.can,0)) AS du');

        if ($q !== '') {
            $baseQuery->where(function ($x) use ($q) {
                $x->where('vattu.ten', 'like', "%{$q}%")
                    ->orWhere('vattu.ma', 'like', "%{$q}%");
            });
        }

        $list = (clone $baseQuery)
            ->orderBy('vattu.ten')
            ->paginate($perPage);

        $allRows = (clone $baseQuery)
            ->orderBy('vattu.ten')
            ->get();

        $stat = [
            'tong'   => (int) $allRows->count(),
            'du'     => 0,
            'thieu'  => 0,
            'thieu_chi_tiet' => [],
        ];

        foreach ($allRows as $item) {
            if ((float)$item->du >= 0) {
                $stat['du']++;
            } else {
                $stat['thieu']++;
                $stat['thieu_chi_tiet'][] = [
                    'vattu_id' => $item->id,
                    'ten'      => $item->ten,
                    'ton'      => (float)$item->ton,
                    'can'      => (float)$item->can,
                    'du'       => (float)$item->du,
                ];
            }
        }

        return response()->json([
            'data' => $list->items(),
            'meta' => [
                'current_page' => $list->currentPage(),
                'per_page'     => $list->perPage(),
                'last_page'    => $list->lastPage(),
                'total'        => $list->total(),
            ],
            'thongke' => $stat,
        ]);
    }

    public function store(Request $req)
    {
        $data = $req->validate([
            'ten'    => 'required|string|max:255|unique:vattu,ten',
            'donvi'  => 'required|string|max:50',
            'ma'     => 'required|string|max:50|alpha_dash|unique:vattu,ma',
            'ghichu' => 'nullable|string',
        ], [
            'ten.required' => 'Tên vật tư là bắt buộc.',
            'ten.unique'   => 'Tên vật tư đã tồn tại.',
            'donvi.required' => 'Đơn vị tính là bắt buộc.',
            'ma.required'  => 'Mã vật tư là bắt buộc.',
            'ma.unique'    => 'Mã vật tư đã tồn tại.',
            'ma.alpha_dash' => 'Mã vật tư chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới.',
        ]);

        $vt = VatTu::create($data);

        return response()->json([
            'message' => 'Tạo vật tư thành công.',
            'data' => $vt
        ], 201);
    }

    public function update($id, Request $req)
    {
        $vt = VatTu::findOrFail($id);

        $data = $req->validate([
            'ten'    => "required|string|max:255|unique:vattu,ten,{$vt->id}",
            'donvi'  => 'required|string|max:50',
            'ma'     => "required|string|max:50|alpha_dash|unique:vattu,ma,{$vt->id}",
            'ghichu' => 'nullable|string',
        ], [
            'ten.required' => 'Tên vật tư là bắt buộc.',
            'ten.unique'   => 'Tên vật tư đã tồn tại.',
            'donvi.required' => 'Đơn vị tính là bắt buộc.',
            'ma.required'  => 'Mã vật tư là bắt buộc.',
            'ma.unique'    => 'Mã vật tư đã tồn tại.',
            'ma.alpha_dash' => 'Mã vật tư chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới.',
        ]);

        $vt->update($data);

        return response()->json([
            'message' => 'Cập nhật vật tư thành công.',
            'data' => $vt
        ]);
    }

    public function destroy($id)
    {
        $vt = VatTu::findOrFail($id);

        $coTonKho = DB::table('kho_ton')->where('vattu_id', $id)->exists();
        $coGiaoDich = DB::table('kho_dong')->where('vattu_id', $id)->exists();
        $coYeuCau = DB::table('yeu_cau_vattu')->where('vattu_id', $id)->exists();

        if ($coTonKho || $coGiaoDich || $coYeuCau) {
            return response()->json([
                'message' => 'Không thể xóa vật tư đã phát sinh dữ liệu.'
            ], 422);
        }

        $vt->delete();

        return response()->json([
            'message' => 'Xóa vật tư thành công.'
        ]);
    }
}

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
        $q        = trim((string) $req->query('q', ''));
        $perPage  = max(1, min((int)$req->query('per_page', 20), 100));

        // Subquery tồn kho theo vật tư
        $subTon = DB::table('kho_ton')
            ->selectRaw('vattu_id, SUM(so_luong) AS ton')   // ✅ vattu_id
            ->groupBy('vattu_id');

        $subCan = DB::table('yeu_cau_vattu AS yct')
            ->join('yeu_cau AS yc', 'yc.id', '=', 'yct.yeu_cau_id')
            ->where('yc.trang_thai', 'tiep_nhan')
            ->selectRaw('yct.vattu_id, SUM(yct.so_luong) AS can')
            ->groupBy('yct.vattu_id');

        $query = \App\Models\VatTu::query()
            ->leftJoinSub($subTon, 't', 't.vattu_id', '=', 'vattu.id')   // ✅ vattu_id
            ->leftJoinSub($subCan, 'c', 'c.vattu_id', '=', 'vattu.id')
            ->selectRaw('vattu.*, COALESCE(t.ton,0) AS ton, COALESCE(c.can,0) AS can, (COALESCE(t.ton,0) - COALESCE(c.can,0)) AS du');

        if ($q !== '') {
            $query->where(function ($x) use ($q) {
                $x->where('vattu.ten', 'like', "%{$q}%")
                    ->orWhere('vattu.ma', 'like', "%{$q}%");
            });
        }

        $list = $query->orderBy('vattu.ten')->paginate($perPage);

        // Thống kê tổng hợp
        $stat = [
            'tong'   => (int) $list->total(),
            'du'     => 0, // số vật tư đủ/ dư (du >= 0)
            'thieu'  => 0, // số vật tư thiếu (du < 0)
            'thieu_chi_tiet' => [], // [{vattu_id, ten, ton, can, du}]
        ];
        foreach ($list->items() as $item) {
            if ($item->du >= 0) $stat['du']++;
            else {
                $stat['thieu']++;
                $stat['thieu_chi_tiet'][] = [
                    'vattu_id' => $item->id,
                    'ten'      => $item->ten,
                    'ton'      => (float)$item->ton,
                    'can'      => (float)$item->can,
                    'du'       => (float)$item->du, // âm là thiếu
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
            'donvi'  => 'nullable|string|max:50',
            'ma'     => 'nullable|string|max:50|unique:vattu,ma',
            'ghichu' => 'nullable|string',
        ]);
        $vt = VatTu::create($data);
        return response()->json(['data' => $vt], 201);
    }

    public function update($id, Request $req)
    {
        $vt = VatTu::findOrFail($id);
        $data = $req->validate([
            'ten'    => "required|string|max:255|unique:vattu,ten,{$vt->id}",
            'donvi'  => 'nullable|string|max:50',
            'ma'     => "nullable|string|max:50|unique:vattu,ma,{$vt->id}",
            'ghichu' => 'nullable|string',
        ]);
        $vt->update($data);
        return response()->json(['data' => $vt]);
    }

    public function destroy($id)
    {
        $vt = VatTu::findOrFail($id);
        $vt->delete();
        return response()->json(['message' => 'deleted']);
    }
}

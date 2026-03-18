<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Kho;
use App\Models\PhieuNX;
use App\Models\PhieuNXCT;

class KhoTonController extends Controller
{
    /**
     * GET /api/admin/kho/{kho}/ton
     * Trả: danh sách tồn của 1 kho, join tên/đơn vị vật tư
     */
    public function ton($khoId)
    {
        Kho::query()->findOrFail($khoId);

        $rows = DB::table('kho_ton')
            ->leftJoin('vattu', 'vattu.id', '=', 'kho_ton.vattu_id')
            ->where('kho_ton.kho_id', $khoId)
            ->selectRaw('
                kho_ton.vattu_id as id,
                vattu.ten,
                vattu.donvi,
                COALESCE(kho_ton.so_luong,0) as so_luong
            ')
            ->orderBy('vattu.ten')
            ->get();

        $data = $rows->map(fn ($r) => [
            'id'       => (int) $r->id,
            'ten'      => $r->ten,
            'donvi'    => $r->donvi,
            'so_luong' => (float) $r->so_luong,
        ]);

        return response()->json(['data' => $data]);
    }

    /**
     * GET /api/admin/kho/{kho}/lich-su
     * Trả: list phiếu + chi tiết phiếu + người tạo phiếu
     * Query: per_page (mặc định 50)
     */
    public function lichSu(Request $req, $khoId)
    {
        Kho::query()->findOrFail($khoId);

        $perPage = max(1, min((int) $req->query('per_page', 50), 200));

        $phieu = DB::table('phieu_nx as p')
            ->leftJoin('users as u', 'u.id', '=', 'p.nguoi_tao_id')
            ->where(function ($q) use ($khoId) {
                $q->where('p.kho_from_id', $khoId)
                    ->orWhere('p.kho_to_id', $khoId);
            })
            ->select(
                'p.id',
                'p.loai',
                'p.kho_from_id',
                'p.kho_to_id',
                'p.nguoi_tao_id',
                'p.ghi_chu',
                'p.created_at',
                'u.name as nguoi_tao_ten',
                'u.email as nguoi_tao_email'
            )
            ->orderByDesc('p.id')
            ->paginate($perPage);

        $ids = collect($phieu->items())->pluck('id')->all();

        $ct = PhieuNXCT::query()
            ->whereIn('phieu_id', $ids ?: [0])
            ->leftJoin('vattu', 'vattu.id', '=', 'phieu_nx_ct.vat_tu_id')
            ->selectRaw('
                phieu_nx_ct.phieu_id,
                phieu_nx_ct.vat_tu_id,
                vattu.ten,
                phieu_nx_ct.so_luong,
                phieu_nx_ct.don_vi
            ')
            ->get()
            ->groupBy('phieu_id');

        $data = collect($phieu->items())->map(function ($p) use ($ct) {
            return [
                'id'           => $p->id,
                'loai'         => $p->loai,
                'kho_from_id'  => $p->kho_from_id,
                'kho_to_id'    => $p->kho_to_id,
                'nguoi_tao_id' => $p->nguoi_tao_id,
                'ghi_chu'      => $p->ghi_chu,
                'created_at'   => $p->created_at,
                'nguoi_tao'    => $p->nguoi_tao_id ? [
                    'id'    => (int) $p->nguoi_tao_id,
                    'ten'   => $p->nguoi_tao_ten,
                    'email' => $p->nguoi_tao_email,
                ] : null,
                'chi_tiet'     => ($ct[$p->id] ?? collect())->values()->map(function ($d) {
                    return [
                        'vat_tu_id' => (int) $d->vat_tu_id,
                        'ten'       => $d->ten,
                        'so_luong'  => (float) $d->so_luong,
                        'don_vi'    => $d->don_vi,
                    ];
                })->all(),
            ];
        });

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $phieu->currentPage(),
                'per_page'     => $phieu->perPage(),
                'last_page'    => $phieu->lastPage(),
                'total'        => $phieu->total(),
            ],
        ]);
    }
}
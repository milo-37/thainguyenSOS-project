<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Models\YeuCau;
use App\Models\YeuCauPhanCong;
use App\Models\YeuCauNhatKy;
use App\Models\User;

class PhanCongController extends Controller
{
    // POST /api/yeucau/{id}/assign
    public function assign(Request $req, $id)
{
    $req->validate([
        'cum_id'  => 'nullable|exists:cum,id',
        'user_id' => 'nullable|exists:users,id',
        'ghi_chu' => 'nullable|string',
    ]);

    if (!$req->cum_id && !$req->user_id) {
        return response()->json([
            'message' => 'Chọn cụm hoặc thành viên'
        ], 422);
    }

    if ($req->cum_id && $req->user_id) {
        return response()->json([
            'message' => 'Chỉ được chọn cụm hoặc thành viên'
        ], 422);
    }

    $yc = YeuCau::findOrFail($id);

    $pc = DB::transaction(function () use ($req, $yc) {
        $oldTrangThai = $yc->trang_thai;
        $oldNguoi = $yc->duoc_giao_cho ?? null;

        $pc = YeuCauPhanCong::create([
            'yeu_cau_id'  => $yc->id,
            'cum_id'      => $req->cum_id,
            'user_id'     => $req->user_id,
            'assigned_by' => $req->user()->id,
            'assigned_at' => Carbon::now(),
        ]);

        if ($req->filled('user_id')) {
            $yc->duoc_giao_cho = (int) $req->user_id;
            $yc->cum_id = null;
        } else {
            $yc->cum_id = (int) $req->cum_id;
            $yc->duoc_giao_cho = null;
        }

        $yc->updated_at = now();
        $yc->save();

        $targetUserName = $req->filled('user_id')
            ? $this->getUserNameById((int) $req->user_id)
            : null;

        $targetCumName = $req->filled('cum_id')
            ? $this->getCumNameById((int) $req->cum_id)
            : null;

        $autoNote = $req->filled('user_id')
            ? ('Phân công cho ' . ($targetUserName ?: ('ID ' . $req->user_id)))
            : ('Chuyển cho ' . ($targetCumName ?: ('cụm ID ' . $req->cum_id)));

        $finalNote = trim(implode(' | ', array_filter([
            $autoNote,
            $req->filled('ghi_chu') ? $req->ghi_chu : null,
        ])));

        YeuCauNhatKy::create([
            'yeu_cau_id'    => $yc->id,
            'thuc_hien_boi' => $req->user()->id,
            'hanh_dong'     => 'chuyen_xu_ly',
            'tu_trangthai'  => $oldTrangThai,
            'den_trangthai' => $yc->trang_thai,
            'tu_nguoi'      => $oldNguoi,
            'den_nguoi'     => $req->user_id,
            'ghichu'        => $finalNote,
            'tao_luc'       => now(),
        ]);

        return $pc;
    });

    return response()->json([
        'message' => 'Phân công thành công',
        'data' => $pc->load(['cum', 'user', 'nguoiGiao', 'yeuCau']),
    ]);
}
    private function getCumNameById(?int $cumId): ?string
{
    if (empty($cumId)) {
        return null;
    }

    return DB::table('cum')->where('id', $cumId)->value('ten');
}

private function getUserNameById(?int $userId): ?string
{
    if (empty($userId)) {
        return null;
    }

    return User::where('id', $userId)->value('name');
}
}
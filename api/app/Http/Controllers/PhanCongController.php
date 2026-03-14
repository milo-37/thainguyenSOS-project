<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Models\YeuCau;
use App\Models\YeuCauPhanCong;
use App\Models\YeuCauNhatKy;

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

            // Lưu log phân công
            $pc = YeuCauPhanCong::create([
                'yeu_cau_id'  => $yc->id,
                'cum_id'      => $req->cum_id,
                'user_id'     => $req->user_id,
                'assigned_by' => $req->user()->id,
                'assigned_at' => Carbon::now(),
            ]);

            // Cập nhật người/cụm đang được giao hiện tại
            if ($req->filled('user_id')) {
                $yc->duoc_giao_cho = (int) $req->user_id;
                $yc->cum_id = null;
            } else {
                $yc->cum_id = (int) $req->cum_id;
                $yc->duoc_giao_cho = null;
            }

            // Bước giao KHÔNG tự chuyển sang dang_xu_ly
            // Chỉ khi người được giao bấm "Nhận xử lý" mới đổi trạng thái
            $yc->updated_at = now();
            $yc->save();

            // Ghi nhật ký hiển thị timeline
            YeuCauNhatKy::create([
                'yeu_cau_id'    => $yc->id,
                'thuc_hien_boi' => $req->user()->id,
                'hanh_dong'     => 'chuyen_xu_ly',
                'tu_trangthai'  => $oldTrangThai,
                'den_trangthai' => $yc->trang_thai,
                'tu_nguoi'      => $oldNguoi,
                'den_nguoi'     => $req->user_id,
                'ghichu'        => $req->filled('ghi_chu')
                    ? $req->ghi_chu
                    : ($req->filled('user_id')
                        ? 'Phân công cho thành viên ID ' . $req->user_id
                        : 'Chuyển cho cụm ID ' . $req->cum_id),
                'tao_luc'       => now(),
            ]);

            return $pc;
        });

        return response()->json([
            'message' => 'Phân công thành công',
            'data' => $pc->load(['cum', 'user', 'nguoiGiao', 'yeuCau']),
        ]);
    }
}
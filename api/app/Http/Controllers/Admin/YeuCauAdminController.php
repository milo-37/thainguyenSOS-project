<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use App\Models\YeuCau;
use App\Models\YeuCauPhanCong;
use App\Models\YeuCauNhatKy;

class YeuCauAdminController extends Controller
{
    /**
     * GET /api/admin/yeucau/{id}/lich-su
     */
    public function lichSu($id)
    {
        $yc = YeuCau::findOrFail($id);

        $items = $yc->nhatKy()
            ->with('user:id,name,email')
            ->get()
            ->map(function ($r) {
                return [
                    'id' => $r->id,
                    'hanh_dong' => $r->hanh_dong,
                    'trang_thai' => $r->den_trangthai ?? $r->tu_trangthai,
                    'trang_thai_hien_thi' => $this->labelTrangThai($r->den_trangthai ?? $r->tu_trangthai),
                    'tu_trang_thai' => $r->tu_trangthai,
                    'den_trang_thai' => $r->den_trangthai,
                    'tu_nguoi' => $r->tu_nguoi,
                    'den_nguoi' => $r->den_nguoi,
                    'ghi_chu' => $r->ghichu,
                    'created_at' => optional($r->tao_luc)->toDateTimeString(),
                    'user' => $r->user ? ['id' => $r->user->id, 'name' => $r->user->name] : null,
                ];
            });

        return response()->json(['data' => $items]);
    }

    /**
     * POST /api/admin/yeucau/{id}/cap-nhat-trang-thai
     * body: { trang_thai: enum, ghi_chu?: string }
     */
    public function capNhatTrangThai(Request $req, $id)
    {
        $data = $req->validate([
            'trang_thai' => ['required', Rule::in(['tiep_nhan', 'dang_xu_ly', 'da_chuyen_cum', 'da_hoan_thanh', 'huy'])],
            'ghi_chu'    => ['nullable', 'string'],
        ]);

        $user = $req->user();
        $yc = YeuCau::lockForUpdate()->findOrFail($id);

        DB::transaction(function () use ($yc, $data, $user) {
            $from = $yc->trang_thai;
            $yc->trang_thai = $data['trang_thai'];
            $yc->save();

            YeuCauNhatKy::create([
                'yeu_cau_id'   => $yc->id,
                'thuc_hien_boi'=> $user->id ?? null,
                'hanh_dong'    => 'doi_trang_thai',
                'tu_trangthai' => $from,
                'den_trangthai'=> $data['trang_thai'],
                'ghichu'       => $data['ghi_chu'] ?? null,
                'tao_luc'      => now(),
            ]);
        });

        return response()->json(['success' => true]);
    }

    /**
     * POST /api/admin/yeucau/{id}/chuyen-xu-ly
     * body: { user_id?: int, cum_id?: int, ghi_chu?: string }
     */
    public function chuyenXuLy(Request $req, $id)
    {
        $data = $req->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'cum_id'  => ['nullable', 'integer', 'exists:cum,id'], // nếu bảng cum tên khác đổi lại
            'ghi_chu' => ['nullable', 'string'],
        ]);

        if (empty($data['user_id']) && empty($data['cum_id'])) {
            return response()->json(['message' => 'Chọn user hoặc cụm để chuyển.'], 422);
        }

        $user = $req->user();
        $yc = YeuCau::lockForUpdate()->findOrFail($id);

        DB::transaction(function () use ($yc, $data, $user) {
            // Lưu phân công
            YeuCauPhanCong::create([
                'yeu_cau_id'  => $yc->id,
                'cum_id'      => $data['cum_id'] ?? null,
                'user_id'     => $data['user_id'] ?? null,
                'assigned_by' => $user->id ?? null,
                'assigned_at' => now(),
            ]);

            // Nếu đang ở "tiep_nhan" thì đẩy về "dang_xu_ly" cho hợp lý
            $from = $yc->trang_thai;
            if ($from === 'tiep_nhan') {
                $yc->trang_thai = 'dang_xu_ly';
                $yc->save();
            }

            // Nhật ký
            YeuCauNhatKy::create([
                'yeu_cau_id'   => $yc->id,
                'thuc_hien_boi'=> $user->id ?? null,
                'hanh_dong'    => 'chuyen_xu_ly',
                'tu_trangthai' => $from,
                'den_trangthai'=> $yc->trang_thai, // có thể đã đổi ở trên
                'tu_nguoi'     => null,
                'den_nguoi'    => $data['user_id'] ?? null, // ghi id người nhận (nếu có)
                'ghichu'       => $data['ghi_chu'] ?? null,
                'tao_luc'      => now(),
            ]);
        });

        return response()->json(['success' => true]);
    }

    private function labelTrangThai(?string $code): string
    {
        return match ($code) {
            'tiep_nhan'      => 'Tiếp nhận',
            'dang_xu_ly'     => 'Đang xử lý',
            'da_chuyen_cum'  => 'Đã chuyển cụm',
            'da_hoan_thanh'  => 'Đã hoàn thành',
            'huy'            => 'Hủy',
            default          => $code ?? '',
        };
    }
    public function claim($id)
{
    $userId = auth()->id();

    return DB::transaction(function () use ($id, $userId) {
        // khóa record để tránh 2 người claim cùng lúc
        $yc = YeuCau::lockForUpdate()->findOrFail($id);

        // nếu đã có người khác nhận thì chặn
        if (!empty($yc->duoc_giao_cho) && (int)$yc->duoc_giao_cho !== (int)$userId) {
            return response()->json([
                'ok' => 0,
                'message' => 'Yêu cầu này đã được người khác nhận xử lý.',
                'duoc_giao_cho' => $yc->duoc_giao_cho,
            ], 409);
        }

        $from = $yc->trang_thai;

        // gán cho chính mình
        $yc->duoc_giao_cho = $userId;
        $yc->cum_id = null; // claim về cá nhân thì bỏ cụm (tuỳ logic)

        // đổi trạng thái nếu đang tiếp nhận
        if ($yc->trang_thai === 'tiep_nhan') {
            $yc->trang_thai = 'dang_xu_ly';
        }

        $yc->save();

        // lưu nhật ký (đúng schema: có tao_luc, không có created_at/updated_at)
        DB::table('yeu_cau_nhatky')->insert([
            'yeu_cau_id'     => $yc->id,
            'thuc_hien_boi'  => $userId,
            'hanh_dong'      => 'nhan_xu_ly',
            'tu_trangthai'   => $from,
            'den_trangthai'  => $yc->trang_thai,
            'tu_nguoi'       => null,
            'den_nguoi'      => $userId,
            'ghichu'         => 'Người dùng tự nhận xử lý',
            'tao_luc'        => now(),
        ]);

        return response()->json(['ok' => 1, 'data' => $yc]);
    });
}


}

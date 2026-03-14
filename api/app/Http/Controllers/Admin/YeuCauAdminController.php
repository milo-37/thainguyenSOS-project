<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use App\Models\User;
use App\Models\YeuCau;
use App\Models\YeuCauPhanCong;
use App\Models\YeuCauNhatKy;

class YeuCauAdminController extends Controller
{
    private function isAdmin(User $user): bool
    {
        // SỬA lại theo field role thật của hệ thống bạn nếu cần
        return in_array($user->role ?? '', ['admin', 'super_admin'], true);
    }

    private function getAllowedCumIds(User $user): array
    {
        $memberIds = method_exists($user, 'cums')
            ? $user->cums()
                ->pluck('cum.id')
                ->map(fn ($id) => (int) $id)
                ->toArray()
            : [];

        $chiHuyIds = method_exists($user, 'chiHuyCums')
            ? $user->chiHuyCums()
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->toArray()
            : [];

        return array_values(array_unique(array_merge($memberIds, $chiHuyIds)));
    }

    private function canAccessYeuCau(User $user, YeuCau $yc): bool
    {
        if ($this->isAdmin($user)) {
            return true;
        }

        // Nếu yêu cầu đã giao đích danh cho user hiện tại
        if (!empty($yc->duoc_giao_cho) && (int) $yc->duoc_giao_cho === (int) $user->id) {
            return true;
        }

        // Nếu yêu cầu thuộc cụm user được phép truy cập
        if (!empty($yc->cum_id)) {
            $allowedCumIds = $this->getAllowedCumIds($user);
            return in_array((int) $yc->cum_id, $allowedCumIds, true);
        }

        return false;
    }

    private function abortIfCannotAccess(Request $req, YeuCau $yc): void
    {
        $user = $req->user();

        if (!$user || !$this->canAccessYeuCau($user, $yc)) {
            abort(403, 'Bạn không có quyền truy cập yêu cầu này.');
        }
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

    /**
     * GET /api/admin/yeucau/{id}/lich-su
     */
    public function lichSu(Request $req, $id)
    {
        $yc = YeuCau::findOrFail($id);
        $this->abortIfCannotAccess($req, $yc);

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
        $this->abortIfCannotAccess($req, $yc);

        DB::transaction(function () use ($yc, $data, $user) {
            $from = $yc->trang_thai;
            $to = $data['trang_thai'];

            $yc->trang_thai = $to;

            // Nếu đưa về "tiếp nhận" thì mở lại để người khác có thể nhận
            if ($to === 'tiep_nhan') {
                $yc->duoc_giao_cho = null;
            }

            $yc->save();

            YeuCauNhatKy::create([
                'yeu_cau_id'    => $yc->id,
                'thuc_hien_boi' => $user->id ?? null,
                'hanh_dong'     => 'doi_trang_thai',
                'tu_trangthai'  => $from,
                'den_trangthai' => $to,
                'ghichu'        => $data['ghi_chu'] ?? null,
                'tao_luc'       => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật trạng thái thành công.',
        ]);
    }

    /**
     * POST /api/admin/yeucau/{id}/chuyen-xu-ly
     * body: { user_id?: int, cum_id?: int, ghi_chu?: string }
     */
    public function chuyenXuLy(Request $req, $id)
    {
        $data = $req->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'cum_id'  => ['nullable', 'integer', 'exists:cum,id'],
            'ghi_chu' => ['nullable', 'string'],
        ]);

        if (empty($data['user_id']) && empty($data['cum_id'])) {
            return response()->json(['message' => 'Chọn user hoặc cụm để chuyển.'], 422);
        }

        $user = $req->user();
        $yc = YeuCau::lockForUpdate()->findOrFail($id);
        $this->abortIfCannotAccess($req, $yc);

        if (!$this->isAdmin($user) && !empty($data['cum_id'])) {
            $allowedCumIds = $this->getAllowedCumIds($user);

            if (!in_array((int) $data['cum_id'], $allowedCumIds, true)) {
                return response()->json([
                    'message' => 'Bạn không được chuyển yêu cầu sang cụm ngoài phạm vi của mình.'
                ], 403);
            }
        }

        DB::transaction(function () use ($yc, $data, $user) {
            YeuCauPhanCong::create([
                'yeu_cau_id'  => $yc->id,
                'cum_id'      => $data['cum_id'] ?? null,
                'user_id'     => $data['user_id'] ?? null,
                'assigned_by' => $user->id ?? null,
                'assigned_at' => now(),
            ]);

            $from = $yc->trang_thai;

            // Nếu đang "tiếp nhận" thì chuyển sang "đang xử lý"
            if ($from === 'tiep_nhan') {
                $yc->trang_thai = 'dang_xu_ly';
            }

            // Nếu chuyển cho cá nhân thì gán người xử lý
            if (!empty($data['user_id'])) {
                $yc->duoc_giao_cho = (int) $data['user_id'];
            }

            // Nếu chuyển cho cụm thì bỏ người xử lý cá nhân và gán lại cụm
            if (!empty($data['cum_id'])) {
                $yc->cum_id = (int) $data['cum_id'];
                $yc->duoc_giao_cho = null;
            }

            $yc->save();

            YeuCauNhatKy::create([
                'yeu_cau_id'    => $yc->id,
                'thuc_hien_boi' => $user->id ?? null,
                'hanh_dong'     => 'chuyen_xu_ly',
                'tu_trangthai'  => $from,
                'den_trangthai' => $yc->trang_thai,
                'tu_nguoi'      => null,
                'den_nguoi'     => $data['user_id'] ?? null,
                'ghichu'        => $data['ghi_chu'] ?? null,
                'tao_luc'       => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Chuyển xử lý thành công.',
        ]);
    }

    /**
     * POST /api/admin/yeucau/{id}/claim
     */
    public function claim(Request $req, $id)
    {
        $userId = auth()->id();

        return DB::transaction(function () use ($id, $userId, $req) {
            $yc = YeuCau::lockForUpdate()->findOrFail($id);
            $this->abortIfCannotAccess($req, $yc);

            // Chỉ cho nhận khi đang ở trạng thái "tiếp nhận"
            if ($yc->trang_thai !== 'tiep_nhan') {
                return response()->json([
                    'ok' => 0,
                    'message' => 'Chỉ có thể nhận xử lý khi yêu cầu đang ở trạng thái Tiếp nhận.',
                ], 409);
            }

            // Nếu đã có người khác nhận thì chặn
            if (!empty($yc->duoc_giao_cho) && (int) $yc->duoc_giao_cho !== (int) $userId) {
                return response()->json([
                    'ok' => 0,
                    'message' => 'Yêu cầu này đã được người khác nhận xử lý.',
                    'duoc_giao_cho' => $yc->duoc_giao_cho,
                ], 409);
            }

            // Nếu chính mình đã nhận rồi thì trả luôn
            if (!empty($yc->duoc_giao_cho) && (int) $yc->duoc_giao_cho === (int) $userId) {
                return response()->json([
                    'ok' => 1,
                    'message' => 'Bạn đã nhận xử lý yêu cầu này rồi.',
                    'data' => $yc,
                ]);
            }

            $from = $yc->trang_thai;

            $yc->duoc_giao_cho = $userId;
            $yc->cum_id = null; // giữ nếu logic claim về cá nhân
            $yc->trang_thai = 'dang_xu_ly';
            $yc->save();

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

            return response()->json([
                'ok' => 1,
                'message' => 'Nhận xử lý thành công.',
                'data' => $yc,
            ]);
        });
    }
}
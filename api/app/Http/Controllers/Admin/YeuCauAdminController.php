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
    public function index(Request $req)
    {
        $user = $req->user();

        $query = YeuCau::query()
            ->with(['media', 'vattuChiTiet.vattu']);

        // Giới hạn dữ liệu xem được
        if (!$this->isAdmin($user)) {
            $viewableCumIds = $this->getAllViewableCumIds($user);

            $query->where(function ($q) use ($user, $viewableCumIds) {
                $q->whereIn('cum_id', $viewableCumIds)
                    ->orWhere('duoc_giao_cho', $user->id);
            });
        }

        if ($req->filled('cum_id')) {
            $query->where('cum_id', (int) $req->cum_id);
        }

        if ($req->filled('trang_thai')) {
            $query->where('trang_thai', $req->trang_thai);
        }

        // Chưa phân công = chưa có người nhận ở cụm hiện tại
        // gồm cả yêu cầu mới tiếp nhận và yêu cầu đã chuyển cụm
        if ($req->boolean('chua_phan_cong')) {
            $query->whereNull('duoc_giao_cho')
                ->whereIn('trang_thai', ['tiep_nhan', 'da_chuyen_cum']);
        }

        if ($req->boolean('assigned_to_me')) {
            $query->where('duoc_giao_cho', $user->id);
        }

        $items = $query->orderByDesc('id')->paginate((int) $req->get('per_page', 20));

        $items->setCollection(
            $items->getCollection()->map(function ($yc) use ($user) {
                return $this->mapYeuCauItem($user, $yc);
            })
        );

        return response()->json($items);
    }

    private function isAdmin(User $user): bool
    {
        return method_exists($user, 'hasAnyRole')
            ? $user->hasAnyRole(['Quản trị', 'admin', 'super_admin'])
            : in_array($user->role ?? '', ['admin', 'super_admin'], true);
    }

    private function getMembershipCumIds(User $user): array
    {
        if (!method_exists($user, 'cums')) {
            return [];
        }

        return $user->cums()
            ->pluck('cum.id')
            ->map(fn($id) => (int) $id)
            ->toArray();
    }

    private function getCommandCumIds(User $user): array
    {
        if (!method_exists($user, 'chiHuyCums')) {
            return [];
        }

        return $user->chiHuyCums()
            ->pluck('id')
            ->map(fn($id) => (int) $id)
            ->toArray();
    }

    private function getAllViewableCumIds(User $user): array
    {
        return array_values(array_unique(array_merge(
            $this->getMembershipCumIds($user),
            $this->getCommandCumIds($user),
        )));
    }

    private function isAssignedDirectly(User $user, YeuCau $yc): bool
    {
        return !empty($yc->duoc_giao_cho) && (int) $yc->duoc_giao_cho === (int) $user->id;
    }

    private function belongsToViewableCum(User $user, YeuCau $yc): bool
    {
        if (empty($yc->cum_id)) {
            return false;
        }

        return in_array((int) $yc->cum_id, $this->getAllViewableCumIds($user), true);
    }

    private function belongsToCommandCum(User $user, YeuCau $yc): bool
    {
        if (empty($yc->cum_id)) {
            return false;
        }

        return in_array((int) $yc->cum_id, $this->getCommandCumIds($user), true);
    }

    private function canViewYeuCau(User $user, YeuCau $yc): bool
    {
        if ($this->isAdmin($user)) {
            return true;
        }

        if ($this->isAssignedDirectly($user, $yc)) {
            return true;
        }

        if ($this->belongsToViewableCum($user, $yc)) {
            return true;
        }

        return false;
    }

    private function canUpdateStatus(User $user, YeuCau $yc): bool
    {
        if ($this->isAdmin($user)) {
            return true;
        }

        // Được giao đích danh thì được cập nhật
        if ($this->isAssignedDirectly($user, $yc)) {
            return true;
        }

        // Điều hành cụm hiện tại được cập nhật
        if ($this->belongsToCommandCum($user, $yc)) {
            return true;
        }

        return false;
    }

    private function canTransferYeuCau(User $user, YeuCau $yc): bool
    {
        if ($this->isAdmin($user)) {
            return true;
        }

        // Chỉ điều hành cụm hiện tại mới được chuyển
        if ($this->belongsToCommandCum($user, $yc)) {
            return true;
        }

        return false;
    }

    private function canClaimYeuCau(User $user, YeuCau $yc): bool
    {
        if ($this->isAdmin($user)) {
            return true;
        }

        // Thành viên hoặc điều hành thuộc cụm hiện tại đều có thể nhận xử lý
        if ($this->belongsToViewableCum($user, $yc)) {
            return true;
        }

        return false;
    }

    private function abortIfCannotView(Request $req, YeuCau $yc): void
    {
        $user = $req->user();

        if (!$user || !$this->canViewYeuCau($user, $yc)) {
            abort(403, 'Bạn không có quyền xem yêu cầu này.');
        }
    }

    private function abortIfCannotUpdateStatus(Request $req, YeuCau $yc): void
    {
        $user = $req->user();

        if (!$user || !$this->canUpdateStatus($user, $yc)) {
            abort(403, 'Bạn không có quyền cập nhật trạng thái yêu cầu này.');
        }
    }

    private function abortIfCannotTransfer(Request $req, YeuCau $yc): void
    {
        $user = $req->user();

        if (!$user || !$this->canTransferYeuCau($user, $yc)) {
            abort(403, 'Bạn không có quyền chuyển xử lý yêu cầu này.');
        }
    }

    private function abortIfCannotClaim(Request $req, YeuCau $yc): void
    {
        $user = $req->user();

        if (!$user || !$this->canClaimYeuCau($user, $yc)) {
            abort(403, 'Bạn không có quyền nhận xử lý yêu cầu này.');
        }
    }

    private function labelTrangThai(?string $code): string
    {
        return match ($code) {
            'tiep_nhan' => 'Tiếp nhận',
            'dang_xu_ly' => 'Đang xử lý',
            'da_chuyen_cum' => 'Đã chuyển cụm',
            'da_hoan_thanh' => 'Đã hoàn thành',
            'huy' => 'Hủy',
            default => $code ?? '',
        };
    }

    private function userBelongsToCum(int $userId, int $cumId): bool
    {
        $targetUser = User::find($userId);

        if (!$targetUser || !method_exists($targetUser, 'cums')) {
            return false;
        }

        return $targetUser->cums()->where('cum.id', $cumId)->exists();
    }

    private function buildPermissions(User $user, YeuCau $yc): array
    {
        $canView = $this->canViewYeuCau($user, $yc);
        $canUpdate = $canView && $this->canUpdateStatus($user, $yc);
        $canTransfer = $canView && $this->canTransferYeuCau($user, $yc);

        // Cho phép nhận xử lý cả khi đang tiếp nhận hoặc đã chuyển cụm
        $canClaim = $canView
            && $this->canClaimYeuCau($user, $yc)
            && in_array($yc->trang_thai, ['tiep_nhan', 'da_chuyen_cum'], true)
            && empty($yc->duoc_giao_cho);

        return [
            'can_view' => $canView,
            'can_view_history' => $canView,
            'can_update_status' => $canUpdate,
            'can_transfer' => $canTransfer,
            'can_claim' => $canClaim,
        ];
    }

    private function mapYeuCauItem(User $user, YeuCau $yc): array
    {
        return [
            'id' => $yc->id,
            'cum_id' => $yc->cum_id,
            'duoc_giao_cho' => $yc->duoc_giao_cho,
            'trang_thai' => $yc->trang_thai,

            'loai' => $yc->loai,

            'ten' => $yc->ten,
            'ten_nguoigui' => $yc->ten_nguoigui,

            'so_dien_thoai' => $yc->so_dien_thoai,
            'sdt_nguoigui' => $yc->sdt_nguoigui,

            'noi_dung' => $yc->noi_dung,
            'noidung' => $yc->noidung,

            'lat' => $yc->lat,
            'lng' => $yc->lng,

            'so_nguoi' => $yc->so_nguoi,
            'songuoi' => $yc->songuoi,

            'created_at' => optional($yc->created_at)->toDateTimeString(),

            'media' => $yc->media ?? [],
            'vattuChiTiet' => $yc->vattuChiTiet ?? [],
            'vattu_chi_tiet' => $yc->vattuChiTiet ?? [],

            'permissions' => $this->buildPermissions($user, $yc),
        ];
    }

    /**
     * GET /api/admin/yeucau/{id}/lich-su
     */
    public function lichSu(Request $req, $id)
    {
        $yc = YeuCau::findOrFail($id);
        $this->abortIfCannotView($req, $yc);

        $items = $yc->nhatKy()
            ->with([
                'user:id,name,email',
                'tuNguoi:id,name',
                'denNguoi:id,name',
            ])
            ->orderByDesc('id')
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
                    'tu_nguoi_ten' => $r->tuNguoi?->name,
                    'den_nguoi_ten' => $r->denNguoi?->name,
                    'ghi_chu' => $r->ghichu,
                    'mo_ta_hien_thi' => $this->buildHistoryDisplayText($r),
                    'created_at' => optional($r->tao_luc)->toDateTimeString(),
                    'user' => $r->user ? [
                        'id' => $r->user->id,
                        'name' => $r->user->name,
                    ] : null,
                ];
            });

        return response()->json(['data' => $items]);
    }

    /**
     * POST /api/admin/yeucau/{id}/cap-nhat-trang-thai
     */
    public function capNhatTrangThai(Request $req, $id)
    {
        $data = $req->validate([
            'trang_thai' => [
                'required',
                Rule::in([
                    'tiep_nhan',
                    'dang_xu_ly',
                    'da_chuyen_cum',
                    'da_hoan_thanh',
                    'huy',
                ])
            ],
            'ghi_chu' => ['nullable', 'string'],
        ]);

        $user = $req->user();

        return DB::transaction(function () use ($id, $data, $user, $req) {
            $yc = YeuCau::lockForUpdate()->findOrFail($id);
            $this->abortIfCannotUpdateStatus($req, $yc);

            $from = $yc->trang_thai;
            $to = $data['trang_thai'];

            $yc->trang_thai = $to;

            // Chuyển về tiếp nhận thì bỏ giao đích danh
            if ($to === 'tiep_nhan') {
                $yc->duoc_giao_cho = null;
            }

            $yc->save();

            YeuCauNhatKy::create([
                'yeu_cau_id' => $yc->id,
                'thuc_hien_boi' => $user->id ?? null,
                'hanh_dong' => 'doi_trang_thai',
                'tu_trangthai' => $from,
                'den_trangthai' => $to,
                'ghichu' => $data['ghi_chu'] ?? null,
                'tao_luc' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Cập nhật trạng thái thành công.',
            ]);
        });
    }

    /**
     * POST /api/admin/yeucau/{id}/chuyen-xu-ly
     * Rule:
     * - luôn phải có cum_id
     * - nếu có user_id => chuyển cho người + đồng bộ cụm
     * - nếu không có user_id => chuyển về cụm
     */
    public function chuyenXuLy(Request $req, $id)
    {
        $data = $req->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'cum_id' => ['required', 'integer', 'exists:cum,id'],
            'ghi_chu' => ['nullable', 'string'],
        ]);

        $targetCumId = (int) $data['cum_id'];
        $targetUserId = !empty($data['user_id']) ? (int) $data['user_id'] : null;
        $isTransferToUser = !empty($targetUserId);

        $user = $req->user();

        return DB::transaction(function () use ($id, $data, $user, $req, $targetCumId, $targetUserId, $isTransferToUser) {
            $yc = YeuCau::lockForUpdate()->findOrFail($id);
            $this->abortIfCannotTransfer($req, $yc);

            // Không phải admin thì chỉ được chuyển trong phạm vi cụm mình chỉ huy
            if (!$this->isAdmin($user)) {
                $commandCumIds = $this->getCommandCumIds($user);

                if (!in_array($targetCumId, $commandCumIds, true)) {
                    return response()->json([
                        'message' => 'Bạn không được chuyển yêu cầu sang cụm ngoài phạm vi chỉ huy của mình.',
                    ], 403);
                }
            }

            if ($isTransferToUser) {
                if (!$this->userBelongsToCum($targetUserId, $targetCumId)) {
                    return response()->json([
                        'message' => 'Người được chuyển không thuộc cụm đã chọn.',
                    ], 422);
                }
            }

            $from = $yc->trang_thai;
            $oldUserId = $yc->duoc_giao_cho;

            YeuCauPhanCong::create([
                'yeu_cau_id' => $yc->id,
                'cum_id' => $targetCumId,
                'user_id' => $targetUserId,
                'assigned_by' => $user->id ?? null,
                'assigned_at' => now(),
            ]);

            // Đồng bộ cụm hiện tại theo cụm nhận
            $yc->cum_id = $targetCumId;

            if ($isTransferToUser) {
                // Giao đích danh cho 1 người trong cụm đích
                $yc->duoc_giao_cho = $targetUserId;
                $yc->trang_thai = 'dang_xu_ly';
            } else {
                // Chuyển về cụm, chưa giao đích danh
                $yc->duoc_giao_cho = null;
                $yc->trang_thai = 'da_chuyen_cum';
            }

            $yc->save();

            $targetUserName = null;
            if ($targetUserId) {
                $targetUserName = User::where('id', $targetUserId)->value('name');
            }

            $targetCumName = DB::table('cum')->where('id', $targetCumId)->value('ten');

            $autoNote = $isTransferToUser
                ? ('Phân công cho ' . ($targetUserName ?: ('ID ' . $targetUserId)))
                : ('Chuyển cho ' . ($targetCumName ?: ('cụm ID ' . $targetCumId)));

            $finalNote = trim(implode(' | ', array_filter([
                $autoNote,
                $data['ghi_chu'] ?? null,
            ])));

            YeuCauNhatKy::create([
                'yeu_cau_id' => $yc->id,
                'thuc_hien_boi' => $user->id ?? null,
                'hanh_dong' => 'chuyen_xu_ly',
                'tu_trangthai' => $from,
                'den_trangthai' => $yc->trang_thai,
                'tu_nguoi' => $oldUserId,
                'den_nguoi' => $targetUserId,
                'ghichu' => $finalNote,
                'tao_luc' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => $isTransferToUser
                    ? 'Đã chuyển yêu cầu cho người xử lý và đồng bộ cụm.'
                    : 'Đã chuyển yêu cầu về cụm xử lý.',
            ]);
        });
    }

    private function getCumNameById(?int $cumId): ?string
    {
        if (empty($cumId)) {
            return null;
        }

        return DB::table('cum')->where('id', $cumId)->value('ten');
    }

    private function extractCumIdFromNote(?string $note): ?int
    {
        if (!$note) {
            return null;
        }

        if (preg_match('/cụm ID\s+(\d+)/iu', $note, $matches)) {
            return (int) $matches[1];
        }

        return null;
    }

    private function buildHistoryDisplayText($log): ?string
    {
        $note = trim((string) ($log->ghichu ?? ''));

        if ($log->hanh_dong === 'chuyen_xu_ly') {
            // Có den_nguoi => là phân công cho người
            if (!empty($log->den_nguoi)) {
                $tenNguoi = $log->denNguoi?->name ?? ('ID ' . $log->den_nguoi);
                return "Phân công cho thành viên {$tenNguoi}";
            }

            // Không có den_nguoi => là chuyển cho cụm
            // Ưu tiên lấy tên cụm từ note
            if (preg_match('/Chuyển cho (.+?)(\s*\||$)/u', $note, $matches)) {
                $cumTen = trim($matches[1]);

                // tránh trường hợp đã có sẵn chữ "cụm"
                if (mb_stripos($cumTen, 'cụm') === false) {
                    return "Chuyển cho cụm {$cumTen}";
                }

                return "Chuyển cho {$cumTen}";
            }

            $cumId = $this->extractCumIdFromNote($note);
            $cumTen = $this->getCumNameById($cumId);

            if ($cumTen) {
                return "Chuyển cho cụm {$cumTen}";
            }

            if ($cumId) {
                return "Chuyển cho cụm {$cumId}";
            }

            return 'Chuyển xử lý';
        }

        if ($log->hanh_dong === 'nhan_xu_ly') {
            $tenNguoi = $log->denNguoi?->name ?? $log->user?->name;
            return $tenNguoi ? "Thành viên {$tenNguoi} nhận xử lý" : 'Nhận xử lý';
        }

        if ($log->hanh_dong === 'doi_trang_thai') {
            $from = $this->labelTrangThai($log->tu_trangthai);
            $to = $this->labelTrangThai($log->den_trangthai);

            if ($from && $to && $from !== $to) {
                return "Đổi trạng thái từ {$from} sang {$to}";
            }

            return $note ?: 'Cập nhật trạng thái';
        }

        return $note ?: null;
    }

    /**
     * POST /api/admin/yeucau/{id}/claim
     */
    public function claim(Request $req, $id)
    {
        $user = $req->user();
        $userId = $user?->id;

        return DB::transaction(function () use ($id, $userId, $req) {
            $yc = YeuCau::lockForUpdate()->findOrFail($id);
            $this->abortIfCannotClaim($req, $yc);

            // Cho phép nhận xử lý khi:
            // - mới tiếp nhận
            // - hoặc đã chuyển về cụm
            if (!in_array($yc->trang_thai, ['tiep_nhan', 'da_chuyen_cum'], true)) {
                return response()->json([
                    'ok' => 0,
                    'message' => 'Chỉ có thể nhận xử lý khi yêu cầu đang ở trạng thái Tiếp nhận hoặc Đã chuyển cụm.',
                ], 409);
            }

            if (!empty($yc->duoc_giao_cho) && (int) $yc->duoc_giao_cho !== (int) $userId) {
                return response()->json([
                    'ok' => 0,
                    'message' => 'Yêu cầu này đã được người khác nhận xử lý.',
                    'duoc_giao_cho' => $yc->duoc_giao_cho,
                ], 409);
            }

            if (!empty($yc->duoc_giao_cho) && (int) $yc->duoc_giao_cho === (int) $userId) {
                return response()->json([
                    'ok' => 1,
                    'message' => 'Bạn đã nhận xử lý yêu cầu này rồi.',
                    'data' => $yc,
                ]);
            }

            $from = $yc->trang_thai;

            $yc->duoc_giao_cho = $userId;
            $yc->trang_thai = 'dang_xu_ly';
            $yc->save();

            YeuCauNhatKy::create([
                'yeu_cau_id' => $yc->id,
                'thuc_hien_boi' => $userId,
                'hanh_dong' => 'nhan_xu_ly',
                'tu_trangthai' => $from,
                'den_trangthai' => $yc->trang_thai,
                'tu_nguoi' => null,
                'den_nguoi' => $userId,
                'ghichu' => 'Người dùng tự nhận xử lý',
                'tao_luc' => now(),
            ]);

            return response()->json([
                'ok' => 1,
                'message' => 'Nhận xử lý thành công.',
                'data' => $yc,
            ]);
        });
    }
}

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Models\User;

class ThongKeController extends Controller
{
    private function isAdmin(User $user): bool
    {
        return $user->hasRole('Quản trị');
    }

    private function getAllowedCumIds(User $user): array
    {
        $memberIds = $user->cums()
            ->pluck('cum.id')
            ->map(fn ($id) => (int) $id)
            ->toArray();

        $chiHuyIds = $user->chiHuyCums()
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->toArray();

        return array_values(array_unique(array_merge($memberIds, $chiHuyIds)));
    }

    private function applyCumScope($query, Request $req, string $tableAlias = 'yeu_cau')
    {
        $user = $req->user();

        if (!$user) {
            return $query->whereRaw('1 = 0');
        }

        $cumColumn = $tableAlias . '.cum_id';

        // Quản trị: được xem tất cả, hoặc lọc theo cum_id nếu có
        if ($this->isAdmin($user)) {
            if ($req->filled('cum_id')) {
                $query->where($cumColumn, (int) $req->cum_id);
            }

            return $query;
        }

        // User thường: chỉ được xem các cụm của mình
        $allowedCumIds = $this->getAllowedCumIds($user);

        if (empty($allowedCumIds)) {
            return $query->whereRaw('1 = 0');
        }

        if ($req->filled('cum_id')) {
            $requestedCumId = (int) $req->cum_id;

            if (in_array($requestedCumId, $allowedCumIds, true)) {
                return $query->where($cumColumn, $requestedCumId);
            }

            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn($cumColumn, $allowedCumIds);
    }

    public function index(Request $req)
    {
        $today = Carbon::today();
        $onlyAssignedToMe = (int) $req->get('assigned_to_me', 0) === 1;
        $uid = $req->user()->id;

        // =========================
        // Base query đúng scope
        // =========================
        $base = DB::table('yeu_cau');
        $this->applyCumScope($base, $req, 'yeu_cau');

        if ($onlyAssignedToMe) {
            $user = $req->user();
            $cumIds = collect($this->getAllowedCumIds($user));

            $base->where(function ($q) use ($uid, $cumIds) {
                $q->where('yeu_cau.duoc_giao_cho', $uid);

                if ($cumIds->isNotEmpty()) {
                    $q->orWhereIn('yeu_cau.cum_id', $cumIds->all());
                }
            });
        }

        $tong = (clone $base)->count();
        $da_xu_ly = (clone $base)->where('yeu_cau.trang_thai', 'da_hoan_thanh')->count();
        $chua_xu_ly = (clone $base)->where('yeu_cau.trang_thai', 'tiep_nhan')->count();

        $trong_ngay_tong = (clone $base)->whereDate('yeu_cau.created_at', $today)->count();
        $trong_ngay_da = (clone $base)
            ->whereDate('yeu_cau.updated_at', $today)
            ->where('yeu_cau.trang_thai', 'da_hoan_thanh')
            ->count();

        $trong_ngay_chua = (clone $base)
            ->whereDate('yeu_cau.created_at', $today)
            ->where('yeu_cau.trang_thai', 'tiep_nhan')
            ->count();

        // =========================================================
        // Tổng nhu yếu phẩm trong các yêu cầu chưa xử lý
        // =========================================================
        $tong_nhu_yeu_pham = DB::table('yeu_cau_vattu as yct')
            ->join('yeu_cau as y', 'y.id', '=', 'yct.yeu_cau_id');

        $this->applyCumScope($tong_nhu_yeu_pham, $req, 'y');

        if ($onlyAssignedToMe) {
            $user = $req->user();
            $cumIds = collect($this->getAllowedCumIds($user));

            $tong_nhu_yeu_pham->where(function ($q) use ($uid, $cumIds) {
                $q->where('y.duoc_giao_cho', $uid);

                if ($cumIds->isNotEmpty()) {
                    $q->orWhereIn('y.cum_id', $cumIds->all());
                }
            });
        }

        $tong_nhu_yeu_pham = $tong_nhu_yeu_pham
            ->where('y.trang_thai', 'tiep_nhan')
            ->sum('yct.so_luong');

        // =========================================================
        // Subquery tồn kho theo vật tư
        // =========================================================
        $tons = DB::table('kho_ton')
            ->select('vattu_id', DB::raw('SUM(so_luong) as ton'))
            ->groupBy('vattu_id');

        // =========================================================
        // Subquery nhu cầu vật tư theo các yêu cầu đang tiếp nhận
        // =========================================================
        $yeucau = DB::table('yeu_cau_vattu as yct')
            ->join('yeu_cau as y', 'y.id', '=', 'yct.yeu_cau_id');

        $this->applyCumScope($yeucau, $req, 'y');

        if ($onlyAssignedToMe) {
            $user = $req->user();
            $cumIds = collect($this->getAllowedCumIds($user));

            $yeucau->where(function ($q) use ($uid, $cumIds) {
                $q->where('y.duoc_giao_cho', $uid);

                if ($cumIds->isNotEmpty()) {
                    $q->orWhereIn('y.cum_id', $cumIds->all());
                }
            });
        }

        $yeucau = $yeucau
            ->where('y.trang_thai', 'tiep_nhan')
            ->select('yct.vattu_id', DB::raw('SUM(yct.so_luong) as can'))
            ->groupBy('yct.vattu_id');

        // =========================================================
        // Join để lấy tên vật tư + tính dư/thiếu
        // =========================================================
        $du_thieu = DB::table(DB::raw('(' . $tons->toSql() . ') as t'))
            ->mergeBindings($tons)
            ->rightJoin(DB::raw('(' . $yeucau->toSql() . ') as c'), 't.vattu_id', '=', 'c.vattu_id')
            ->mergeBindings($yeucau)
            ->join('vattu as v', 'v.id', '=', 'c.vattu_id')
            ->select(
                'c.vattu_id',
                'v.ten as ten',
                DB::raw('COALESCE(t.ton,0) as ton'),
                'c.can',
                DB::raw('(COALESCE(t.ton,0) - c.can) as du')
            )
            ->orderBy('v.ten')
            ->get();

        return response()->json([
            'tong_so_yeu_cau' => $tong,
            'so_da_xu_ly' => $da_xu_ly,
            'so_chua_xu_ly' => $chua_xu_ly,
            'trong_ngay' => [
                'tong' => $trong_ngay_tong,
                'da_xu_ly' => $trong_ngay_da,
                'chua_xu_ly' => $trong_ngay_chua,
            ],
            'vat_tu' => [
                'tong_nhu_yeu_pham_chua_xu_ly' => $tong_nhu_yeu_pham,
                'du_thieu' => $du_thieu,
            ],
        ]);
    }
}
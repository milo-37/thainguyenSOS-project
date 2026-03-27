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

        if ($this->isAdmin($user)) {
            if ($req->filled('cum_id')) {
                $query->where($cumColumn, (int) $req->cum_id);
            }

            return $query;
        }

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

    private function getScopedCumRows(Request $req)
    {
        $user = $req->user();

        $query = DB::table('cum')->select('id', 'ten');

        if (!$user) {
            return collect();
        }

        if ($this->isAdmin($user)) {
            if ($req->filled('cum_id')) {
                $query->where('id', (int) $req->cum_id);
            }

            return $query->get();
        }

        $allowedCumIds = $this->getAllowedCumIds($user);

        if (empty($allowedCumIds)) {
            return collect();
        }

        if ($req->filled('cum_id')) {
            $requestedCumId = (int) $req->cum_id;

            if (!in_array($requestedCumId, $allowedCumIds, true)) {
                return collect();
            }

            $query->where('id', $requestedCumId);
            return $query->get();
        }

        return $query->whereIn('id', $allowedCumIds)->get();
    }

    private function buildVatTuTheoCum(Request $req, bool $onlyAssignedToMe = false): array
    {
        $user = $req->user();
        $uid = $user->id;

        $cums = $this->getScopedCumRows($req);

        if ($cums->isEmpty()) {
            return [];
        }

        $cumIds = $cums->pluck('id')->map(fn ($id) => (int) $id)->all();

        // 1) Tổng tồn theo cụm = cộng tồn các kho thuộc cụm
        $tonRows = DB::table('kho as k')
            ->join('kho_ton as kt', 'kt.kho_id', '=', 'k.id')
            ->leftJoin('vattu as vt', 'vt.id', '=', 'kt.vattu_id')
            ->whereIn('k.cum_id', $cumIds)
            ->selectRaw('
                k.cum_id,
                kt.vattu_id,
                vt.ten,
                vt.donvi,
                COALESCE(SUM(kt.so_luong), 0) as ton
            ')
            ->groupBy('k.cum_id', 'kt.vattu_id', 'vt.ten', 'vt.donvi')
            ->get();

        // 2) Tổng nhu cầu theo cụm từ yêu cầu chưa hoàn tất
        $needQuery = DB::table('yeu_cau_vattu as yct')
            ->join('yeu_cau as y', 'y.id', '=', 'yct.yeu_cau_id')
            ->leftJoin('vattu as vt', 'vt.id', '=', 'yct.vattu_id')
            ->whereIn('y.cum_id', $cumIds)
            ->whereIn('y.trang_thai', ['tiep_nhan', 'da_chuyen_cum', 'dang_xu_ly']);

        if ($onlyAssignedToMe) {
            $needQuery->where('y.duoc_giao_cho', $uid);
        }

        $needRows = $needQuery
            ->selectRaw('
                y.cum_id,
                yct.vattu_id,
                vt.ten,
                vt.donvi,
                COALESCE(SUM(yct.so_luong), 0) as can
            ')
            ->groupBy('y.cum_id', 'yct.vattu_id', 'vt.ten', 'vt.donvi')
            ->get();

        // 3) Gộp theo key cum_id + vattu_id
        $map = [];

        foreach ($tonRows as $r) {
            $key = $r->cum_id . '_' . $r->vattu_id;
            $map[$key] = [
                'cum_id' => (int) $r->cum_id,
                'vattu_id' => (int) $r->vattu_id,
                'ten' => $r->ten,
                'donvi' => $r->donvi,
                'ton' => (float) $r->ton,
                'can' => 0,
            ];
        }

        foreach ($needRows as $r) {
            $key = $r->cum_id . '_' . $r->vattu_id;

            if (!isset($map[$key])) {
                $map[$key] = [
                    'cum_id' => (int) $r->cum_id,
                    'vattu_id' => (int) $r->vattu_id,
                    'ten' => $r->ten,
                    'donvi' => $r->donvi,
                    'ton' => 0,
                    'can' => 0,
                ];
            }

            $map[$key]['can'] = (float) $r->can;
        }

        // 4) Khởi tạo group theo cụm
        $grouped = [];

        foreach ($cums as $cum) {
            $grouped[(int) $cum->id] = [
                'cum_id' => (int) $cum->id,
                'cum_ten' => $cum->ten,
                'mat_hang_thieu' => 0,
                'mat_hang_du' => 0,
                'mat_hang_du_vua' => 0,
                'tong_so_luong_thieu' => 0,
                'tong_so_luong_du' => 0,
                'items' => [],
            ];
        }

        // 5) Đổ item vào từng cụm
        foreach ($map as $row) {
            $cumId = (int) $row['cum_id'];

            if (!isset($grouped[$cumId])) {
                continue;
            }

            $du = (float) $row['ton'] - (float) $row['can'];

            $item = [
                'vattu_id' => $row['vattu_id'],
                'ten' => $row['ten'],
                'donvi' => $row['donvi'],
                'ton' => (float) $row['ton'],
                'can' => (float) $row['can'],
                'du' => $du,
            ];

            $grouped[$cumId]['items'][] = $item;

            if ($du < 0) {
                $grouped[$cumId]['mat_hang_thieu']++;
                $grouped[$cumId]['tong_so_luong_thieu'] += abs($du);
            } elseif ($du > 0) {
                $grouped[$cumId]['mat_hang_du']++;
                $grouped[$cumId]['tong_so_luong_du'] += $du;
            } else {
                $grouped[$cumId]['mat_hang_du_vua']++;
            }
        }

        // 6) Sort item trong từng cụm: thiếu trước, đủ sau, dư cuối
        foreach ($grouped as &$cum) {
            usort($cum['items'], function ($a, $b) {
                $priorityA = $a['du'] < 0 ? 0 : ($a['du'] == 0 ? 1 : 2);
                $priorityB = $b['du'] < 0 ? 0 : ($b['du'] == 0 ? 1 : 2);

                if ($priorityA !== $priorityB) {
                    return $priorityA <=> $priorityB;
                }

                return abs($b['du']) <=> abs($a['du']);
            });
        }
        unset($cum);

        return array_values($grouped);
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
            $base->where('yeu_cau.duoc_giao_cho', $uid);
        }

        $tong = (clone $base)->count();
        $da_xu_ly = (clone $base)->where('yeu_cau.trang_thai', 'da_hoan_thanh')->count();
        $chua_xu_ly = (clone $base)->whereIn('yeu_cau.trang_thai', ['tiep_nhan', 'da_chuyen_cum'])->count();

        $trong_ngay_tong = (clone $base)->whereDate('yeu_cau.created_at', $today)->count();
        $trong_ngay_da = (clone $base)
            ->whereDate('yeu_cau.updated_at', $today)
            ->where('yeu_cau.trang_thai', 'da_hoan_thanh')
            ->count();

        $trong_ngay_chua = (clone $base)
            ->whereDate('yeu_cau.created_at', $today)
            ->whereIn('yeu_cau.trang_thai', ['tiep_nhan', 'da_chuyen_cum'])
            ->count();

        // =========================================================
        // Tổng nhu yếu phẩm trong các yêu cầu chưa xử lý
        // =========================================================
        $tongNhuYeuPhamQuery = DB::table('yeu_cau_vattu as yct')
            ->join('yeu_cau as y', 'y.id', '=', 'yct.yeu_cau_id');

        $this->applyCumScope($tongNhuYeuPhamQuery, $req, 'y');

        if ($onlyAssignedToMe) {
            $tongNhuYeuPhamQuery->where('y.duoc_giao_cho', $uid);
        }

        $tong_nhu_yeu_pham = $tongNhuYeuPhamQuery
            ->whereIn('y.trang_thai', ['tiep_nhan', 'da_chuyen_cum', 'dang_xu_ly'])
            ->sum('yct.so_luong');

        // =========================================================
        // Subquery tồn kho theo vật tư (toàn phạm vi hiện tại)
        // Lưu ý: bản này vẫn là tổng hợp theo vật tư, chưa tách cụm
        // =========================================================
        $tons = DB::table('kho_ton')
            ->select('vattu_id', DB::raw('SUM(so_luong) as ton'))
            ->groupBy('vattu_id');

        // =========================================================
        // Subquery nhu cầu vật tư theo yêu cầu đang cần xử lý
        // =========================================================
        $yeucau = DB::table('yeu_cau_vattu as yct')
            ->join('yeu_cau as y', 'y.id', '=', 'yct.yeu_cau_id');

        $this->applyCumScope($yeucau, $req, 'y');

        if ($onlyAssignedToMe) {
            $yeucau->where('y.duoc_giao_cho', $uid);
        }

        $yeucau = $yeucau
            ->whereIn('y.trang_thai', ['tiep_nhan', 'da_chuyen_cum', 'dang_xu_ly'])
            ->select('yct.vattu_id', DB::raw('SUM(yct.so_luong) as can'))
            ->groupBy('yct.vattu_id');

        // =========================================================
        // Join lấy tên vật tư + tính dư/thiếu tổng
        // =========================================================
        $du_thieu = DB::table(DB::raw('(' . $tons->toSql() . ') as t'))
            ->mergeBindings($tons)
            ->rightJoin(DB::raw('(' . $yeucau->toSql() . ') as c'), 't.vattu_id', '=', 'c.vattu_id')
            ->mergeBindings($yeucau)
            ->join('vattu as v', 'v.id', '=', 'c.vattu_id')
            ->select(
                'c.vattu_id',
                'v.ten as ten',
                'v.donvi',
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
            'vat_tu_theo_cum' => $this->buildVatTuTheoCum($req, $onlyAssignedToMe),
        ]);
    }
}
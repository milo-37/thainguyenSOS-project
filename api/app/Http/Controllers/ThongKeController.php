<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ThongKeController extends Controller
{
    public function index(Request $req)
    {
        $today = Carbon::today();
        $cumId = $req->get('cum_id');
        $onlyAssignedToMe = (int)$req->get('assigned_to_me', 0) === 1;
        $uid = $req->user()->id;

        $base = DB::table('yeu_cau');

        if ($cumId) {
            $base->whereExists(function ($q) use ($cumId) {
                $q->select(DB::raw(1))
                    ->from('yeu_cau_phan_cong as pc')
                    ->whereColumn('pc.yeu_cau_id', 'yeu_cau.id')
                    ->where('pc.cum_id', $cumId);
            });
        }

        if ($onlyAssignedToMe) {
            $base->whereExists(function ($q) use ($uid) {
                $q->select(DB::raw(1))
                    ->from('yeu_cau_phan_cong as pc')
                    ->whereColumn('pc.yeu_cau_id', 'yeu_cau.id')
                    ->where('pc.user_id', $uid);
            });
        }

        $tong = (clone $base)->count();
        $da_xu_ly = (clone $base)->where('trang_thai', 'da_xu_ly')->count();
        $chua_xu_ly = (clone $base)->where('trang_thai', 'tiep_nhan')->count();

        $trong_ngay_tong = (clone $base)->whereDate('created_at', $today)->count();
        $trong_ngay_da   = (clone $base)->whereDate('updated_at', $today)->where('trang_thai', 'da_xu_ly')->count();
        $trong_ngay_chua = (clone $base)->whereDate('created_at', $today)->where('trang_thai', 'tiep_nhan')->count();

        // Tổng nhu yếu phẩm trong các yêu cầu chưa xử lý
        $tong_nhu_yeu_pham = DB::table('yeu_cau_vattu as yct')
            ->join('yeu_cau as y', 'y.id', '=', 'yct.yeu_cau_id')
            ->when($cumId, function ($s) use ($cumId) {
                $s->whereExists(function ($q) use ($cumId) {
                    $q->select(DB::raw(1))
                        ->from('yeu_cau_phan_cong as pc')
                        ->whereColumn('pc.yeu_cau_id', 'y.id')
                        ->where('pc.cum_id', $cumId);
                });
            })
            ->when($onlyAssignedToMe, function ($s) use ($uid) {
                $s->whereExists(function ($q) use ($uid) {
                    $q->select(DB::raw(1))
                        ->from('yeu_cau_phan_cong as pc')
                        ->whereColumn('pc.yeu_cau_id', 'y.id')
                        ->where('pc.user_id', $uid);
                });
            })
            ->where('y.trang_thai', 'tiep_nhan')
            ->sum('yct.so_luong');

        // So sánh đủ/thiếu
        $tons = DB::table('kho_ton')
            ->select('vattu_id', DB::raw('SUM(so_luong) as ton'))
            ->groupBy('vattu_id');

        $yeucau = DB::table('yeu_cau_vattu as yct')
            ->join('yeu_cau as y', 'y.id', '=', 'yct.yeu_cau_id')
            ->select('yct.vattu_id', DB::raw('SUM(yct.so_luong) as can'))
            ->where('y.trang_thai', 'tiep_nhan')
            ->groupBy('yct.vattu_id');

        $du_thieu = DB::table(DB::raw('(' . $tons->toSql() . ') as t'))
            ->mergeBindings($tons)
            ->rightJoin(DB::raw('(' . $yeucau->toSql() . ') as c'), 't.vattu_id', '=', 'c.vattu_id')
            ->mergeBindings($yeucau)
            ->select('c.vattu_id', 't.ton', 'c.can', DB::raw('(COALESCE(t.ton,0) - c.can) as du'))
            ->get();

        return response()->json([
            'tong_so_yeu_cau' => $tong,
            'so_da_xu_ly'     => $da_xu_ly,
            'so_chua_xu_ly'   => $chua_xu_ly,
            'trong_ngay'      => [
                'tong'       => $trong_ngay_tong,
                'da_xu_ly'   => $trong_ngay_da,
                'chua_xu_ly' => $trong_ngay_chua,
            ],
            'vat_tu' => [
                'tong_nhu_yeu_pham_chua_xu_ly' => $tong_nhu_yeu_pham,
                'du_thieu'                     => $du_thieu,
            ],
        ]);
    }
}

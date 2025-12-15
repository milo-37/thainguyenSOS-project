<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use App\Models\Kho;
use App\Models\VatTu;
use App\Models\PhieuNx;
use App\Models\PhieuNxCt;

class KhoController extends Controller
{
    // GET /api/admin/kho
    public function index(Request $req)
    {
        $q = Kho::query()->orderBy('ten');
        if ($kw = $req->query('q')) {
            $q->where('ten','like',"%$kw%");
        }
        return response()->json(['data' => $q->get()]);
    }

    // GET /api/admin/kho/{id}/ton
    public function ton($id)
    {
        // Tồn = Tổng nhập + chuyển vào - tổng xuất - chuyển ra
        $rows = DB::table('vattu as vt')
            ->leftJoin('phieu_nx_ct as d','d.vat_tu_id','=','vt.id')
            ->leftJoin('phieu_nx as p','p.id','=','d.phieu_id')
            ->selectRaw("
                vt.id, vt.ten, vt.donvi,
                COALESCE(SUM(
                    CASE
                        WHEN p.loai='nhap'       AND p.kho_to_id=? THEN d.so_luong
                        WHEN p.loai='chuyen'     AND p.kho_to_id=? THEN d.so_luong
                        WHEN p.loai IS NULL THEN 0
                        ELSE 0
                    END
                ),0)
                -
                COALESCE(SUM(
                    CASE
                        WHEN p.loai='xuat'       AND p.kho_from_id=? THEN d.so_luong
                        WHEN p.loai='chuyen'     AND p.kho_from_id=? THEN d.so_luong
                        ELSE 0
                    END
                ),0) as so_luong
            ", [$id,$id,$id,$id])
            ->groupBy('vt.id','vt.ten','vt.donvi')
            ->orderBy('vt.ten')
            ->get();

        return response()->json(['data' => $rows]);
    }

    // GET /api/admin/kho/{id}/lich-su
    public function lichSu($id)
    {
        $rows = DB::table('phieu_nx as p')
            ->leftJoin('phieu_nx_ct as d','d.phieu_id','=','p.id')
            ->leftJoin('vattu as vt','vt.id','=','d.vat_tu_id')
            ->select('p.*', DB::raw('JSON_ARRAYAGG(JSON_OBJECT(
                "vat_tu_id", d.vat_tu_id,
                "ten", vt.ten,
                "so_luong", d.so_luong,
                "don_vi", COALESCE(d.don_vi, vt.donvi)
            )) as chi_tiet'))
            ->where(function($q) use ($id){
                $q->where('p.kho_from_id', $id)->orWhere('p.kho_to_id', $id);
            })
            ->groupBy('p.id')
            ->orderByDesc('p.created_at')
            ->limit(50)
            ->get()
            ->map(function($r){
                $r->chi_tiet = json_decode($r->chi_tiet ?? '[]', true);
                return $r;
            });

        return response()->json(['data' => $rows]);
    }

    // POST /api/admin/kho/nhap
    public function nhap(Request $req)
    {
        $data = $req->validate([
            'kho_to_id' => ['required','integer', Rule::exists('kho','id')],
            'ghi_chu'   => ['nullable','string'],
            'items'     => ['required','array','min:1'],
            'items.*.vat_tu_id' => ['required','integer', Rule::exists('vattu','id')],
            'items.*.so_luong'  => ['required','numeric','gt:0'],
            'items.*.don_vi'    => ['nullable','string'],
        ]);

        return DB::transaction(function() use ($data) {
            $phieu = PhieuNX::create([
                'loai'       => 'nhap',
                'kho_to_id'  => $data['kho_to_id'],
                'ghi_chu'    => $data['ghi_chu'] ?? null,
            ]);

            foreach ($data['items'] as $it) {
                PhieuNXCT::create([
                    'phieu_id'  => $phieu->id,
                    'vat_tu_id' => $it['vat_tu_id'],
                    'so_luong'  => $it['so_luong'],
                    'don_vi'    => $it['don_vi'] ?? null,
                ]);
            }

            // + tồn: cộng theo (kho_id, vattu_id)
            $this->adjustTon($data['kho_to_id'], $data['items'], +1);

            return response()->json(['id'=>$phieu->id], 201);
        });
    }

    // ====== XUẤT
    public function xuat(Request $req)
    {
        $data = $req->validate([
            'kho_from_id' => ['required','integer', Rule::exists('kho','id')],
            'ghi_chu'     => ['nullable','string'],
            'items'       => ['required','array','min:1'],
            'items.*.vat_tu_id' => ['required','integer', Rule::exists('vattu','id')],
            'items.*.so_luong'  => ['required','numeric','gt:0'],
            'items.*.don_vi'    => ['nullable','string'],
        ]);

        return DB::transaction(function() use ($data) {
            $phieu = PhieuNX::create([
                'loai'        => 'xuat',
                'kho_from_id' => $data['kho_from_id'],
                'ghi_chu'     => $data['ghi_chu'] ?? null,
            ]);

            foreach ($data['items'] as $it) {
                PhieuNXCT::create([
                    'phieu_id'  => $phieu->id,
                    'vat_tu_id' => $it['vat_tu_id'],
                    'so_luong'  => $it['so_luong'],
                    'don_vi'    => $it['don_vi'] ?? null,
                ]);
            }

            // - tồn
            $this->adjustTon($data['kho_from_id'], $data['items'], -1);

            return response()->json(['id'=>$phieu->id]);
        });
    }

    // ====== CHUYỂN
    public function chuyen(Request $req)
    {
        $data = $req->validate([
            'kho_from_id' => ['required','integer', Rule::exists('kho','id')],
            'kho_to_id'   => ['required','integer', Rule::exists('kho','id')],
            'ghi_chu'     => ['nullable','string'],
            'items'       => ['required','array','min:1'],
            'items.*.vat_tu_id' => ['required','integer', Rule::exists('vattu','id')],
            'items.*.so_luong'  => ['required','numeric','gt:0'],
            'items.*.don_vi'    => ['nullable','string'],
        ]);

        return DB::transaction(function() use ($data) {
            $phieu = PhieuNX::create([
                'loai'        => 'chuyen',
                'kho_from_id' => $data['kho_from_id'],
                'kho_to_id'   => $data['kho_to_id'],
                'ghi_chu'     => $data['ghi_chu'] ?? null,
            ]);

            foreach ($data['items'] as $it) {
                PhieuNXCT::create([
                    'phieu_id'  => $phieu->id,
                    'vat_tu_id' => $it['vat_tu_id'],
                    'so_luong'  => $it['so_luong'],
                    'don_vi'    => $it['don_vi'] ?? null,
                ]);
            }

            // - từ kho nguồn, + vào kho đích
            $this->adjustTon($data['kho_from_id'], $data['items'], -1);
            $this->adjustTon($data['kho_to_id'],   $data['items'], +1);

            return response()->json(['id'=>$phieu->id]);
        });
    }

    /**
     * Cộng/Trừ tồn kho theo cặp (kho_id, vattu_id).
     * $sign = +1 => nhập,  -1 => xuất
     */
    private function adjustTon(int $khoId, array $items, int $sign = +1): void
    {
        foreach ($items as $it) {
            $vtId = (int)$it['vat_tu_id'];
            $qty  = (float)$it['so_luong'] * $sign;

            // nếu chưa có bản ghi -> insert, nếu có -> update cộng dồn
            $exists = DB::table('kho_ton')
                ->where('kho_id', $khoId)
                ->where('vattu_id', $vtId)
                ->exists();

            if ($exists) {
                DB::table('kho_ton')
                    ->where('kho_id', $khoId)
                    ->where('vattu_id', $vtId)
                    ->update([
                        'so_luong' => DB::raw('COALESCE(so_luong,0) + ('.($qty).')')
                    ]);
            } else {
                DB::table('kho_ton')->insert([
                    'kho_id'    => $khoId,
                    'vattu_id'  => $vtId,
                    'so_luong'  => max(0, $qty), // nếu xuất trước khi có tồn sẽ về 0
                ]);
            }
        }
    }

    // util: map vattu_id => ton (use by xuất/chuyển)
    private function getTonMap($khoId): array
    {
        $rows = DB::table('vattu as vt')
            ->leftJoin('phieu_nx_ct as d','d.vat_tu_id','=','vt.id')
            ->leftJoin('phieu_nx as p','p.id','=','d.phieu_id')
            ->selectRaw("
                vt.id,
                COALESCE(SUM(
                    CASE
                        WHEN p.loai='nhap'   AND p.kho_to_id=? THEN d.so_luong
                        WHEN p.loai='chuyen' AND p.kho_to_id=? THEN d.so_luong
                        ELSE 0 END
                ),0)
                -
                COALESCE(SUM(
                    CASE
                        WHEN p.loai='xuat'   AND p.kho_from_id=? THEN d.so_luong
                        WHEN p.loai='chuyen' AND p.kho_from_id=? THEN d.so_luong
                        ELSE 0 END
                ),0) as so_luong
            ", [$khoId,$khoId,$khoId,$khoId])
            ->groupBy('vt.id')
            ->get();

        $map = [];
        foreach ($rows as $r) $map[$r->id] = (float)$r->so_luong;
        return $map;
    }

    public function store(Request $req) {
        $data = $req->validate([
            'ten' => 'required|string|max:255|unique:kho,ten',
            'mo_ta' => 'nullable|string',
            'dia_chi' => 'nullable|string|max:255',
            'cum_id' => 'nullable|integer|exists:cum,id',
            'ghichu' => 'nullable|string',
        ]);
        $kho = Kho::create($data);
        return response()->json(['data' => $kho], 201);
    }

    public function update(Request $req, $id)
    {
        $kho = Kho::findOrFail($id);

        $data = $req->validate([
            'ten'     => ['required','string','max:255', Rule::unique('kho','ten')->ignore($kho->id)],
            'mo_ta'   => ['nullable','string'],
            'cum_id'  => ['nullable','integer','exists:cum,id'],
            'dia_chi' => ['nullable','string','max:255'],
            'ghichu'  => ['nullable','string'],
        ]);

        $kho->fill($data)->save();

        return response()->json(['data'=>$kho]);
    }

// DELETE /api/admin/kho/{id}
    public function destroy($id)
    {
        $kho = Kho::findOrFail($id);

        // Không cho xóa nếu đã có chứng từ liên quan
        $refCount = PhieuNx::where('kho_from_id',$kho->id)->orWhere('kho_to_id',$kho->id)->count();
        if ($refCount > 0) {
            return response()->json([
                'message' => 'Kho đã phát sinh chứng từ nên không thể xóa.'
            ], 422);
        }

        $kho->delete();

        return response()->json(['success'=>true]);
    }
    public function dsVatTu() {
        return DB::table('vattu')->orderBy('ten')->get();
    }
    public function taoVatTu(Request $r) {
        $d = $r->validate(['ten'=>'required','donvi'=>'nullable','ma'=>'nullable','ghichu'=>'nullable']);
        $id = DB::table('vattu')->insertGetId([...$d,'created_at'=>now(),'updated_at'=>now()]);
        return ['id'=>$id];
    }

    // Kho
    public function dsKho() {
        return DB::table('kho')
            ->leftJoin('kho_ton','kho.id','=','kho_ton.kho_id')
            ->selectRaw('kho.id,kho.ten,kho.dia_chi,COALESCE(SUM(kho_ton.so_luong),0) tong')
            ->groupBy('kho.id','kho.ten','kho.dia_chi')
            ->orderBy('kho.id')->get();
    }
    public function taoKho(Request $r) {
        $d=$r->validate(['ten'=>'required','dia_chi'=>'nullable','ghichu'=>'nullable']);
        $id=DB::table('kho')->insertGetId([...$d,'created_at'=>now(),'updated_at'=>now()]);
        return ['id'=>$id];
    }
    public function tonKho($khoId) {
        return DB::table('kho_ton')
            ->join('vattu','vattu.id','=','kho_ton.vattu_id')
            ->where('kho_ton.kho_id',$khoId)
            ->select('vattu_id','vattu.ten','vattu.donvi','so_luong')
            ->orderBy('vattu.ten')->get();
    }
}

<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\{Cum, Kho, KhoTon, User};


class CumController extends Controller
{
// GET /api/cum
    public function index(Request $req){
        $q = Cum::withCount('thanhViens')->with(['chiHuy']);
        if ($kw = $req->get('q')) {
            $q->where(function($s) use ($kw){
                $s->where('ten','like',"%$kw%")
                    ->orWhere('mo_ta','like',"%$kw%");
            });
        }
        return response()->json($q->orderByDesc('id')->paginate($req->get('per_page',20)));
    }


// POST /api/cum
    public function store(Request $req){
        $data = $req->validate([
            'ten' => 'required|string',
            'mo_ta' => 'nullable|string',
            'chi_huy_id' => 'nullable|exists:users,id',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'dia_chi_text' => 'nullable|string',
            'thanh_vien_ids' => 'nullable|array',
            'thanh_vien_ids.*' => 'exists:users,id',
        ]);
        $cum = DB::transaction(function() use ($data){
   $cum = Cum::create($data);
   $cum->thanhViens()->sync($data['thanh_vien_ids'] ?? []);
   Kho::firstOrCreate(['cum_id'=>$cum->id], ['ten'=>"Kho cụm: ".$cum->ten]);
   return $cum;
});
return response()->json($cum->load(['thanhViens','chiHuy']));
    }


// GET /api/cum/{id}
    public function show($id){
        $cum = Cum::with(['thanhViens','chiHuy','kho'])->findOrFail($id);
        return response()->json($cum);
    }


// PUT /api/cum/{id}
    public function update(Request $req, $id){
        $cum = Cum::findOrFail($id);
        $data = $req->validate([
            'ten' => 'required|string',
            'mo_ta' => 'nullable|string',
            'chi_huy_id' => 'nullable|exists:users,id',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'dia_chi_text' => 'nullable|string',
            'thanh_vien_ids' => 'nullable|array',
            'thanh_vien_ids.*' => 'exists:users,id',
        ]);
        DB::transaction(function() use ($cum,$data){
            $cum->update($data);
            if (isset($data['thanh_vien_ids'])) $cum->thanhViens()->sync($data['thanh_vien_ids']);
// ensure kho tồn tại
            \App\Models\Kho::firstOrCreate(['cum_id'=>$cum->id],['ten'=>"Kho cụm: ".$cum->ten]);
        });
        return response()->json($cum->fresh(['thanhViens','chiHuy','kho']));
    }


// DELETE /api/cum/{id}
    public function destroy($id){
        Cum::findOrFail($id)->delete();
        return response()->json(['ok'=>true]);
    }
}

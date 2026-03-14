<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Cum;
use App\Models\Kho;

class CumController extends Controller
{

    // GET /api/cum
    public function index(Request $req)
    {
        $q = Cum::withCount('thanhViens')->with(['chiHuy']);

        if ($kw = $req->get('q')) {
            $q->where(function ($s) use ($kw) {
                $s->where('ten', 'like', "%$kw%")
                  ->orWhere('mo_ta', 'like', "%$kw%");
            });
        }

        return response()->json(
            $q->orderByDesc('id')->paginate($req->get('per_page', 20))
        );
    }


    // POST /api/cum
    public function store(Request $req)
    {
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

        $memberIds = $data['thanh_vien_ids'] ?? [];

        if (!empty($data['chi_huy_id']) && !in_array($data['chi_huy_id'], $memberIds)) {
            $memberIds[] = $data['chi_huy_id'];
        }

        $cum = DB::transaction(function () use ($data, $memberIds) {

            $cumData = $data;
            unset($cumData['thanh_vien_ids']);

            $cum = Cum::create($cumData);

            $cum->thanhViens()->sync($memberIds);

            Kho::updateOrCreate(
                ['cum_id' => $cum->id],
                ['ten' => "Kho cụm: " . $cum->ten]
            );

            return $cum;
        });

        return response()->json(
            $cum->load(['thanhViens', 'chiHuy', 'kho'])
        );
    }


    // GET /api/cum/{id}
    public function show($id)
    {
        $cum = Cum::with(['thanhViens', 'chiHuy', 'kho'])->findOrFail($id);
        return response()->json($cum);
    }


    // PUT /api/cum/{id}
    public function update(Request $req, $id)
    {
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

        $memberIds = $data['thanh_vien_ids'] ?? [];

        if (!empty($data['chi_huy_id']) && !in_array($data['chi_huy_id'], $memberIds)) {
            $memberIds[] = $data['chi_huy_id'];
        }

        DB::transaction(function () use ($cum, $data, $memberIds) {

            $cumData = $data;
            unset($cumData['thanh_vien_ids']);

            $cum->update($cumData);

            $cum->thanhViens()->sync($memberIds);

            Kho::updateOrCreate(
                ['cum_id' => $cum->id],
                ['ten' => "Kho cụm: " . $cum->ten]
            );
        });

        return response()->json(
            $cum->fresh(['thanhViens', 'chiHuy', 'kho'])
        );
    }


    // DELETE /api/cum/{id}
    public function destroy($id)
    {
        $cum = Cum::with(['kho'])->findOrFail($id);

        DB::transaction(function () use ($cum) {

            $cum->thanhViens()->detach();

            if ($cum->kho) {
                $cum->kho->delete();
            }

            $cum->delete();
        });

        return response()->json(['ok' => true]);
    }
}
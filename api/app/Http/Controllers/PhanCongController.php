<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use App\Models\{YeuCau,YeuCauPhanCong,Cum,User};
use Carbon\Carbon;


class PhanCongController extends Controller
{
// POST /api/yeucau/{id}/assign
    public function assign(Request $req, $id){
        $req->validate([
            'cum_id' => 'nullable|exists:cum,id',
            'user_id' => 'nullable|exists:users,id',
        ]);
        if (!$req->cum_id && !$req->user_id) {
            return response()->json(['message'=>'Chọn cụm hoặc thành viên'],422);
        }
        $yc = YeuCau::findOrFail($id);
        $pc = YeuCauPhanCong::create([
            'yeu_cau_id' => $yc->id,
            'cum_id' => $req->cum_id,
            'user_id' => $req->user_id,
            'assigned_by' => $req->user()->id,
            'assigned_at' => Carbon::now(),
        ]);
        return response()->json($pc->load(['cum','user','yeuCau']));
    }
}

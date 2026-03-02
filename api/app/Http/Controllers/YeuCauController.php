<?php
namespace App\Http\Controllers;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use App\Models\YeuCau;
use App\Models\VatTu;
use App\Models\TepDinhKem;
use App\Models\YeuCauVatTu;

class YeuCauController extends Controller
{
    public function index(Request $req)
    {
        $q = YeuCau::query()
            ->select([
                'id','loai','noidung','ten_nguoigui','sdt_nguoigui',
                'lat','lng','so_nguoi','trang_thai','created_at'
            ])
            ->with([
                'media:id,doi_tuong_id,mime,duong_dan',
                'vattuChiTiet' => function ($q) {
                    $q->select(['id','yeu_cau_id','vattu_id','so_luong','donvi'])
                        ->with('vattu:id,ten,donvi');
                }
            ]);

        // lọc loại
        if ($req->filled('loai')) {
            $q->where('loai', $req->string('loai'));
        }

        // từ khóa: nội dung, tên, sđt
        if ($req->filled('q')) {
            $kw = trim($req->string('q'));
            $q->where(function($s) use ($kw) {
                $s->where('noidung','like',"%{$kw}%")
                    ->orWhere('ten_nguoigui','like',"%{$kw}%")
                    ->orWhere('sdt_nguoigui','like',"%{$kw}%");
            });
        }

        // trong N giờ gần nhất
        if ($req->filled('hours')) {
            $hours = (int)$req->input('hours');
            if ($hours > 0) {
                $q->where('created_at', '>=', now()->subHours($hours));
            }
        }

        // lọc theo bán kính (km) dựa trên lat/lng trung tâm
        if ($req->filled('center_lat') && $req->filled('center_lng') && $req->filled('radius_km')) {
            $lat = (float) $req->input('center_lat');
            $lng = (float) $req->input('center_lng');
            $radius = (float) $req->input('radius_km');

            // Haversine (km) – MySQL/MariaDB
            $haversine = "(6371 * acos( cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?)) + sin(radians(?)) * sin(radians(lat)) ) )";

            $q->selectRaw("$haversine AS distance", [$lat,$lng,$lat])
                ->having('distance', '<=', $radius)
                ->orderBy('distance');
        } else {
            $q->latest('id');
        }

        // phân trang nhẹ (tuỳ bạn)
        // $data = $q->paginate(200);

        $data = $q->get();

        // Trả đúng cấu trúc FE đang đọc
        return response()->json([
            'data' => $data->map(function(YeuCau $r){
                return [
                    'id'            => $r->id,
                    'loai'          => $r->loai,
                    'noidung'       => $r->noidung,
                    'ten_nguoigui'  => $r->ten_nguoigui,
                    'sdt_nguoigui'  => $r->sdt_nguoigui,
                    'lat'           => (float)$r->lat,
                    'lng'           => (float)$r->lng,
                    'so_nguoi'      => $r->so_nguoi,
                    'trang_thai'    => $r->trang_thai,
                    'created_at'    => $r->created_at,
                    // media: [{url,type,thumb}]
                    'media' => $r->media->map(fn($m)=>[
                        'url'=>$m->url,
                        'type'=>Str::startsWith($m->mime, 'image/') ? 'image'
                            : (Str::startsWith($m->mime, 'video/') ? 'video' : 'other'),
                        'thumb'=>$m->duong_dan,
                    ])->values(),
                    // vattu_chitiet: [{ten,so_luong,don_vi}]
                    'vattu_chitiet' => $r->vattuChiTiet->map(function($c){
                        return [
                            'ten'      => $c->vattu->ten ?? '',
                            'so_luong' => $c->so_luong,
                            'don_vi'   => $c->don_vi ?: ($c->vattu->don_vi ?? ''),
                        ];
                    })->values(),
                ];
            }),
        ]);
    }
    public function indexAdmin(Request $request)
    {
        $q = YeuCau::query()
            ->with(['media:id,doi_tuong,doi_tuong_id,duong_dan,mime,created_at', 'vattuChiTiet.vattu:id,ten,donvi'])
            ->orderByDesc('id');
        if ($request->filled('cum_id')) {
            $q->where('cum_id', (int)$request->cum_id);
        }

        // ✅ “Được giao”: cho chính tôi hoặc cho 1 CỤM mà tôi là thành viên
        if ($request->boolean('assigned_to_me')) {
            $user = $request->user();
            // Lấy danh sách cụm mà tôi là thành viên (tùy tên quan hệ của bạn)
            // Ưu tiên dùng quan hệ nếu đã có:
            $cumIds = method_exists($user, 'cums')
                ? $user->cums()->pluck('cums.id')
                : DB::table('cum_thanh_vien')->where('user_id', $user->id)->pluck('cum_id');

            $q->where(function($w) use ($user, $cumIds){
                $w->where('duoc_giao_cho', $user->id)
                    ->orWhereIn('cum_id', $cumIds);
            });
        }

        if ($request->boolean('chua_phan_cong')) {
            $q->whereNull('duoc_giao_cho')->whereNull('cum_id');
            // hoặc: $q->whereDoesntHave('phanCong');
        }

        // Lọc trạng thái (select ở admin)
        if ($request->filled('trang_thai')) {
            $vals = collect(explode(',', $request->trang_thai))->map(fn($x)=>trim($x))->filter()->values();
            if ($vals->isNotEmpty()) $q->whereIn('trang_thai', $vals);
        }

        // Thời gian (giữ nguyên nếu cần)
        if ($request->filled('hours') && (int)$request->hours > 0) {
            $q->where('created_at', '>=', now()->subHours((int)$request->hours));
        }

        $perPage = max(1, min(100, (int)$request->input('per_page', 100)));
        $p = $q->paginate($perPage);

        // Chuẩn hóa media/url/type + alias vật tư cho FE (giữ đúng cấu trúc hiện tại của bạn)
        $p->getCollection()->transform(function ($item) {
            if ($item->relationLoaded('media')) {
                $item->media->transform(function ($m) {
                    $m->url  = \Illuminate\Support\Facades\Storage::url($m->duong_dan);
                    $m->type = str_starts_with($m->mime ?? '', 'image/') ? 'image' : (str_starts_with($m->mime ?? '', 'video/') ? 'video' : 'other');
                    return $m;
                });
            }
            if ($item->relationLoaded('vattuChiTiet')) {
                $item->vattu_chi_tiet = $item->vattuChiTiet;
            }
            return $item;
        });

        return $p;
    }

    /** GET /api/yeucau/{id} – trả chi tiết 1 bản ghi (kèm media & vật tư) */
    public function show($id)
    {
        $r = YeuCau::query()
            ->with([
                'media:id,yeucau_id,type,url,thumb',
                'vattuChiTiet' => function ($q) {
                    $q->select(['id','yeucau_id','vattu_id','so_luong','don_vi'])
                        ->with('vattu:id,ten,don_vi');
                }
            ])
            ->findOrFail($id);

        return response()->json([
            'id'            => $r->id,
            'loai'          => $r->loai,
            'noidung'       => $r->noidung,
            'ten_nguoigui'  => $r->ten_nguoigui,
            'sdt_nguoigui'  => $r->sdt_nguoigui,
            'lat'           => (float)$r->lat,
            'lng'           => (float)$r->lng,
            'so_nguoi'      => $r->so_nguoi,
            'trang_thai'    => $r->trang_thai,
            'created_at'    => $r->created_at,
            'media' => $r->media->map(fn($m)=>[
                'url'=>$m->url, 'type'=>$m->type, 'thumb'=>$m->thumb,
            ])->values(),
            'vattu_chitiet' => $r->vattuChiTiet->map(function($c){
                return [
                    'ten'      => $c->vattu->ten ?? '',
                    'so_luong' => $c->so_luong,
                    'don_vi'   => $c->don_vi ?: ($c->vattu->don_vi ?? ''),
                ];
            })->values(),
        ]);
    }
    public function danhsach(Request $request)
    {
        $q = YeuCau::query()
            ->with(['vattuChiTiet.vattu', 'media'])
            ->orderByDesc('id');

        // === 1. Lọc theo loại (cứu người / nhu yếu phẩm)
        if ($request->filled('loai')) {
            $q->where('loai', $request->loai);
        }

        // === 2. Lọc theo trạng thái
        if ($request->filled('trang_thai')) {
            // cho phép truyền nhiều trạng thái cách nhau dấu phẩy
            $statuses = array_map('trim', explode(',', $request->trang_thai));
            $q->whereIn('trang_thai', $statuses);
        }

        // === 3. Từ khóa tìm kiếm (frontend gửi param "q")
        if ($request->filled('q')) {
            $kw = trim($request->q);
            $q->where(function ($s) use ($kw) {
                if (ctype_digit($kw)) {
                    $s->orWhere('id', (int) $kw);
                }
                $s->orWhere('ten_nguoigui', 'like', "%$kw%")
                    ->orWhere('sdt_nguoigui', 'like', "%$kw%")
                    ->orWhere('noidung', 'like', "%$kw%");
            });
        }

        // === 4. Khoảng thời gian (giờ)
        if ($request->filled('hours')) {
            $q->where('created_at', '>=', now()->subHours((int)$request->hours));
        }

        // === 5. Lọc theo bán kính (km) nếu có center
        if ($request->filled('center_lat') && $request->filled('center_lng') && $request->filled('radius_km')) {
            $lat = (float) $request->center_lat;
            $lng = (float) $request->center_lng;
            $radius = (float) $request->radius_km;

            $q->selectRaw(
                "yeu_cau.*, (6371 * acos(cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?)) + sin(radians(?)) * sin(radians(lat)))) as khoang_cach",
                [$lat, $lng, $lat]
            )->having('khoang_cach', '<=', $radius);
        }

        // === 6. Lấy dữ liệu
        $list = $q->limit(500)->get()->map(function ($item) {
            return [
                'id'           => $item->id,
                'loai'         => $item->loai,
                'trang_thai'   => $item->trang_thai,
                'lat'          => $item->lat,
                'lng'          => $item->lng,
                'ten_nguoigui' => $item->ten_nguoigui,
                'sdt_nguoigui' => $item->sdt_nguoigui,
                'noidung'      => $item->noidung,
                'so_nguoi'     => $item->so_nguoi,
                'vattu'        => $item->vattuChiTiet?->map(fn($v) => [
                        'ten'      => $v->vattu?->ten,
                        'so_luong' => $v->so_luong,
                        'don_vi'   => $v->vattu?->don_vi,
                    ])->values() ?? [],
                'media' => $item->media?->map(fn($m) => [
                        'id'   => $m->id,
                        'url'  => url($m->url), // chuyển đường dẫn tương đối -> tuyệt đối
                        'type' => str_contains($m->mime ?? '', 'video') ? 'video' : 'image',
                    ])->values() ?? [],
                // Chuyển về ISO-8601 có timezone VN để FE hiển thị chính xác "mấy phút trước"
                'created_at' => optional($item->created_at)
                    ->setTimezone('Asia/Ho_Chi_Minh')
                    ->toIso8601String(),
            ];
        });

        return response()->json([
            'status' => true,
            'count'  => $list->count(),
            'data'   => $list,
        ]);
    }



    public function tao(Request $request)
    {
        $data = $request->validate([
            'loai'          => ['required', Rule::in(['cuu_nguoi','nhu_yeu_pham'])],
            'ten_nguoigui'  => ['required','string','max:255'],
            'sdt_nguoigui'  => ['required','string','max:30'],
            'noidung'       => ['required','string'],
            'lat'           => ['required','numeric'],
            'lng'           => ['required','numeric'],
            'so_nguoi'      => ['nullable','integer','min:1'],
            'vattu_chitiet' => ['nullable','string'],     // JSON: [{vattu_id, so_luong}]
            'files.*'       => ['nullable','file','max:15360'],
        ]);

        // chặn số điện thoại đã có yêu cầu "tiep_nhan"
        $dup = YeuCau::where('sdt_nguoigui', $data['sdt_nguoigui'])
            ->where('trang_thai','tiep_nhan')
            ->latest('id')->first();
        if ($dup) {
            return response()->json([
                'status' => false,
                'message' => 'Số điện thoại này đã có yêu cầu đang tiếp nhận.',
                'existing_id' => $dup->id,
            ], 409);
        }

        return DB::transaction(function () use ($request, $data) {
            $data['trang_thai'] = 'tiep_nhan';
            if (empty($data['so_nguoi'])) $data['so_nguoi'] = 1;

            $yc = YeuCau::create($data);

            // LƯU VẬT TƯ CHI TIẾT
            $vtArr = json_decode($request->input('vattu_chitiet', '[]'), true) ?: [];
            foreach ($vtArr as $row) {
                if (empty($row['vattu_id']) || empty($row['so_luong'])) continue;

                $v = VatTu::find((int)$row['vattu_id']);
                if (!$v) continue;

                // tạo qua quan hệ -> Eloquent tự gán yeu_cau_id = $yc->id
                $yc->vattuChiTiet()->create([
                    'vattu_id'  => (int)$v->id,
                    'so_luong'  => (float)$row['so_luong'],
                    'ten_vattu' => $v->ten,           // ✅ gán tên
                    'donvi'     => $v->don_vi ?? '',  // ✅ gán đơn vị
                ]);
            }

            // LƯU FILE ĐÍNH KÈM (đường dẫn tương đối)
            if ($request->hasFile('files')) {
                foreach ($request->file('files') as $file) {
                    $path = $file->store('yeucau', 'public'); // storage/app/public/yeucau/...
                    TepDinhKem::create([
                        'doi_tuong'    => 'yeu_cau',
                        'doi_tuong_id' => $yc->id,
                        'duong_dan'    => 'storage/' . $path,
                        'mime'         => $file->getClientMimeType(),
                        'kich_thuoc'   => $file->getSize(),
                    ]);
                }
            }

            return response()->json(['status'=>true, 'id'=>$yc->id], 201);
        });
    }

    // === Trang chi tiết yêu cầu ===
    public function chitiet($id)
    {
        $yc = YeuCau::with(['vattuChiTiet.vattu','media'])->findOrFail($id);

        return response()->json([
            'id'           => $yc->id,
            'loai'         => $yc->loai,
            'trang_thai'   => $yc->trang_thai,
            'lat'          => $yc->lat,
            'lng'          => $yc->lng,
            'ten_nguoigui' => $yc->ten_nguoigui,
            'sdt_nguoigui' => $yc->sdt_nguoigui,
            'noidung'      => $yc->noidung,
            'so_nguoi'     => $yc->so_nguoi,
            'vattu' => $yc->vattuChiTiet->map(function($r){
                return [
                    'ten'      => $r->ten_vattu ?? $r->vattu?->ten,
                    'so_luong' => $r->so_luong,
                    'don_vi'   => $r->donvi ?? $r->vattu?->don_vi,
                ];
            })->values(),
            'media'        => $yc->media->map(fn($m)=>[
                'id'=>$m->id,
                'url'=>$m->url,
                'type'=> str_contains($m->mime,'video') ? 'video' : 'image'
            ])->values(),
            'created_at'   => optional($yc->created_at)->format('Y-m-d H:i:s'),
        ]);
    }

    public function sua($id, Request $r) {
        $upd = $r->only(['tieu_de','noidung','lat','lng','so_nguoi']);
        if (!$upd) return ['ok'=>true];
        $upd['updated_at'] = now();
        DB::table('yeu_cau')->where('id',$id)->update($upd);

        DB::table('yeu_cau_nhatky')->insert([
            'yeu_cau_id'=>$id,'thuc_hien_boi'=>auth()->id(),
            'hanh_dong'=>'sua','tao_luc'=>now()
        ]);
        return ['ok'=>true];
    }

    public function giao($id, Request $r) {
        $r->validate(['user_id'=>'required|integer']);
        $curr = DB::table('yeu_cau')->where('id',$id)->first();
        DB::table('yeu_cau')->where('id',$id)->update(['duoc_giao_cho'=>$r->user_id,'updated_at'=>now()]);
        DB::table('yeu_cau_nhatky')->insert([
            'yeu_cau_id'=>$id,'thuc_hien_boi'=>auth()->id(),'hanh_dong'=>'gan_nguoi',
            'tu_nguoi'=>$curr->duoc_giao_cho,'den_nguoi'=>$r->user_id,'tao_luc'=>now()
        ]);
        return ['ok'=>true];
    }

    public function doiTrangThai($id, Request $r) {
        $r->validate([
    'trang_thai' => 'required|in:tiep_nhan,dang_xu_ly,da_chuyen_cum,da_hoan_thanh,huy',
    'ghichu' => 'nullable|string'
]);

        $curr = DB::table('yeu_cau')->where('id',$id)->first();
        DB::table('yeu_cau')->where('id',$id)->update(['trang_thai'=>$r->trang_thai,'updated_at'=>now()]);
        DB::table('yeu_cau_nhatky')->insert([
            'yeu_cau_id'=>$id,'thuc_hien_boi'=>auth()->id(),'hanh_dong'=>'doi_trang_thai',
            'tu_trangthai'=>$curr->trang_thai,'den_trangthai'=>$r->trang_thai,'ghichu'=>$r->ghichu,'tao_luc'=>now()
        ]);
        return ['ok'=>true];
    }

    public function nhatKy($id) {
        return DB::table('yeu_cau_nhatky')->where('yeu_cau_id',$id)->orderBy('id','desc')->get();
    }
    public function capNhatTrangThai(Request $request, $id) {
        $yc = YeuCau::findOrFail($id);
        $yc->trang_thai = $request->input('trang_thai', $yc->trang_thai);
        $yc->save();

        // lưu lịch sử ghi chú (nếu bạn có bảng lịch sử)
        if ($note = trim($request->input('ghi_chu',''))) {
            // YeuCauLichSu::create([...]); // tùy cấu trúc bạn
        }
        return response()->json(['ok'=>true]);
    }

    public function chuyenXuLy(Request $request, $id) {
        $yc = YeuCau::findOrFail($id);
        if ($request->filled('user_id')) {
            $yc->duoc_giao_cho = (int)$request->user_id;
            $yc->cum_id = null;
        } elseif ($request->filled('cum_id')) {
            $yc->cum_id = (int)$request->cum_id;
            $yc->duoc_giao_cho = null;
        }
        $yc->save();

        if ($note = trim($request->input('ghi_chu',''))) {
            // YeuCauLichSu::create([...]);
        }
        return response()->json(['ok'=>true]);
    }

}

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
use App\Models\YeuCauNhatKy;

class YeuCauController extends Controller
{
    public function index(Request $req)
    {
        $q = YeuCau::query()
            ->select([
                'id',
                'loai',
                'noidung',
                'ten_nguoigui',
                'sdt_nguoigui',
                'lat',
                'lng',
                'so_nguoi',
                'trang_thai',
                'created_at'
            ])
            ->with([
                'media:id,doi_tuong_id,mime,duong_dan',
                'vattuChiTiet' => function ($q) {
                    $q->select(['id', 'yeu_cau_id', 'vattu_id', 'so_luong', 'donvi'])
                        ->with('vattu:id,ten,donvi');
                }
            ]);

        if ($req->filled('loai')) {
            $q->where('loai', $req->string('loai'));
        }

        if ($req->filled('q')) {
            $kw = trim($req->string('q'));
            $q->where(function ($s) use ($kw) {
                $s->where('noidung', 'like', "%{$kw}%")
                    ->orWhere('ten_nguoigui', 'like', "%{$kw}%")
                    ->orWhere('sdt_nguoigui', 'like', "%{$kw}%");
            });
        }

        if ($req->filled('hours')) {
            $hours = (int) $req->input('hours');
            if ($hours > 0) {
                $q->where('created_at', '>=', now()->subHours($hours));
            }
        }

        if ($req->filled('center_lat') && $req->filled('center_lng') && $req->filled('radius_km')) {
            $lat = (float) $req->input('center_lat');
            $lng = (float) $req->input('center_lng');
            $radius = (float) $req->input('radius_km');

            $haversine = "(6371 * acos( cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?)) + sin(radians(?)) * sin(radians(lat)) ) )";

            $q->selectRaw("$haversine AS distance", [$lat, $lng, $lat])
                ->having('distance', '<=', $radius)
                ->orderBy('distance');
        } else {
            $q->latest('id');
        }

        $data = $q->get();

        return response()->json([
            'data' => $data->map(function (YeuCau $r) {
                return [
                    'id' => $r->id,
                    'loai' => $r->loai,
                    'noidung' => $r->noidung,
                    'ten_nguoigui' => $r->ten_nguoigui,
                    'sdt_nguoigui' => $r->sdt_nguoigui,
                    'lat' => (float) $r->lat,
                    'lng' => (float) $r->lng,
                    'so_nguoi' => $r->so_nguoi,
                    'trang_thai' => $r->trang_thai,
                    'created_at' => $r->created_at,
                    'media' => $r->media->map(fn($m) => [
                        'url' => Storage::url($m->duong_dan),
                        'type' => Str::startsWith($m->mime, 'image/')
                            ? 'image'
                            : (Str::startsWith($m->mime, 'video/') ? 'video' : 'other'),
                        'thumb' => $m->duong_dan,
                    ])->values(),
                    'vattu_chitiet' => $r->vattuChiTiet->map(function ($c) {
                        return [
                            'ten' => $c->vattu->ten ?? '',
                            'so_luong' => $c->so_luong,
                            'don_vi' => $c->donvi ?: ($c->vattu->donvi ?? ''),
                        ];
                    })->values(),
                ];
            }),
        ]);
    }

    public function indexAdmin(Request $request)
{
    $user = $request->user();

    $q = YeuCau::query()
        ->with([
            'media:id,doi_tuong,doi_tuong_id,duong_dan,mime,created_at',
            'vattuChiTiet.vattu:id,ten,donvi'
        ])
        ->orderByDesc('id');

    if (!$this->isAdmin($user)) {
        $allowedCumIds = $this->getAllowedCumIds($user);

        if (empty($allowedCumIds)) {
            $q->whereRaw('1 = 0');
        } else {
            if ($request->filled('cum_id')) {
                $requestedCumId = (int) $request->cum_id;

                if (in_array($requestedCumId, $allowedCumIds, true)) {
                    $q->where('cum_id', $requestedCumId);
                } else {
                    $q->whereRaw('1 = 0');
                }
            } else {
                $q->whereIn('cum_id', $allowedCumIds);
            }
        }
    } else {
        if ($request->filled('cum_id')) {
            $q->where('cum_id', (int) $request->cum_id);
        }
    }

    if ($request->boolean('assigned_to_me')) {
        $cumIds = collect($this->getAllowedCumIds($user));

        $q->where(function ($w) use ($user, $cumIds) {
            $w->where('duoc_giao_cho', $user->id);

            if ($cumIds->isNotEmpty()) {
                $w->orWhereIn('cum_id', $cumIds->all());
            }
        });
    }

    if ($request->boolean('chua_phan_cong')) {
        $q->whereNull('duoc_giao_cho')->whereNull('cum_id');
    }

    if ($request->filled('trang_thai')) {
        $vals = collect(explode(',', $request->trang_thai))
            ->map(fn($x) => trim($x))
            ->filter()
            ->values();

        if ($vals->isNotEmpty()) {
            $q->whereIn('trang_thai', $vals);
        }
    }

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

    if ($request->filled('hours') && (int) $request->hours > 0) {
        $q->where('created_at', '>=', now()->subHours((int) $request->hours));
    }

    $perPage = max(1, min(100, (int) $request->input('per_page', 100)));
    $p = $q->paginate($perPage);

    $p->getCollection()->transform(function ($item) {
        if ($item->relationLoaded('media')) {
            $item->media->transform(function ($m) {
                $m->url = Storage::url($m->duong_dan);
                $m->type = str_starts_with($m->mime ?? '', 'image/')
                    ? 'image'
                    : (str_starts_with($m->mime ?? '', 'video/') ? 'video' : 'other');
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

    public function show($id)
    {
        $r = YeuCau::query()
            ->with([
                'media:id,doi_tuong_id,mime,duong_dan',
                'vattuChiTiet' => function ($q) {
                    $q->select(['id', 'yeu_cau_id', 'vattu_id', 'so_luong', 'donvi'])
                        ->with('vattu:id,ten,donvi');
                }
            ])
            ->findOrFail($id);

        return response()->json([
            'id' => $r->id,
            'loai' => $r->loai,
            'noidung' => $r->noidung,
            'ten_nguoigui' => $r->ten_nguoigui,
            'sdt_nguoigui' => $r->sdt_nguoigui,
            'lat' => (float) $r->lat,
            'lng' => (float) $r->lng,
            'so_nguoi' => $r->so_nguoi,
            'trang_thai' => $r->trang_thai,
            'created_at' => $r->created_at,
            'media' => $r->media->map(fn($m) => [
                'url' => Storage::url($m->duong_dan),
                'type' => Str::startsWith($m->mime, 'image/')
                    ? 'image'
                    : (Str::startsWith($m->mime, 'video/') ? 'video' : 'other'),
                'thumb' => $m->duong_dan,
            ])->values(),
            'vattu_chitiet' => $r->vattuChiTiet->map(function ($c) {
                return [
                    'ten' => $c->vattu->ten ?? '',
                    'so_luong' => $c->so_luong,
                    'don_vi' => $c->donvi ?: ($c->vattu->donvi ?? ''),
                ];
            })->values(),
        ]);
    }

    public function danhsach(Request $request)
    {
        $q = YeuCau::query()
            ->with(['vattuChiTiet.vattu', 'media'])
            ->orderByDesc('id');

        if ($request->filled('loai')) {
            $q->where('loai', $request->loai);
        }

        if ($request->filled('trang_thai')) {
            $statuses = array_map('trim', explode(',', $request->trang_thai));
            $q->whereIn('trang_thai', $statuses);
        }

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

        if ($request->filled('hours')) {
            $q->where('created_at', '>=', now()->subHours((int) $request->hours));
        }

        if ($request->filled('center_lat') && $request->filled('center_lng') && $request->filled('radius_km')) {
            $lat = (float) $request->center_lat;
            $lng = (float) $request->center_lng;
            $radius = (float) $request->radius_km;

            $q->selectRaw(
                "yeu_cau.*, (6371 * acos(cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?)) + sin(radians(?)) * sin(radians(lat)))) as khoang_cach",
                [$lat, $lng, $lat]
            )->having('khoang_cach', '<=', $radius);
        }

        $list = $q->limit(500)->get()->map(function ($item) {
            return [
                'id' => $item->id,
                'loai' => $item->loai,
                'trang_thai' => $item->trang_thai,
                'lat' => $item->lat,
                'lng' => $item->lng,
                'ten_nguoigui' => $item->ten_nguoigui,
                'sdt_nguoigui' => $item->sdt_nguoigui,
                'noidung' => $item->noidung,
                'so_nguoi' => $item->so_nguoi,
                'vattu' => $item->vattuChiTiet?->map(fn($v) => [
                    'ten' => $v->vattu?->ten,
                    'so_luong' => $v->so_luong,
                    'don_vi' => $v->vattu?->donvi,
                ])->values() ?? [],
                'media' => $item->media?->map(fn($m) => [
                    'id' => $m->id,
                    'url' => Storage::url($m->duong_dan),
                    'type' => str_contains($m->mime ?? '', 'video') ? 'video' : 'image',
                ])->values() ?? [],
                'created_at' => optional($item->created_at)
                    ->setTimezone('Asia/Ho_Chi_Minh')
                    ->toIso8601String(),
            ];
        });

        return response()->json([
            'status' => true,
            'count' => $list->count(),
            'data' => $list,
        ]);
    }

    public function tao(Request $request)
    {
        $data = $request->validate([
            'loai' => ['required', Rule::in(['cuu_nguoi', 'nhu_yeu_pham'])],
            'ten_nguoigui' => ['required', 'string', 'max:255'],
            'sdt_nguoigui' => ['required', 'string', 'max:30'],
            'noidung' => ['required', 'string'],
            'lat' => ['required', 'numeric'],
            'lng' => ['required', 'numeric'],
            'so_nguoi' => ['nullable', 'integer', 'min:1'],
            'vattu_chitiet' => ['nullable', 'string'],
            'files.*' => ['nullable', 'file', 'max:15360'],
        ]);

        $dup = YeuCau::where('sdt_nguoigui', $data['sdt_nguoigui'])
            ->where('trang_thai', 'tiep_nhan')
            ->latest('id')
            ->first();

        if ($dup) {
            return response()->json([
                'status' => false,
                'message' => 'Số điện thoại này đã có yêu cầu đang tiếp nhận.',
                'existing_id' => $dup->id,
            ], 409);
        }

        return DB::transaction(function () use ($request, $data) {
            $data['trang_thai'] = 'tiep_nhan';
            if (empty($data['so_nguoi'])) {
                $data['so_nguoi'] = 1;
            }

            $yc = YeuCau::create($data);

            $vtArr = json_decode($request->input('vattu_chitiet', '[]'), true) ?: [];
            foreach ($vtArr as $row) {
                if (empty($row['vattu_id']) || empty($row['so_luong'])) {
                    continue;
                }

                $v = VatTu::find((int) $row['vattu_id']);
                if (!$v) {
                    continue;
                }

                $yc->vattuChiTiet()->create([
                    'vattu_id' => (int) $v->id,
                    'so_luong' => (float) $row['so_luong'],
                    'ten_vattu' => $v->ten,
                    'donvi' => $v->donvi ?? '',
                ]);
            }

            if ($request->hasFile('files')) {
                foreach ($request->file('files') as $file) {
                    $path = $file->store('yeucau', 'public');
                    TepDinhKem::create([
                        'doi_tuong' => 'yeu_cau',
                        'doi_tuong_id' => $yc->id,
                        'duong_dan' => $path,
                        'mime' => $file->getClientMimeType(),
                        'kich_thuoc' => $file->getSize(),
                    ]);
                }
            }

            YeuCauNhatKy::create([
                'yeu_cau_id' => $yc->id,
                'thuc_hien_boi' => auth()->id() ?: null,
                'hanh_dong' => 'created',
                'tu_trangthai' => null,
                'den_trangthai' => 'tiep_nhan',
                'tu_nguoi' => null,
                'den_nguoi' => null,
                'ghichu' => 'Tạo yêu cầu mới',
                'tao_luc' => now(),
            ]);

            return response()->json(['status' => true, 'id' => $yc->id], 201);
        });
    }

    public function chitiet($id)
    {
        $yc = YeuCau::with(['vattuChiTiet.vattu', 'media'])->findOrFail($id);

        return response()->json([
            'id' => $yc->id,
            'loai' => $yc->loai,
            'trang_thai' => $yc->trang_thai,
            'lat' => $yc->lat,
            'lng' => $yc->lng,
            'ten_nguoigui' => $yc->ten_nguoigui,
            'sdt_nguoigui' => $yc->sdt_nguoigui,
            'noidung' => $yc->noidung,
            'so_nguoi' => $yc->so_nguoi,
            'vattu' => $yc->vattuChiTiet->map(function ($r) {
                return [
                    'ten' => $r->ten_vattu ?? $r->vattu?->ten,
                    'so_luong' => $r->so_luong,
                    'don_vi' => $r->donvi ?? $r->vattu?->donvi,
                ];
            })->values(),
            'media' => $yc->media->map(fn($m) => [
                'id' => $m->id,
                'url' => Storage::url($m->duong_dan),
                'type' => str_contains($m->mime, 'video') ? 'video' : 'image',
            ])->values(),
            'created_at' => optional($yc->created_at)->format('Y-m-d H:i:s'),
        ]);
    }

    public function sua($id, Request $r)
    {
        $upd = $r->only(['tieu_de', 'noidung', 'lat', 'lng', 'so_nguoi']);
        if (!$upd) {
            return response()->json(['ok' => true]);
        }

        DB::table('yeu_cau')->where('id', $id)->update(array_merge($upd, [
            'updated_at' => now(),
        ]));

        DB::table('yeu_cau_nhatky')->insert([
            'yeu_cau_id' => $id,
            'thuc_hien_boi' => auth()->id(),
            'hanh_dong' => 'sua',
            'tao_luc' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    // Giữ tương thích route cũ /admin/yeucau/{id}/giao
    public function giao($id, Request $r)
    {
        $r->validate([
            'user_id' => 'required|integer|exists:users,id',
            'ghi_chu' => 'nullable|string',
        ]);

        $yc = YeuCau::findOrFail($id);

        DB::transaction(function () use ($yc, $r) {
            $oldNguoi = $yc->duoc_giao_cho ?? null;
            $oldTrangThai = $yc->trang_thai;

            $yc->duoc_giao_cho = (int) $r->user_id;
            $yc->updated_at = now();
            $yc->save();

            YeuCauNhatKy::create([
                'yeu_cau_id' => $yc->id,
                'thuc_hien_boi' => auth()->id(),
                'hanh_dong' => 'gan_nguoi',
                'tu_trangthai' => $oldTrangThai,
                'den_trangthai' => $yc->trang_thai,
                'tu_nguoi' => $oldNguoi,
                'den_nguoi' => (int) $r->user_id,
                'ghichu' => $r->ghi_chu ?: 'Gán người xử lý',
                'tao_luc' => now(),
            ]);
        });

        return response()->json(['ok' => true]);
    }
    private function isAdmin($user): bool
{
    return $user && method_exists($user, 'hasRole') && $user->hasRole('Quản trị');
}

private function getAllowedCumIds($user): array
{
    $memberIds = method_exists($user, 'cums')
        ? $user->cums()->pluck('cum.id')->map(fn($id) => (int) $id)->toArray()
        : DB::table('cum_thanh_vien')->where('user_id', $user->id)->pluck('cum_id')->map(fn($id) => (int) $id)->toArray();

    $chiHuyIds = DB::table('cum')
        ->where('chi_huy_id', $user->id)
        ->pluck('id')
        ->map(fn($id) => (int) $id)
        ->toArray();

    return array_values(array_unique(array_merge($memberIds, $chiHuyIds)));
}

    public function doiTrangThai($id, Request $r)
    {
        $r->validate([
    'trang_thai' => 'required|in:tiep_nhan,dang_xu_ly,da_chuyen_cum,da_hoan_thanh,huy',
    'ghi_chu' => 'nullable|string',
]);

        $curr = DB::table('yeu_cau')->where('id', $id)->first();

        if (!$curr) {
            return response()->json(['message' => 'Không tìm thấy yêu cầu'], 404);
        }

        DB::transaction(function () use ($id, $r, $curr) {
            $update = [
    'trang_thai' => $r->trang_thai,
    'updated_at' => now(),
];

if ($r->trang_thai === 'tiep_nhan') {
    $update['duoc_giao_cho'] = null;
}

DB::table('yeu_cau')
    ->where('id', $id)
    ->update($update);

            DB::table('yeu_cau_nhatky')->insert([
                'yeu_cau_id' => $id,
                'thuc_hien_boi' => auth()->id(),
                'hanh_dong' => 'doi_trang_thai',
                'tu_trangthai' => $curr->trang_thai,
                'den_trangthai' => $r->trang_thai,
                'tu_nguoi' => $curr->duoc_giao_cho ?? null,
                'den_nguoi' => $curr->duoc_giao_cho ?? null,
                'ghichu' => $r->ghi_chu,
                'tao_luc' => now(),
            ]);
        });

        return response()->json(['ok' => true]);
    }

    public function claim($id, Request $request)
{
    $yc = YeuCau::findOrFail($id);
    $user = $request->user();

    /*
    CHẶN TRƯỜNG HỢP ĐÃ ĐƯỢC XỬ LÝ
    */
    if ($yc->trang_thai !== 'tiep_nhan') {
        return response()->json([
            'message' => 'Yêu cầu này đã được nhận xử lý'
        ], 403);
    }

    /*
    CHẶN TRƯỜNG HỢP ĐÃ CÓ NGƯỜI NHẬN
    */
    if (!empty($yc->duoc_giao_cho) && (int)$yc->duoc_giao_cho !== (int)$user->id) {
        return response()->json([
            'message' => 'Yêu cầu này đang được giao cho người khác'
        ], 403);
    }

    DB::transaction(function () use ($yc, $user) {

        $oldTrangThai = $yc->trang_thai;
        $oldNguoi = $yc->duoc_giao_cho;

        $yc->duoc_giao_cho = $user->id;
        $yc->trang_thai = 'dang_xu_ly';
        $yc->updated_at = now();
        $yc->save();

        YeuCauNhatKy::create([
            'yeu_cau_id' => $yc->id,
            'thuc_hien_boi' => $user->id,
            'hanh_dong' => 'nhan_xu_ly',
            'tu_trangthai' => $oldTrangThai,
            'den_trangthai' => 'dang_xu_ly',
            'tu_nguoi' => $oldNguoi,
            'den_nguoi' => $user->id,
            'ghichu' => 'Nhận xử lý yêu cầu',
            'tao_luc' => now(),
        ]);
    });

    return response()->json([
        'ok' => true,
        'message' => 'Nhận xử lý thành công'
    ]);
}

    public function nhatKy($id)
    {
        $items = YeuCauNhatKy::with('user:id,name')
            ->where('yeu_cau_id', $id)
            ->orderByDesc('tao_luc')
            ->get()
            ->map(function ($x) {
                $label = match ($x->hanh_dong) {
                    'created' => 'Tạo yêu cầu',
                    'sua' => 'Chỉnh sửa',
                    'gan_nguoi' => 'Gán người xử lý',
                    'chuyen_xu_ly' => 'Chuyển xử lý',
                    'nhan_xu_ly' => 'Nhận xử lý',
                    'doi_trang_thai' => match ($x->den_trangthai) {
                        'tiep_nhan' => 'Tiếp nhận',
                        'dang_xu_ly' => 'Đang xử lý',
                        'da_chuyen_cum' => 'Đã chuyển cụm',
                        'da_hoan_thanh' => 'Đã hoàn thành',
                        'huy' => 'Hủy',
                        default => 'Đổi trạng thái',
                    },
                    default => $x->hanh_dong,
                };

                return [
                    'id' => $x->id,
                    'hanh_dong' => $x->hanh_dong,
                    'trang_thai_hien_thi' => $label,
                    'nguoi_thuc_hien' => $x->user?->name ?? 'Hệ thống',
                    'ghi_chu' => $x->ghichu,
                    'created_at' => $x->tao_luc,
                    'tu_trangthai' => $x->tu_trangthai,
                    'den_trangthai' => $x->den_trangthai,
                    'tu_nguoi' => $x->tu_nguoi,
                    'den_nguoi' => $x->den_nguoi,
                ];
            });

        return response()->json([
            'data' => $items,
        ]);
    }
}
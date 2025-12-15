<?php
// app/Http/Controllers/UserController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use Illuminate\Support\Facades\Schema;

class UserController extends Controller
{
    // Danh sách + tìm kiếm + filter theo role Spatie
    public function index(Request $req)
    {
        $q = \App\Models\User::query();
        $kw = $req->get('q');
        $hasPhone = Schema::hasColumn('users','phone');

        if ($kw) {
            $q->where(function($s) use($kw,$hasPhone){
                $s->where('name','like',"%$kw%")
                    ->orWhere('email','like',"%$kw%");
                if ($hasPhone) $s->orWhere('phone','like',"%$kw%");
            });
        }
        if ($role = $req->get('role')) {
            $q->whereHas('roles', fn($s)=>$s->where('name',$role));
        }
        $q->with('roles:id,name');
        return response()->json($q->orderByDesc('id')->paginate($req->integer('per_page',20)));
    }

    public function show($id)
    {
        $u = User::with('roles:id,name')->findOrFail($id);
        return response()->json($u);
    }

    public function store(Request $req)
    {
        $data = $req->validate([
            'name'     => ['required','string','max:255'],
            'email'    => ['required','email','max:255','unique:users,email'],
            'phone'    => ['nullable','string','max:50'],
            'password' => ['required','string','min:6'],
            'roles'    => ['array'],                    // mảng tên role
            'roles.*'  => ['string','exists:roles,name'],
        ]);

        $u = new User();
        $u->name  = $data['name'];
        $u->email = $data['email'];
        $u->phone = $data['phone'] ?? null;
        $u->password = Hash::make($data['password']);
        $u->save();

        if (!empty($data['roles'])) {
            $u->syncRoles($data['roles']);             // gán role Spatie
        }

        return response()->json($u->load('roles:id,name'), 201);
    }

    public function update(Request $req, $id)
    {
        $u = User::findOrFail($id);

        $data = $req->validate([
            'name'     => ['sometimes','required','string','max:255'],
            'email'    => ['sometimes','required','email','max:255', Rule::unique('users','email')->ignore($u->id)],
            'phone'    => ['nullable','string','max:50'],
            'password' => ['nullable','string','min:6'],
            'roles'    => ['sometimes','array'],
            'roles.*'  => ['string','exists:roles,name'],
        ]);

        if (array_key_exists('name',$data))  $u->name  = $data['name'];
        if (array_key_exists('email',$data)) $u->email = $data['email'];
        if (array_key_exists('phone',$data)) $u->phone = $data['phone'];
        if (!empty($data['password']))       $u->password = Hash::make($data['password']);
        $u->save();

        if (array_key_exists('roles',$data)) {
            $u->syncRoles($data['roles'] ?? []);       // cập nhật role
        }

        return response()->json($u->load('roles:id,name'));
    }

    public function destroy(Request $req, $id)
    {
        $u = User::findOrFail($id);
        if ($req->user() && (int)$req->user()->id === (int)$u->id) {
            return response()->json(['message'=>'Không thể xoá tài khoản đang đăng nhập'], 422);
        }
        $u->delete();
        return response()->json(['ok'=>true]);
    }
}

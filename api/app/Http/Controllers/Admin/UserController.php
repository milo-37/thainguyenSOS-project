<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(Request $req)
    {
        $q       = trim($req->get('q',''));
        $perPage = max(1, (int)($req->get('per_page', 20)));

        $p = User::query()
            ->with('roles:id,name')
            ->when($q, function($x) use ($q){
                $x->where('name','like',"%$q%")
                    ->orWhere('email','like',"%$q%")
                    ->orWhere('phone','like',"%$q%");
            })
            ->orderByDesc('id')
            ->paginate($perPage);

        $map = $p->getCollection()->map(function(User $u){
            $r = $u->roles->first();
            return [
                'id'        => $u->id,
                'name'      => $u->name,
                'email'     => $u->email,
                'phone'     => $u->phone,
                'role_id'   => $r->id   ?? null,
                'role_name' => $r->name ?? null,
            ];
        });

        return response()->json([
            'data'         => $map,
            'total'        => $p->total(),
            'per_page'     => $p->perPage(),
            'current_page' => $p->currentPage(),
        ]);
    }

    public function store(Request $req)
    {
        $data = $req->validate([
            'name'     => ['required','string','max:255'],
            'email'    => ['required','email','max:255','unique:users,email'],
            'phone'    => ['nullable','string','max:50'],
            'password' => ['required','string','min:6'],
            'role_id'  => ['required','integer', Rule::exists('roles','id')],
        ]);

        $u = User::create($data);

        $role = Role::findById($data['role_id'], 'web');
        $u->syncRoles([$role->name]);

        return response()->json(['id'=>$u->id], 201);
    }

    public function update(Request $req, $id)
    {
        $u = User::findOrFail($id);

        $data = $req->validate([
            'name'     => ['sometimes','required','string','max:255'],
            'email'    => ['sometimes','required','email','max:255', Rule::unique('users','email')->ignore($u->id)],
            'phone'    => ['nullable','string','max:50'],
            'password' => ['nullable','string','min:6'],
            'role_id'  => ['nullable','integer', Rule::exists('roles','id')],
        ]);

        if (empty($data['password'])) unset($data['password']);
        $u->update($data);

        if (isset($data['role_id'])) {

            $role = Role::findById($data['role_id'], 'web');
            $u->syncRoles([$role->name]);
        }

        return response()->json(['ok'=>true]);
    }

    public function destroy($id)
    {
        User::findOrFail($id)->delete();
        return response()->json(['ok'=>true]);
    }
}

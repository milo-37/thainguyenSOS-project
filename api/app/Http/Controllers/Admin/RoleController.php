<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleController extends Controller
{
    public function index()
    {
        return response()->json(Role::orderBy('id')->get(['id','name']));
    }

    public function store(Request $req)
    {
        $data = $req->validate([
            'name' => ['required','string','max:100', Rule::unique('roles','name')],
        ]);
        $r = Role::create(['name' => $data['name'], 'guard_name' => 'web']);


        return response()->json(['id'=>$r->id], 201);
    }

    public function update(Request $req, $id)
    {
        $r = Role::findOrFail($id);
        $data = $req->validate([
            'name' => ['required','string','max:100', Rule::unique('roles','name')->ignore($r->id)],
        ]);
        $r->update(['name'=>$data['name']]);
        return response()->json(['ok'=>true]);
    }

    public function destroy($id)
    {
        Role::findOrFail($id)->delete();
        return response()->json(['ok'=>true]);
    }


    public function syncPermissions(Request $req, $id)
    {
        $role = Role::findOrFail($id);
        $data = $req->validate([
            'permission_ids' => ['array'],
            'permission_ids.*' => [Rule::exists('permissions','id')],
        ]);

        $perms = \Spatie\Permission\Models\Permission::whereIn('id', $data['permission_ids'] ?? [])->pluck('name')->toArray();
        $role->syncPermissions($perms);

        return response()->json(['ok'=>true]);
    }
    public function permissions()
    {
        // chỉ lấy theo guard 'web' cho khớp roles của bạn
        $items = Permission::where('guard_name', 'web')
            ->orderBy('name')
            ->get(['id','name','guard_name']);

        return response()->json(['data' => $items]);
    }

    public function rolePermissions(Role $role)
    {
        // đảm bảo đúng guard
        if ($role->guard_name !== 'web') {
            $role->guard_name = 'web';
        }

        $ids = $role->permissions()->pluck('id')->all();
        return response()->json([
            'role' => $role->only(['id','name','guard_name']),
            'permission_ids' => $ids,
        ]);
    }

    public function syncRolePermissions(Request $request, Role $role)
    {
        $ids = (array) $request->input('permission_ids', []);
        // optional: lọc theo guard để tránh gán nhầm
        $validIds = Permission::whereIn('id', $ids)
            ->where('guard_name', 'web')
            ->pluck('id')
            ->all();

        $role->syncPermissions($validIds);

        return response()->json(['ok' => true, 'count' => count($validIds)]);
    }
}

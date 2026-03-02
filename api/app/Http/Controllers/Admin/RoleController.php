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
        return response()->json(
            Role::where('guard_name', 'web')
                ->orderBy('id')
                ->get(['id','name','guard_name'])
        );
    }

    public function store(Request $req)
    {
        $data = $req->validate([
            'name' => ['required','string','max:100', Rule::unique('roles','name')],
        ]);

        $role = Role::create([
            'name' => $data['name'],
            'guard_name' => 'web',
        ]);

        return response()->json(['id'=>$role->id], 201);
    }

    public function update(Request $req, $id)
    {
        $role = Role::findOrFail($id);

        $data = $req->validate([
            'name' => ['required','string','max:100', Rule::unique('roles','name')->ignore($role->id)],
        ]);

        $role->update(['name'=>$data['name']]);
        return response()->json(['ok'=>true]);
    }

    public function destroy($id)
    {
        $role = Role::findOrFail($id);
        $role->delete();
        return response()->json(['ok'=>true]);
    }

    public function permissions()
    {
        $items = Permission::where('guard_name','web')
            ->orderBy('name')
            ->get(['id','name','guard_name']);

        return response()->json(['data'=>$items]);
    }

    public function rolePermissions(Role $role)
    {
        if ($role->guard_name !== 'web') {
            return response()->json(['message'=>'Role guard không hợp lệ'], 422);
        }

        $ids = $role->permissions()
            ->where('guard_name','web')
            ->pluck('id')
            ->all();

        return response()->json([
            'role' => $role->only(['id','name','guard_name']),
            'permission_ids' => $ids,
        ]);
    }

    public function syncRolePermissions(Request $request, Role $role)
    {
        if ($role->guard_name !== 'web') {
            return response()->json(['message'=>'Role guard không hợp lệ'], 422);
        }

        $data = $request->validate([
            'permission_ids' => ['array'],
            'permission_ids.*' => [Rule::exists('permissions','id')],
        ]);

        $ids = $data['permission_ids'] ?? [];

        $perms = Permission::whereIn('id', $ids)
            ->where('guard_name','web')
            ->get();

        // ✅ đúng: syncPermissions bằng Permission models
        $role->syncPermissions($perms);

        return response()->json(['ok'=>true, 'count'=>$perms->count()]);
    }
}

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function dangNhap(Request $r)
    {
        $cred = $r->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($cred)) {
            return response()->json(['message' => 'Sai tài khoản/mật khẩu'], 422);
        }

        /** @var \App\Models\User $user */
        $user = $r->user();
        $token = $user->createToken('web')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => method_exists($user, 'getRoleNames')
                    ? $user->getRoleNames()->values()
                    : [],
            ],
        ]);
    }

    public function me(Request $request)
{
    /** @var \App\Models\User $user */
    $user = $request->user();

    $membershipCums = method_exists($user, 'cums')
        ? $user->cums()->get(['cum.id', 'cum.ten'])
        : collect();

    $commandCums = method_exists($user, 'chiHuyCums')
        ? $user->chiHuyCums()->get(['id', 'ten'])->map(function ($c) {
            return (object) [
                'id' => $c->id,
                'ten' => $c->ten,
            ];
        })
        : collect();

    $viewable = $membershipCums
        ->map(fn ($c) => [
            'id' => (int) $c->id,
            'ten' => $c->ten,
        ])
        ->merge(
            $commandCums->map(fn ($c) => [
                'id' => (int) $c->id,
                'ten' => $c->ten,
            ])
        )
        ->unique('id')
        ->values();

    $roles = method_exists($user, 'getRoleNames')
        ? $user->getRoleNames()->values()->all()
        : [];

    $permissions = method_exists($user, 'getAllPermissions')
        ? $user->getAllPermissions()->pluck('name')->values()->all()
        : [];

    return response()->json([
        'id' => $user->id,
        'name' => $user->name,
        'email' => $user->email,
        'roles' => $roles,
        'permissions' => $permissions,
        'is_admin' => in_array('Quản trị', $roles),
        'viewable_cums' => $viewable,
    ]);
}
}
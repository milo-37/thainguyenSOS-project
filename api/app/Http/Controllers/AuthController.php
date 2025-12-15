<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function dangNhap(Request $r) {
        $cred = $r->validate(['email'=>'required|email','password'=>'required']);
        if (!Auth::attempt($cred)) return response()->json(['message'=>'Sai tài khoản/mật khẩu'], 422);

        /** @var \App\Models\User $user */
        $user = $r->user();
        $token = $user->createToken('web')->plainTextToken;

        return [
            'token' => $token,
            'user'  => ['id'=>$user->id,'name'=>$user->name,'email'=>$user->email,
                'roles'=>$user->getRoleNames()]
        ];
    }
}

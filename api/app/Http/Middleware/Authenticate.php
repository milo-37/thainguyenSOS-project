<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     */
    protected function redirectTo(Request $request): ?string
    {
        // Nếu là API hoặc yêu cầu JSON => không redirect, chỉ trả 401
        if ($request->expectsJson() || $request->is('api/*')) {
            return null;
        }

        // Nếu bạn có trang login web thì trả về đường dẫn đó
        // Còn nếu đây là ứng dụng API thì cứ để null luôn
        return null;
    }

}

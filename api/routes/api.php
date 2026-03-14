<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\YeuCauController;
use App\Http\Controllers\KhoController;
use App\Http\Controllers\VatTuController;
use App\Http\Controllers\VietMapController;
use App\Http\Controllers\Admin\KhoTonController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\PhanCongController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    $user = $request->user();

    return response()->json([
        'id' => $user->id,
        'name' => $user->name,
        'email' => $user->email,
        'phone' => $user->phone,
        'roles' => $user->getRoleNames()->values(),
    ]);
});

Route::post('/dangnhap', [AuthController::class, 'dangNhap']);

// ==============================
// PUBLIC API
// ==============================
Route::get('/yeucau', [YeuCauController::class, 'index']);
Route::get('/xemyeucau/{id}', [YeuCauController::class, 'chitiet']);
Route::post('/yeucau', [YeuCauController::class, 'tao']);

Route::get('/dsvattu', [KhoController::class, 'dsVatTu']);

// Proxy VietMap
Route::get('/vietmap/geocode', [VietMapController::class, 'geocode']);
Route::get('/vietmap/route', [VietMapController::class, 'route']);

// ==============================
// AUTH API
// ==============================
Route::middleware('auth:sanctum')->group(function () {

    // ==========================
    // YÊU CẦU - ADMIN / DASHBOARD
    // ==========================
    Route::get('/admin/yeucau', [YeuCauController::class, 'indexAdmin']);
    Route::patch('/admin/yeucau/{id}', [YeuCauController::class, 'sua']);

    // Route cũ giữ lại để tương thích nếu nơi khác còn dùng
    Route::post('/admin/yeucau/{id}/giao', [YeuCauController::class, 'giao']);
    Route::post('/admin/yeucau/{id}/trangthai', [YeuCauController::class, 'doiTrangThai']);
    Route::get('/admin/yeucau/{id}/nhatky', [YeuCauController::class, 'nhatKy']);

    // Route chuẩn mới
    Route::get('/yeucau/{id}', [YeuCauController::class, 'show']);
    Route::post('/yeucau/{id}/assign', [PhanCongController::class, 'assign']);
    Route::post('/yeucau/{id}/claim', [YeuCauController::class, 'claim']);
    Route::post('/yeucau/{id}/status', [YeuCauController::class, 'doiTrangThai']);
    Route::get('/yeucau/{id}/history', [YeuCauController::class, 'nhatKy']);

    // Route tương thích frontend hiện tại
    Route::post('/admin/yeucau/{id}/chuyen-xu-ly', [PhanCongController::class, 'assign']);
    Route::post('/admin/yeucau/{id}/cap-nhat-trang-thai', [YeuCauController::class, 'doiTrangThai']);
    Route::get('/admin/yeucau/{id}/lich-su', [YeuCauController::class, 'nhatKy']);
    Route::post('/yeucau/{id}/nhan-xu-ly', [YeuCauController::class, 'claim']);

    // ==========================
    // CỤM
    // ==========================
    Route::get('/cum', [\App\Http\Controllers\CumController::class, 'index']);
    Route::post('/cum', [\App\Http\Controllers\CumController::class, 'store']);
    Route::get('/cum/{id}', [\App\Http\Controllers\CumController::class, 'show']);
    Route::put('/cum/{id}', [\App\Http\Controllers\CumController::class, 'update']);
    Route::delete('/cum/{id}', [\App\Http\Controllers\CumController::class, 'destroy']);

    // ==========================
    // VẬT TƯ
    // ==========================
    Route::get('/vattu', [VatTuController::class, 'index']);
    Route::post('/vattu', [VatTuController::class, 'store']);
    Route::put('/vattu/{id}', [VatTuController::class, 'update']);
    Route::delete('/vattu/{id}', [VatTuController::class, 'destroy']);

    // ==========================
    // THỐNG KÊ
    // ==========================
    Route::get('/thongke', [\App\Http\Controllers\ThongKeController::class, 'index']);

    // ==========================
    // USERS
    // ==========================
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    // ==========================
    // ROLES / PERMISSIONS
    // ==========================
    Route::prefix('admin')->group(function () {
        Route::get('/roles', [RoleController::class, 'index']);
        Route::post('/roles', [RoleController::class, 'store']);
        Route::put('/roles/{id}', [RoleController::class, 'update']);
        Route::delete('/roles/{id}', [RoleController::class, 'destroy']);

        Route::get('/permissions', [RoleController::class, 'permissions']);
        Route::get('/roles/{role}/permissions', [RoleController::class, 'rolePermissions']);
        Route::post('/roles/{role}/permissions', [RoleController::class, 'syncRolePermissions']);
    });

    // ==========================
    // KHO
    // ==========================
    Route::get('/kho', [KhoController::class, 'index']);
    Route::post('/kho', [KhoController::class, 'store']);
    Route::put('/kho/{id}', [KhoController::class, 'update']);
    Route::delete('/kho/{id}', [KhoController::class, 'destroy']);

    Route::post('/kho/nhap', [KhoController::class, 'nhap']);
    Route::post('/kho/xuat', [KhoController::class, 'xuat']);
    Route::post('/kho/chuyen', [KhoController::class, 'chuyen']);

    Route::get('/kho/{kho}/ton', [KhoTonController::class, 'ton']);
    Route::get('/kho/{kho}/lich-su', [KhoTonController::class, 'lichSu']);
});
<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\YeuCauController;
use App\Http\Controllers\KhoController;
use App\Http\Controllers\VatTuController;
use App\Http\Controllers\VietMapController;
use App\Http\Controllers\PhanCongController;
use App\Http\Controllers\Admin\KhoTonController;
use App\Http\Controllers\Admin\YeuCauAdminController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Admin\RoleController as AdminRoleController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// endpoint cũ, có thể giữ để tương thích nơi khác
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
Route::middleware('auth:sanctum')->get('/me', [AuthController::class, 'me']);

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
    Route::get('/admin/yeucau', [YeuCauAdminController::class, 'index']);
    Route::post('/admin/yeucau/{id}/cap-nhat-trang-thai', [YeuCauAdminController::class, 'capNhatTrangThai']);
    Route::post('/admin/yeucau/{id}/chuyen-xu-ly', [YeuCauAdminController::class, 'chuyenXuLy']);
    Route::get('/admin/yeucau/{id}/lich-su', [YeuCauAdminController::class, 'lichSu']);
    Route::post('/admin/yeucau/{id}/claim', [YeuCauAdminController::class, 'claim']);

    // nếu nơi khác trong hệ thống còn dùng route admin cũ thì map về controller mới luôn
    Route::post('/admin/yeucau/{id}/trangthai', [YeuCauAdminController::class, 'capNhatTrangThai']);
    Route::get('/admin/yeucau/{id}/nhatky', [YeuCauAdminController::class, 'lichSu']);

    // nếu bạn chưa dùng PATCH sửa yêu cầu trong dashboard thì có thể bỏ route này
    // Route::patch('/admin/yeucau/{id}', [YeuCauController::class, 'sua']);

    // ==========================
    // YÊU CẦU - AUTH USER FLOW
    // ==========================
    Route::get('/yeucau/{id}', [YeuCauController::class, 'show']);
    Route::post('/yeucau/{id}/assign', [PhanCongController::class, 'assign']);

    // chuyển claim của frontend hiện tại sang controller admin mới để đồng bộ quyền
    Route::post('/yeucau/{id}/claim', [YeuCauAdminController::class, 'claim']);
    Route::post('/yeucau/{id}/nhan-xu-ly', [YeuCauAdminController::class, 'claim']);

    // nếu frontend/user flow khác vẫn cần status/history cũ thì giữ
    Route::post('/yeucau/{id}/status', [YeuCauController::class, 'doiTrangThai']);
    Route::get('/yeucau/{id}/history', [YeuCauController::class, 'nhatKy']);

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
    // ADMIN USERS / ROLES / PERMISSIONS
    // ==========================
    Route::prefix('admin')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);

        Route::get('/users', [AdminUserController::class, 'index']);
        Route::post('/users', [AdminUserController::class, 'store'])->middleware('permission:users.create');
        Route::put('/users/{id}', [AdminUserController::class, 'update'])->middleware('permission:users.update');
        Route::delete('/users/{id}', [AdminUserController::class, 'destroy'])->middleware('permission:users.delete');

        Route::get('/roles', [AdminRoleController::class, 'index'])->middleware('permission:roles.view');
        Route::post('/roles', [AdminRoleController::class, 'store'])->middleware('permission:roles.create');
        Route::put('/roles/{id}', [AdminRoleController::class, 'update'])->middleware('permission:roles.update');
        Route::delete('/roles/{id}', [AdminRoleController::class, 'destroy'])->middleware('permission:roles.delete');

        Route::get('/permissions', [AdminRoleController::class, 'permissions'])->middleware('permission:permissions.view');
        Route::get('/roles/{role}/permissions', [AdminRoleController::class, 'rolePermissions'])->middleware('permission:roles.view');
        Route::post('/roles/{role}/permissions', [AdminRoleController::class, 'syncRolePermissions'])->middleware('permission:roles.assign_permissions');
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

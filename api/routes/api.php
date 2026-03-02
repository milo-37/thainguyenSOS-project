<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\YeuCauController;
use App\Http\Controllers\KhoController;
use App\Http\Controllers\VatTuController;
use App\Http\Controllers\VietMapController;
use App\Http\Controllers\Admin\YeuCauAdminController;
use App\Http\Controllers\Admin\KhoTonController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\RoleController;


/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});
Route::post('/dangnhap', [AuthController::class,'dangNhap']);

// Yêu cầu (public xem + tạo)
//Route::get('/yeucau', [YeuCauController::class,'danhsach']);
Route::get('/yeucau',         [\App\Http\Controllers\YeuCauController::class, 'index']);
Route::get('/xemyeucau/{id}', [YeuCauController::class,'chitiet']);
Route::post('/yeucau', [YeuCauController::class,'tao']); // multipart: tep[]

Route::get('/dsvattu', [KhoController::class,'dsVatTu']);
Route::middleware('auth:sanctum')->group(function () {

    // Yêu cầu (quản trị)
    Route::get('/admin/yeucau', [\App\Http\Controllers\YeuCauController::class, 'indexAdmin']);
    Route::patch('/admin/yeucau/{id}', [YeuCauController::class,'sua']);
    Route::post('/admin/yeucau/{id}/giao', [YeuCauController::class,'giao']);
    Route::post('/admin/yeucau/{id}/trangthai', [YeuCauController::class,'doiTrangThai']);
    Route::get('/admin/yeucau/{id}/nhatky', [YeuCauController::class,'nhatKy']);

    // CỤM
    Route::get('/cum',        [\App\Http\Controllers\CumController::class, 'index']);
    Route::post('/cum',       [\App\Http\Controllers\CumController::class, 'store']);
    Route::get('/cum/{id}',   [\App\Http\Controllers\CumController::class, 'show']);
    Route::put('/cum/{id}',   [\App\Http\Controllers\CumController::class, 'update']);
    Route::delete('/cum/{id}',[\App\Http\Controllers\CumController::class, 'destroy']);

    // YÊU CẦU + PHÂN CÔNG
    Route::get('/yeucau/{id}',    [\App\Http\Controllers\YeuCauController::class, 'show']);
    Route::put('/yeucau/{id}',    [\App\Http\Controllers\YeuCauController::class, 'update']);
    Route::post('/yeucau/{id}/assign', [\App\Http\Controllers\PhanCongController::class, 'assign']);
    Route::post('yeucau/{id}/nhan-xu-ly', [\App\Http\Controllers\Admin\YeuCauAdminController::class, 'claim']);

    // VẬT TƯ
    Route::get('vattu',        [VatTuController::class, 'index']);
    Route::post('vattu',       [VatTuController::class, 'store']);
    Route::put('vattu/{id}',   [VatTuController::class, 'update']);
    Route::delete('vattu/{id}',[VatTuController::class, 'destroy']);


    //Route::post('/admin/yeucau/{id}/cap-nhat-trang-thai', [YeuCauController::class, 'capNhatTrangThai']);
    //Route::post('/admin/yeucau/{id}/chuyen-xu-ly', [YeuCauController::class, 'chuyenXuLy']);

    // THỐNG KÊ
    Route::get('/thongke', [\App\Http\Controllers\ThongKeController::class, 'index']);

    // USERS
    /*Route::get('/users',        [\App\Http\Controllers\UserController::class, 'index']);
    Route::get('/users/{id}',   [\App\Http\Controllers\UserController::class, 'show']);
    Route::post('/users',       [\App\Http\Controllers\UserController::class, 'store']);   // tạo
    Route::put('/users/{id}',   [\App\Http\Controllers\UserController::class, 'update']);  // cập nhật
    Route::delete('/users/{id}',[\App\Http\Controllers\UserController::class, 'destroy']);
*/

    // Users
    Route::get('users',        [UserController::class, 'index']);
    Route::post('users',       [UserController::class, 'store']);
    Route::put('users/{id}',   [UserController::class, 'update']);
    Route::delete('users/{id}',[UserController::class, 'destroy']);

    // Roles & permissions
    /*Route::get('roles',                    [RoleController::class, 'index']);
    Route::post('roles',                   [RoleController::class, 'store']);
    Route::put('roles/{id}',               [RoleController::class, 'update']);
    Route::delete('roles/{id}',            [RoleController::class, 'destroy']);
    Route::get('roles/{id}/permissions',   [RoleController::class, 'permissions']);
    Route::post('roles/{id}/permissions',  [RoleController::class, 'syncPermissions']);
    Route::get('permissions', [RoleController::class, 'permissions']);*/

    Route::prefix('admin')->group(function () {
    // ROLES
    Route::get('/roles', [RoleController::class, 'index']);
    Route::post('/roles', [RoleController::class, 'store']);
    Route::put('/roles/{id}', [RoleController::class, 'update']);
    Route::delete('/roles/{id}', [RoleController::class, 'destroy']);

    // PERMISSIONS
    Route::get('/permissions', [RoleController::class, 'permissions']);

    // ROLE PERMISSIONS (GET + SYNC)
    Route::get('/roles/{role}/permissions', [RoleController::class, 'rolePermissions']);
    Route::post('/roles/{role}/permissions', [RoleController::class, 'syncRolePermissions']);
});

    Route::get('kho', [KhoController::class, 'index']);
    Route::post('kho', [KhoController::class, 'store']);
    Route::put('kho/{id}', [KhoController::class, 'update']);
    Route::delete('kho/{id}', [KhoController::class, 'destroy']);
    Route::post('kho/nhap', [KhoController::class, 'nhap']);
    Route::post('kho/xuat', [KhoController::class, 'xuat']);
    Route::post('kho/chuyen', [KhoController::class, 'chuyen']);
    Route::get('kho/{kho}/ton',      [KhoTonController::class, 'ton']);
    Route::get('kho/{kho}/lich-su',  [KhoTonController::class, 'lichSu']);

});


Route::prefix('admin')->middleware('auth:sanctum')->group(function () {
    // Lịch sử xử lý
    Route::get('yeucau/{id}/lich-su', [YeuCauAdminController::class, 'lichSu']);

    // Cập nhật trạng thái
    Route::post('yeucau/{id}/cap-nhat-trang-thai', [YeuCauAdminController::class, 'capNhatTrangThai']);

    // Chuyển xử lý (chuyển cho cụm hoặc người dùng)
    Route::post('yeucau/{id}/chuyen-xu-ly', [YeuCauAdminController::class, 'chuyenXuLy']);

});

// Proxy VietMap (giấu key)
Route::get('/vietmap/geocode', [VietMapController::class,'geocode']);
Route::get('/vietmap/route',   [VietMapController::class,'route']);

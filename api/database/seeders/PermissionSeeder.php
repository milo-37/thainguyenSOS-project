<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $perms = [
            // Dashboard/Map
            'dashboard.view',
            'map.view',

            // Users
            'users.view',
            'users.create',
            'users.update',
            'users.delete',
            'users.manage_roles',

            // Roles & Permissions
            'roles.view',
            'roles.create',
            'roles.update',
            'roles.delete',
            'roles.assign_permissions',
            'permissions.view',

            // Cụm (cum)
            'cum.view',
            'cum.create',
            'cum.update',
            'cum.delete',
            'cum.members.manage',

            // Yêu cầu cứu hộ (yeucau)
            'yeucau.view',
            'yeucau.create',
            'yeucau.update',
            'yeucau.delete',
            'yeucau.phancong',            // phân công
            'yeucau.chuyen_xu_ly',        // chuyển xử lý (giao cho cụm/người)
            'yeucau.cap_nhat_trang_thai', // cập nhật trạng thái nhanh + ghi chú
            'yeucau.history.view',        // xem lịch sử
            'yeucau.media.view',          // xem media

            // Kho
            'kho.view',
            'kho.create',
            'kho.update',
            'kho.delete',
            'kho.ton.view',
            'kho.lich_su.view',
            'kho.nhap',
            'kho.xuat',
            'kho.chuyen',

            // Vật tư
            'vattu.view',
            'vattu.create',
            'vattu.update',
            'vattu.delete',
            'vattu.thongke.view',

            // Thống kê
            'thongke.view',
        ];

        foreach ($perms as $name) {
            Permission::firstOrCreate(
                ['name' => $name, 'guard_name' => 'web'],
                []
            );
        }
    }
}

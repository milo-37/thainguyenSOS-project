<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use Spatie\Permission\Models\Role;

class KhoiTaoSeeder extends Seeder
{
    public function run(): void
    {

        $admin      = Role::firstOrCreate(['name' => 'admin',      'guard_name' => 'web']);
        $dieu_hanh  = Role::firstOrCreate(['name' => 'dieu_hanh',  'guard_name' => 'web']);
        $thanh_vien = Role::firstOrCreate(['name' => 'thanh_vien', 'guard_name' => 'web']);

    }
}

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Chuẩn hóa dữ liệu cũ trước khi đặt unique
        DB::table('vattu')
            ->whereNull('ma')
            ->update(['ma' => '']);

        // Nếu bạn muốn bắt buộc ma phải có giá trị:
        // cần đảm bảo tất cả bản ghi cũ đều đã có ma hợp lệ trước khi change()

        Schema::table('vattu', function (Blueprint $table) {
            // Nếu DB hỗ trợ doctrine/dbal thì mới dùng change()
            // composer require doctrine/dbal

            // $table->string('ma', 50)->nullable(false)->change();
            $table->unique('ten', 'vattu_ten_unique');
        });
    }

    public function down(): void
    {
        Schema::table('vattu', function (Blueprint $table) {
            $table->dropUnique('vattu_ten_unique');
        });
    }
};
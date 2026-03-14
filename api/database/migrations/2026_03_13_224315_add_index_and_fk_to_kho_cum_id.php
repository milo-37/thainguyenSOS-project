<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('kho') && Schema::hasColumn('kho', 'cum_id')) {
            Schema::table('kho', function (Blueprint $table) {
                try {
                    $table->index('cum_id', 'kho_cum_id_index');
                } catch (\Throwable $e) {
                    // index đã tồn tại thì bỏ qua
                }
            });

            try {
                DB::statement("
                    ALTER TABLE kho
                    ADD CONSTRAINT kho_cum_id_foreign
                    FOREIGN KEY (cum_id) REFERENCES cum(id)
                    ON DELETE SET NULL
                ");
            } catch (\Throwable $e) {
                // FK đã tồn tại hoặc dữ liệu cũ không phù hợp thì bỏ qua
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('kho')) {
            try {
                DB::statement("ALTER TABLE kho DROP FOREIGN KEY kho_cum_id_foreign");
            } catch (\Throwable $e) {
            }

            try {
                Schema::table('kho', function (Blueprint $table) {
                    $table->dropIndex('kho_cum_id_index');
                });
            } catch (\Throwable $e) {
            }
        }
    }
};
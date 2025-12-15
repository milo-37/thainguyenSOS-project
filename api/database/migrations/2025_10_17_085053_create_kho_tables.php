<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ========== BẢNG KHO ==========
        if (!Schema::hasTable('kho')) {
            Schema::create('kho', function (Blueprint $table) {
                $table->id();
                $table->string('ten');
                $table->text('mo_ta')->nullable();
                $table->unsignedBigInteger('cum_id')->nullable();
                $table->timestamps();
            });
        } else {
            // Bảng đã có sẵn (như ảnh bạn chụp). Bổ sung các cột còn thiếu.
            Schema::table('kho', function (Blueprint $table) {
                if (!Schema::hasColumn('kho', 'mo_ta')) {
                    $table->text('mo_ta')->nullable()->after('ten');
                }
                if (!Schema::hasColumn('kho', 'cum_id')) {
                    $table->unsignedBigInteger('cum_id')->nullable()->after('mo_ta');
                }
                // (Không đụng tới 'dia_chi' và 'ghichu' cũ của bạn — vẫn giữ nguyên)
            });
        }

        // ========== BẢNG KHO_TON ==========
        if (!Schema::hasTable('kho_ton')) {
            Schema::create('kho_ton', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('kho_id');
                $table->unsignedBigInteger('vat_tu_id');
                $table->decimal('so_luong', 18, 2)->default(0);
                $table->timestamps();
                $table->index(['kho_id','vat_tu_id']);
            });
        }

        // ========== BẢNG PHIEU_NX ==========
        if (!Schema::hasTable('phieu_nx')) {
            Schema::create('phieu_nx', function (Blueprint $table) {
                $table->id();
                $table->enum('loai', ['nhap','xuat','chuyen']);
                $table->unsignedBigInteger('kho_from_id')->nullable();
                $table->unsignedBigInteger('kho_to_id')->nullable();
                $table->unsignedBigInteger('nguoi_tao_id')->nullable();
                $table->text('ghi_chu')->nullable();
                $table->timestamps();
                $table->index(['loai','kho_from_id','kho_to_id']);
            });
        }

        // ========== BẢNG PHIEU_NX_CT ==========
        if (!Schema::hasTable('phieu_nx_ct')) {
            Schema::create('phieu_nx_ct', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('phieu_id');
                $table->unsignedBigInteger('vat_tu_id');
                $table->decimal('so_luong', 18, 2);
                $table->string('don_vi')->nullable();
                $table->timestamps();
                $table->index(['phieu_id','vat_tu_id']);
            });
        }
    }

    public function down(): void
    {
        // Down phải an toàn: không drop bảng kho sẵn có của bạn.
        // Chỉ drop các bảng phụ nếu chúng do migration này tạo ra.
        if (Schema::hasTable('phieu_nx_ct')) Schema::drop('phieu_nx_ct');
        if (Schema::hasTable('phieu_nx')) Schema::drop('phieu_nx');
        if (Schema::hasTable('kho_ton')) Schema::drop('kho_ton');

        // KHÔNG drop 'kho' vì là dữ liệu sẵn có ở hệ thống bạn.
        // Nếu muốn rollback hoàn toàn, tự xử lý thủ công khi chắc chắn.
    }
};

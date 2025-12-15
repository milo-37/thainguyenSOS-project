<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        /**
         * BẢN ĐỒ/YÊU CẦU CỨU TRỢ
         * - yeu_cau: yêu cầu cứu người/nhu yếu phẩm
         * - yeu_cau_vattu: các vật tư cần cho mỗi yêu cầu
         * - yeu_cau_nhatky: lịch sử thao tác/trạng thái/giao việc
         * - tep_dinhkem: ảnh/video đính kèm yêu cầu
         */

        Schema::create('yeu_cau', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->enum('loai', ['cuu_nguoi', 'nhu_yeu_pham']); // loại yêu cầu
            $t->string('tieu_de')->nullable();
            $t->text('noidung')->nullable();

            // thông tin người gửi (sẽ ẩn với public)
            $t->string('ten_nguoigui')->nullable();
            $t->string('sdt_nguoigui', 20)->nullable();

            // vị trí (tạm dùng DOUBLE; khi lên prod có thể chuyển PostGIS)
            $t->double('lat')->nullable();
            $t->double('lng')->nullable();

            $t->integer('so_nguoi')->default(0);

            // trạng thái xử lý
            $t->enum('trang_thai', ['tiep_nhan','dang_xuly','hoan_thanh','huy'])->default('tiep_nhan');

            // phân công người phụ trách (tham chiếu users.id – để nullable)
            $t->unsignedBigInteger('duoc_giao_cho')->nullable();
            $t->foreign('duoc_giao_cho')->references('id')->on('users')->nullOnDelete();

            // người tạo (nếu có tài khoản đăng nhập khi tạo)
            $t->unsignedBigInteger('tao_boi')->nullable();
            $t->foreign('tao_boi')->references('id')->on('users')->nullOnDelete();

            $t->timestamps();

            // chỉ mục cơ bản
            $t->index(['loai','trang_thai']);
            $t->index(['lat','lng']);
        });

        Schema::create('yeu_cau_vattu', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('yeu_cau_id');
            $t->string('ten_vattu');               // tên vật tư cần (free text)
            $t->decimal('so_luong', 12, 2)->default(0);
            $t->string('donvi')->default('donvi');

            $t->foreign('yeu_cau_id')->references('id')->on('yeu_cau')->cascadeOnDelete();
            $t->index('yeu_cau_id');
        });

        Schema::create('yeu_cau_nhatky', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('yeu_cau_id');
            $t->unsignedBigInteger('thuc_hien_boi')->nullable(); // users.id

            // hành động: created, sua, gan_nguoi, doi_trang_thai, chuyen_nguoi, attach, note
            $t->string('hanh_dong');
            $t->string('tu_trangthai')->nullable();
            $t->string('den_trangthai')->nullable();
            $t->unsignedBigInteger('tu_nguoi')->nullable();      // users.id
            $t->unsignedBigInteger('den_nguoi')->nullable();     // users.id
            $t->text('ghichu')->nullable();
            $t->timestamp('tao_luc')->useCurrent();

            $t->foreign('yeu_cau_id')->references('id')->on('yeu_cau')->cascadeOnDelete();
            $t->foreign('thuc_hien_boi')->references('id')->on('users')->nullOnDelete();
            $t->foreign('tu_nguoi')->references('id')->on('users')->nullOnDelete();
            $t->foreign('den_nguoi')->references('id')->on('users')->nullOnDelete();

            $t->index('yeu_cau_id');
        });

        Schema::create('tep_dinhkem', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('doi_tuong');                 // 'yeu_cau' (có thể mở rộng)
            $t->unsignedBigInteger('doi_tuong_id');  // id của yêu cầu
            $t->string('duong_dan');                 // storage path hoặc URL
            $t->string('mime')->nullable();
            $t->bigInteger('kich_thuoc')->nullable();
            $t->unsignedBigInteger('tai_len_boi')->nullable(); // users.id
            $t->timestamps();

            $t->index(['doi_tuong','doi_tuong_id']);
            $t->foreign('tai_len_boi')->references('id')->on('users')->nullOnDelete();
        });

        /**
         * KHO NHIỀU CHI NHÁNH
         * - kho: danh sách kho
         * - vattu: danh mục vật tư
         * - kho_ton: tồn theo từng kho – từng vật tư
         * - kho_giaodich: phiếu nhập/xuất/chuyển (header)
         * - kho_dong: các dòng vật tư trong một phiếu (detail)
         */

        Schema::create('kho', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('ten');
            $t->string('dia_chi')->nullable();
            $t->text('ghichu')->nullable();
            $t->timestamps();
            $t->unique('ten'); // tên kho duy nhất (tuỳ bạn)
        });

        Schema::create('vattu', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('ten');
            $t->string('donvi')->default('donvi');
            $t->string('ma')->nullable(); // sku/mã
            $t->text('ghichu')->nullable();
            $t->timestamps();
            $t->unique('ma'); // nếu có sử dụng mã
        });

        // tồn theo kho
        Schema::create('kho_ton', function (Blueprint $t) {
            $t->unsignedBigInteger('kho_id');
            $t->unsignedBigInteger('vattu_id');
            $t->decimal('so_luong', 12, 2)->default(0);

            $t->primary(['kho_id','vattu_id']);
            $t->foreign('kho_id')->references('id')->on('kho')->cascadeOnDelete();
            $t->foreign('vattu_id')->references('id')->on('vattu')->cascadeOnDelete();
        });

        // phiếu nhập/xuất/chuyển
        Schema::create('kho_giaodich', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->enum('loai', ['nhap','xuat','chuyen']);
            $t->unsignedBigInteger('kho_id')->nullable();      // kho nguồn (nhập/xuất dùng trường này)
            $t->unsignedBigInteger('kho_den_id')->nullable();  // kho đích khi 'chuyen'
            $t->unsignedBigInteger('tao_boi')->nullable();     // users.id
            $t->timestamp('tao_luc')->useCurrent();
            $t->text('ghichu')->nullable();

            $t->foreign('kho_id')->references('id')->on('kho')->nullOnDelete();
            $t->foreign('kho_den_id')->references('id')->on('kho')->nullOnDelete();
            $t->foreign('tao_boi')->references('id')->on('users')->nullOnDelete();

            $t->index(['loai','kho_id','kho_den_id']);
        });

        Schema::create('kho_dong', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('giaodich_id');
            $t->unsignedBigInteger('vattu_id');
            $t->decimal('so_luong', 12, 2);

            $t->foreign('giaodich_id')->references('id')->on('kho_giaodich')->cascadeOnDelete();
            $t->foreign('vattu_id')->references('id')->on('vattu')->cascadeOnDelete();

            $t->index('giaodich_id');
        });

        /**
         * (Tùy chọn) ĐỘI CỨU HỘ HIỂN THỊ TRÊN BẢN ĐỒ
         * Nếu bạn muốn quản lý đội và thành viên (tham chiếu users)
         */
        Schema::create('doi_cuuho', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('ten');
            $t->text('ghichu')->nullable();
            $t->timestamps();
        });

        Schema::create('doi_thanhvien', function (Blueprint $t) {
            $t->unsignedBigInteger('doi_id');
            $t->unsignedBigInteger('user_id'); // users.id
            $t->string('vai_tro')->nullable();

            $t->primary(['doi_id','user_id']);
            $t->foreign('doi_id')->references('id')->on('doi_cuuho')->cascadeOnDelete();
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('doi_thanhvien');
        Schema::dropIfExists('doi_cuuho');
        Schema::dropIfExists('kho_dong');
        Schema::dropIfExists('kho_giaodich');
        Schema::dropIfExists('kho_ton');
        Schema::dropIfExists('vattu');
        Schema::dropIfExists('tep_dinhkem');
        Schema::dropIfExists('yeu_cau_nhatky');
        Schema::dropIfExists('yeu_cau_vattu');
        Schema::dropIfExists('yeu_cau');
    }
};

<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;


return new class extends Migration {
    public function up(): void {
        Schema::create('yeu_cau_phan_cong', function (Blueprint $t) {
            $t->id();
            $t->foreignId('yeu_cau_id')->constrained('yeu_cau')->cascadeOnDelete();
            $t->foreignId('cum_id')->nullable()->constrained('cum')->nullOnDelete();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('assigned_by')->constrained('users');
            $t->timestamp('assigned_at');
            $t->timestamps();
        });
    }


    public function down(): void {
        Schema::dropIfExists('yeu_cau_phan_cong');
    }
};

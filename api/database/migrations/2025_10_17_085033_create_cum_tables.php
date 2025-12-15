<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;


return new class extends Migration {
    public function up(): void {
        Schema::create('cum', function (Blueprint $t) {
            $t->id();
            $t->string('ten');
            $t->text('mo_ta')->nullable();
            $t->foreignId('chi_huy_id')->nullable()->constrained('users')->nullOnDelete();
            $t->decimal('lat', 10, 7)->nullable();
            $t->decimal('lng', 10, 7)->nullable();
            $t->string('dia_chi_text')->nullable();
            $t->timestamps();
        });


        Schema::create('cum_thanh_vien', function (Blueprint $t) {
            $t->id();
            $t->foreignId('cum_id')->constrained('cum')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->timestamps();
            $t->unique(['cum_id','user_id']);
        });
    }


    public function down(): void {
        Schema::dropIfExists('cum_thanh_vien');
        Schema::dropIfExists('cum');
    }
};

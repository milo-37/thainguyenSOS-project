<?php
// database/migrations/2025_10_17_000001_add_phone_role_to_users.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('users', function (Blueprint $t) {
            if (!Schema::hasColumn('users','phone')) $t->string('phone', 50)->nullable()->after('email');
            if (!Schema::hasColumn('users','role'))  $t->string('role', 20)->default('member')->after('phone');
        });
    }
    public function down(): void {
        Schema::table('users', function (Blueprint $t) {
            if (Schema::hasColumn('users','role'))  $t->dropColumn('role');
            if (Schema::hasColumn('users','phone')) $t->dropColumn('phone');
        });
    }
};

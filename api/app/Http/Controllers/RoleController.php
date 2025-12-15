<?php
// app/Http/Controllers/RoleController.php
namespace App\Http\Controllers;

use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function index() {
        return response()->json(Role::orderBy('id')->get(['id','name','guard_name']));
    }
}

<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable, HasRoles;

    protected string $guard_name = 'web';

    protected $fillable = ['name', 'email', 'phone', 'password'];
    protected $hidden = ['password', 'remember_token'];
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    public function cums()
    {
        return $this->belongsToMany(\App\Models\Cum::class, 'cum_thanh_vien', 'user_id', 'cum_id')->withTimestamps();
    }

    public function chiHuyCums()
    {
        return $this->hasMany(\App\Models\Cum::class, 'chi_huy_id');
    }
}
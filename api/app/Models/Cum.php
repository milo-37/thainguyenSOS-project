<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;


class Cum extends Model
{
    use HasFactory;
    protected $table = 'cum';
    protected $fillable = ['ten','mo_ta','chi_huy_id','lat','lng','dia_chi_text'];


    public function chiHuy() { return $this->belongsTo(User::class, 'chi_huy_id'); }
    public function thanhViens() { return $this->belongsToMany(User::class, 'cum_thanh_vien', 'cum_id','user_id')->withTimestamps(); }
    public function kho() { return $this->hasOne(Kho::class, 'cum_id'); }
}

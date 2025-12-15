<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class PhieuNX extends Model
{
    protected $table = 'phieu_nx';
    protected $fillable = ['loai','kho_from_id','kho_to_id','nguoi_tao_id','ghi_chu'];
    public function chiTiet(){ return $this->hasMany(PhieuNXCT::class,'phieu_id'); }
    public function khoFrom(){ return $this->belongsTo(Kho::class,'kho_from_id'); }
    public function khoTo(){ return $this->belongsTo(Kho::class,'kho_to_id'); }
    public function nguoiTao(){ return $this->belongsTo(User::class,'nguoi_tao_id'); }
}

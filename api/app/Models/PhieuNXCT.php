<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class PhieuNXCT extends Model
{
    protected $table = 'phieu_nx_ct';
    protected $fillable = ['phieu_id','vat_tu_id','so_luong','don_vi'];
    public function phieu(){ return $this->belongsTo(PhieuNX::class,'phieu_id'); }
    public function vatTu(){ return $this->belongsTo(VatTu::class,'vat_tu_id'); }
}

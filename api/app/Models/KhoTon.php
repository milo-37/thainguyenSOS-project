<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class KhoTon extends Model
{
    protected $table = 'kho_ton';
    protected $fillable = ['kho_id', 'vattu_id', 'so_luong'];
    public $timestamps = false;
    public function kho(){ return $this->belongsTo(Kho::class,'kho_id'); }
    public function vatTu(){ return $this->belongsTo(VatTu::class,'vattu_id'); }
}

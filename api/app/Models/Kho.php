<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class Kho extends Model
{
    protected $table = 'kho';
    protected $fillable = ['ten','mo_ta','cum_id','dia_chi','ghichu'];
    public function cum(){ return $this->belongsTo(Cum::class,'cum_id'); }
    public function tons(){ return $this->hasMany(KhoTon::class,'kho_id'); }
}

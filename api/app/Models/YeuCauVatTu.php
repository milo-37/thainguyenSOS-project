<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class YeuCauVatTu extends Model
{
    protected $table = 'yeu_cau_vattu';
    protected $guarded = [];
    protected $fillable = [
        'yeu_cau_id', 'vattu_id', 'so_luong', 'ten_vattu', 'donvi'];
    public $timestamps = false;

    public function yeuCau()
    {
        return $this->belongsTo(YeuCau::class, 'yeu_cau_id');
    }
    public function vattu()
    {
        return $this->belongsTo(VatTu::class, 'vattu_id');
    }
}

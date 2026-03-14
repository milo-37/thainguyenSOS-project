<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class YeuCauPhanCong extends Model
{
    protected $table = 'yeu_cau_phan_cong';

    protected $fillable = [
        'yeu_cau_id',
        'cum_id',
        'user_id',
        'assigned_by',
        'assigned_at'
    ];

    public $timestamps = true;

    public function yeuCau()
    {
        return $this->belongsTo(YeuCau::class, 'yeu_cau_id');
    }

    public function cum()
    {
        return $this->belongsTo(Cum::class, 'cum_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function nguoiGiao()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
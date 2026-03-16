<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class YeuCauNhatKy extends Model
{
    protected $table = 'yeu_cau_nhatky';
    public $timestamps = false;

    protected $fillable = [
        'yeu_cau_id',
        'thuc_hien_boi',
        'hanh_dong',
        'tu_trangthai',
        'den_trangthai',
        'tu_nguoi',
        'den_nguoi',
        'ghichu',
        'tao_luc',
    ];

    protected $casts = [
        'tao_luc' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'thuc_hien_boi');
    }

    public function yeuCau()
    {
        return $this->belongsTo(YeuCau::class, 'yeu_cau_id');
    }

    public function tuNguoi()
    {
        return $this->belongsTo(User::class, 'tu_nguoi');
    }

    public function denNguoi()
    {
        return $this->belongsTo(User::class, 'den_nguoi');
    }
}
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class YeuCau extends Model
{
    protected $table = 'yeu_cau';
    protected $fillable = [
        'loai','noidung','ten_nguoigui','sdt_nguoigui','lat','lng','so_nguoi','trang_thai'
    ];

    public function media()
    {
        return $this->hasMany(TepDinhKem::class, 'doi_tuong_id')
            ->where('doi_tuong', 'yeu_cau');
    }
    public function vattuChiTiet()
    {
        return $this->hasMany(YeuCauVatTu::class, 'yeu_cau_id', 'id')
            ->select(['id', 'yeu_cau_id', 'vattu_id', 'so_luong', 'donvi']); // <-- đúng
    }
    /*public function nhatKy()
    {
        return $this->hasMany(YeuCauNhatKy::class, 'yeu_cau_id');
    }
    */
    public function nhatKy()
    {
        return $this->hasMany(\App\Models\YeuCauNhatKy::class, 'yeu_cau_id')->orderByDesc('tao_luc');
    }
    public function phanCong()
    {
        return $this->hasMany(\App\Models\YeuCauPhanCong::class, 'yeu_cau_id');
    }
    public function vattus()
    {
        return $this->belongsToMany(VatTu::class, 'yeu_cau_vattu', 'yeu_cau_id', 'vattu_id')
            ->withPivot(['so_luong','donvi']);
    }
    public function phanCongs()
    {
        return $this->hasMany(YeuCauPhanCong::class, 'yeu_cau_id', 'id');
    }
}

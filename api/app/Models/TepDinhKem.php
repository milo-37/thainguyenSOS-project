<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TepDinhKem extends Model
{
    protected $table = 'tep_dinhkem';
    protected $fillable = ['doi_tuong', 'doi_tuong_id', 'duong_dan', 'mime', 'kich_thuoc'];
    protected $guarded = [];

    // đường dẫn truy cập (tự build URL đầy đủ)
    protected $appends = ['url'];

    public function getUrlAttribute()
    {
        // chỉ lưu tương đối => ghép URL đầy đủ khi trả JSON
        $path = $this->duong_dan;
        if (str_starts_with($path, 'http')) return $path; // cũ, giữ nguyên
        return url($path);
    }
}

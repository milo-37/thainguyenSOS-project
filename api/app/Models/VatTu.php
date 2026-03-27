<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VatTu extends Model
{
    protected $table = 'vattu';

    protected $fillable = [
        'ten',
        'donvi',
        'ma',
        'ghichu',
    ];

    protected $casts = [
        'id' => 'integer',
    ];

    public function setTenAttribute($value): void
    {
        $value = trim((string)$value);
        $value = preg_replace('/\s+/', ' ', $value);
        $this->attributes['ten'] = $value;
    }

    public function setMaAttribute($value): void
    {
        $value = trim((string)$value);
        $value = strtolower($value);
        $value = preg_replace('/\s+/', '', $value);
        $this->attributes['ma'] = $value;
    }

    public function setDonviAttribute($value): void
    {
        $value = trim((string)$value);
        $value = preg_replace('/\s+/', ' ', $value);
        $this->attributes['donvi'] = $value;
    }

    public function setGhichuAttribute($value): void
    {
        $this->attributes['ghichu'] = $value !== null ? trim((string)$value) : null;
    }
}
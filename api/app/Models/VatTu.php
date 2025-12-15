<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VatTu extends Model
{
    protected $table = 'vattu';
    protected $fillable = ['ten','donvi','ma','ghichu'];
}

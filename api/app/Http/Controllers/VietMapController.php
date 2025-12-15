<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class VietMapController extends Controller
{
    public function geocode(Request $r) {
        $key = env('VIETMAP_API_KEY');
        $text = $r->query('text');
        return Http::get('https://maps.vietmap.vn/api/search', ['apikey'=>$key,'text'=>$text])->json();
    }
    public function route(Request $r) {
        $key = env('VIETMAP_API_KEY');
        $from = $r->query('from'); // "lat,lng"
        $to   = $r->query('to');
        return Http::get('https://maps.vietmap.vn/api/route', ['apikey'=>$key,'point'=>[$from,$to]])->json();
    }
}

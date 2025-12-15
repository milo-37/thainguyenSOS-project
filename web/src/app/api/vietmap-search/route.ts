export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const text = (searchParams.get('text') || '').trim();
    if (!text) return Response.json([]);

    const key = process.env.VIETMAP_APIKEY!;
    const base = 'https://maps.vietmap.vn/api';

    async function hit(url: string) {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) return null;
        return r.json();
    }

    // Ưu tiên autocomplete → search → geocode
    let data =
        (await hit(`${base}/autocomplete/v3?text=${encodeURIComponent(text)}&size=8&apikey=${key}`)) ||
        (await hit(`${base}/search/v3?text=${encodeURIComponent(text)}&size=8&apikey=${key}`)) ||
        (await hit(`${base}/geocode/v3?text=${encodeURIComponent(text)}&size=8&apikey=${key}`));

    const items = (data?.data ?? []).map((i: any) => ({
        id: i.place_id || i.ref_id || i.osm_id || i.name || `${i.lat},${i.lng}`,
        name: i.name || i.display || i.address || text,
        address: i.address || i.display || '',
        lat: Number(i.lat),
        lng: Number(i.lng),
    }));

    return Response.json(items);
}

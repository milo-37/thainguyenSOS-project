// GET /api/vietmap-proxy?u=<FULL URL to maps.vietmap.vn WITHOUT apikey>
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("u");
    if (!raw) return new Response("Missing u", { status: 400 });

    const url = new URL(raw);
    if (url.hostname !== "maps.vietmap.vn") return new Response("Forbidden", { status: 403 });

    // gắn apikey ở server (client không bao giờ thấy)
    const key = process.env.VIETMAP_APIKEY!;
    url.searchParams.delete("apikey");
    url.searchParams.set("apikey", key);

    const up = await fetch(url.toString(), {
        cache: "no-store",
        headers: { Accept: "application/json,application/x-protobuf,image/png,*/*" },
    });

    return new Response(up.body, {
        status: up.status,
        headers: {
            "content-type": up.headers.get("content-type") || "application/octet-stream",
            "cache-control": "no-store",
        },
    });
}

"use client";
import * as React from "react";

declare global { interface Window { vietmapgl: any; } }

type Props = {
    value?: { lat: number; lng: number } | null;
    onChange: (pos: { lat: number; lng: number }) => void;
    className?: string;
    height?: number;
    zoom?: number;
};

export default function VietmapPicker({
                                          value, onChange, className, height = 420, zoom = 12,
                                      }: Props) {
    const ref = React.useRef<HTMLDivElement>(null);
    const mapRef = React.useRef<any>(null);
    const markerRef = React.useRef<any>(null);

    React.useEffect(() => {
        if (!window.vietmapgl) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://maps.vietmap.vn/sdk/vietmap-gl.css";
            document.head.appendChild(link);

            const script = document.createElement("script");
            script.src = "https://maps.vietmap.vn/sdk/vietmap-gl.js";
            script.async = true;
            document.body.appendChild(script);
        }
    }, []);

    React.useEffect(() => {
        if (!ref.current || mapRef.current || !window.vietmapgl) return;

        const vmgl = window.vietmapgl;
        vmgl.accessToken = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;
        const defaultCenter = value ? [value.lng, value.lat] : [105.8342, 21.0278]; // Hà Nội

        const map = new vmgl.Map({
            container: ref.current!,
            style: "https://maps.vietmap.vn/mt/tm/style.json",
            center: defaultCenter,
            zoom,
        });
        mapRef.current = map;

        // geolocate nếu chưa có value
        if (!value && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const ll = [pos.coords.longitude, pos.coords.latitude];
                map.flyTo({ center: ll, zoom: 13 });
                if (markerRef.current) markerRef.current.setLngLat(ll);
            });
        }

        const m = new vmgl.Marker({ draggable: true }).setLngLat(defaultCenter).addTo(map);
        markerRef.current = m;

        m.on("dragend", () => {
            const ll = m.getLngLat();
            onChange({ lat: ll.lat, lng: ll.lng });
        });

        map.on("click", (e: any) => {
            const ll = e.lngLat;
            m.setLngLat(ll);
            onChange({ lat: ll.lat, lng: ll.lng });
        });
    }, [value, zoom, onChange]);

    React.useEffect(() => {
        if (!markerRef.current || !value) return;
        markerRef.current.setLngLat([value.lng, value.lat]);
        if (mapRef.current) mapRef.current.flyTo({ center: [value.lng, value.lat], zoom: Math.max(zoom, 12) });
    }, [value, zoom]);

    return (
        <div className={className}>
            <div ref={ref} style={{ height }} className="w-full rounded-lg overflow-hidden border" />
            <div className="text-xs text-muted-foreground mt-2">
                Nhấp để đặt ghim; kéo ghim để tinh chỉnh vị trí cụm.
            </div>
        </div>
    );
}

'use client';
import { useEffect, useRef } from 'react';
import { loadVietMapGL } from "@/lib/loadVietmap";


type LatLng = { lat: number; lng: number };

export default function MapPicker({
                                      styleUrl,
                                      value,
                                      onChange,
                                      userZoom = 14,
                                      defaultCenter = [105.85, 21.03] as [number, number],
                                      defaultZoom = 5,
                                      heightClass = 'h-[50vh]',
                                  }: {
    styleUrl: string;
    value?: LatLng | null;
    onChange?: (p: LatLng) => void;
    userZoom?: number;
    defaultCenter?: [number, number];
    defaultZoom?: number;
    heightClass?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);

    // init map CHỈ 1 LẦN
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const vietmapgl: any = await loadVietMapGL();
            if (cancelled || !ref.current || mapRef.current) return;

            const map = new vietmapgl.Map({
                container: ref.current!,
                style: styleUrl,
                center: value ? [value.lng, value.lat] : defaultCenter,
                zoom: value ? userZoom : defaultZoom,
                fadeDuration: 0,
                renderWorldCopies: false,
            });
            mapRef.current = map;

            map.addControl(new vietmapgl.NavigationControl(), 'bottom-right');
            const geo = new vietmapgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false });
            map.addControl(geo, 'bottom-right');

            map.on('load', () => {
                const start = value ? [value.lng, value.lat] : map.getCenter();
                const marker = new vietmapgl.Marker({ draggable: true }).setLngLat(start).addTo(map);
                markerRef.current = marker;

                const emit = (lng: number, lat: number) => onChange?.({ lat, lng });

                marker.on('dragend', () => {
                    const ll = marker.getLngLat();
                    emit(ll.lng, ll.lat);
                });

                map.on('click', (e: any) => {
                    marker.setLngLat(e.lngLat);
                    emit(e.lngLat.lng, e.lngLat.lat);
                });

                if (!value) {
                    const apply = (lng: number, lat: number) => {
                        map.easeTo({ center: [lng, lat], zoom: userZoom });
                        marker.setLngLat([lng, lat]);
                        emit(lng, lat);
                    };
                    geo.once('geolocate', (e: any) => apply(e.coords.longitude, e.coords.latitude));
                    try { (geo as any).trigger?.(); } catch {}
                }

                const ro = new ResizeObserver(() => { try { map.resize(); } catch {} });
                ref.current && ro.observe(ref.current);
                const onWinResize = () => { try { map.resize(); } catch {} };
                window.addEventListener('resize', onWinResize);
                map.once('remove', () => { ro.disconnect(); window.removeEventListener('resize', onWinResize); });
            });
        })();
        return () => { cancelled = true; };
    }, [styleUrl, userZoom, defaultZoom, defaultCenter]); // KHÔNG phụ thuộc value

    // đồng bộ marker/camera khi value đổi (không re-init)
    useEffect(() => {
        const map = mapRef.current, mk = markerRef.current;
        if (!map || !mk || !value) return;
        const ll: [number, number] = [value.lng, value.lat];
        mk.setLngLat(ll);
        const c = map.getCenter();
        const dist = Math.hypot(c.lng - ll[0], c.lat - ll[1]);
        if (dist > 0.0005) map.easeTo({ center: ll, zoom: Math.max(map.getZoom(), 14) });
    }, [value?.lat, value?.lng]);

    return <div ref={ref} className={`${heightClass} w-full rounded-2xl border overflow-hidden bg-gray-100`} />;
}

"use client";
import * as React from "react";

declare global {
  interface Window {
    vietmapgl: any;
    __vietmapglLoading?: Promise<void>;
  }
}

type Props = {
  value?: { lat: number; lng: number } | null;
  onChange: (pos: { lat: number; lng: number }) => void;
  className?: string;
  height?: number;
  zoom?: number;
};

function loadVietmapGL(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  // đã có rồi
  if (window.vietmapgl) return Promise.resolve();

  // đang load dở
  if (window.__vietmapglLoading) return window.__vietmapglLoading;

  window.__vietmapglLoading = new Promise<void>((resolve, reject) => {
    // CSS (chỉ add 1 lần)
    const cssId = "vietmapgl-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://maps.vietmap.vn/sdk/vietmap-gl.css";
      document.head.appendChild(link);
    }

    // JS (chỉ add 1 lần)
    const jsId = "vietmapgl-js";
    const existing = document.getElementById(jsId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Load vietmap-gl.js failed")));
      return;
    }

    const script = document.createElement("script");
    script.id = jsId;
    script.src = "https://maps.vietmap.vn/sdk/vietmap-gl.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Load vietmap-gl.js failed"));
    document.body.appendChild(script);
  });

  return window.__vietmapglLoading;
}

export default function VietmapPicker({
  value,
  onChange,
  className,
  height = 420,
  zoom = 12,
}: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);
  const markerRef = React.useRef<any>(null);

  // init map 1 lần
  React.useEffect(() => {
    let destroyed = false;

    (async () => {
      await loadVietmapGL();
      if (destroyed) return;
      if (!ref.current || mapRef.current) return;

      const vmgl = window.vietmapgl;
      vmgl.accessToken = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;

      const defaultCenter: [number, number] = value
        ? [value.lng, value.lat]
        : [105.8342, 21.0278]; // Hà Nội

      const map = new vmgl.Map({
        container: ref.current,
        style: "https://maps.vietmap.vn/mt/tm/style.json",
        center: defaultCenter,
        zoom,
      });

      mapRef.current = map;

      const marker = new vmgl.Marker({ draggable: true })
        .setLngLat(defaultCenter)
        .addTo(map);

      markerRef.current = marker;

      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        onChange({ lat: ll.lat, lng: ll.lng });
      });

      map.on("click", (e: any) => {
        const ll = e.lngLat;
        marker.setLngLat(ll);
        onChange({ lat: ll.lat, lng: ll.lng });
      });

      // geolocate nếu chưa có value
      if (!value && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const ll: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          map.flyTo({ center: ll, zoom: 13 });
          marker.setLngLat(ll);
          onChange({ lat: ll[1], lng: ll[0] });
        });
      }
    })().catch((err) => {
      console.error(err);
    });

    return () => {
      destroyed = true;
      // nếu bạn muốn cleanup map khi unmount:
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // chỉ init 1 lần (không phụ thuộc value/onChange để tránh init lại)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync marker + camera khi value đổi
  React.useEffect(() => {
    if (!markerRef.current || !value) return;
    markerRef.current.setLngLat([value.lng, value.lat]);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [value.lng, value.lat],
        zoom: Math.max(zoom, 12),
      });
    }
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

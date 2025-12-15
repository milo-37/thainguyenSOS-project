export function loadVietMapGL(): Promise<any> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined") return reject("SSR");

        // đã có rồi thì dùng luôn
        if ((window as any).vietmapgl) return resolve((window as any).vietmapgl);

        // CSS
        const cssId = "vietmapgl-css";
        if (!document.getElementById(cssId)) {
            const link = document.createElement("link");
            link.id = cssId;
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/@vietmap/vietmap-gl-js/dist/vietmap-gl.css";
            document.head.appendChild(link);
        }

        // JS
        const jsId = "vietmapgl-js";
        if (document.getElementById(jsId)) {
            const iv = setInterval(() => {
                if ((window as any).vietmapgl) { clearInterval(iv); resolve((window as any).vietmapgl); }
            }, 50);
            return;
        }
        const s = document.createElement("script");
        s.id = jsId;
        s.src = "https://unpkg.com/@vietmap/vietmap-gl-js/dist/vietmap-gl.js";
        s.async = true;
        s.onload = () => resolve((window as any).vietmapgl);
        s.onerror = (e) => reject(e);
        document.body.appendChild(s);
    });
}

export function parseGmapsLink(link: string): { lat: number; lng: number } | null {
    if (!link) return null;
    const at = link.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (at) return { lat: +at[1], lng: +at[2] };
    const q = link.match(/[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (q) return { lat: +q[1], lng: +q[2] };
    const bang = link.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (bang) return { lat: +bang[1], lng: +bang[2] };
    return null;
}

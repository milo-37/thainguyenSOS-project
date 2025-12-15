'use client';
import { useMemo, useRef, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList, CommandEmpty } from '@/components/ui/command';
import { MapPin, Loader2 } from 'lucide-react';

type Suggest = { name: string; lat: number; lng: number; address?: string };

export default function AddressSearch({
                                          styleUrl = process.env.NEXT_PUBLIC_VIETMAP_STYLE_BASE!,
                                          placeholder = 'Nhập địa chỉ để tìm (VietMap)…',
                                          onPick,
                                      }: {
    styleUrl?: string;
    placeholder?: string;
    onPick?: (pos: { lat: number; lng: number; label?: string }) => void;
}) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<Suggest[]>([]);
    const timer = useRef<any>(null);

    // Lấy apikey từ styleUrl bạn cung cấp
    const apikey = useMemo(() => {
        try {
            const u = new URL(styleUrl);
            return u.searchParams.get('apikey') || '';
        } catch { return ''; }
    }, [styleUrl]);

    useEffect(() => {
        if (!q.trim()) {
            setItems([]);
            setOpen(false);
            return;
        }
        clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            if (!apikey) return;
            setLoading(true);
            try {
                const url = new URL('https://maps.vietmap.vn/api/search/v3');
                url.searchParams.set('apikey', apikey);
                url.searchParams.set('text', q.trim());
                url.searchParams.set('size', '8');

                const r = await fetch(url.toString());
                const js = await r.json();

                // v3 thường trả MẢNG gốc; đôi khi trong data
                const raw = Array.isArray(js) ? js : (js?.data || []);
                const arr: Suggest[] = raw.map((it: any) => {
                    const lat = it?.lat ?? it?.location?.lat ?? it?.geometry?.coordinates?.[1];
                    const lng = it?.lng ?? it?.lon ?? it?.location?.lng ?? it?.location?.lon ?? it?.geometry?.coordinates?.[0];
                    const name = it?.display || it?.name || it?.properties?.name || 'Không tên';
                    const address = it?.address || it?.full_name || it?.properties?.address || it?.display || '';
                    return { name, lat: Number(lat), lng: Number(lng), address };
                }).filter((x: any) => Number.isFinite(x.lat) && Number.isFinite(x.lng));

                setItems(arr);
                setOpen(true);
            } catch {
                setItems([]);
                setOpen(true);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer.current);
    }, [q, apikey]);

    const pick = (s: Suggest) => {
        onPick?.({ lat: s.lat, lng: s.lng, label: s.address || s.name });
        setOpen(false);
    };

    return (
        <div className="grid gap-2">
            <label className="text-sm text-gray-600">Gợi ý</label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <div className="relative">
                        <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={placeholder}
                            onFocus={() => items.length && setOpen(true)}
                        />
                        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
                    </div>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[min(32rem,90vw)]" align="start">
                    <Command>
                        <CommandList>
                            {!loading && !items.length && <CommandEmpty>Không có gợi ý</CommandEmpty>}
                            <CommandGroup heading={q ? 'Gợi ý' : undefined}>
                                {items.map((s, idx) => (
                                    <CommandItem key={idx} onSelect={() => pick(s)}>
                                        <MapPin className="mr-2 h-4 w-4" />
                                        <div className="flex flex-col">
                                            <span className="font-medium">{s.name}</span>
                                            {s.address ? <span className="text-xs text-gray-500">{s.address}</span> : null}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}

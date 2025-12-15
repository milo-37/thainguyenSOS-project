'use client';
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Map, LogOut, LogIn, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AppHeader() {
    const router = useRouter();
    const [authed, setAuthed] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const check = () => setAuthed(!!localStorage.getItem("token"));
        check();
        window.addEventListener("storage", check);
        return () => window.removeEventListener("storage", check);
    }, []);

    return (
        <header className="h-16 flex items-center justify-between px-4 md:px-6 lg:px-8 border-b bg-white">
            <Link href="/" className="flex items-center gap-2 font-semibold text-gray-800">
                <div className="size-8 rounded-full bg-black text-white grid place-items-center">C</div>
                Cứu hộ Thái Nguyên
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm text-gray-700">
                <Link href="/" className="hover:text-black transition">Trang chủ</Link>
                <Link href="/map" className="hover:text-black transition flex items-center gap-1">
                    <Map size={16}/> Bản đồ
                </Link>
                <Link href="/guiyeucau" className="hover:text-black transition">Gửi yêu cầu</Link>
            </nav>

            <div className="flex items-center gap-2">
                {/* 🔒 Nút Quản trị chỉ hiện khi đã đăng nhập */}
                {authed && (
                    <Link href="/admin/dashboard">
                        <Button variant="outline" className="gap-2">
                            <Settings size={16}/> Quản trị
                        </Button>
                    </Link>
                )}

                {/* Nếu chưa đăng nhập → hiện nút Đăng nhập */}
                {!authed ? (
                    <Link href="/admin/login">
                        <Button className="gap-2">
                            <LogIn size={16}/> Đăng nhập
                        </Button>
                    </Link>
                ) : (
                    // Nếu đã đăng nhập → hiện nút Thoát
                    <Button
                        className="gap-2"
                        variant="default"
                        onClick={() => {
                            localStorage.removeItem("token");
                            // phát sự kiện storage để các tab khác đồng bộ trạng thái
                            window.dispatchEvent(new StorageEvent("storage"));
                            router.replace("/");
                        }}
                    >
                        <LogOut size={16}/> Thoát
                    </Button>
                )}
            </div>
        </header>
    );
}

'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    Boxes,
    Map,
    Package,
    Users,
    LogOut
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const [authed, setAuthed] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (location.pathname === "/admin/login") {
            setReady(true);
            setAuthed(false);
            return;
        }

        const token = localStorage.getItem("token");
        if (!token) {
            router.replace("/admin/login");
            return;
        }

        setAuthed(true);
        setReady(true);
    }, [router]);

    if (!ready) {
        return <div className="p-10 text-center text-gray-500">Đang tải…</div>;
    }

    // Không hiển thị sidebar cho trang đăng nhập
    if (typeof window !== "undefined" && location.pathname === "/admin/login") {
        return <>{children}</>;
    }

    if (!authed) return null;

    const menu = [
        { href: "/admin/dashboard", label: "Bảng điều khiển", icon: LayoutDashboard },
        { href: "/admin/clusters", label: "Cụm cứu hộ", icon: Boxes },
        { href: "/admin/yeucau", label: "Yêu cầu cứu hộ", icon: Map },
        { href: "/admin/kho", label: "Kho cứu trợ", icon: Boxes },
        { href: "/admin/vattu", label: "Vật tư", icon: Package },
        { href: "/admin/users", label: "Người dùng", icon: Users },
    ];

    const currentPath = typeof window !== "undefined" ? location.pathname : "";

    return (
        <div className="grid md:grid-cols-[240px_1fr] gap-6">
            <aside className="h-[calc(100vh-100px)] sticky top-[84px] rounded-2xl border bg-white p-4 shadow-sm">
                <nav className="grid gap-1 text-sm">
                    {menu.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                                currentPath === href
                                    ? "bg-blue-50 text-blue-600 font-medium"
                                    : "hover:bg-gray-100 text-gray-700"
                            }`}
                        >
                            <Icon size={16} />
                            {label}
                        </Link>
                    ))}
                </nav>

                <button
                    className="mt-6 w-full border rounded-lg px-3 py-2 flex items-center justify-center gap-2 text-gray-700 hover:bg-gray-100 transition"
                    onClick={() => {
                        localStorage.removeItem("token");
                        router.replace("/");
                    }}
                >
                    <LogOut size={16} />
                    Đăng xuất
                </button>
            </aside>

            <section>{children}</section>
        </div>
    );
}

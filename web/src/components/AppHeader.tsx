'use client';

import Link from "next/link";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Map as MapIcon,
  LogOut,
  LogIn,
  Settings,
  Menu,
  X
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () => setAuthed(!!localStorage.getItem("token"));
    check();

    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    window.dispatchEvent(new StorageEvent("storage"));
    setOpen(false);
    router.replace("/");
  };

  const nav = [
    { href: "/map", label: "Bản đồ", icon: <MapIcon size={16} /> },
    { href: "/guiyeucau", label: "Gửi yêu cầu" },
  ];

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={mobile ? "grid gap-1" : "hidden md:flex items-center gap-6 text-sm"}>
      {nav.map((i) => {
        const active = pathname === i.href;
        const base =
          "rounded-lg px-2 py-2 md:px-0 md:py-0 transition";
        const clsMobile = active
          ? "bg-black text-white"
          : "hover:bg-gray-100 text-gray-800";
        const clsDesktop = active
          ? "text-black font-semibold"
          : "text-gray-700 hover:text-black";

        return (
          <Link
            key={i.href}
            href={i.href}
            onClick={() => mobile && setOpen(false)}
            className={[
              base,
              mobile ? clsMobile : clsDesktop,
              !mobile && "flex items-center gap-1"
            ].filter(Boolean).join(" ")}
          >
            {i.icon ? <span className="inline-flex">{i.icon}</span> : null}
            <span>{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
      <div className="h-16 flex items-center justify-between px-4 md:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 min-w-0">
  <div className="size-10 shrink-0 rounded-full bg-emerald-700 flex items-center justify-center shadow-sm">
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="M4 15C6 13.5 8 13.5 10 15C12 16.5 14 16.5 16 15C18 13.5 20 13.5 22 15"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M5 11C7 9.8 9 9.8 11 11C13 12.2 15 12.2 17 11C19 9.8 21 9.8 23 11"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="7" cy="7" r="1.6" fill="#ef4444" />
    </svg>
  </div>

  <div className="min-w-0">
    <div className="font-semibold text-gray-900 leading-tight truncate">
      Thái Nguyên SOS
    </div>
    <div className="text-xs text-gray-500 leading-tight hidden sm:block truncate">
      Điều phối cứu trợ & yêu cầu hỗ trợ
    </div>
  </div>
</Link>

        {/* Desktop nav */}
        <NavLinks />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Admin only when authed (desktop) */}
          {authed && (
            <Link href="/admin/dashboard" className="hidden sm:inline-flex">
              <Button variant="outline" className="gap-2">
                <Settings size={16} /> Quản trị
              </Button>
            </Link>
          )}

          {!authed ? (
            <Link href="/admin/login" className="hidden sm:inline-flex">
              <Button className="gap-2">
                <LogIn size={16} /> Đăng nhập
              </Button>
            </Link>
          ) : (
            <Button
              className="gap-2 hidden sm:inline-flex"
              variant="default"
              onClick={logout}
            >
              <LogOut size={16} /> Thoát
            </Button>
          )}

          {/* Mobile menu button */}
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Mở menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t bg-white">
          <div className="px-4 py-3 grid gap-3">
            <NavLinks mobile />

            <div className="grid gap-2 pt-2 border-t">
              {authed && (
                <Link href="/admin/dashboard" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Settings size={16} /> Quản trị
                  </Button>
                </Link>
              )}

              {!authed ? (
                <Link href="/admin/login" onClick={() => setOpen(false)}>
                  <Button className="w-full justify-start gap-2">
                    <LogIn size={16} /> Đăng nhập
                  </Button>
                </Link>
              ) : (
                <Button className="w-full justify-start gap-2" onClick={logout}>
                  <LogOut size={16} /> Thoát
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

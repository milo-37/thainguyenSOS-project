'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Boxes,
  Map,
  Package,
  Users,
  LogOut,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/api';

type CurrentUser = {
  is_admin?: boolean;
  permissions?: string[];
  roles?: string[];
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (pathname === '/admin/login') {
      setReady(true);
      setAuthed(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/admin/login');
      return;
    }

    (async () => {
      try {
        const me = await getCurrentUser();
        setUser(me);
        setAuthed(true);
      } catch (e) {
        console.error('Load current user in layout failed:', e);
        localStorage.removeItem('token');
        router.replace('/admin/login');
      } finally {
        setReady(true);
      }
    })();
  }, [pathname, router]);

  const isAdmin = !!user?.is_admin;

  const perms = useMemo(() => {
    const arr = Array.isArray(user?.permissions) ? user.permissions : [];
    return arr.reduce((acc: Record<string, boolean>, item: string) => {
      acc[item] = true;
      return acc;
    }, {});
  }, [user]);

  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isMember = roles.includes('Thành viên');

  const menu = useMemo(() => {
    const items = [
      {
        href: '/admin/dashboard',
        label: 'Bảng điều khiển',
        icon: LayoutDashboard,
        visible: isAdmin || perms['dashboard.view'],
      },
      {
        href: '/admin/clusters',
        label: 'Cụm cứu hộ',
        icon: Boxes,
        visible: isAdmin || perms['cum.view'],
      },
      {
        href: '/admin/yeucau',
        label: 'Yêu cầu cứu hộ',
        icon: Map,
        visible: isAdmin || perms['yeucau.view'],
      },
      {
        href: '/admin/kho',
        label: 'Kho cứu trợ',
        icon: Boxes,
        visible: isAdmin || perms['kho.view'],
      },
      {
        href: '/admin/vattu',
        label: 'Vật tư',
        icon: Package,
        visible: isAdmin || perms['vattu.view'],
      },
      {
        href: '/admin/users',
        label: 'Người dùng',
        icon: Users,
        visible:
          !isMember &&
          (isAdmin ||
            perms['users.view'] ||
            perms['roles.view'] ||
            perms['permissions.view']),
      },
    ];

    return items.filter((x) => x.visible);
  }, [isAdmin, perms, isMember]);

  const allowedPaths = useMemo(() => menu.map((m) => m.href), [menu]);

  useEffect(() => {
    if (!ready || pathname === '/admin/login' || !authed) return;

    const matched = allowedPaths.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );

    if (!matched) {
      router.replace('/admin/dashboard');
    }
  }, [ready, authed, pathname, allowedPaths, router]);

  if (!ready) {
    return <div className="p-10 text-center text-gray-500">Đang tải…</div>;
  }

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (!authed) return null;

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-6">
      <aside className="h-[calc(100vh-100px)] sticky top-[84px] rounded-2xl border bg-white p-4 shadow-sm">
        <nav className="grid gap-1 text-sm">
          {menu.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                pathname === href
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'hover:bg-gray-100 text-gray-700'
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
            localStorage.removeItem('token');
            router.replace('/admin/login');
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
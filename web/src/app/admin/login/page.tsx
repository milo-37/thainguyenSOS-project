'use client';

import { useMemo, useState } from 'react';
import { API } from '@/lib/api';

export default function Login() {
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const endpoint = useMemo(() => `${API}/dangnhap`, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        {/* Soft glow */}
        <div className="relative">
          <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-r from-blue-200/40 via-indigo-200/30 to-sky-200/40 blur-2xl" />

          {/* Card */}
          <div className="relative rounded-3xl bg-white/80 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 overflow-hidden">
            {/* Top accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500" />

            {/* Header */}
            <div className="px-7 pt-7 pb-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white grid place-items-center shadow-md">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                    <path d="M6 11h12v10H6z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Đăng nhập</h1>
                  <p className="text-sm text-slate-500">Truy cập hệ thống quản trị</p>
                </div>
              </div>

              <div className="mt-5 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            </div>

            {/* Form */}
            <form
              className="px-7 pb-7"
              onSubmit={async (e: any) => {
                e.preventDefault();
                if (loading) return;

                setErr('');
                setLoading(true);

                try {
                  const fd = new FormData(e.currentTarget);

                  const payload = {
                    email: String(fd.get('email') || '').trim(),
                    password: String(fd.get('password') || ''),
                  };

                  const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  });

                  if (!res.ok) {
                    const text = await res.text();
                    setErr(text || 'Đăng nhập thất bại. Vui lòng thử lại.');
                    return;
                  }

                  const data = await res.json();
                  localStorage.setItem('token', data.token);
                  location.href = '/admin/dashboard';
                } catch (e: any) {
                  setErr(e?.message || 'Có lỗi mạng. Vui lòng thử lại.');
                } finally {
                  setLoading(false);
                }
              }}
            >
              {/* Error alert */}
              {err && (
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                  <div className="flex items-start gap-2">
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                      <path d="M10.3 3.5h3.4l8.2 14.2a2 2 0 0 1-1.7 3H3.8a2 2 0 0 1-1.7-3L10.3 3.5z" />
                    </svg>
                    <span className="leading-relaxed">{err}</span>
                  </div>
                </div>
              )}

              {/* Email */}
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <div className="relative mb-5">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16v12H4z" />
                    <path d="m4 7 8 6 8-6" />
                  </svg>
                </span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white/70 pl-11 pr-4 py-3 text-slate-900
                             shadow-sm outline-none transition
                             placeholder:text-slate-400
                             focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* Password */}
              <label className="block text-sm font-medium text-slate-700 mb-2">Mật khẩu</label>
              <div className="relative mb-6">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                    <path d="M6 11h12v10H6z" />
                  </svg>
                </span>

                <input
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-slate-200 bg-white/70 pl-11 pr-14 py-3 text-slate-900
                             shadow-sm outline-none transition
                             placeholder:text-slate-400
                             focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />

                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-2 my-2 px-3 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100/80 transition"
                  aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPw ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.1A10.5 10.5 0 0 1 12 5c7 0 10 7 10 7a18 18 0 0 1-3.2 4.2" />
                      <path d="M6.2 6.2A18 18 0 0 0 2 12s3 7 10 7a10.5 10.5 0 0 0 2.1-.2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Submit */}
              <button
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white font-semibold py-3
                           shadow-lg shadow-blue-600/20 transition
                           hover:brightness-110 active:brightness-95
                           focus:outline-none focus:ring-4 focus:ring-blue-200
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {loading && (
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                    </svg>
                  )}
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </span>
              </button>

              {/* Footer */}
              <p className="mt-5 text-center text-xs text-slate-500">
                © {new Date().getFullYear()} Thai Nguyen SOS — Admin Portal
              </p>
            </form>
          </div>
        </div>

        {/* tiny helper line */}
        <p className="mt-5 text-center text-xs text-slate-400">
          Tip: Kiểm tra lại API_BASE / CORS nếu đăng nhập không vào được.
        </p>
      </div>
    </div>
  );
}

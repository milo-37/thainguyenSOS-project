'use client';
import { useState } from 'react';
import { API } from '@/lib/api';

export default function Login() {
    const [err,setErr] = useState('');
    return (
        <form className="max-w-sm mx-auto p-6" onSubmit={async (e:any)=>{
            e.preventDefault();
            setErr('');
            const fd = new FormData(e.currentTarget);
            const res = await fetch(`${API}/dangnhap`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email: fd.get('email'), password: fd.get('password') })});
            if (!res.ok) return setErr(await res.text());
            const data = await res.json();
            localStorage.setItem('token', data.token);
            location.href = '/admin/dashboard';
        }}>
            <h1 className="text-2xl font-bold mb-4">Đăng nhập</h1>
            <input name="email" placeholder="Email" className="border p-2 rounded w-full mb-2"/>
            <input name="password" type="password" placeholder="Mật khẩu" className="border p-2 rounded w-full mb-2"/>
            <button className="px-4 py-2 bg-blue-600 text-white rounded">Đăng nhập</button>
            {err && <p className="text-red-600 mt-2">{err}</p>}
        </form>
    );
}

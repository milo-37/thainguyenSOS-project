'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    // USERS
    listUsers, getUser, createUser, updateUser, deleteUser,
    // ROLES
    listRoles, createRole, updateRole, deleteRole,
    // PERMISSIONS
    listPermissions, getRolePermissions, saveRolePermissions,
} from '@/lib/api';

/* ===========================
   Types
=========================== */
type Role = { id:number; name:string; guard_name?:string };
type User = {
    id:number;
    name:string;
    email:string;
    phone?:string|null;
    role_id?: number|null;
    role_name?: string;
};

type Perm = { id:number; name:string; guard_name?:string };

/* ===========================
   Helpers
=========================== */
function cx(...s:(string|false|undefined)[]) {
    return s.filter(Boolean).join(' ');
}

function groupPermissions(perms: Perm[]) {
    const map: Record<string, Perm[]> = {};
    perms.forEach(p => {
        const [g] = p.name.split('.');
        const key = g || 'khác';
        (map[key] ||= []).push(p);
    });
    Object.values(map).forEach(arr => arr.sort((a,b)=> a.name.localeCompare(b.name)));
    return Object.entries(map).sort((a,b)=> a[0].localeCompare(b[0]));
}

/* ===========================
   Roles & Permissions Panel
=========================== */
function RolesPermissionsPanel() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [perms, setPerms] = useState<Perm[]>([]);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [rolePermIds, setRolePermIds] = useState<number[]>([]);
    const [loadingPerms, setLoadingPerms] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [keyword, setKeyword] = useState('');

    const filteredPerms = useMemo(() => {
        if (!keyword.trim()) return perms;
        const k = keyword.toLowerCase();
        return perms.filter(p => p.name.toLowerCase().includes(k));
    }, [perms, keyword]);

    const grouped = useMemo(() => groupPermissions(filteredPerms), [filteredPerms]);

    useEffect(() => {
        (async () => {
            const r = await listRoles();
            setRoles(r?.data ?? r);
            const p = await listPermissions();
            setPerms(p?.data ?? p);
        })();
    }, []);

    const openPermissions = async (role: Role) => {
        setSelectedRole(role);
        setLoadingPerms(true);
        const rp = await getRolePermissions(role.id);
        setRolePermIds(rp?.permission_ids ?? []);
        setLoadingPerms(false);
    };

    const togglePerm = (id:number, checked:boolean) => {
        setRolePermIds(prev => checked ? [...new Set([...prev, id])] : prev.filter(x => x !== id));
    };

    const toggleGroup = (ids:number[], checked:boolean) => {
        setRolePermIds(prev => {
            const set = new Set(prev);
            ids.forEach(id => checked ? set.add(id) : set.delete(id));
            return Array.from(set);
        });
    };

    const selectAll = () => setRolePermIds(perms.map(p => p.id));
    const unselectAll = () => setRolePermIds([]);

    const handleSave = async () => {
        if (!selectedRole) return;
        setSaving(true);
        try {
            await saveRolePermissions(selectedRole.id, rolePermIds);
            alert('Đã lưu quyền cho nhóm.');
        } catch (e:any) {
            alert(e?.message ?? 'Lưu quyền thất bại');
        } finally {
            setSaving(false);
        }
    };

    const addRole = async () => {
        const name = newRoleName.trim();
        if (!name) return;
        const created = await createRole({ name });
        setNewRoleName('');
        const r = await listRoles();
        setRoles(r?.data ?? r);
        // chọn luôn role vừa tạo
        const id = created?.data?.id ?? created?.id;
        if (id) {
            const role = (r?.data ?? r).find((x:Role)=>x.id===id);
            if (role) openPermissions(role);
        }
    };

    const renameRole = async (role: Role) => {
        const name = prompt('Tên nhóm mới', role.name)?.trim();
        if (!name) return;
        await updateRole(role.id, { name });
        const r = await listRoles();
        setRoles(r?.data ?? r);
        if (selectedRole?.id === role.id) {
            const refreshed = (r?.data ?? r).find((x:Role)=>x.id===role.id) || role;
            setSelectedRole(refreshed);
        }
    };

    const removeRole = async (role: Role) => {
        if (!confirm(`Xoá nhóm "${role.name}"?`)) return;
        await deleteRole(role.id);
        const r = await listRoles();
        setRoles(r?.data ?? r);
        if (selectedRole?.id === role.id) {
            setSelectedRole(null);
            setRolePermIds([]);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT */}
            <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-lg font-semibold mb-3">Nhóm</div>
                <div className="flex gap-2 mb-4">
                    <input
                        className="h-10 border rounded px-3 flex-1"
                        placeholder="Tên nhóm"
                        value={newRoleName}
                        onChange={e=>setNewRoleName(e.target.value)}
                    />
                    <button onClick={addRole} className="h-10 px-4 rounded bg-black text-white">Thêm</button>
                </div>

                <div className="space-y-2">
                    {roles.map(r => (
                        <div key={r.id} className="flex items-center justify-between rounded-lg border p-2 hover:bg-gray-50">
                            <div className="font-medium">{r.name}</div>
                            <div className="flex gap-2">
                                <button
                                    onClick={()=>openPermissions(r)}
                                    className={cx('px-3 py-1.5 rounded border', selectedRole?.id===r.id && 'bg-black text-white')}
                                >
                                    Quyền
                                </button>
                                <button onClick={()=>renameRole(r)} className="px-3 py-1.5 rounded border">Sửa</button>
                                <button onClick={()=>removeRole(r)} className="px-3 py-1.5 rounded border text-red-600">Xoá</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT */}
            <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-lg font-semibold">
                        Quyền của nhóm {selectedRole ? <span className="text-primary">“{selectedRole.name}”</span> : ''}
                    </div>
                    {selectedRole && (
                        <div className="flex gap-2">
                            <button onClick={selectAll} className="px-3 py-1.5 rounded border">Chọn tất cả</button>
                            <button onClick={unselectAll} className="px-3 py-1.5 rounded border">Bỏ chọn</button>
                        </div>
                    )}
                </div>

                {!selectedRole ? (
                    <div className="text-sm text-gray-500">Chọn 1 nhóm để cấu hình quyền.</div>
                ) : (
                    <>
                        <div className="mb-3">
                            <input
                                className="h-10 border rounded px-3 w-full"
                                placeholder="Tìm quyền…"
                                value={keyword}
                                onChange={e=>setKeyword(e.target.value)}
                            />
                        </div>

                        {loadingPerms ? (
                            <div className="text-sm text-gray-500">Đang tải…</div>
                        ) : (
                            <div className="max-h-[60vh] overflow-auto space-y-4 pr-1">
                                {grouped.map(([group, arr]) => {
                                    const ids = arr.map(p=>p.id);
                                    const checkedAll = ids.every(id=>rolePermIds.includes(id));
                                    const indeterminate = !checkedAll && ids.some(id=>rolePermIds.includes(id));
                                    return (
                                        <div key={group} className="rounded-lg border p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <input
                                                    type="checkbox"
                                                    checked={checkedAll}
                                                    ref={(el)=>{ if (el) el.indeterminate = indeterminate; }}
                                                    onChange={e=>toggleGroup(ids, e.currentTarget.checked)}
                                                />
                                                <div className="font-medium capitalize">{group}</div>
                                            </div>
                                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {arr.map(p => {
                                                    const checked = rolePermIds.includes(p.id);
                                                    return (
                                                        <label key={p.id} className="flex items-center gap-2 rounded border px-2 py-1.5 hover:bg-gray-50">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={e=>togglePerm(p.id, e.currentTarget.checked)}
                                                            />
                                                            <span className="text-sm">{p.name}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                                {!grouped.length && <div className="text-sm text-gray-500">Không có quyền phù hợp từ khoá.</div>}
                            </div>
                        )}

                        <div className="mt-4 flex justify-end">
                            <button
                                disabled={saving}
                                onClick={handleSave}
                                className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
                            >
                                {saving ? 'Đang lưu…' : 'Lưu quyền'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/* ===========================
   Users Tab (list + CRUD)
=========================== */
function UsersPanel() {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);

    // modal
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<User|null>(null);
    const [frm, setFrm] = useState<{name:string; email:string; phone?:string; password?:string; role_id?:number|''}>({
        name:'', email:'', phone:'', password:'', role_id:''
    });
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await listUsers({ q });
            setUsers(res?.data ?? res);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        (async () => {
            const r = await listRoles();
            setRoles(r?.data ?? r);
            await load();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startCreate = () => {
        setEditing(null);
        setFrm({ name:'', email:'', phone:'', password:'', role_id:'' });
        setOpen(true);
    };

    const startEdit = async (u:User) => {
        // nếu cần lấy detail: await getUser(u.id)
        setEditing(u);
        setFrm({ name:u.name, email:u.email, phone:u.phone||'', password:'', role_id:u.role_id ?? '' });
        setOpen(true);
    };

    const doDelete = async (u:User) => {
        if (!confirm(`Xoá "${u.name}"?`)) return;
        await deleteUser(u.id);
        await load();
    };

    const save = async () => {
        if (!frm.name.trim() || !frm.email.trim()) { alert('Nhập tên & email'); return; }
        setSaving(true);
        try {
            if (editing) {
                const payload:any = {
                    name: frm.name.trim(),
                    email: frm.email.trim(),
                    phone: (frm.phone||'').trim() || undefined,
                    role_id: frm.role_id ? Number(frm.role_id) : undefined,
                };
                // chỉ gửi password khi có nhập
                if (frm.password && frm.password.trim()) payload.password = frm.password.trim();

                await updateUser(editing.id, payload);
                alert('Đã cập nhật.');
            } else {
                await createUser({
                    name: frm.name.trim(),
                    email: frm.email.trim(),
                    phone: (frm.phone||'').trim() || undefined,
                    password: (frm.password||'').trim() || undefined,
                    role_id: frm.role_id ? Number(frm.role_id) : undefined,
                });
                alert('Đã tạo người dùng.');
            }
            setOpen(false);
            await load();
        } catch (e:any) {
            alert(e?.message || 'Lưu thất bại');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* actions */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                    <input
                        className="h-10 border rounded px-3 min-w-[260px]"
                        placeholder="Tìm theo tên, email, điện thoại…"
                        value={q}
                        onChange={e=>setQ(e.target.value)}
                        onKeyDown={e=> e.key==='Enter' && load()}
                    />
                    <button onClick={load} className="h-10 px-4 rounded border">Tìm</button>
                </div>
                <div className="ml-auto">
                    <button onClick={startCreate} className="h-10 px-4 rounded bg-black text-white">+ Thêm thành viên</button>
                </div>
            </div>

            {/* table */}
            <div className="rounded-xl border bg-white overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="bg-gray-50 border-b">
                        <th className="p-2 text-left w-12">#</th>
                        <th className="p-2 text-left">Tên</th>
                        <th className="p-2 text-left">Email</th>
                        <th className="p-2 text-left">Điện thoại</th>
                        <th className="p-2 text-left">Nhóm</th>
                        <th className="p-2 text-right w-40">Thao tác</th>
                    </tr>
                    </thead>
                    <tbody>
                    {users.map((u, idx) => (
                        <tr key={u.id} className="border-b last:border-0">
                            <td className="p-2">{idx+1}</td>
                            <td className="p-2">{u.name}</td>
                            <td className="p-2">{u.email}</td>
                            <td className="p-2">{u.phone || ''}</td>
                            <td className="p-2">{u.role_name || ''}</td>
                            <td className="p-2 text-right">
                                <div className="inline-flex gap-2">
                                    <button className="px-3 py-1.5 rounded border" onClick={()=>startEdit(u)}>Sửa</button>
                                    <button className="px-3 py-1.5 rounded border text-red-600" onClick={()=>doDelete(u)}>Xoá</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {!users.length && (
                        <tr><td colSpan={6} className="p-6 text-center text-gray-500">{loading?'Đang tải…':'Không có dữ liệu.'}</td></tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* modal create/edit */}
            {open && (
                <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center">
                    <div className="bg-white rounded-xl w-full max-w-2xl p-5 space-y-4">
                        <div className="text-lg font-semibold">{editing?'Sửa thành viên':'Thêm thành viên'}</div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm">Họ tên</label>
                                <input className="mt-1 w-full h-10 border rounded px-3"
                                       value={frm.name}
                                       onChange={e=>setFrm({...frm, name:e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-sm">Email</label>
                                <input className="mt-1 w-full h-10 border rounded px-3"
                                       value={frm.email}
                                       onChange={e=>setFrm({...frm, email:e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-sm">Điện thoại</label>
                                <input className="mt-1 w-full h-10 border rounded px-3"
                                       value={frm.phone||''}
                                       onChange={e=>setFrm({...frm, phone:e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-sm">{editing?'Mật khẩu (để trống nếu giữ nguyên)':'Mật khẩu'}</label>
                                <input type="password" className="mt-1 w-full h-10 border rounded px-3"
                                       value={frm.password||''}
                                       onChange={e=>setFrm({...frm, password:e.target.value})}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-sm">Nhóm (role)</label>
                                <select
                                    className="mt-1 w-full h-10 border rounded px-3"
                                    value={frm.role_id ?? ''}
                                    onChange={e=>setFrm({...frm, role_id: e.target.value ? Number(e.target.value) : ''})}
                                >
                                    <option value="">-- Chọn nhóm --</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button className="px-3 py-1.5 rounded border" onClick={()=>setOpen(false)} disabled={saving}>Hủy</button>
                            <button className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-60" onClick={save} disabled={saving}>
                                {saving?'Đang lưu…':(editing?'Lưu thay đổi':'Tạo mới')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ===========================
   PAGE
=========================== */
export default function UsersPage() {
    const [tab, setTab] = useState<'users'|'roles'>('users');

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
                <button
                    onClick={()=>setTab('users')}
                    className={cx('h-9 px-4 rounded-full border', tab==='users' && 'bg-black text-white')}
                >
                    Người dùng
                </button>
                <button
                    onClick={()=>setTab('roles')}
                    className={cx('h-9 px-4 rounded-full border', tab==='roles' && 'bg-black text-white')}
                >
                    Nhóm & Quyền
                </button>
            </div>

            {tab==='users' ? <UsersPanel/> : <RolesPermissionsPanel/>}
        </div>
    );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
type Role = { id: number; name: string; guard_name?: string };
type User = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role_id?: number | null;
  role_name?: string;
};
type Perm = { id: number; name: string; guard_name?: string };

/* ===========================
   Helpers
=========================== */
function cx(...s: (string | false | undefined | null)[]) {
  return s.filter(Boolean).join(' ');
}

function groupPermissions(perms: Perm[]) {
  const map: Record<string, Perm[]> = {};
  perms.forEach((p) => {
    const [g] = p.name.split('.');
    const key = (g || 'khác').trim();
    (map[key] ||= []).push(p);
  });
  Object.values(map).forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name)));
  return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
}

function useDebouncedValue<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* ===========================
   Small UI atoms
=========================== */
function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-base font-semibold">{title}</div>
      {desc ? <div className="text-sm text-gray-500">{desc}</div> : null}
    </div>
  );
}

function Pill({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border',
        active ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200'
      )}
    >
      {children}
    </span>
  );
}

function IconBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'danger' }) {
  const { className, tone = 'default', ...rest } = props;
  return (
    <button
      {...rest}
      className={cx(
        'h-9 px-3 rounded-lg border text-sm inline-flex items-center gap-2 hover:bg-gray-50 active:scale-[0.99] transition',
        tone === 'danger' && 'text-red-600 hover:bg-red-50 border-red-200',
        className
      )}
    />
  );
}

function PrimaryBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={cx(
        'h-9 px-4 rounded-lg bg-black text-white text-sm font-medium hover:opacity-95 active:scale-[0.99] transition disabled:opacity-60',
        className
      )}
    />
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  maxWidth = 'max-w-2xl',
}: {
  open: boolean;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className={cx('w-full rounded-2xl bg-white shadow-xl ring-1 ring-black/5', maxWidth)}>
          <div className="p-5 border-b flex items-start justify-between gap-3">
            <div className="text-lg font-semibold">{title}</div>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-lg border hover:bg-gray-50 inline-grid place-items-center"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="p-5">{children}</div>
          {footer ? <div className="p-5 pt-0">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-2 h-12 w-12 rounded-2xl bg-gray-100 grid place-items-center text-xl">👤</div>
      <div className="font-semibold">{title}</div>
      {desc ? <div className="text-sm text-gray-500 mt-1">{desc}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ===========================
   Roles & Permissions Panel (Optimized)
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
  const [onlySelected, setOnlySelected] = useState(false);

  /* ---------- Labels (VN) ---------- */
  const MODULE_LABEL: Record<string, string> = {
    dashboard: 'Bảng điều khiển',
    map: 'Bản đồ',
    thongke: 'Thống kê',
    cum: 'Cụm',
    kho: 'Kho',
    vattu: 'Vật tư',
    yeucau: 'Yêu cầu cứu trợ',
    users: 'Người dùng',
    roles: 'Nhóm quyền',
    permissions: 'Danh sách quyền',
  };

  const PERM_LABEL: Record<string, string> = {
    'dashboard.view': 'Xem dashboard',
    'map.view': 'Xem bản đồ',
    'thongke.view': 'Xem thống kê',

    // Cụm
    'cum.view': 'Xem cụm',
    'cum.create': 'Thêm cụm',
    'cum.update': 'Sửa cụm',
    'cum.delete': 'Xoá cụm',
    'cum.members.manage': 'Quản lý thành viên cụm',

    // Kho
    'kho.view': 'Xem kho',
    'kho.create': 'Thêm kho',
    'kho.update': 'Sửa kho',
    'kho.delete': 'Xoá kho',
    'kho.ton.view': 'Xem tồn kho',
    'kho.lich_su.view': 'Xem lịch sử kho',
    'kho.nhap': 'Nhập kho',
    'kho.xuat': 'Xuất kho',
    'kho.chuyen': 'Chuyển kho',

    // Vật tư
    'vattu.view': 'Xem vật tư',
    'vattu.create': 'Thêm vật tư',
    'vattu.update': 'Sửa vật tư',
    'vattu.delete': 'Xoá vật tư',
    'vattu.thongke.view': 'Xem thống kê vật tư',

    // Yêu cầu
    'yeucau.view': 'Xem yêu cầu',
    'yeucau.create': 'Tạo yêu cầu',
    'yeucau.update': 'Sửa yêu cầu',
    'yeucau.delete': 'Xoá yêu cầu',
    'yeucau.phancong': 'Phân công xử lý',
    'yeucau.chuyen_xu_ly': 'Chuyển xử lý',
    'yeucau.cap_nhat_trang_thai': 'Cập nhật trạng thái',
    'yeucau.history.view': 'Xem lịch sử yêu cầu',
    'yeucau.media.view': 'Xem tệp đính kèm',

    // Users/Roles/Permissions
    'users.view': 'Xem người dùng',
    'users.create': 'Thêm người dùng',
    'users.update': 'Sửa người dùng',
    'users.delete': 'Xoá người dùng',
    'users.manage_roles': 'Gán nhóm quyền cho người dùng',

    'roles.view': 'Xem nhóm quyền',
    'roles.create': 'Thêm nhóm quyền',
    'roles.update': 'Sửa nhóm quyền',
    'roles.delete': 'Xoá nhóm quyền',
    'roles.assign_permissions': 'Gán quyền cho nhóm',

    'permissions.view': 'Xem danh sách quyền',
  };

  const permDisplay = (name: string) => PERM_LABEL[name] ?? name;

  /* ---------- Ordering ---------- */
  const ORDER = [
    'view', 'create', 'update', 'delete',
    'nhap', 'xuat', 'chuyen',
    'ton.view', 'lich_su.view',
    'history.view', 'media.view',
    'phancong', 'chuyen_xu_ly', 'cap_nhat_trang_thai',
    'members.manage', 'manage_roles', 'assign_permissions',
  ];

  const permSortKey = (fullName: string) => {
    const parts = fullName.split('.');
    const tail = parts.slice(1).join('.'); // vd: kho.ton.view => "ton.view"
    const idx = ORDER.indexOf(tail);
    return idx === -1 ? 999 : idx;
  };

  /* ---------- Grouping by module ---------- */
  const groupByModule = (list: Perm[]) => {
    const map: Record<string, Perm[]> = {};
    list.forEach(p => {
      const moduleKey = p.name.split('.')[0] || 'khác';
      (map[moduleKey] ||= []).push(p);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => permSortKey(a.name) - permSortKey(b.name)));
    return Object.entries(map).sort((a, b) => (MODULE_LABEL[a[0]] || a[0]).localeCompare(MODULE_LABEL[b[0]] || b[0]));
  };

  /* ---------- Filtering ---------- */
  const filteredPerms = useMemo(() => {
    let list = perms;

    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase();
      list = list.filter(p => {
        const moduleKey = p.name.split('.')[0] || '';
        const moduleLabel = (MODULE_LABEL[moduleKey] || moduleKey).toLowerCase();
        const label = permDisplay(p.name).toLowerCase();
        return p.name.toLowerCase().includes(k) || label.includes(k) || moduleLabel.includes(k);
      });
    }

    if (onlySelected) {
      const set = new Set(rolePermIds);
      list = list.filter(p => set.has(p.id));
    }

    return list;
  }, [perms, keyword, onlySelected, rolePermIds]);

  const grouped = useMemo(() => groupByModule(filteredPerms), [filteredPerms]);

  /* ---------- Load base data ---------- */
  useEffect(() => {
    (async () => {
      const r = await listRoles();
      setRoles(r?.data ?? r);
      const p = await listPermissions();
      setPerms(p?.data ?? p);
    })();
  }, []);

  /* ---------- Role perms ---------- */
  const openPermissions = async (role: Role) => {
    setSelectedRole(role);
    setLoadingPerms(true);
    try {
      const rp = await getRolePermissions(role.id);
      setRolePermIds(rp?.permission_ids ?? []);
    } finally {
      setLoadingPerms(false);
    }
  };

  const togglePerm = (id: number, checked: boolean) => {
    setRolePermIds(prev => checked ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id));
  };

  const toggleMany = (ids: number[], checked: boolean) => {
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
    } catch (e: any) {
      alert(e?.message ?? 'Lưu quyền thất bại');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Role CRUD ---------- */
  const addRole = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    const created = await createRole({ name });
    setNewRoleName('');
    const r = await listRoles();
    const list = r?.data ?? r;
    setRoles(list);
    const id = created?.data?.id ?? created?.id;
    if (id) {
      const role = list.find((x: Role) => x.id === id);
      if (role) openPermissions(role);
    }
  };

  const renameRole = async (role: Role) => {
    const name = prompt('Tên nhóm mới', role.name)?.trim();
    if (!name) return;
    await updateRole(role.id, { name });
    const r = await listRoles();
    const list = r?.data ?? r;
    setRoles(list);
    if (selectedRole?.id === role.id) {
      const refreshed = list.find((x: Role) => x.id === role.id) || role;
      setSelectedRole(refreshed);
    }
  };

  const removeRole = async (role: Role) => {
    if (!confirm(`Xoá nhóm "${role.name}"?`)) return;
    await deleteRole(role.id);
    const r = await listRoles();
    const list = r?.data ?? r;
    setRoles(list);
    if (selectedRole?.id === role.id) {
      setSelectedRole(null);
      setRolePermIds([]);
    }
  };

  /* ---------- Quick actions per module ---------- */
  const getModuleKey = (p: Perm) => p.name.split('.')[0] || 'khác';

  const idsOfModule = (moduleKey: string) =>
    perms.filter(p => getModuleKey(p) === moduleKey).map(p => p.id);

  const idsViewOfModule = (moduleKey: string) =>
    perms
      .filter(p => getModuleKey(p) === moduleKey)
      .filter(p => p.name === `${moduleKey}.view` || p.name.endsWith('.view'))
      .map(p => p.id);

  const idsCRUDOfModule = (moduleKey: string) => {
    const want = new Set([`${moduleKey}.view`, `${moduleKey}.create`, `${moduleKey}.update`, `${moduleKey}.delete`]);
    return perms.filter(p => want.has(p.name)).map(p => p.id);
  };

  /* ---------- UI ---------- */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT: Roles */}
      <div className="lg:col-span-4 rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <div className="text-base font-semibold">Nhóm</div>
          <div className="text-sm text-gray-500">Tạo / sửa / xoá nhóm quyền</div>
        </div>

        <div className="p-4 border-b">
          <div className="flex gap-2">
            <input
              className="h-10 border rounded-lg px-3 flex-1 focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="Tên nhóm mới…"
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
            />
            <button onClick={addRole} className="h-10 px-4 rounded-lg bg-black text-white text-sm font-medium">
              Thêm
            </button>
          </div>
        </div>

        <div className="p-2 max-h-[70vh] overflow-auto">
          {roles.map(r => {
            const active = selectedRole?.id === r.id;
            return (
              <div
                key={r.id}
                className={cx(
                  'flex items-center justify-between rounded-xl border p-3 m-2 hover:bg-gray-50 transition',
                  active && 'border-black'
                )}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs text-gray-500 truncate">role_id: {r.id}</div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openPermissions(r)}
                    className={cx(
                      'h-9 px-3 rounded-lg border text-sm hover:bg-gray-50',
                      active && 'bg-black text-white border-black hover:bg-black'
                    )}
                  >
                    Quyền
                  </button>
                  <button onClick={() => renameRole(r)} className="h-9 px-3 rounded-lg border text-sm hover:bg-gray-50">
                    Sửa
                  </button>
                  <button
                    onClick={() => removeRole(r)}
                    className="h-9 px-3 rounded-lg border text-sm text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Xoá
                  </button>
                </div>
              </div>
            );
          })}
          {!roles.length && <div className="p-6 text-center text-sm text-gray-500">Chưa có nhóm nào.</div>}
        </div>
      </div>

      {/* RIGHT: Permissions */}
      <div className="lg:col-span-8 rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-base font-semibold">
              Quyền của nhóm{' '}
              {selectedRole ? (
                <span className="text-black">“{selectedRole.name}”</span>
              ) : (
                <span className="text-gray-400">(chưa chọn)</span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Hiển thị quyền theo module, tên quyền tiếng Việt (hover để xem mã kỹ thuật).
            </div>
          </div>

          {selectedRole ? (
            <div className="flex gap-2 shrink-0">
              <button onClick={selectAll} className="h-9 px-3 rounded-lg border text-sm hover:bg-gray-50">
                Chọn tất cả
              </button>
              <button onClick={unselectAll} className="h-9 px-3 rounded-lg border text-sm hover:bg-gray-50">
                Bỏ chọn
              </button>
            </div>
          ) : null}
        </div>

        {!selectedRole ? (
          <div className="p-6 text-sm text-gray-500">Chọn 1 nhóm ở cột trái để cấu hình quyền.</div>
        ) : (
          <>
            <div className="p-4 border-b space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  className="h-10 border rounded-lg px-3 w-full focus:outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Tìm quyền… (vd: kho, xem, xóa, phân công...)"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                />

                <label className="h-10 border rounded-lg px-3 flex items-center justify-between gap-3 cursor-pointer select-none">
                  <span className="text-sm">Chỉ hiện quyền đã chọn</span>
                  <input
                    type="checkbox"
                    checked={onlySelected}
                    onChange={e => setOnlySelected(e.currentTarget.checked)}
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                <span className="px-2.5 py-1 rounded-full border">Đã chọn: {rolePermIds.length}</span>
                <span className="px-2.5 py-1 rounded-full border">Hiển thị: {filteredPerms.length}</span>
              </div>
            </div>

            {loadingPerms ? (
              <div className="p-4 text-sm text-gray-500">Đang tải quyền…</div>
            ) : (
              <div className="max-h-[65vh] overflow-auto p-4 space-y-4">
                {grouped.map(([moduleKey, arr]) => {
                  const ids = arr.map(p => p.id);
                  const checkedCount = ids.filter(id => rolePermIds.includes(id)).length;
                  const checkedAll = checkedCount === ids.length && ids.length > 0;
                  const indeterminate = checkedCount > 0 && checkedCount < ids.length;

                  const moduleLabel = MODULE_LABEL[moduleKey] || moduleKey;

                  return (
                    <div key={moduleKey} className="rounded-2xl border p-4">
                      {/* module header */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checkedAll}
                            ref={(el) => { if (el) el.indeterminate = indeterminate; }}
                            onChange={e => toggleMany(ids, e.currentTarget.checked)}
                          />
                          <div className="min-w-0">
                            <div className="font-semibold">{moduleLabel}</div>
                            <div className="text-xs text-gray-500">
                              {checkedCount}/{ids.length} quyền được chọn
                            </div>
                          </div>
                        </div>

                        {/* quick actions */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="h-9 px-3 rounded-lg border text-sm hover:bg-gray-50"
                            onClick={() => toggleMany(idsViewOfModule(moduleKey), true)}
                            title="Chọn tất cả quyền xem trong module"
                          >
                            Chỉ xem
                          </button>
                          <button
                            className="h-9 px-3 rounded-lg border text-sm hover:bg-gray-50"
                            onClick={() => toggleMany(idsCRUDOfModule(moduleKey), true)}
                            title="Chọn quyền Xem/Thêm/Sửa/Xoá"
                          >
                            CRUD
                          </button>
                          <button
                            className="h-9 px-3 rounded-lg border text-sm hover:bg-gray-50"
                            onClick={() => toggleMany(idsOfModule(moduleKey), true)}
                            title="Chọn toàn bộ quyền trong module"
                          >
                            Tất cả
                          </button>
                          <button
                            className="h-9 px-3 rounded-lg border text-sm hover:bg-gray-50"
                            onClick={() => toggleMany(idsOfModule(moduleKey), false)}
                            title="Bỏ toàn bộ quyền module"
                          >
                            Bỏ chọn
                          </button>
                        </div>
                      </div>

                      {/* permissions grid */}
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {arr.map(p => {
                          const checked = rolePermIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={cx(
                                'flex items-start gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 transition cursor-pointer',
                                checked && 'border-black'
                              )}
                              title={p.name} // tooltip mã kỹ thuật
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                onChange={e => togglePerm(p.id, e.currentTarget.checked)}
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{permDisplay(p.name)}</div>
                                <div className="text-[11px] text-gray-500 truncate">{p.name}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {!grouped.length && (
                  <div className="p-10 text-center text-sm text-gray-500">
                    Không có quyền phù hợp.
                  </div>
                )}
              </div>
            )}

            <div className="p-4 border-t flex justify-end">
              <button
                disabled={saving}
                onClick={handleSave}
                className="h-10 px-4 rounded-lg bg-black text-white text-sm font-medium disabled:opacity-60"
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
  const debouncedQ = useDebouncedValue(q, 350);
  const [loading, setLoading] = useState(false);

  // modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [frm, setFrm] = useState<{ name: string; email: string; phone?: string; password?: string; role_id?: number | '' }>({
    name: '',
    email: '',
    phone: '',
    password: '',
    role_id: '',
  });
  const [saving, setSaving] = useState(false);

  const load = async (query?: string) => {
    setLoading(true);
    try {
      const res = await listUsers({ q: (query ?? q).trim() });
      setUsers(res?.data ?? res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const r = await listRoles();
      setRoles(r?.data ?? r);
      await load('');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounce search auto load
  useEffect(() => {
    load(debouncedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const startCreate = () => {
    setEditing(null);
    setFrm({ name: '', email: '', phone: '', password: '', role_id: '' });
    setOpen(true);
  };

  const startEdit = async (u: User) => {
    // Nếu cần detail: const detail = await getUser(u.id)
    setEditing(u);
    setFrm({ name: u.name, email: u.email, phone: u.phone || '', password: '', role_id: u.role_id ?? '' });
    setOpen(true);
  };

  const doDelete = async (u: User) => {
    if (!confirm(`Xoá "${u.name}"?`)) return;
    await deleteUser(u.id);
    await load(debouncedQ);
  };

  const save = async () => {
    if (!frm.name.trim() || !frm.email.trim()) {
      alert('Nhập tên & email');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const payload: any = {
          name: frm.name.trim(),
          email: frm.email.trim(),
          phone: (frm.phone || '').trim() || undefined,
          role_id: frm.role_id ? Number(frm.role_id) : undefined,
        };
        if (frm.password && frm.password.trim()) payload.password = frm.password.trim();

        await updateUser(editing.id, payload);
        alert('Đã cập nhật.');
      } else {
        await createUser({
          name: frm.name.trim(),
          email: frm.email.trim(),
          phone: (frm.phone || '').trim() || undefined,
          password: (frm.password || '').trim() || undefined,
          role_id: frm.role_id ? Number(frm.role_id) : undefined,
        });
        alert('Đã tạo người dùng.');
      }
      setOpen(false);
      await load(debouncedQ);
    } catch (e: any) {
      alert(e?.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="rounded-2xl border bg-white shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <SectionTitle title="Người dùng" desc="Tìm kiếm và quản lý thành viên hệ thống" />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <input
              className="h-10 w-full sm:w-[320px] border rounded-lg pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="Tìm theo tên, email, điện thoại…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
          </div>
          <PrimaryBtn onClick={startCreate}>+ Thêm thành viên</PrimaryBtn>
        </div>
      </div>

      {/* table */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-left w-14">#</th>
                <th className="p-3 text-left min-w-[200px]">Tên</th>
                <th className="p-3 text-left min-w-[220px]">Email</th>
                <th className="p-3 text-left min-w-[140px]">Điện thoại</th>
                <th className="p-3 text-left min-w-[160px]">Nhóm</th>
                <th className="p-3 text-right w-44">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <Skeleton rows={6} />
                  </td>
                </tr>
              ) : users.length ? (
                users.map((u, idx) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50/60 transition">
                    <td className="p-3 text-gray-500">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-gray-500">id: {u.id}</div>
                    </td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.phone || <span className="text-gray-400">—</span>}</td>
                    <td className="p-3">
                      {u.role_name ? <Pill active>{u.role_name}</Pill> : <Pill>Chưa gán</Pill>}
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-2">
                        <IconBtn onClick={() => startEdit(u)}>Sửa</IconBtn>
                        <IconBtn tone="danger" onClick={() => doDelete(u)}>
                          Xoá
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6">
                    <EmptyState
                      title="Không có dữ liệu"
                      desc={q.trim() ? 'Không tìm thấy người dùng phù hợp từ khoá.' : 'Tạo người dùng đầu tiên để bắt đầu.'}
                      action={<PrimaryBtn onClick={startCreate}>+ Thêm thành viên</PrimaryBtn>}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t text-xs text-gray-500 flex items-center justify-between">
          <div>Tổng: {users.length}</div>
          <div>Tìm kiếm tự động (debounce 350ms)</div>
        </div>
      </div>

      {/* modal */}
      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={editing ? 'Sửa thành viên' : 'Thêm thành viên'}
        footer={
          <div className="flex justify-end gap-2">
            <IconBtn onClick={() => setOpen(false)} disabled={saving}>
              Huỷ
            </IconBtn>
            <PrimaryBtn onClick={save} disabled={saving}>
              {saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo mới'}
            </PrimaryBtn>
          </div>
        }
      >
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Họ tên</label>
            <input
              className="mt-1 w-full h-10 border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-black/10"
              value={frm.name}
              onChange={(e) => setFrm({ ...frm, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full h-10 border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-black/10"
              value={frm.email}
              onChange={(e) => setFrm({ ...frm, email: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Điện thoại</label>
            <input
              className="mt-1 w-full h-10 border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-black/10"
              value={frm.phone || ''}
              onChange={(e) => setFrm({ ...frm, phone: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium">{editing ? 'Mật khẩu (để trống nếu giữ nguyên)' : 'Mật khẩu'}</label>
            <input
              type="password"
              className="mt-1 w-full h-10 border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-black/10"
              value={frm.password || ''}
              onChange={(e) => setFrm({ ...frm, password: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Nhóm (role)</label>
            <select
              className="mt-1 w-full h-10 border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-black/10"
              value={frm.role_id ?? ''}
              onChange={(e) => setFrm({ ...frm, role_id: e.target.value ? Number(e.target.value) : '' })}
            >
              <option value="">-- Chọn nhóm --</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <div className="mt-2 text-xs text-gray-500">
              Gợi ý: tạo nhóm + phân quyền ở tab “Nhóm & Quyền”, sau đó quay lại gán role cho user.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ===========================
   PAGE
=========================== */
export default function UsersPage() {
  const [tab, setTab] = useState<'users' | 'roles'>('users');

  return (
    <div className="p-4 space-y-4">
      {/* header */}
      <div className="rounded-2xl border bg-white shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <div className="text-xl font-semibold">Quản trị người dùng</div>
          <div className="text-sm text-gray-500">Quản lý tài khoản, nhóm và phân quyền</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('users')}
            className={cx(
              'h-9 px-4 rounded-full border text-sm transition',
              tab === 'users' ? 'bg-black text-white border-black' : 'hover:bg-gray-50'
            )}
          >
            Người dùng
          </button>

          <button
            onClick={() => setTab('roles')}
            className={cx(
              'h-9 px-4 rounded-full border text-sm transition',
              tab === 'roles' ? 'bg-black text-white border-black' : 'hover:bg-gray-50'
            )}
          >
            Nhóm & Quyền
          </button>
        </div>
      </div>

      {tab === 'users' ? <UsersPanel /> : <RolesPermissionsPanel />}
    </div>
  );
}
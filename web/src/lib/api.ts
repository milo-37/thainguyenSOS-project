// src/lib/api.ts
export const API = "/api"; // dùng proxy Next (next.config.ts -> rewrites)

export function authHeader() {
    const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// Gọi API JSON tiện dụng
export async function api(path: string, init?: RequestInit) {
    const url = `${API}${path.startsWith("/") ? "" : "/"}${path}`;
    const res = await fetch(url, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
            ...authHeader(),
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// Multipart form (upload)
export async function apiForm(path: string, fd: FormData) {
    const url = `${API}${path.startsWith("/") ? "" : "/"}${path}`;
    const res = await fetch(url, {
        method: "POST",
        body: fd,
        headers: {
            ...authHeader(),
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// ---------------------------------------------------------
// CỤM
// ---------------------------------------------------------
export async function listClusters(q?: string, page = 1) {
    return api(`/cum?q=${encodeURIComponent(q || "")}&page=${page}`);
}
export async function getCluster(id: number) {
    return api(`/cum/${id}`);
}
export async function createCluster(payload: any) {
    return api(`/cum`, { method: "POST", body: JSON.stringify(payload) });
}
export async function updateCluster(id: number, payload: any) {
    return api(`/cum/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}
export async function deleteCluster(id: number) {
    return api(`/cum/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------
// YÊU CẦU
// ---------------------------------------------------------
export async function listYeuCau(params: any = {}) {
    const usp = new URLSearchParams(params).toString();
    return api(`/yeucau${usp ? "?" + usp : ""}`);
}

export async function getYeuCau(id: number) {
    return api(`/yeucau/${id}`);
}

export async function updateYeuCau(id: number, body: any) {
    return api(`/yeucau/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
    });
}

export async function assignYeuCau(
    id: number,
    body: { cum_id?: number; user_id?: number }
) {
    return api(`/yeucau/${id}/assign`, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

// ---------------------------------------------------------
// KHO  (giữ block này, xóa các block KHO khác trùng tên)
// ---------------------------------------------------------
export async function listKho(params: any = {}) {
    const usp = new URLSearchParams(params).toString();
    return api(`/kho${usp ? "?" + usp : ""}`);
}

export async function khoTons(params: any = {}) {
    const usp = new URLSearchParams(params).toString();
    return api(`/kho/tons${usp ? "?" + usp : ""}`);
}

export async function khoHistory(params: any = {}) {
    const usp = new URLSearchParams(params).toString();
    return api(`/kho/history${usp ? "?" + usp : ""}`);
}

export async function khoNhap(body: any) {
    return api(`/kho/nhap`, { method: "POST", body: JSON.stringify(body) });
}

export async function khoXuat(body: any) {
    return api(`/kho/xuat`, { method: "POST", body: JSON.stringify(body) });
}

export async function khoChuyen(body: any) {
    return api(`/kho/chuyen`, { method: "POST", body: JSON.stringify(body) });
}
// ---------------------------------------------------------
// THỐNG KÊ
// ---------------------------------------------------------
export async function thongKe(params: any = {}) {
    const usp = new URLSearchParams(params).toString();
    return api(`/thongke${usp ? "?" + usp : ""}`);
}
export async function listYeuCauAdmin(params: any = {}) {
    const usp = new URLSearchParams(params).toString();
    return api(`/admin/yeucau${usp ? "?" + usp : ""}`);
}

export async function quickUpdateTrangThai(id: number, trang_thai: 'tiep_nhan'|'dang_xu_ly'|'hoan_thanh'|'huy', ghi_chu: string) {
    const token = localStorage.getItem('token') ?? '';
    const url = new URL(`/api/admin/yeucau/${id}/cap-nhat-trang-thai`, process.env.NEXT_PUBLIC_API_URL as string);
    const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type':'application/json' },
        body: JSON.stringify({ trang_thai, ghi_chu }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
export async function getUser(id: number | string) {
    return request(`/admin/users/${id}`, {
        method: 'GET',
    });
}

export async function transferAssignment(id: number, payload: {user_id?: number, cum_id?: number, ghi_chu?: string}) {
    const token = localStorage.getItem('token') ?? '';
    const url = new URL(`/api/admin/yeucau/${id}/chuyen-xu-ly`, process.env.NEXT_PUBLIC_API_URL as string);
    const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
// helpers

const FALLBACK_BASE = 'http://localhost:8000/api';
const getApiBase = () => {
    const raw = (process.env.NEXT_PUBLIC_API_URL || '').trim() || FALLBACK_BASE;
    return raw.replace(/\/+$/, '');
};

export const buildUrl = (path: string) => {
    const base = getApiBase();
    const p = ('/' + (path || '')).replace(/\/{2,}/g, '/');
    if (/\/api$/i.test(base) && p.startsWith('/api/')) return base + p.replace(/^\/api/, '');
    return base + p;
};

// ==== Luôn có Authorization & Accept ====
const baseHeaders = () => {
    const token = (typeof window !== 'undefined' && localStorage.getItem('token')) || '';
    return {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };
};


export async function getYeuCauHistory(id: number) {
    const token = localStorage.getItem('token') ?? '';

    const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
    const buildUrl = (path: string) =>
        path.startsWith('/')
            ? `${base}${path}`
            : `${base}/${path}`;

    // endpoint chính
    const url = buildUrl(`/admin/yeucau/${id}/lich-su`);

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
    });
    return res.json();
}
export async function listWarehouses() {
    return api('/kho');
}

export async function stockByWarehouse(khoId: number) {
    return api(`/kho/${khoId}/ton`);
}


export async function historyWarehouse(khoId:number, params:any = {}) {
    const usp = new URLSearchParams(params).toString();
    return api(`/kho/${khoId}/lich-su${usp ? `?${usp}` : ''}`);
}

export async function nhapKho(payload: {
    kho_to_id: number; ghi_chu?: string;
    items: { vat_tu_id: number; so_luong: number; don_vi?: string }[];
}) {
    return api('/kho/nhap', { method: 'POST', body: JSON.stringify(payload) });
}

export async function xuatKho(payload: {
    kho_from_id: number; ghi_chu?: string;
    items: { vat_tu_id: number; so_luong: number; don_vi?: string }[];
}) {
    return api('/kho/xuat', { method: 'POST', body: JSON.stringify(payload) });
}

export async function chuyenKho(payload: {
    kho_from_id: number; kho_to_id: number; ghi_chu?: string;
    items: { vat_tu_id: number; so_luong: number; don_vi?: string }[];
}) {
    return api('/kho/chuyen', { method: 'POST', body: JSON.stringify(payload) });
}

export async function createWarehouse(payload: {
    ten: string; mo_ta?: string; cum_id?: number; dia_chi?: string; ghichu?: string;
}) {
    return api('/kho', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateWarehouse(id:number, payload: {
    ten: string; mo_ta?: string; cum_id?: number; dia_chi?: string; ghichu?: string;
}) {
    return api(`/kho/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deleteWarehouse(id:number) {
    return api(`/kho/${id}`, { method: 'DELETE' });
}

export async function dsvattu(params: any = {}) {
    const usp = new URLSearchParams(params).toString();
    return api(`/dsvattu${usp ? "?" + usp : ""}`);
}
export async function listVatTu(params: any = {}) {
    const usp = new URLSearchParams(params).toString();
    return api(`/vattu${usp ? "?" + usp : ""}`);
}
export async function createVatTu(body: any) {
    return api(`/vattu`, { method: "POST", body: JSON.stringify(body) });
}
export async function updateVatTu(id: number, body: any) {
    return api(`/vattu/${id}`, { method: "PUT", body: JSON.stringify(body) });
}
export async function deleteVatTu(id: number) {
    return api(`/vattu/${id}`, { method: "DELETE" });
}
// USERS
export async function listUsers(params:any = {}) {
    const usp = new URLSearchParams(params).toString();
    return api(`/users${usp ? `?${usp}` : ''}`);
}
export async function createUser(body:any) {
    return api(`/users`, { method:'POST', body: JSON.stringify(body) });
}
export async function updateUser(id:number, body:any) {
    return api(`/users/${id}`, { method:'PUT', body: JSON.stringify(body) });
}
export async function deleteUser(id:number) {
    return api(`/users/${id}`, { method:'DELETE' });
}

// ROLES
export async function listRoles() {
    return api(`/roles`);
}
export async function createRole(body:{name:string}) {
    return api(`/roles`, { method:'POST', body: JSON.stringify(body) });
}
export async function updateRole(id:number, body:{name:string}) {
    return api(`/roles/${id}`, { method:'PUT', body: JSON.stringify(body) });
}
export async function deleteRole(id:number) {
    return api(`/roles/${id}`, { method:'DELETE' });
}
export async function listPermissions() {
    return api('/permissions'); // trả về data: Permission[]
}

export async function getRolePermissions(roleId: number) {
    return api(`/roles/${roleId}/permissions`); // { role, permission_ids }
}

export async function saveRolePermissions(roleId: number, permission_ids: number[]) {
    return api(`/roles/${roleId}/permissions`, {
        method: 'POST',
        body: JSON.stringify({ permission_ids }),
    });
}
export async function claimYeuCau(id: number) {
    return api(`/yeucau/${id}/nhan-xu-ly`, { method: 'POST' });
}
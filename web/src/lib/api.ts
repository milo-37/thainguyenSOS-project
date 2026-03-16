export const API = "/api";

// ==============================
// CORE JSON API
// ==============================
export async function api(path: string, init: RequestInit = {}) {
  const url = `${API}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
  let message = 'Có lỗi xảy ra';

  try {
    const errorData = await res.json();
    message = errorData?.message || message;
  } catch {
    try {
      message = await res.text();
    } catch {
      message = 'Có lỗi xảy ra';
    }
  }

  throw new Error(message);
}

  return res.json();
}

export async function getCurrentUser() {
  return api('/me');
}

// ==============================
// MULTIPART API
// ==============================
export async function apiForm(path: string, fd: FormData) {
  const url = `${API}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    method: "POST",
    body: fd,
    headers,
  });

  if (!res.ok) {
  let message = 'Có lỗi xảy ra';

  try {
    const errorData = await res.json();
    message = errorData?.message || message;
  } catch {
    try {
      message = await res.text();
    } catch {
      message = 'Có lỗi xảy ra';
    }
  }

  throw new Error(message);
}

  return res.json();
}

// ==============================
// CỤM
// ==============================
export async function listClusters(q?: string, page = 1) {
  return api(`/cum?q=${encodeURIComponent(q || "")}&page=${page}`);
}

export async function getCluster(id: number) {
  return api(`/cum/${id}`);
}

export async function createCluster(payload: any) {
  return api(`/cum`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCluster(id: number, payload: any) {
  return api(`/cum/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCluster(id: number) {
  return api(`/cum/${id}`, {
    method: "DELETE",
  });
}

// ==============================
// YÊU CẦU - PUBLIC / USER
// ==============================
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
  body: { cum_id?: number; user_id?: number; ghi_chu?: string }
) {
  return api(`/yeucau/${id}/assign`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function claimYeuCau(id: number) {
  return api(`/yeucau/${id}/nhan-xu-ly`, {
    method: "POST",
  });
}

// ==============================
// KHO
// ==============================
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
  return api(`/kho/nhap`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function khoXuat(body: any) {
  return api(`/kho/xuat`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function khoChuyen(body: any) {
  return api(`/kho/chuyen`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listWarehouses() {
  return api("/kho");
}

export async function stockByWarehouse(khoId: number) {
  return api(`/kho/${khoId}/ton`);
}

export async function historyWarehouse(khoId: number, params: any = {}) {
  const usp = new URLSearchParams(params).toString();
  return api(`/kho/${khoId}/lich-su${usp ? `?${usp}` : ""}`);
}

export async function nhapKho(payload: {
  kho_to_id: number;
  ghi_chu?: string;
  items: { vat_tu_id: number; so_luong: number; don_vi?: string }[];
}) {
  return api("/kho/nhap", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function xuatKho(payload: {
  kho_from_id: number;
  ghi_chu?: string;
  items: { vat_tu_id: number; so_luong: number; don_vi?: string }[];
}) {
  return api("/kho/xuat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function chuyenKho(payload: {
  kho_from_id: number;
  kho_to_id: number;
  ghi_chu?: string;
  items: { vat_tu_id: number; so_luong: number; don_vi?: string }[];
}) {
  return api("/kho/chuyen", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createWarehouse(payload: {
  ten: string;
  mo_ta?: string;
  cum_id?: number;
  dia_chi?: string;
  ghichu?: string;
}) {
  return api("/kho", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWarehouse(
  id: number,
  payload: {
    ten: string;
    mo_ta?: string;
    cum_id?: number;
    dia_chi?: string;
    ghichu?: string;
  }
) {
  return api(`/kho/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteWarehouse(id: number) {
  return api(`/kho/${id}`, {
    method: "DELETE",
  });
}

// ==============================
// THỐNG KÊ + ADMIN YÊU CẦU
// ==============================
export async function thongKe(params: any = {}) {
  const usp = new URLSearchParams(params).toString();
  return api(`/thongke${usp ? "?" + usp : ""}`);
}

export async function listYeuCauAdmin(
  params: any = {},
  init: RequestInit = {}
) {
  const usp = new URLSearchParams(params).toString();
  return api(`/admin/yeucau${usp ? "?" + usp : ""}`, init);
}

export async function quickUpdateTrangThai(
  id: number,
  trang_thai:
    | "tiep_nhan"
    | "dang_xu_ly"
    | "da_chuyen_cum"
    | "da_hoan_thanh"
    | "huy",
  ghi_chu: string
) {
  return api(`/admin/yeucau/${id}/cap-nhat-trang-thai`, {
    method: "POST",
    body: JSON.stringify({
      trang_thai,
      ghi_chu,
    }),
  });
}

export async function transferAssignment(
  id: number,
  payload: { cum_id: number; user_id?: number; ghi_chu?: string }
) {
  return api(`/admin/yeucau/${id}/chuyen-xu-ly`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getYeuCauHistory(id: number) {
  return api(`/admin/yeucau/${id}/lich-su`);
}

// ==============================
// VẬT TƯ
// ==============================
export async function dsvattu(params: any = {}) {
  const usp = new URLSearchParams(params).toString();
  return api(`/dsvattu${usp ? "?" + usp : ""}`);
}

export async function listVatTu(params: any = {}) {
  const usp = new URLSearchParams(params).toString();
  return api(`/vattu${usp ? "?" + usp : ""}`);
}

export async function createVatTu(body: any) {
  return api(`/vattu`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateVatTu(id: number, body: any) {
  return api(`/vattu/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteVatTu(id: number) {
  return api(`/vattu/${id}`, {
    method: "DELETE",
  });
}

// ==============================
// USERS
// ==============================
export async function listUsers(params: any = {}) {
  const usp = new URLSearchParams(params).toString();
  return api(`/users${usp ? `?${usp}` : ""}`);
}

export async function getUser(id: number | string) {
  return api(`/admin/users/${id}`);
}

export async function createUser(body: any) {
  return api(`/users`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateUser(id: number, body: any) {
  return api(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteUser(id: number) {
  return api(`/users/${id}`, {
    method: "DELETE",
  });
}

// ==============================
// ROLES / PERMISSIONS
// ==============================
export async function listRoles() {
  return api(`/admin/roles`);
}

export async function createRole(body: { name: string }) {
  return api(`/admin/roles`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateRole(id: number, body: { name: string }) {
  return api(`/admin/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteRole(id: number) {
  return api(`/admin/roles/${id}`, {
    method: "DELETE",
  });
}

export async function listPermissions() {
  return api(`/admin/permissions`);
}

export async function getRolePermissions(roleId: number) {
  return api(`/admin/roles/${roleId}/permissions`);
}

export async function saveRolePermissions(
  roleId: number,
  permission_ids: number[]
) {
  return api(`/admin/roles/${roleId}/permissions`, {
    method: "POST",
    body: JSON.stringify({ permission_ids }),
  });
}
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export function getToken() {
  return localStorage.getItem("token");
}

export function setToken(token) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

/**
 * request("/auth/login", { method:"POST", body:{ username, password } })
 * => trả về JSON từ backend (kể cả lỗi 4xx/5xx, nếu backend trả JSON).
 */
export async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    auth = true, // tự gắn Bearer token nếu có
  } = options;

  const token = auth ? getToken() : null;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw ? { message: raw } : null;
  }

  // Chuẩn hoá lỗi: luôn có success=false để FE dễ xử lý
  if (!res.ok) {
    if (data && typeof data === "object") {
      return {
        success: data.success ?? false,
        ...data,
        status: res.status,
      };
    }
    return { success: false, status: res.status, message: `HTTP ${res.status}` };
  }

  return data ?? { success: true };
}

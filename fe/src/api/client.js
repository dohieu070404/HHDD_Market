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

function friendlyHttpMessage(status) {
  switch (status) {
    case 0:
      return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau.";
    case 400:
      return "Dữ liệu không hợp lệ.";
    case 401:
      return "Bạn cần đăng nhập để tiếp tục.";
    case 403:
      return "Bạn không có quyền thực hiện thao tác này.";
    case 404:
      return "Không tìm thấy dữ liệu yêu cầu.";
    case 409:
      return "Dữ liệu đã tồn tại hoặc bị xung đột.";
    case 422:
      return "Dữ liệu không hợp lệ.";
    case 500:
      return "Hệ thống đang bận. Vui lòng thử lại sau.";
    default:
      return `Lỗi HTTP ${status}`;
  }
}

/**
 * request("/auth/login", { method:"POST", body:{ username, password } })
 * => trả về JSON từ backend (kể cả lỗi 4xx/5xx, nếu backend trả JSON).
 */
export async function request(path, options = {}) {
  const { method = "GET", body, headers = {}, auth = true } = options;

  const token = auth ? getToken() : null;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return { success: false, status: 0, message: friendlyHttpMessage(0) };
  }

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // Nếu server trả về text, vẫn hiển thị gọn gàng, không show stacktrace/HTML
    data = raw ? { message: String(raw).slice(0, 200) } : null;
  }

  // Chuẩn hoá lỗi: luôn có success=false để FE dễ xử lý
  if (!res.ok) {
    if (data && typeof data === "object") {
      return {
        success: data.success ?? false,
        ...data,
        message: data.message || friendlyHttpMessage(res.status),
        status: res.status,
      };
    }
    return { success: false, status: res.status, message: friendlyHttpMessage(res.status) };
  }

  return data ?? { success: true };
}

// Multipart/form-data helper (for uploading files)
export async function requestFormData(path, options = {}) {
  const { method = "POST", formData, headers = {}, auth = true } = options;
  const token = auth ? getToken() : null;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: formData,
    });
  } catch {
    return { success: false, status: 0, message: friendlyHttpMessage(0) };
  }

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw ? { message: String(raw).slice(0, 200) } : null;
  }

  if (!res.ok) {
    if (data && typeof data === "object") {
      return {
        success: data.success ?? false,
        ...data,
        message: data.message || friendlyHttpMessage(res.status),
        status: res.status,
      };
    }
    return { success: false, status: res.status, message: friendlyHttpMessage(res.status) };
  }

  return data ?? { success: true };
}

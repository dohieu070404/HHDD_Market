import { getToken } from "../api/client";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

/**
 * Upload multipart/form-data with progress (XHR).
 * Returns parsed JSON.
 */
export function uploadWithProgress({ path, formData, method = "POST", onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE}${path}`, true);

    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      onProgress?.(pct);
    };

    xhr.onload = () => {
      const raw = xhr.responseText || "";
      let json = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json ?? { success: true });
      } else {
        reject({ status: xhr.status, data: json });
      }
    };

    xhr.onerror = () => reject({ status: 0, data: null });
    xhr.send(formData);
  });
}

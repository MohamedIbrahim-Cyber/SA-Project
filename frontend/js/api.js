const API_BASE = "http://localhost:5000/api";

const api = {
  getToken: () => localStorage.getItem("uni_token"),
  setToken: (t) => localStorage.setItem("uni_token", t),
  clearToken: () => localStorage.removeItem("uni_token"),

  async request(endpoint, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw { status: res.status, ...data };
    }
    return data;
  },
};
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://api.kaidz.xyz/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Gắn JWT token vào Header của mọi request nếu có
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Xử lý khi token hết hạn hoặc không hợp lệ (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (credentials) => api.post("/auth/login", credentials).then((res) => res.data),
  register: (data) => api.post("/auth/register", data).then((res) => res.data),
  getMe: () => api.get("/auth/me").then((res) => res.data),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }).then((res) => res.data),
  resetPassword: (data) => api.post("/auth/reset-password", data).then((res) => res.data),
  loginGoogle: (data) => api.post("/auth/google", data).then((res) => res.data),
};

export const bankApi = {
  getBanks: () => api.get("/banks").then((res) => res.data),
};

export const groupApi = {
  getGroups: () => api.get("/groups").then((res) => res.data),
  getGroup: (id) => api.get(`/groups/${id}`).then((res) => res.data),
  createGroup: (data) => api.post("/groups", data).then((res) => res.data),
  getMembers: async (groupId) => {
    try {
      const res = await api.get(`/groups/${groupId}/members`);
      return res.data;
    } catch {
      const grp = await api.get(`/groups/${groupId}`);
      return grp.data?.members || [];
    }
  },
  addMember: (groupId, memberData) =>
    api.post(`/groups/${groupId}/members`, memberData).then((res) => res.data),
  getGroupTransactions: (groupId, params) =>
    api.get(`/groups/${groupId}/transactions`, { params }).then((res) => res.data),
};

export const transactionApi = {
  createTransaction: (groupId, data) =>
    api.post(`/groups/${groupId}/transactions`, data).then((res) => res.data),
  getTransaction: (id) => api.get(`/transactions/${id}`).then((res) => res.data),
};

export const paymentRequestApi = {
  getMyDebts: () => api.get("/payment-requests", { params: { type: "DEBT" } }).then((res) => res.data),
  getMyCredits: () => api.get("/payment-requests", { params: { type: "CREDIT" } }).then((res) => res.data),
  getPaymentRequests: (params) => api.get("/payment-requests", { params }).then((res) => res.data),
  confirmPaid: (id) => api.post(`/payment-requests/${id}/confirm-payment`).then((res) => res.data),
  approve: (id) => api.post(`/payment-requests/${id}/approve`).then((res) => res.data),
  reject: (id) => api.post(`/payment-requests/${id}/reject`).then((res) => res.data),
  getQr: (id) => api.get(`/payment-requests/${id}/qr`).then((res) => res.data),
};

export const paymentInfoApi = {
  getMyInfo: () => api.get("/payment-info/me").then((res) => res.data),
  saveMyInfo: (data) => api.put("/payment-info/me", data).then((res) => res.data),
};

export default api;

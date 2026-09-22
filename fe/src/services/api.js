import axios from "axios";
import { cookieUtils } from "../utils/cookie";
import { createPendingRequests } from "./pendingRequests";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://api.kaidz.xyz/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

const sharePending = createPendingRequests();
function read(url, config = {}) {
  const token = cookieUtils.get("token") || localStorage.getItem("token");
  const key = JSON.stringify([token, url, config.params || {}]);
  return sharePending(key, () => api.get(url, config).then((res) => res.data));
}

// Gắn JWT token đọc từ Cookie vào Header của mọi request nếu có
api.interceptors.request.use(
  (config) => {
    const token = cookieUtils.get("token") || localStorage.getItem("token");
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
      cookieUtils.remove("token");
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (credentials) => api.post("/auth/login", credentials).then((res) => res.data),
  register: (data) => api.post("/auth/register", data).then((res) => res.data),
  verifyEmail: (token) => api.post("/auth/verify-email", { token }).then((res) => res.data),
  resendVerification: (email) => api.post("/auth/resend-verification", { email }).then((res) => res.data),
  getMe: () => read("/auth/me"),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }).then((res) => res.data),
  resetPassword: (data) => api.post("/auth/reset-password", data).then((res) => res.data),
  loginGoogle: (data) => api.post("/auth/google", data).then((res) => res.data),
};

export const bankApi = {
  getBanks: () => api.get("/banks").then((res) => res.data),
};

export const groupApi = {
  getGroups: () => read("/groups"),
  getGroup: (id) => read(`/groups/${id}`),
  createGroup: (data) => api.post("/groups", data).then((res) => res.data),
  getMembers: (groupId) => read(`/groups/${groupId}/members`),
  addMember: (groupId, memberData) =>
    api.post(`/groups/${groupId}/members`, memberData).then((res) => res.data),
  getGroupTransactions: (groupId, params) =>
    read(`/groups/${groupId}/transactions`, { params }),
};

export const transactionApi = {
  createTransaction: (groupId, data) =>
    api.post(`/groups/${groupId}/transactions`, data).then((res) => res.data),
  getTransaction: (id) => api.get(`/transactions/${id}`).then((res) => res.data),
};

export const paymentRequestApi = {
  getMyDebts: () => read("/payment-requests", { params: { type: "DEBT" } }),
  getMyCredits: () => read("/payment-requests", { params: { type: "CREDIT" } }),
  getPaymentRequests: (params) => read("/payment-requests", { params }),
  getDetail: (id) => api.get(`/payment-requests/${id}`).then((res) => res.data),
  confirmPaid: (id) => api.post(`/payment-requests/${id}/confirm-payment`).then((res) => res.data),
  approve: (id) => api.post(`/payment-requests/${id}/approve`).then((res) => res.data),
  reject: (id) => api.post(`/payment-requests/${id}/reject`).then((res) => res.data),
  getQr: (id) => api.get(`/payment-requests/${id}/qr`).then((res) => res.data),
};

export const statementApi = {
  getGroupStatements: (groupId) => api.get(`/groups/${groupId}/statements`).then((res) => res.data),
  getStatementDetail: (groupId, periodId) =>
    api.get(`/groups/${groupId}/statements/${periodId}`).then((res) => res.data),
};

export const adminOutboxApi = {
  getOutboxList: (params) => api.get("/admin/outbox", { params }).then((res) => res.data),
  getOutboxDetail: (id) => api.get(`/admin/outbox/${id}`).then((res) => res.data),
  retryOutbox: (id) => api.post(`/admin/outbox/${id}/retry`).then((res) => res.data),
  cancelOutbox: (id) => api.post(`/admin/outbox/${id}/cancel`).then((res) => res.data),
};

export const paymentInfoApi = {
  getMyInfo: () => read("/payment-info/me"),
  saveMyInfo: (data) => api.put("/payment-info/me", data).then((res) => res.data),
};

export default api;

import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";


const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});


// Attach JWT token to requests if available
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

// Intercept 401 response
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      // Optional: localStorage.removeItem("token");
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (credentials) => api.post("/auth/login", credentials).then((res) => res.data),
  register: (data) => api.post("/auth/register", data).then((res) => res.data),
  getMe: () => api.get("/auth/me").then((res) => res.data),
};

export const groupApi = {
  getGroups: () => api.get("/groups").then((res) => res.data),
  getGroup: (id) => api.get(`/groups/${id}`).then((res) => res.data),
  createGroup: (data) => api.post("/groups", data).then((res) => res.data),
  getMembers: (groupId) => api.get(`/groups/${groupId}/members`).then((res) => res.data),
  addMember: (groupId, memberData) => api.post(`/groups/${groupId}/members`, memberData).then((res) => res.data),
  getGroupTransactions: (groupId, params) =>
    api.get(`/groups/${groupId}/transactions`, { params }).then((res) => res.data),
};

export const transactionApi = {
  createTransaction: (data) => api.post("/transactions", data).then((res) => res.data),
  getTransaction: (id) => api.get(`/transactions/${id}`).then((res) => res.data),
};

export const paymentRequestApi = {
  getMyDebts: () => api.get("/payment-requests/my-debts").then((res) => res.data),
  getMyCredits: () => api.get("/payment-requests/my-credits").then((res) => res.data),
  confirmPaid: (id) => api.post(`/payment-requests/${id}/confirm-paid`).then((res) => res.data),
  approve: (id) => api.post(`/payment-requests/${id}/approve`).then((res) => res.data),
  reject: (id) => api.post(`/payment-requests/${id}/reject`).then((res) => res.data),
  getQr: (id) => api.get(`/payment-requests/${id}/qr`).then((res) => res.data),
};

export const paymentInfoApi = {
  getMyInfo: () => api.get("/payment-info/me").then((res) => res.data),
  saveMyInfo: (data) => api.post("/payment-info", data).then((res) => res.data),
};

export default api;

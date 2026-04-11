import axios from "axios";
import Cookies from "js-cookie";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Attach active organization context
  const orgId = Cookies.get("active_org_id");
  if (orgId) {
    config.headers["X-Org-Id"] = orgId;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = Cookies.get("refresh_token");
        if (!refreshToken) {
          throw new Error("No refresh token");
        }

        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/auth/refresh`,
          { refreshToken },
        );

        Cookies.set("access_token", data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        Cookies.remove("access_token");
        Cookies.remove("refresh_token");
        Cookies.remove("active_org_id");
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;

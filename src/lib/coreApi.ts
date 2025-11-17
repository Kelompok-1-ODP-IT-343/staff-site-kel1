import axios, { AxiosHeaders } from "axios";

// Resolve and normalize API base URLs from environment variables once
const resolveBaseUrl = (envValue: string | undefined, fallback: string) => {
  const raw = (envValue && envValue.trim()) || fallback;
  // Remove any trailing slashes to avoid accidental double slashes in requests
  return raw.replace(/\/+$/, "");
};

// Build core API base from host + "/api/v1"
const CORE_HOST = resolveBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  "http://localhost:18080",
);
const CORE_API_BASE = `${CORE_HOST}/api/v1`;

// Credit score base: use /api/v2. If env includes /api/v*, force v2; else append /api/v2.
const resolveCreditApiV2Base = (
  envValue: string | undefined,
  hostFallback: string,
) => {
  const raw = (envValue && envValue.trim()) || hostFallback;
  const clean = raw.replace(/\/+$/, "");
  if (/\/api\/v\d+$/i.test(clean)) {
    return clean.replace(/\/api\/v\d+$/i, "/api/v2");
  }
  return `${clean}/api/v2`;
};

const CREDIT_SCORE_API_BASE = resolveCreditApiV2Base(
  process.env.NEXT_PUBLIC_CREDIT_SCORE_API_URL,
  CORE_HOST,
);

// Axios instance untuk seluruh request ke API Satu Atap
const coreApi = axios.create({
  baseURL: CORE_API_BASE,
  timeout: 150000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Axios instance khusus untuk refresh token agar tidak terkena loop interceptor
export const refreshClient = axios.create({
  baseURL: CORE_API_BASE,
  timeout: 150000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Axios instance untuk Credit Score API (Java service)
const creditScoreApi = axios.create({
  baseURL: CREDIT_SCORE_API_BASE,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Cookie helpers
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!value) return null;
  try {
    return decodeURIComponent(value.split("=")[1]);
  } catch {
    return value.split("=")[1];
  }
}

function setCookieMaxAge(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const isHttps =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const encoded = encodeURIComponent(value);
  document.cookie = `${name}=${encoded}; max-age=${maxAgeSeconds}; path=/; ${isHttps ? "secure; " : ""}SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  const isHttps =
    typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = `${name}=; max-age=0; path=/; ${isHttps ? "secure; " : ""}SameSite=Lax`;
}

// Cleanup legacy cookies that are no longer used
try {
  if (typeof window !== "undefined") {
    deleteCookie("access_token");
    deleteCookie("refresh_token");
    deleteCookie("refresh_expires_at");
  }
} catch {}

// Interceptor: sisipkan Authorization jika ada token di cookie
coreApi.interceptors.request.use((config) => {
  try {
      if (typeof window !== "undefined") {
      const token = getCookie("token");
      if (token) {
        const authHeader = `Bearer ${token}`;
        if (config.headers instanceof AxiosHeaders) {
          config.headers.set("Authorization", authHeader);
        } else {
          config.headers = new AxiosHeaders(config.headers as any);
          config.headers.set("Authorization", authHeader);
        }
      }
    }
  } catch {
    // abaikan jika cookie tidak tersedia
  }
  return config;
});

// Ensure Credit Score API also attaches Authorization from cookie
creditScoreApi.interceptors.request.use((config) => {
  try {
      if (typeof window !== "undefined") {
      const token = getCookie("token");
      if (token) {
        const authHeader = `Bearer ${token}`;
        if (config.headers instanceof AxiosHeaders) {
          config.headers.set("Authorization", authHeader);
        } else {
          config.headers = new AxiosHeaders(config.headers as any);
          config.headers.set("Authorization", authHeader);
        }
      }
    }
  } catch {}
  return config;
});

// Flag to prevent multiple refresh token requests
let isRefreshing = false;
let failedQueue: { resolve: (token: string | null) => void; reject: (err: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor response: handle 401 errors and token refresh
coreApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401/403 and we haven't tried to refresh the token yet
    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        // If refresh is already in progress, queue this request
        try {
          const token = await new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          if (originalRequest.headers instanceof AxiosHeaders) {
            (originalRequest.headers as AxiosHeaders).set(
              "Authorization",
              `Bearer ${token}`,
            );
          } else {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
          }
          return coreApi(originalRequest);
        } catch (err) {
          return Promise.reject(err);
        }
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Get the refresh token from cookie
        const refreshToken =
          typeof window !== "undefined" ? getCookie("refreshToken") : null;
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        // Call refresh token endpoint via dedicated client
        const response = await refreshClient.post("/auth/refresh", {
          refreshToken,
        });

        const respData = response?.data ?? {};
        const token = respData?.data?.token ?? respData?.token;
        const newRefresh =
          respData?.data?.refreshToken ?? respData?.refreshToken;
        const isOk = Boolean(token);
        if (isOk) {
          if (typeof window !== "undefined") {
            // Update cookies: token 15 menit, refreshToken 24 jam
            setCookieMaxAge("token", token, 15 * 60);
            if (newRefresh) {
              setCookieMaxAge("refreshToken", newRefresh, 24 * 60 * 60);
            }
          }

          // Update authorization header
          if (originalRequest.headers instanceof AxiosHeaders) {
            (originalRequest.headers as AxiosHeaders).set(
              "Authorization",
              `Bearer ${token}`,
            );
          } else {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
          }

          // Process queued requests
          processQueue(null, token);

          // Retry the original request
          return coreApi(originalRequest);
        } else {
          processQueue(new Error("Failed to refresh token"));
          // Clear tokens and redirect to login
          if (typeof window !== "undefined") {
            deleteCookie("token");
            deleteCookie("refreshToken");
            window.location.href = "/login";
          }
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError);
        // Clear tokens and redirect to login
        if (typeof window !== "undefined") {
          deleteCookie("token");
          deleteCookie("refreshToken");
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // No fallback logout for 401/403 here; only refresh failure triggers logout.

    return Promise.reject(error);
  },
);

// Apply same refresh logic for creditScoreApi so requests retry after refresh
creditScoreApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        try {
          const token = await new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          if (originalRequest.headers instanceof AxiosHeaders) {
            (originalRequest.headers as AxiosHeaders).set(
              "Authorization",
              `Bearer ${token}`,
            );
          } else {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
          }
          return creditScoreApi(originalRequest);
        } catch (err) {
          return Promise.reject(err);
        }
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshToken =
          typeof window !== "undefined" ? getCookie("refreshToken") : null;
        if (!refreshToken) throw new Error("No refresh token available");
        const response = await refreshClient.post("/auth/refresh", {
          refreshToken,
        });
        const respData = response?.data ?? {};
        const token = respData?.data?.token ?? respData?.token;
        const newRefresh =
          respData?.data?.refreshToken ?? respData?.refreshToken;
        const isOk = Boolean(token);
        if (isOk) {
          if (typeof window !== "undefined") {
            setCookieMaxAge("token", token, 15 * 60);
            if (newRefresh)
              setCookieMaxAge("refreshToken", newRefresh, 24 * 60 * 60);
          }
          if (originalRequest.headers instanceof AxiosHeaders) {
            (originalRequest.headers as AxiosHeaders).set(
              "Authorization",
              `Bearer ${token}`,
            );
          } else {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
          }
          processQueue(null, token);
          return creditScoreApi(originalRequest);
        } else {
          processQueue(new Error("Failed to refresh token"));
          if (typeof window !== "undefined") {
            deleteCookie("token");
            deleteCookie("refreshToken");
            window.location.href = "/login";
          }
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError);
        if (typeof window !== "undefined") {
          deleteCookie("token");
          deleteCookie("refreshToken");
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default coreApi;

// User Profile API functions
export const getUserProfile = async () => {
  try {
    const response = await coreApi.get("/user/profile");
    return response.data;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw error;
  }
};

// Update User Profile by ID, prefer /user/{id} with fallback to /users/{id}
export const updateUserProfile = async (
  userId: number | string,
  payload: {
    fullName: string;
    username: string;
    phone: string;
    companyName?: string;
  },
) => {
  const id = String(userId || 1);
  try {
    const response = await coreApi.put(`/user/${id}`, payload);
    return response.data;
  } catch (error: any) {
    // Fallback to alternate path if necessary
    if (error?.response?.status === 404 || error?.response?.status === 405) {
      const resp2 = await coreApi.put(`/users/${id}`, payload);
      return resp2.data;
    }
    console.error("Error updating user profile:", error);
    throw error;
  }
};

// Notifications API
export const getUserNotifications = async () => {
  try {
    const response = await coreApi.get(`/notifications/user`);
    const data = (response as any)?.data;
    return data?.data ?? data ?? [];
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    throw error;
  }
};

// KPR Applications API functions
export const getKPRApplicationsProgress = async () => {
  try {
    // Verifikator endpoint sesuai spesifikasi backend
    const response = await coreApi.get(
      "/kpr-applications/verifikator/progress",
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching KPR applications progress:", error);
    throw error;
  }
};

export const getKPRApplicationDetail = async (applicationId: string) => {
  try {
    const response = await coreApi.get(`/kpr-applications/${applicationId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching KPR application detail:", error);
    throw error;
  }
};

export const approveKPRApplication = async (
  applicationId: string,
  approvalNotes: string,
) => {
  try {
    const response = await coreApi.post(`/approval/verifikator`, {
      isApproved: true,
      reason: approvalNotes || "",
      applicationId: parseInt(applicationId),
    });
    return response.data;
  } catch (error) {
    console.error("Error approving KPR application:", error);
    throw error;
  }
};

export const rejectKPRApplication = async (
  applicationId: string,
  rejectionReason: string,
) => {
  try {
    const response = await coreApi.post(`/approval/verifikator`, {
      isApproved: false,
      reason: rejectionReason || "",
      applicationId: parseInt(applicationId),
    });
    return response.data;
  } catch (error) {
    console.error("Error rejecting KPR application:", error);
    throw error;
  }
};

export const getCreditScore = async (userId: string) => {
  try {
    const response = await creditScoreApi.post(`/credit-score`, {
      user_id: userId,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching credit score:", error);
    throw error;
  }
};

// Credit Recommendation API
// Convenience wrapper: provide applicationId, this will fetch the application detail
// from coreApi and post to the recommendation-system endpoint on the credit score API.
export const getCreditRecommendation = async (applicationId: string) => {
  try {
    // Fetch application detail first (reusing existing helper which returns response.data)
    const appDetail = await getKPRApplicationDetail(applicationId);

    // Some endpoints return { success, message, data }, some may return plain
    const payload = (appDetail as any)?.data ?? appDetail;

    const requestBody = {
      kprApplication: {
        success: true,
        message: "KPR application detail retrieved successfully",
        data: payload,
      },
    };

    const response = await creditScoreApi.post(
      `/recommendation-system`,
      requestBody,
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching credit recommendation:", error);
    throw error;
  }
};

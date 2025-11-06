import coreApi from "@/lib/coreApi";
import { decodeJWT, isTokenExpired } from "@/lib/jwtUtils";

type ApiError = {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "object" && error !== null) {
    const { response } = error as ApiError;
    const message = response?.data?.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return fallback;
};

// Keys used in localStorage
const LS_KEYS = {
  accessToken: "access_token",
  refreshToken: "refresh_token",
  refreshExpiresAt: "refresh_expires_at", // epoch ms when refresh token (client-side policy) expires
} as const;

// 24 hours in milliseconds
export const REFRESH_TTL_MS = 24 * 60 * 60 * 1000;

export function saveTokens(params: { accessToken: string; refreshToken?: string; refreshTtlMs?: number }) {
  if (typeof window === "undefined") return;
  const { accessToken, refreshToken, refreshTtlMs = REFRESH_TTL_MS } = params;
  localStorage.setItem(LS_KEYS.accessToken, accessToken);
  if (refreshToken) {
    localStorage.setItem(LS_KEYS.refreshToken, refreshToken);
    // If the refresh token is a JWT with exp, we'll still set client-side fallback expiry of 24h
    const expiresAt = Date.now() + refreshTtlMs;
    localStorage.setItem(LS_KEYS.refreshExpiresAt, String(expiresAt));
  }
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_KEYS.accessToken);
  localStorage.removeItem(LS_KEYS.refreshToken);
  localStorage.removeItem(LS_KEYS.refreshExpiresAt);
  localStorage.removeItem("user_name");
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_KEYS.accessToken);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_KEYS.refreshToken);
}

export function isRefreshExpired(): boolean {
  try {
    if (typeof window === "undefined") return true;
    const token = localStorage.getItem(LS_KEYS.refreshToken);
    if (!token) return true;

    // Prefer JWT exp if the refresh token is a JWT
    const isJwt = token.split(".").length === 3;
    if (isJwt) {
      const payload = decodeJWT(token as string);
      if (!payload?.exp) return false; // if no exp, fall back below
      const nowSec = Math.floor(Date.now() / 1000);
      return payload.exp < nowSec;
    }

    // Fallback to client-side 24h TTL from stored timestamp
    const expiresAtStr = localStorage.getItem(LS_KEYS.refreshExpiresAt);
    if (!expiresAtStr) return false; // if not present, don't block refresh but server will decide
    const expiresAt = Number(expiresAtStr);
    return Date.now() > expiresAt;
  } catch {
    return true;
  }
}

export type LoginPayload = {
  identifier: string;
  password: string;
};

export type AuthSuccess = {
  success: true;
  token: string;
  user: {
    id: number;
    name: string;
    email?: string;
    role: string;
  };
};

export type AuthFailure = {
  success: false;
  message: string;
};

const APPROVER_ROLES = ["APPROVER"] as const;

const isApproverRole = (role: string | undefined | null): boolean => {
  if (!role) return false;
  const normalized = role.toUpperCase();
  return APPROVER_ROLES.some((allowed) => allowed === normalized);
};

export function getCurrentUser(): AuthSuccess["user"] | null {
  try {
    const token = localStorage.getItem(LS_KEYS.accessToken);
    if (!token || isTokenExpired(token)) {
      return null;
    }

    const payload = decodeJWT(token);
    if (!payload) return null;

    return {
      id: payload.userId,
      name: payload.sub,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export type LogoutResult = {
  success: boolean;
  message?: string;
};

export async function logout(): Promise<LogoutResult> {
  try {
    // Call the logout endpoint
    await coreApi.post(API_ENDPOINTS.LOGOUT);

    // Clear local storage
    clearTokens();

    return {
      success: true,
    };
  } catch (err: unknown) {
    console.error("Logout error:", err);

    // Still clear local storage even if the API call fails
    clearTokens();

    return {
      success: false,
      message: extractErrorMessage(err, "Logout failed"),
    };
  }
}

// Blueprint login: panggilan API asli dikomentari, return success
// API endpoints
const API_ENDPOINTS = {
  LOGIN: '/auth/login',    // This will be appended to the base URL from .env.local
  PROFILE: '/user/profile',
  LOGOUT: '/auth/logout'   // Will be /api/v1/auth/logout
};

export async function loginBlueprint(
  payload: LoginPayload
): Promise<AuthSuccess | AuthFailure> {
  try {
    // Make API call to your login endpoint
    const response = await coreApi.post(API_ENDPOINTS.LOGIN, {
      identifier: payload.identifier,
      password: payload.password
    });

    const { success, message, data } = response.data;
    
    if (success) {
      // Get user info from the JWT token
      const decodedToken = decodeJWT(data.token);
      
      if (!decodedToken) {
        return {
          success: false,
          message: "Invalid token received"
        };
      }

      // Store the JWT tokens with a 24h refresh TTL policy
      saveTokens({ accessToken: data.token, refreshToken: data.refreshToken, refreshTtlMs: REFRESH_TTL_MS });
      
      // Check if the user has the approver role
      if (!isApproverRole(decodedToken.role)) {
        return {
          success: false,
          message: "Access denied. This portal is only for approvers."
        };
      }

      return { 
        success: true, 
        token: data.token,
        user: {
          id: decodedToken.userId,
          name: decodedToken.sub,
          role: decodedToken.role
        }
      };
    }
    
    return {
      success: false,
      message: message || "Login failed"
    };
  } catch (err: unknown) {
    // Handle API errors
    console.error("Login error:", err);
    return {
      success: false,
      message: extractErrorMessage(err, "Login failed"),
    };
  }
}

// New: initiate login that may require OTP
export type LoginInitResult = {
  success: boolean;
  requiresOtp: boolean;
  message?: string;
};

export async function initiateLogin(
  payload: LoginPayload
): Promise<LoginInitResult> {
  try {
    const response = await coreApi.post('/auth/login', {
      identifier: payload.identifier,
      password: payload.password,
    });

    const { success, message, data } = response.data || {};

    if (!success) {
      return { success: false, requiresOtp: false, message: message || 'Login failed' };
    }

    // If token exists, login completed (no OTP required)
    if (data?.token) {
      const decodedToken = decodeJWT(data.token);
      if (!decodedToken) {
        return { success: false, requiresOtp: false, message: 'Invalid token received' };
      }
      // Persist tokens
      saveTokens({ accessToken: data.token, refreshToken: data.refreshToken, refreshTtlMs: REFRESH_TTL_MS });
      if (!isApproverRole(decodedToken.role)) {
        return { success: false, requiresOtp: false, message: 'Access denied. This portal is only for approvers.' };
      }
      return { success: true, requiresOtp: false };
    }

    // Otherwise assume OTP is required
    return { success: true, requiresOtp: true };
  } catch (err: unknown) {
    console.error("Initiate login error:", err);
    return {
      success: false,
      requiresOtp: false,
      message: extractErrorMessage(err, "Login failed"),
    };
  }
}

// New: verify OTP for login
export async function verifyOtpLogin(params: { identifier: string; otp: string }): Promise<AuthSuccess | AuthFailure> {
  try {
    const response = await coreApi.post('/auth/verify-otp', {
      identifier: params.identifier,
      otp: params.otp,
      purpose: 'login',
    });

    const { success, message, data } = response.data || {};
    if (!success) {
      return { success: false, message: message || 'OTP verification failed' };
    }

    if (!data?.token) {
      return { success: false, message: 'No token returned from OTP verification' };
    }

    const decodedToken = decodeJWT(data.token);
    if (!decodedToken) {
      return { success: false, message: 'Invalid token received' };
    }

    // Persist tokens
    saveTokens({ accessToken: data.token, refreshToken: data.refreshToken, refreshTtlMs: REFRESH_TTL_MS });

    if (!isApproverRole(decodedToken.role)) {
      return { success: false, message: 'Access denied. This portal is only for approvers.' };
    }

    return {
      success: true,
      token: data.token,
      user: {
        id: decodedToken.userId,
        name: decodedToken.sub,
        role: decodedToken.role,
      },
    };
  } catch (err: unknown) {
    console.error("Verify OTP error:", err);
    return {
      success: false,
      message: extractErrorMessage(err, "OTP verification failed"),
    };
  }
}

// Perform token refresh explicitly (normally handled by interceptor)
export async function refreshAccessToken(): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; message?: string }>{
  try {
    if (isRefreshExpired()) {
      return { success: false, message: "Refresh token expired" };
    }
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return { success: false, message: "No refresh token" };
    }

    const resp = await coreApi.post(
      '/auth/refresh',
      { refreshToken },
      { headers: { 'x-skip-auth': 'true' } } // ensure no Authorization header is attached
    );

    const { success, data, message } = resp.data || {};
    if (!success || !data?.token) {
      return { success: false, message: message || 'Failed to refresh token' };
    }

    // Save new tokens
    saveTokens({ accessToken: data.token, refreshToken: data.refreshToken, refreshTtlMs: REFRESH_TTL_MS });
    return { success: true, accessToken: data.token, refreshToken: data.refreshToken };
  } catch (err: unknown) {
    return {
      success: false,
      message: extractErrorMessage(err, "Failed to refresh token"),
    };
  }
}

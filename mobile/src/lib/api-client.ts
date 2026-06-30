// HTTP client for the self-hosted Arena API (VITE_API_URL, e.g. http://localhost:4000/api).

export let API_URL: string | undefined;
const isBrowser = typeof window !== "undefined";
if (isBrowser) {
  const envUrl = process.env.EXPO_PUBLIC_API_URL as string | undefined;
  if (envUrl && envUrl.includes('localhost')) {
    // Replace localhost with the current hostname to support LAN access
    API_URL = envUrl.replace('localhost', window.location.hostname);
  } else {
    API_URL = envUrl ?? `${window.location.protocol}//${window.location.hostname}:4000/api`;
  }
} else {
  // Server‑side rendering: use only the env variable (no window access)
  API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:4000/api";
}
const TOKEN_KEY = "arena_token";
const USER_KEY = "arena_user";

export const apiEnabled = Boolean(API_URL);

export type ApiUser = {
  id: string;
  email: string;
  employeeId?: string;
  role: "admin" | "hr" | "manager" | "employee";
  isApproved: boolean;
  isSuspended?: boolean;
  status: "pending" | "configured" | "active" | "suspended" | "rejected";
  mustChangePassword?: boolean;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getCachedUser(): ApiUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as ApiUser) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: ApiUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function clearSession() {
  setToken(null);
  setCachedUser(null);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new ApiError(0, "API is not configured (set VITE_API_URL)");

  const token = getToken();
  const fullUrl = `${API_URL}${path}`;

  if (__DEV__) {
    console.debug(`[api] ${method} ${fullUrl}`);
  }

  const res = await fetch(fullUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;

    if (__DEV__) {
      console.warn(`[api] ${method} ${fullUrl} → ${res.status}`, data);
    }

    throw new ApiError(res.status, msg, data);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export async function signup(input: {
  email: string;
  password: string;
  name: string;
  employeeId?: string;
}) {
  return api.post<{ token?: string; user?: ApiUser; message?: string }>("/auth/signup", input);
}

export async function login(input: { email: string; password: string }) {
  const res = await api.post<{ token: string; user: ApiUser }>("/auth/login", input);
  setToken(res.token);
  setCachedUser(res.user);
  return res;
}

export async function impersonate(employeeId: string) {
  const currentToken = getToken();
  const currentUser = getCachedUser();
  if (currentToken && currentUser && currentUser.role === "admin") {
    window.localStorage.setItem("arena_original_token", currentToken);
    window.localStorage.setItem("arena_original_user", JSON.stringify(currentUser));
  }

  const res = await api.post<{ token: string; user: ApiUser }>("/auth/impersonate", { employeeId });
  setToken(res.token);
  setCachedUser(res.user);
  return res;
}

export function revertImpersonation() {
  const originalToken = window.localStorage.getItem("arena_original_token");
  const originalUser = window.localStorage.getItem("arena_original_user");
  if (originalToken && originalUser) {
    setToken(originalToken);
    try {
      setCachedUser(JSON.parse(originalUser));
    } catch {
      setCachedUser(null);
    }
    window.localStorage.removeItem("arena_original_token");
    window.localStorage.removeItem("arena_original_user");
  }
}

export function isImpersonating(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.localStorage.getItem("arena_original_token");
}

export async function me() {
  return api.get<{ user: ApiUser }>("/auth/me");
}

export function applySession(token: string, user: ApiUser) {
  setToken(token);
  setCachedUser(user);
}

export function logout() {
  clearSession();
}

export async function health() {
  return api.get<{ ok: boolean; db: string; ts: number }>("/health");
}

export async function changePassword(newPassword: string) {
  const res = await api.post<{ user: ApiUser }>("/auth/change-password", { newPassword });
  setCachedUser(res.user);
  return res;
}

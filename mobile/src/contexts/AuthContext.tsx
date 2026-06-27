import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Employee } from "@/types/hr";
import {
  ApiError,
  apiEnabled,
  applySession,
  clearSession,
  getCachedUser,
  getToken,
  login as apiLogin,
  logout as apiLogout,
  me,
  setCachedUser,
  signup as apiSignup,
  changePassword as apiChangePassword,
  type ApiUser,
} from "@/lib/api-client";
import { fallbackEmployeeForUser, fetchEmployeeRoster, resolveActor } from "@/lib/employees-api";
import { setRoster } from "@/lib/roster";
import { resetSyncArenaData, syncArenaData } from "@/lib/data-sync";
import { useQueryClient } from "@tanstack/react-query";
import { getPermissions } from "@/api/permissions";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type { ApiUser } from "@/lib/api-client";

type AuthContextValue = {
  status: AuthStatus;
  user: ApiUser | null;
  actor: Employee | null;
  employees: Employee[];
  /** True after Mongo seed + store hydration finished for this session */
  dataReady: boolean;
  error: string | null;
  isLoading: boolean;
  apiEnabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    email: string;
    password: string;
    name: string;
    employeeId?: string;
  }) => Promise<"authenticated" | "pending_approval">;
  changePassword: (newPassword: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  refreshSession: () => Promise<void>;
  refreshOrgData: () => Promise<void>;
  switchRole: (appRole: ApiUser["role"], hrRole: Employee["role"]) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadSession(): Promise<{
  user: ApiUser;
  employees: Employee[];
  actor: Employee;
}> {
  const { user } = await me();
  const employees = await fetchEmployeeRoster(user);
  const actor = resolveActor(user, employees);
  setCachedUser(user);
  return { user, employees, actor };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [actor, setActor] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const runOrgSync = useCallback(async (sessionUser: ApiUser) => {
    setDataReady(false);
    const { employees: roster } = await syncArenaData(sessionUser);
    if (roster.length > 0) {
      setEmployees(roster);
      setActor((prev) => {
        const linked = roster.find((e) => e.id === sessionUser.employeeId);
        return linked ?? prev ?? resolveActor(sessionUser, roster);
      });
    }
    setDataReady(true);
    console.log('[AuthContext] dataReady set true');
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    resetSyncArenaData();
    setRoster([]);
    setUser(null);
    setActor(null);
    setEmployees([]);
    setDataReady(false);
    setError(null);
    setStatus("unauthenticated");
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) throw new Error("No token");
      const session = await loadSession();

      // Prefetch permissions so useRoleFeature has them immediately
      await queryClient.prefetchQuery({
        queryKey: ["permissions", session.user.role],
        queryFn: () => getPermissions(session.user.role),
      }).catch((err) => console.warn('[AuthContext] perm prefetch error:', err));

      setUser(session.user);
      setEmployees(session.employees);
      setActor(session.actor);
      setStatus("authenticated");
      // Fire-and-forget: hydrate stores in background so the UI renders immediately
      runOrgSync(session.user).catch((err) =>
        console.warn('[AuthContext] background sync error:', err)
      );
    } catch {
      logout();
    }
  }, [runOrgSync, logout]);

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await apiLogin({ email, password });
      const session = await loadSession();

      // Prefetch permissions so useRoleFeature has them immediately
      await queryClient.prefetchQuery({
        queryKey: ["permissions", session.user.role],
        queryFn: () => getPermissions(session.user.role),
      }).catch((err) => console.warn('[AuthContext] perm prefetch error:', err));

      setUser(session.user);
      setEmployees(session.employees);
      setActor(session.actor);
      setStatus("authenticated");
      // Fire-and-forget: hydrate stores in background
      runOrgSync(session.user).catch((err) =>
        console.warn('[AuthContext] background sync error:', err)
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Login failed";
      setError(msg);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [runOrgSync]);

  const signup = useCallback(
    async (input: { email: string; password: string; name: string; employeeId?: string }) => {
      setActionLoading(true);
      setError(null);
      try {
        const res = await apiSignup(input);
        if (res.token && res.user) {
          applySession(res.token, res.user);
          const session = await loadSession();
          setUser(session.user);
          setEmployees(session.employees);
          setActor(session.actor);
          setStatus("authenticated");
          await runOrgSync(session.user);
          return "authenticated" as const;
        }
        return "pending_approval" as const;
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Signup failed";
        setError(msg);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [runOrgSync],
  );

  const changePassword = useCallback(async (newPassword: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await apiChangePassword(newPassword);
      setUser(res.user);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Password reset failed";
      setError(msg);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    await bootstrap();
  }, [bootstrap]);

  const refreshOrgData = useCallback(async () => {
    if (!user) return;
    resetSyncArenaData();
    await runOrgSync(user);
  }, [user, runOrgSync]);

  const switchRole = useCallback((apiRole: ApiUser["role"], hrRole: Employee["role"]) => {
    setUser((prev) => {
      if (!prev) return null;
      return { ...prev, role: apiRole };
    });
    setActor((prev) => {
      if (!prev) return null;
      const actualAppRole = apiRole === "admin" ? "admin" : apiRole === "hr" ? "hr" : apiRole === "employee" ? "employee" : "manager";
      return { ...prev, role: hrRole, appRole: actualAppRole };
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      actor,
      employees,
      dataReady,
      error,
      isLoading: status === "loading" || actionLoading,
      apiEnabled,
      login,
      signup,
      changePassword,
      logout,
      clearError: () => setError(null),
      refreshSession,
      refreshOrgData,
      switchRole,
    }),
    [
      status,
      user,
      actor,
      employees,
      dataReady,
      error,
      actionLoading,
      login,
      signup,
      changePassword,
      logout,
      refreshSession,
      refreshOrgData,
      switchRole,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

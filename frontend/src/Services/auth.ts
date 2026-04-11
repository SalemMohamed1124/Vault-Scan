import Cookies from "js-cookie";
import type { AuthResponse, Organization, User } from "@/types";
import api from "@/lib/api";

const TOKEN_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const USER_KEY = "vault_user";
const ORGS_KEY = "vault_orgs";
const ACTIVE_ORG_KEY = "active_org_id";

// ─── Token helpers ───────────────────────────────
export function getAccessToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}

export function getRefreshToken(): string | undefined {
  return Cookies.get(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  Cookies.set(TOKEN_KEY, accessToken, { expires: 1 }); // 1 day (auto-refreshed)
  Cookies.set(REFRESH_KEY, refreshToken, { expires: 7 });
}

export function clearTokens(): void {
  Cookies.remove(TOKEN_KEY);
  Cookies.remove(REFRESH_KEY);
  Cookies.remove(ACTIVE_ORG_KEY);
  if (typeof window !== "undefined") {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ORGS_KEY);
  }
}

// ─── User / Org persistence ─────────────────────
export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getStoredOrgs(): Organization[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORGS_KEY);
    return raw ? (JSON.parse(raw) as Organization[]) : [];
  } catch {
    return [];
  }
}

export function setStoredOrgs(orgs: Organization[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(ORGS_KEY, JSON.stringify(orgs));
  }
}

export function getActiveOrgId(): string | undefined {
  return Cookies.get(ACTIVE_ORG_KEY);
}

export function setActiveOrgId(orgId: string): void {
  Cookies.set(ACTIVE_ORG_KEY, orgId, { expires: 30 });
}

// ─── Auth flow helpers ──────────────────────────
export function handleAuthResponse(data: AuthResponse): void {
  setTokens(data.accessToken, data.refreshToken);
  setStoredUser(data.user);
  setStoredOrgs(data.organizations);

  // Set first org as active if none set
  if (!getActiveOrgId() && data.organizations.length > 0) {
    setActiveOrgId(data.organizations[0].id);
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/login", {
    email,
    password,
  });
  handleAuthResponse(data);
  return data;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/register", {
    name,
    email,
    password,
  });
  handleAuthResponse(data);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/api/auth/logout");
  } catch {
    // ignore — clear tokens anyway
  }
  clearTokens();
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>("/api/auth/me");
  setStoredUser(data);
  return data;
}

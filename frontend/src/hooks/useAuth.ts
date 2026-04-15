"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Organization, User } from "@/types";
import {
  getActiveOrgId,
  getStoredOrgs,
  getStoredUser,
  isAuthenticated,
  logout as logoutFn,
  setActiveOrgId,
} from "@/Services/auth";

// ─── Simple external store for auth state ────────
let listeners: Array<() => void> = [];

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "{}";
  return JSON.stringify({
    isAuth: isAuthenticated(),
    user: getStoredUser(),
    orgs: getStoredOrgs(),
    activeOrgId: getActiveOrgId(),
  });
}

function getServerSnapshot(): string {
  return "{}";
}

// ─── Notify auth changes ────────────────────────
export function notifyAuthChange(): void {
  emitChange();
}

// ─── Hook ────────────────────────────────────────
interface UseAuthReturn {
  user: User | null;
  organizations: Organization[];
  activeOrgId: string | undefined;
  isLoggedIn: boolean;
  switchOrg: (orgId: string) => void;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const state = useMemo(() => {
    try {
      return JSON.parse(raw) as {
        isAuth: boolean;
        user: User | null;
        orgs: Organization[];
        activeOrgId: string | undefined;
      };
    } catch {
      return { isAuth: false, user: null, orgs: [], activeOrgId: undefined };
    }
  }, [raw]);

  const switchOrg = useCallback(
    (orgId: string) => {
      setActiveOrgId(orgId);
      emitChange();
      router.refresh();
    },
    [router],
  );

  const logout = useCallback(async () => {
    await logoutFn();
    emitChange();
    router.push("/login");
  }, [router]);

  return {
    user: state.user,
    organizations: state.orgs,
    activeOrgId: state.activeOrgId,
    isLoggedIn: state.isAuth,
    switchOrg,
    logout,
  };
}

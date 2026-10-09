'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@/app/lib/types/auth';
import type { Profile } from '@/app/lib/types/user';
import { logoutUser } from '@/app/lib/api/auth';
import { getProfile, getMe, UserApiError } from '@/app/lib/api/user';
import { queryKeys } from '@/app/lib/queries/queryKeys';
import { PROFILE_STALE_TIME } from '@/app/lib/queries/staleTimes';

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAccountDisabled: boolean;
  error: string | null;
  /** @deprecated Will be removed in PR 3 — use profile query invalidation instead. */
  setUser: (user: AuthUser | null) => void;
  /** Profile language_code (ISO 639-1), null when profile not loaded or user unauthenticated. */
  profileLanguage: string | null;
  /** Profile currency_code (ISO 4217), null when profile not loaded or user unauthenticated. */
  profileCurrency: string | null;
  /** Profile first_name, null when profile not loaded or user unauthenticated. */
  profileFirstName: string | null;
  /** Profile avatar URL (Google picture or custom upload), null when profile not loaded or user unauthenticated. */
  profileAvatar: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Extract identity fields ({id, email, role_name}) from the profile response.
 *
 * Falls back to role_name='client' when the backend omits it.
 */
function extractAuthUser(profile: Profile): AuthUser | null {
  const id = profile.id;
  const email = profile.email;
  if (typeof id !== 'string' || typeof email !== 'string') return null;
  return {
    id,
    email,
    role_name: typeof profile.role_name === 'string' ? profile.role_name : 'client',
    permissions: [],
  };
}

export function AuthProvider({
  children,
  serverAuthenticated,
}: {
  children: ReactNode;
  /** Indica si el server detectó cookies de auth. Evita llamadas innecesarias a la API. */
  serverAuthenticated: boolean;
}) {
  const queryClient = useQueryClient();

  // ── Manual overrides — backward compat for pages that call setUser ──
  const [manualUser, setManualUser] = useState<AuthUser | null>(null);

  // ── Identity query (GET /v1/auth/me — works for ALL roles) ──────────────
  const meQuery = useQuery({
    queryKey: queryKeys.user.me(),
    queryFn: ({ signal }) => getMe(signal),
    enabled: serverAuthenticated,
    retry: 1,
    staleTime: PROFILE_STALE_TIME,
  });

  // ── Profile query (GET /v1/user/profile — client-only) ──────────────────
  //     Enabled when server says we're authenticated OR when manualUser is set
  //     (post-login, serverAuthenticated stays false until full page reload).
  const profileQuery = useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: ({ signal }) => getProfile(signal),
    enabled: serverAuthenticated || !!manualUser,
    retry: false,
    staleTime: PROFILE_STALE_TIME,
  });

  // ── Derived state: identity from /auth/me ───────────────────────────────

  const meUser = useMemo<AuthUser | null>(() => {
    if (!meQuery.data?.user) return null;
    const u = meQuery.data.user;
    if (typeof u.id !== 'string' || typeof u.email !== 'string') return null;
    return {
      id: u.id,
      email: u.email,
      role_name: typeof u.role_name === 'string' ? u.role_name : 'client',
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
    };
  }, [meQuery.data]);

  // Extract identity from profile query (secondary, for clients)
  const profileUser = useMemo(() => {
    if (!profileQuery.data) return null;
    return extractAuthUser(profileQuery.data.profile);
  }, [profileQuery.data]);

  // Effective user: meQuery wins; fallback to profileUser; then manual
  const user = meUser ?? profileUser ?? manualUser;

  // ── Profile locale — extracted from profile query ──────────────────────
  const profileLanguage = useMemo(() => {
    if (!profileQuery.data?.profile) return null;
    return profileQuery.data.profile.language_code ?? null;
  }, [profileQuery.data]);

  const profileCurrency = useMemo(() => {
    if (!profileQuery.data?.profile) return null;
    return profileQuery.data.profile.currency_code ?? null;
  }, [profileQuery.data]);

  const profileFirstName = useMemo(() => {
    const liveProfile = profileQuery.data?.profile;
    const cachedProfile = queryClient.getQueryData<{ profile: { first_name?: string | null } }>(queryKeys.user.profile())?.profile;
    const profile = liveProfile ?? cachedProfile;
    return profile?.first_name ?? null;
  }, [profileQuery.data, queryClient]);

  const profileAvatar = useMemo(() => {
    // Check live query data first, then fall back to cache
    // (TanStack Query v5 disabled queries don't subscribe to cache updates)
    const liveProfile = profileQuery.data?.profile;
    const cachedProfile = queryClient.getQueryData<{ profile: { avatar_url?: string | null } }>(queryKeys.user.profile())?.profile;
    const profile = liveProfile ?? cachedProfile;
    return profile?.avatar_url ?? null;
  }, [profileQuery.data, queryClient]);

  // Loading: true while either identity query is pending
  const isLoading = serverAuthenticated && meQuery.isPending;

  // ── Error handling ──────────────────────────────────────────────────────

  // Account-disabled detection: from profile query only (not meQuery)
  const isAccountDisabled = useMemo(() => {
    if (!profileQuery.error) return false;
    const err = profileQuery.error;
    return (
      err instanceof UserApiError &&
      err.code === 'PERMISSION_DENIED' &&
      err.detail?.toLowerCase().includes('deshabilitada')
    );
  }, [profileQuery.error]);

  // Profile PERMISSION_DENIED is expected for admins — suppress it
  const isProfilePermissionDenied = useMemo(() => {
    if (!profileQuery.error) return false;
    const err = profileQuery.error;
    return (
      err instanceof UserApiError &&
      err.code === 'PERMISSION_DENIED' &&
      !isAccountDisabled
    );
  }, [profileQuery.error, isAccountDisabled]);

  // Error: derived from meQuery (identity), profile 401/TOKEN_INVALID, account-disabled
  const error = useMemo(() => {
    // meQuery error → surface it (real auth problem)
    if (meQuery.error) {
      const err = meQuery.error;
      if (err instanceof UserApiError && err.code === 'TOKEN_INVALID') {
        return null; // handled by redirect effect
      }
      if (err instanceof Error) return err.message;
      return 'Error al verificar la sesión';
    }

    // Profile error
    if (!profileQuery.error) return null;
    const err = profileQuery.error;

    // TOKEN_INVALID on profile → session expired
    if (err instanceof UserApiError && err.code === 'TOKEN_INVALID') {
      return null;
    }

    // PERMISSION_DENIED on profile for admins → expected, not an error
    if (isProfilePermissionDenied) return null;

    // Account disabled → handled by redirect
    if (isAccountDisabled) return null;

    if (err instanceof Error) return err.message;
    return 'Error al cargar el perfil';
  }, [meQuery.error, profileQuery.error, isProfilePermissionDenied, isAccountDisabled]);

  // ── Effect: redirect on account-disabled ────────────────────────────────
  useEffect(() => {
    if (isAccountDisabled && !window.location.pathname.startsWith('/auth/account-disabled')) {
      window.location.href = '/auth/account-disabled';
    }
  }, [isAccountDisabled]);

  // ── Effect: redirect on session expiry (TOKEN_INVALID from meQuery) ─────
  useEffect(() => {
    if (!serverAuthenticated) return;
    // Don't redirect from auth pages — login handles its own flow,
    // account-disabled is a terminal state for blocked users.
    if (window.location.pathname.startsWith('/auth/login')) return;
    if (window.location.pathname.startsWith('/auth/account-disabled')) return;

    const err = meQuery.error;
    if (err instanceof UserApiError && err.code === 'TOKEN_INVALID') {
      const returnUrl = encodeURIComponent(
        window.location.pathname + window.location.search
      );
      window.location.href = `/auth/login?reason=session_expired&returnUrl=${returnUrl}`;
    }
  }, [serverAuthenticated, meQuery.error]);

  // ── Public API (backward-compat bridge) ──────────────────────────────────

  const setUser = useCallback((u: AuthUser | null) => {
    setManualUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
      // logoutUser() handles the redirect (reads Location from 302 response)
      return;
    } catch {
      // Fallback: clear local state and redirect
    }
    queryClient.clear();
    setManualUser(null);
    window.location.href = '/';
  }, [queryClient]);

  // ── Memoized context value ───────────────────────────────────────────────

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      isAccountDisabled,
      error,
      setUser,
      profileLanguage,
      profileCurrency,
      profileFirstName,
      profileAvatar,
      logout,
    }),
    [user, isLoading, isAccountDisabled, error, setUser, profileLanguage, profileCurrency, profileFirstName, profileAvatar, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}

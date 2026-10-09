// app/lib/api/user.ts
//
// Raw fetch client for user profile, preferences, medical, avatars, and favorites.
// Cookie-based auth: credentials:"include", no Authorization header needed.
// Follows canonical flights.ts/hotels.ts pattern: typed errors, rate limit extraction,
// AbortController timeouts, direct fetch() instead of apiFetch() wrapper.
//
// FIXED May 2026: PATCH methods, /profile/ prefix in document URLs, medical conflict paths.
// REMOVED: updateLocale() (merged into updateProfile), updateNotificationPreference() (endpoint doesn't exist).

import type {
  ProfileResponse,
  UpdateProfileBody,
  UpdateTravelPreferencesBody,
  MedicalProfile,
  GetMedicalProfileResponse,
  UpdateMedicalProfileBody,
  AvatarUploadUrl,
  EntityType,
  CreateFavoriteBody,
  FavoritesResponse,
  AddFavoriteResponse,
  PendingConflictsResponse,
  ResolveConflictBody,
  TravelPreferences,
} from '@/app/lib/types/user';
import { rateLimitStore } from './rate-limit';

// ==========================================
// SINGLE env var
// ==========================================
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// ==========================================
// TYPED ERROR CODES — RFC 9457 mapping
// ==========================================
export type UserErrorCode =
  // Profile (7)
  | 'PROFILE_NOT_FOUND'
  | 'INVALID_ENUM'
  | 'INVALID_COUNTRY_CODE'
  | 'INVALID_TIMEZONE'
  | 'INVALID_LANGUAGE_CODE'
  | 'INVALID_CURRENCY_CODE'
  | 'INVALID_PHONE'
  // Medical (4)
  | 'MEDICAL_PROFILE_NOT_FOUND'
  | 'DECRYPTION_ERROR'
  | 'INVALID_BLOOD_TYPE'
  | 'ENCRYPTION_ERROR'
  // Medical Conflicts (3)
  | 'PENDING_UPDATE_NOT_FOUND'
  | 'PENDING_UPDATE_EXPIRED'
  | 'INVALID_PENDING_ACTION'
  // Avatars (4)
  | 'INVALID_MIME_TYPE'
  | 'FILE_TOO_LARGE'
  | 'FILE_NOT_FOUND'
  | 'AVATAR_NOT_FOUND'
  // Favorites (3)
  | 'DUPLICATE_FAVORITE'
  | 'INVALID_ENTITY_TYPE'
  | 'FAVORITE_NOT_FOUND'
  // Travel Preferences (2)
  | 'TRAVEL_PREFS_NOT_FOUND'
  | 'INVALID_MAX_LAYOVER'
  // Documents (3)
  | 'INVALID_FILE_TYPE'
  | 'DOCUMENT_NOT_FOUND'
  | 'DOCUMENT_NOT_READY'
  // Saved Searches (2)
  | 'DUPLICATE_SEARCH'
  | 'SEARCH_NOT_FOUND'
  // Common (3)
  | 'TOKEN_INVALID'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  // Rate limiting (1)
  | 'RATE_LIMIT_EXCEEDED'
  // Admin / Management (1)
  | 'PERMISSION_DENIED';

/**
 * Typed error class for user API errors.
 * Carries machine-readable `code`, HTTP status, human detail, and trace ID.
 * On 429, `retryAfter` carries the Retry-After seconds value.
 */
export class UserApiError extends Error {
  constructor(
    public readonly code: UserErrorCode,
    public readonly status: number,
    public readonly detail: string,
    public readonly traceId?: string,
    public readonly retryAfter?: number,
  ) {
    super(`[${code}] ${detail}`);
    this.name = 'UserApiError';
  }
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Extract rate limit headers from ANY response (success or error)
 * and update the global rateLimitStore.
 */
export function extractRateLimitHeaders(response: Response, endpoint: string): void {
  const limit = response.headers.get('RateLimit-Limit');
  const remaining = response.headers.get('RateLimit-Remaining');
  const reset = response.headers.get('RateLimit-Reset');

  if (limit !== null && remaining !== null && reset !== null) {
    rateLimitStore.update({
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
      endpoint,
      timestamp: Date.now(),
    });
  }
}

/**
 * Parse a non-ok Response into a typed UserApiError.
 * Maps RFC 9457 type URI → UserErrorCode.
 * On 429, also calls rateLimitStore.block() with Retry-After.
 * Always calls extractRateLimitHeaders before throwing.
 */
export async function parseUserError(response: Response, endpoint: string): Promise<never> {
  const body = await response.json().catch(() => ({}));
  const type: string = body?.type || '';
  const status = response.status;

  let code: UserErrorCode;

  // 1. Rate limit — highest priority
  if (status === 429 || type.includes('rate_limit') || type.includes('rate-limit')) {
    code = 'RATE_LIMIT_EXCEEDED';
  }
  // 1b. PERMISSION_DENIED — admin/management endpoints
  else if (status === 403 || type.includes('permission-denied') || type.includes('missing-permission') || type.includes('forbidden')) {
    code = 'PERMISSION_DENIED';
  }
  // 2. Type URI-based mapping (specific error codes)
  else if (type.includes('invalid-enum')) {
    code = 'INVALID_ENUM';
  } else if (type.includes('invalid-country-code')) {
    code = 'INVALID_COUNTRY_CODE';
  } else if (type.includes('invalid-timezone')) {
    code = 'INVALID_TIMEZONE';
  } else if (type.includes('invalid-language-code')) {
    code = 'INVALID_LANGUAGE_CODE';
  } else if (type.includes('invalid-currency-code')) {
    code = 'INVALID_CURRENCY_CODE';
  } else if (type.includes('invalid-phone')) {
    code = 'INVALID_PHONE';
  } else if (type.includes('invalid-blood-type')) {
    code = 'INVALID_BLOOD_TYPE';
  } else if (type.includes('invalid-mime-type')) {
    code = 'INVALID_MIME_TYPE';
  } else if (type.includes('file-too-large')) {
    code = 'FILE_TOO_LARGE';
  } else if (type.includes('invalid-entity-type')) {
    code = 'INVALID_ENTITY_TYPE';
  } else if (type.includes('duplicate-search')) {
    code = 'DUPLICATE_SEARCH';
  } else if (type.includes('duplicate-favorite')) {
    code = 'DUPLICATE_FAVORITE';
  } else if (type.includes('medical-profile-not-found')) {
    code = 'MEDICAL_PROFILE_NOT_FOUND';
  } else if (type.includes('favorite-not-found')) {
    code = 'FAVORITE_NOT_FOUND';
  } else if (type.includes('file-not-found')) {
    code = 'FILE_NOT_FOUND';
  } else if (type.includes('avatar-not-found')) {
    code = 'AVATAR_NOT_FOUND';
  } else if (type.includes('invalid-file-type')) {
    code = 'INVALID_FILE_TYPE';
  } else if (type.includes('document-not-found')) {
    code = 'DOCUMENT_NOT_FOUND';
  } else if (type.includes('document-not-ready')) {
    code = 'DOCUMENT_NOT_READY';
  } else if (type.includes('search-not-found')) {
    code = 'SEARCH_NOT_FOUND';
  } else if (type.includes('travel-prefs-not-found') || type.includes('travel-preferences-not-found')) {
    code = 'TRAVEL_PREFS_NOT_FOUND';
  } else if (type.includes('invalid-max-layover')) {
    code = 'INVALID_MAX_LAYOVER';
  } else if (type.includes('profile-not-found')) {
    code = 'PROFILE_NOT_FOUND';
  } else if (type.includes('decryption')) {
    code = 'DECRYPTION_ERROR';
  } else if (type.includes('encryption')) {
    code = 'ENCRYPTION_ERROR';
  } else if (type.includes('pending-update-not-found')) {
    code = 'PENDING_UPDATE_NOT_FOUND';
  } else if (type.includes('pending-update-expired')) {
    code = 'PENDING_UPDATE_EXPIRED';
  } else if (type.includes('invalid-pending-action')) {
    code = 'INVALID_PENDING_ACTION';
  } else if (type.includes('token-invalid')) {
    code = 'TOKEN_INVALID';
  } else if (type.includes('validation')) {
    code = 'VALIDATION_ERROR';
  }
  // 3. Status-based fallback
  else if (status === 400) {
    code = 'VALIDATION_ERROR';
  } else if (status === 401) {
    code = 'TOKEN_INVALID';
  } else if (status === 404) {
    code = 'PROFILE_NOT_FOUND';
  } else if (status === 409) {
    code = 'DUPLICATE_FAVORITE';
  } else {
    code = 'INTERNAL_ERROR';
  }

  const retryAfterHeader = response.headers.get('Retry-After');

  // On 429, block the rate limit store for the specified duration
  if (code === 'RATE_LIMIT_EXCEEDED' && retryAfterHeader) {
    rateLimitStore.block(parseInt(retryAfterHeader, 10));
  }

  // Always extract rate limit headers from error responses too
  extractRateLimitHeaders(response, endpoint);

  throw new UserApiError(
    code,
    status,
    body?.detail || body?.title || `Error ${status}`,
    body?.trace_id || undefined,
    retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined,
  );
}

// ==========================================
// PERFIL PRINCIPAL
// ==========================================

// ── GET /v1/auth/me — Identity endpoint (works for all roles) ──────────

/** Response from GET /v1/auth/me — identity only, no profile data. */
export interface MeResponse {
  user: {
    id: string;
    email: string;
    role_name: string;
    permissions?: string[];
  };
}

/**
 * Get authenticated user identity.
 * Works for ALL roles (client + admin) — no RequireClientRole middleware.
 */
export async function getMe(signal?: AbortSignal): Promise<MeResponse> {
  const endpoint = '/v1/auth/me';
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 10000);
  const effectiveSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      credentials: 'include',
      signal: effectiveSignal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }

    return response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof UserApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }
    throw error;
  }
}

// ── GET /v1/user/profile — Profile (client-only) ────────────────────────

/**
 * Get user profile and travel preferences.
 *
 * Direct fetch with credentials:"include".
 * 10s timeout via AbortController.
 * Rate limit headers extracted from every response.
 */
export async function getProfile(signal?: AbortSignal): Promise<ProfileResponse> {
  const endpoint = '/v1/user/profile';
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 10000);
  const effectiveSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      credentials: 'include',
      signal: effectiveSignal,
    });

    clearTimeout(timeoutId);

    // Always extract rate limit headers
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }

    return adaptProfileResponse(await response.json());
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Re-throw UserApiError as-is
    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

/** Adapta la respuesta plana del backend al formato ProfileResponse del frontend. */
// deno-lint-ignore no-explicit-any
function adaptProfileResponse(raw: Record<string, unknown>): ProfileResponse {
  const loc = (raw.location as Record<string, unknown>) || {};

  // Build Profile: use backend id/user_id/email directly, derive locale fields from location
  return {
    profile: {
      id: (raw.id as string) || '',
      user_id: (raw.user_id as string) || '',
      email: (raw.email as string) || '',
      first_name: (raw.first_name as string | null) ?? null,
      last_name: (raw.last_name as string | null) ?? null,
      date_of_birth: (raw.date_of_birth as string | null) ?? null,
      gender: (raw.gender as import('@/app/lib/types/user').Gender | null) ?? null,
      nationality: (raw.nationality as string | null) ?? null,
      phone: (raw.phone as string | null) ?? null,
      bio: (raw.bio as string | null) ?? null,
      role_name: (raw.role_name as string) ?? undefined,
      avatar_url: (raw.avatar_url as string | null) ?? null,
      language_code: (loc.language as string) ?? null,
      currency_code: (loc.currency as string) ?? null,
      timezone_name: (loc.timezone as string) ?? null,
    },
  };
}

/**
 * Update user profile fields (name, gender, nationality, etc.).
 * Locale fields (language, currency) are updated through this endpoint too.
 *
 * Direct fetch with credentials:"include".
 * 10s timeout via AbortController.
 */
export async function updateProfile(data: UpdateProfileBody, signal?: AbortSignal): Promise<void> {
  const endpoint = '/v1/user/profile';
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 10000);
  const effectiveSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',                                           // ← PUT → PATCH
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
      signal: effectiveSignal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

// ==========================================
// PREFERENCIAS DE VIAJE
// ==========================================

/**
 * Get travel preferences from the dedicated endpoint.
 *
 * Returns null when the user has no saved preferences (404 TRAVEL_PREFS_NOT_FOUND).
 * Direct fetch with credentials:"include".
 * 10s timeout via AbortController.
 */
export async function getTravelPreferences(
  signal?: AbortSignal
): Promise<TravelPreferences | null> {
  const endpoint = '/v1/user/profile/travel-preferences';
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 10000);
  const effectiveSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      credentials: 'include',
      signal: effectiveSignal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (response.status === 404) return null;
    if (!response.ok) await parseUserError(response, endpoint);

    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof UserApiError && error.code === 'TRAVEL_PREFS_NOT_FOUND') {
      return null;
    }

    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

/**
 * Update travel preferences (class, seat, meals, airlines, etc.).
 *
 * Direct fetch with credentials:"include".
 * 10s timeout via AbortController.
 */
export async function updateTravelPreferences(
  data: UpdateTravelPreferencesBody
): Promise<void> {
  const endpoint = '/v1/user/profile/travel-preferences';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',                                           // ← PUT → PATCH
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

// ==========================================
// PERFIL MÉDICO
// ==========================================

/**
 * Unwrap MedicalField<T> fields from the API response.
 * Backend returns { data: { blood_type: { value, source, updated_at }, ... } }.
 * This adapter extracts just the .value for MedicalForm presentation.
 */
export function adaptMedicalProfile(raw: Record<string, unknown>): Record<string, unknown> {
  // Handle the { data: { ... } } wrapper
  const data = (raw.data as Record<string, unknown>) || raw;

  const unwrap = (field: unknown): unknown => {
    let value: unknown = field;
    if (field && typeof field === 'object' && 'value' in field) {
      value = (field as { value: unknown }).value;
    }
    // Handle backend double-serialization — .value may be a JSON string
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('[') || trimmed.startsWith('{')) && trimmed.length > 2) {
        try {
          return JSON.parse(trimmed);
        } catch {
          /* not JSON, return string */
        }
      }
    }
    return value;
  };

  return {
    blood_type: unwrap(data.blood_type),
    allergies: unwrap(data.allergies),
    medications: unwrap(data.medications),
    conditions: unwrap(data.conditions),
    vaccinations: unwrap(data.vaccinations),
    emergency_contact: unwrap(data.emergency_contact),
    insurance_info: unwrap(data.insurance_info),
    // Passthrough meta fields from top-level response
    is_shared: raw.is_shared as boolean ?? false,
    has_pending_conflicts: raw.has_pending_conflicts as boolean ?? false,
    pending_conflict_count: raw.pending_conflict_count as number ?? 0,
  };
}

/**
 * Get medical profile. Returns null when the user has no medical profile (404).
 *
 * Direct fetch with credentials:"include".
 * 10s timeout via AbortController.
 * Preserves caller contract: null for missing profile, throws for other errors.
 *
 * Returns the full API response { data: MedicalProfile } so callers can access
 * source tracing and updated_at information.
 */
export async function getMedicalProfile(): Promise<GetMedicalProfileResponse | null> {
  const endpoint = '/v1/user/profile/medical';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }

    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof UserApiError && error.code === 'MEDICAL_PROFILE_NOT_FOUND') {
      return null;
    }

    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

/**
 * Create or update medical profile.
 *
 * Direct fetch with credentials:"include".
 * 10s timeout via AbortController.
 */
export async function updateMedicalProfile(
  data: UpdateMedicalProfileBody
): Promise<void> {
  const endpoint = '/v1/user/profile/medical';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',                                           // ← PUT → PATCH
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

// ==========================================
// AVATARES
// ==========================================

/**
 * Request a presigned R2 upload URL for a new avatar.
 *
 * Direct fetch with credentials:"include".
 * 15s timeout — involves backend→R2 IAM call.
 */
export async function getUploadAvatarUrl(file: File): Promise<AvatarUploadUrl> {
  const endpoint = '/v1/user/profile/avatar';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      }),
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }

    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

/**
 * Upload file directly to R2 presigned URL (cross-origin, no credentials).
 * Unchanged from original — already direct fetch to external storage.
 */
export async function uploadAvatarToR2(upload_url: string, file: File): Promise<void> {
  const res = await fetch(upload_url, {
    method: 'PUT',
    body: file,
  });
  if (!res.ok) throw new Error(`Error al subir imagen: ${res.status}`);
}

/**
 * Confirm avatar upload after R2 PUT completes.
 * Triggers async image processing on the backend.
 *
 * Direct fetch with credentials:"include".
 * 10s timeout via AbortController.
 */
export async function confirmAvatarUpload(storage_key: string): Promise<string> {
  const endpoint = '/v1/user/profile/avatar/confirm';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storage_key }),
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }

    const data = await response.json();
    return data.avatar_url || data.message;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

// ==========================================
// CONFLICTOS MÉDICOS
// ==========================================

/**
 * List medical field conflicts from OCR document processing.
 *
 * GET /v1/user/profile/medical-conflicts?status=pending
 * Direct fetch with credentials:"include".
 * 10s timeout via AbortController.
 * Returns empty array on 404 (no conflicts is not an error).
 */
export async function listMedicalConflicts(status?: string): Promise<PendingConflictsResponse> {
  let url = '/v1/user/profile/medical-conflicts';               // ← was: /medical/pending
  if (status) {
    url += `?status=${encodeURIComponent(status)}`;
  }

  const endpoint = url;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }

    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // No conflicts = empty array, not an error
    if (error instanceof UserApiError && error.code === 'PENDING_UPDATE_NOT_FOUND') {
      return { conflicts: [] };
    }

    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

/**
 * Resolve a medical conflict by accepting, rejecting, or providing a custom value.
 *
 * POST /v1/user/profile/medical-conflicts/:conflict_id/resolve
 * Direct fetch with credentials:"include".
 * 10s timeout via AbortController.
 * Body: { action, value? }
 * Returns { message: string } on success.
 * Throws UserApiError on PENDING_UPDATE_NOT_FOUND, PENDING_UPDATE_EXPIRED, INVALID_PENDING_ACTION.
 */
export async function resolveMedicalConflict(
  conflictId: string,                                            // ← conflict_id in URL path
  body: ResolveConflictBody,
): Promise<{ message: string }> {
  const endpoint = `/v1/user/profile/medical-conflicts/${encodeURIComponent(conflictId)}/resolve`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }

    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

// ==========================================
// FAVORITOS
// ==========================================

/**
 * List user favorites, optionally filtered by entity type.
 *
 * Direct fetch with credentials:"include".
 * 10s timeout via AbortController.
 * No Content-Type header (GET request).
 */
export async function listFavorites(entityType?: EntityType, signal?: AbortSignal): Promise<FavoritesResponse> {
  let url = '/v1/user/favorites';
  if (entityType) {
    url += `?entity_type=${encodeURIComponent(entityType)}`;
  }

  const endpoint = url;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 10000);
  const effectiveSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      credentials: 'include',
      signal: effectiveSignal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }

    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

/**
 * Add a favorite. Returns the created favorite info, or { conflict: true }
 * when the favorite already exists (409 DUPLICATE_FAVORITE).
 * Duplicate favorite is a recoverable business state — not an error.
 *
 * Direct fetch with credentials:"include".
 * 10s timeout via AbortController.
 */
export async function addFavorite(
  body: CreateFavoriteBody,
  signal?: AbortSignal
): Promise<AddFavoriteResponse | { conflict: true }> {
  const endpoint = '/v1/user/favorites';
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 10000);
  const effectiveSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
      signal: effectiveSignal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }

    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Duplicate favorite is a recoverable business state, not an error
    if (error instanceof UserApiError && error.code === 'DUPLICATE_FAVORITE') {
      return { conflict: true };
    }

    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

/**
 * Delete a favorite by ID.
 *
 * Direct fetch with credentials:"include".
 * 10s timeout via AbortController.
 * No Content-Type header (DELETE request).
 */
export async function deleteFavorite(favoriteId: string, signal?: AbortSignal): Promise<{ message: string }> {
  const endpoint = `/v1/user/favorites/${favoriteId}`;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 10000);
  const effectiveSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      credentials: 'include',
      signal: effectiveSignal,
    });

    clearTimeout(timeoutId);
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      await parseUserError(response, endpoint);
    }

    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof UserApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    throw error;
  }
}

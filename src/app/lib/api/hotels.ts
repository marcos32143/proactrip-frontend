// app/lib/api/hotels.ts
//
// Raw fetch client for hotel search and hotel-details endpoints.
// Cookie-based auth: credentials:"include", no Authorization header needed.
// Follows the same pattern as flights.ts — direct fetch(), AbortController,
// RFC 9457 error mapping, and rate limit header extraction.

import type {
  SearchHotelsResponse,
  HotelDetailsResponse,
  HotelRoomsResponse,
  SearchParams,
  FilterValues,
} from '@/app/lib/types/hotel';
import { getUserPreferences } from '@/app/lib/utils/location';
import { rateLimitStore } from './rate-limit';
import { adaptSearchResults, adaptHotelDetails } from '@/app/lib/utils/transformers';

// ==========================================
// SINGLE env var
// ==========================================
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// ==========================================
// TYPED ERROR CODES — RFC 9457 mapping
// ==========================================
export type HotelErrorCode =
  | 'VALIDATION_ERROR'        // 400
  | 'INVALID_PARAM_RANGE'     // 422
  | 'RATE_LIMIT_EXCEEDED'     // 429
  | 'PROPERTY_NOT_FOUND'      // 404
  | 'TOKEN_INVALID'           // 401/403
  | 'PROVIDER_UNAVAILABLE'    // 503
  | 'INTERNAL_ERROR';         // 500

/**
 * Typed error class for hotel API errors.
 * Carries machine-readable `code`, HTTP status, human detail, and trace ID.
 * On 429, `retryAfter` carries the Retry-After seconds value.
 */
export class HotelApiError extends Error {
  constructor(
    public readonly code: HotelErrorCode,
    public readonly status: number,
    public readonly detail: string,
    public readonly traceId?: string,
    public readonly retryAfter?: number,
  ) {
    super(detail);
    this.name = 'HotelApiError';
  }
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Extract rate limit headers from ANY response (success or error)
 * and update the global rateLimitStore.
 */
function extractRateLimitHeaders(response: Response, endpoint: string): void {
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
 * Parse a non-ok Response into a typed HotelApiError.
 * Maps RFC 9457 type URI → HotelErrorCode.
 * On 429, also calls rateLimitStore.block() with Retry-After.
 */
async function parseHotelError(response: Response, endpoint: string): Promise<HotelApiError> {
  let body: Record<string, unknown> = {};
  try {
    body = await response.json();
  } catch {
    // Non-JSON response — read as text for debugging
    try {
      const text = await response.text();
      console.group('⚠️ [HotelAPI] Non-JSON error response');
      console.log('Status:', response.status, response.statusText);
      console.log('URL:', response.url);
      console.log('Body (text):', text.substring(0, 500));
      console.groupEnd();
    } catch {
      // Couldn't read body at all
      console.group('⚠️ [HotelAPI] Unreadable error response');
      console.log('Status:', response.status, response.statusText);
      console.log('URL:', response.url);
      console.groupEnd();
    }
  }

  const type: string = (body?.type as string) || '';
  const status = response.status;

  // Log full error details for debugging (skip 404 — endpoint not yet implemented)
  if (status !== 404) {
    console.group(`❌ [HotelAPI] Error ${status} — ${endpoint}`);
    console.log('Type:', type || '(none)');
    console.log('Detail:', body?.detail || body?.title || '(none)');
    console.log('Trace ID:', body?.trace_id || '(none)');
    console.log('Headers:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    console.groupEnd();
  }

  let code: HotelErrorCode;
  let detailOverride: string | undefined;
  if (status === 400 || type.includes('validation')) {
    code = 'VALIDATION_ERROR';
  } else if (status === 422 || type.includes('invalid-param')) {
    code = 'INVALID_PARAM_RANGE';
  } else if (status === 429 || type.includes('rate_limit')) {
    code = 'RATE_LIMIT_EXCEEDED';
  } else if (status === 404 || type.includes('property-not-found')) {
    code = 'PROPERTY_NOT_FOUND';
    detailOverride = 'La reserva de habitaciones no está disponible aún.';
  } else if (status === 401 || status === 403 || type.includes('token')) {
    code = 'TOKEN_INVALID';
  } else if (status === 503 || type.includes('provider')) {
    code = 'PROVIDER_UNAVAILABLE';
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

  return new HotelApiError(
    code,
    status,
    detailOverride || (body?.detail as string) || (body?.title as string) || `Error ${status}`,
    (body?.trace_id as string) || undefined,
    retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined,
  );
}

// ==========================================
// TIMEOUTS
// ==========================================
const SEARCH_TIMEOUT_MS = 30_000;
const DETAILS_TIMEOUT_MS = 15_000;
const ROOMS_TIMEOUT_MS = 15_000;

// ==========================================
// SEARCH HOTELS
// ==========================================

/**
 * Search hotels — supports hotels and vacation rentals.
 *
 * Raw fetch with credentials:"include" for cookie-based auth.
 * 30s timeout via AbortController.
 * Rate limit headers extracted from every response.
 * RFC 9457 errors mapped to HotelApiError.
 */
export async function searchHotels(
  params: SearchParams & { page_token?: string | null },
  filters: FilterValues,
  signal?: AbortSignal,
): Promise<{
  type: string;
  results_state: string;
  properties: ReturnType<typeof adaptSearchResults>;
  brands: unknown[] | null;
  pagination: { next_token: string | null; has_more: boolean };
  from_cache: boolean;
  cached_at: string | null;
}> {
  const user = getUserPreferences();

  // Guard: reject empty queries before hitting the backend
  if (!params.query || params.query.trim() === '') {
    throw new Error('Se requiere un destino para buscar');
  }

  // Build request body
  const body: Record<string, unknown> = {
    query: params.query,
    check_in_date: params.check_in_date,
    check_out_date: params.check_out_date,
    adults: params.adults || 2,
    // Only send children if ages array matches the count — SerpAPI requires them to match.
    // Sending children=1 with children_ages=[] causes a 400 from the provider.
    children: (params.children > 0 && params.children_ages?.length === params.children)
      ? params.children
      : 0,
    children_ages: (params.children > 0 && params.children_ages?.length === params.children)
      ? params.children_ages
      : [],
    // rooms removed — backend no longer expects it
    ...(params.gl ? { gl: params.gl } : {}),
    ...(params.hl ? { hl: params.hl } : {}),
    ...(params.currency || user.currency ? { currency: params.currency || user.currency } : {}),
    vacation_rentals: filters.vacation_rentals ?? params.vacation_rentals ?? false,
    page_token: params.page_token ?? null,
  };

  const isVR = filters.vacation_rentals ?? params.vacation_rentals ?? false;

  // Truly mode-agnostic — always safe to send regardless of hotel vs VR mode
  if (filters.min_price != null) body.min_price = filters.min_price;
  if (filters.max_price != null) body.max_price = filters.max_price;
  if (filters.rating != null) body.rating = filters.rating;
  if (filters.sort_by != null) body.sort_by = Number(filters.sort_by);

  // Mode-specific filters — amenity/property-type IDs differ per mode
  // and the backend rejects invalid values with a 502.
  if (!isVR) {
    // Hotels-only
    if (filters.amenities?.length) body.amenities = filters.amenities;
    if (filters.property_types?.length) body.property_types = filters.property_types;
    if (filters.hotel_classes?.length) body.hotel_classes = filters.hotel_classes;
    if (filters.brands?.length) body.brands = filters.brands.map(Number).filter(b => b > 0);
    if (filters.free_cancellation != null) body.free_cancellation = filters.free_cancellation;
    if (filters.special_offers != null) body.special_offers = filters.special_offers;
    if (filters.eco_certified != null) body.eco_certified = filters.eco_certified;
  }
  if (isVR) {
    // VR-only
    if (filters.amenities?.length) body.amenities = filters.amenities;
    if (filters.property_types?.length) body.property_types = filters.property_types;
    if (filters.bedrooms != null) body.bedrooms = filters.bedrooms;
    if (filters.bathrooms != null) body.bathrooms = filters.bathrooms;
  }

  const endpoint = '/v1/search/hotels';
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), SEARCH_TIMEOUT_MS);
  const effectiveSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    console.log('🔍 Buscando hoteles...');

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
      signal: effectiveSignal,
    });

    clearTimeout(timeoutId);

    // Always extract rate limit headers (success or error)
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      throw await parseHotelError(response, endpoint);
    }

    const data: SearchHotelsResponse = await response.json();
    console.log('[raw-api] searchHotels:', {
      type: data.type,
      results_state: data.results_state,
      propertyCount: data.properties?.length,
      firstProperty: data.properties?.[0] ? {
        id: data.properties[0].id,
        ratings: data.properties[0].ratings,
        reviews_breakdown: data.properties[0].reviews_breakdown,
      } : null,
    });
    const transformedHotels = adaptSearchResults(data.properties, params);

    return {
      type: data.type,
      results_state: data.results_state,
      properties: transformedHotels,
      brands: data.brands,
      pagination: data.pagination,
      from_cache: data.from_cache,
      cached_at: data.cached_at,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Re-throw HotelApiError as-is
    if (error instanceof HotelApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La búsqueda ha excedido el tiempo de espera.');
    }

    console.error('❌ Error en searchHotels():', error);
    throw error;
  }
}

// ==========================================
// GET HOTEL DETAILS
// ==========================================

/**
 * Get hotel details for a specific property.
 *
 * Raw fetch with credentials:"include" for cookie-based auth.
 * 15s timeout via AbortController.
 * Dynamically sets vacation_rentals flag from params.
 */
export async function getHotelDetails(
  hotelId: string,
  params: SearchParams,
): Promise<{ property: ReturnType<typeof adaptHotelDetails> }> {
  if (!hotelId || hotelId.trim() === '') {
    throw new HotelApiError('VALIDATION_ERROR', 400, 'Se requiere el ID del hotel');
  }

  const user = getUserPreferences();

  const body: Record<string, unknown> = {
    id: hotelId,
    query: params.query,
    check_in_date: params.check_in_date,
    check_out_date: params.check_out_date,
    adults: params.adults || 2,
    // Only send children if ages array matches the count — SerpAPI requires them to match.
    children: (params.children > 0 && params.children_ages?.length === params.children)
      ? params.children
      : 0,
    children_ages: (params.children > 0 && params.children_ages?.length === params.children)
      ? params.children_ages
      : [],
    ...(params.gl ? { gl: params.gl } : {}),
    ...(params.hl ? { hl: params.hl } : {}),
    ...(params.currency || user.currency ? { currency: params.currency || user.currency } : {}),
    vacation_rentals: params.vacation_rentals ?? false,
  };

  const endpoint = '/v1/search/hotel-details';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DETAILS_TIMEOUT_MS);

  try {
    console.log('🏨 Obteniendo detalles del hotel...');

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Always extract rate limit headers
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      throw await parseHotelError(response, endpoint);
    }

    const data = await response.json();
    console.log('[raw-api] getHotelDetails:', {
      id: data?.id,
      name: data?.name,
      ratings: data?.ratings,
      reviews_breakdown: data?.reviews_breakdown,
    });
    const transformed = adaptHotelDetails(data, params);

    return { property: transformed };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Re-throw HotelApiError as-is
    if (error instanceof HotelApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    console.error('❌ Error en getHotelDetails():', error);
    throw error;
  }
}

// ==========================================
// GET HOTEL ROOMS
// ==========================================

/**
 * Get available rooms for a hotel.
 *
 * TODO: Verify backend endpoint /v1/search/hotel-rooms exists.
 * If not implemented yet, this call will fail with a network error.
 *
 * Raw fetch with credentials:"include" for cookie-based auth.
 * 20s timeout via AbortController.
 */
export async function getHotelRooms(
  hotelId: string,
  params: {
    check_in_date: string;
    check_out_date: string;
    adults: number;
    children: number;
    children_ages?: number[];
  },
): Promise<HotelRoomsResponse> {
  const user = getUserPreferences();

  const body: Record<string, unknown> = {
    id: hotelId,
    check_in_date: params.check_in_date,
    check_out_date: params.check_out_date,
    adults: params.adults || 2,
    children: params.children || 0,
    children_ages: params.children_ages || [],
    gl: user.gl,
    hl: user.hl,
    currency: user.currency,
  };

  const endpoint = '/v1/search/hotel-rooms';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ROOMS_TIMEOUT_MS);

  try {
    console.log('🏨 Obteniendo habitaciones...');

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Always extract rate limit headers
    extractRateLimitHeaders(response, endpoint);

    if (!response.ok) {
      throw await parseHotelError(response, endpoint);
    }

    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Re-throw HotelApiError as-is
    if (error instanceof HotelApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    console.error('❌ Error en getHotelRooms():', error);
    throw error;
  }
}

// ==========================================
// GET HOTEL DETAILS — SERVER-SAFE
// ==========================================

/**
 * Server-safe version of getHotelDetails for SSR pages.
 * Does NOT call getUserPreferences() (localStorage unavailable on server).
 * Forwards Cookie header manually via cookieHeader param.
 * Deduces gl/hl/currency from cookies or falls back to defaults.
 */
export async function getHotelDetailsServer(
  hotelId: string,
  searchParams: {
    query: string;
    check_in_date: string;
    check_out_date: string;
    adults?: string;
    children?: string;
    gl?: string;
    hl?: string;
    currency?: string;
    vacation_rentals?: string;
  },
  cookieHeader: string | null,
): Promise<{
  property: ReturnType<typeof adaptHotelDetails>;
}> {
  if (!hotelId || hotelId.trim() === '') {
    throw new HotelApiError('VALIDATION_ERROR', 400, 'Se requiere el ID del hotel');
  }

  // Deduce defaults from cookies (server-side, no localStorage)
  let gl = searchParams.gl || '';
  let hl = searchParams.hl || '';
  let currency = searchParams.currency || '';

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      const [key, value] = cookie.split('=');
      if (key === 'gl') gl = gl || decodeURIComponent(value || '');
      if (key === 'hl') hl = hl || decodeURIComponent(value || '');
      if (key === 'currency') currency = currency || decodeURIComponent(value || '');
    }
  }

  const body: Record<string, unknown> = {
    id: hotelId,
    query: searchParams.query,
    check_in_date: searchParams.check_in_date,
    check_out_date: searchParams.check_out_date,
    adults: parseInt(searchParams.adults || '2', 10),
    // SSR path does not receive children_ages from URL params, so children is always 0.
    // This avoids sending children=1 with empty ages to SerpAPI.
    children: 0,
    children_ages: [],
    ...(gl ? { gl } : {}),
    ...(hl ? { hl } : {}),
    ...(currency ? { currency } : {}),
    vacation_rentals: searchParams.vacation_rentals === 'true',
  };

  const endpoint = '/v1/search/hotel-details';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DETAILS_TIMEOUT_MS);

  try {
    console.log('🏨 [SSR] Obteniendo detalles del hotel...');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw await parseHotelError(response, endpoint);
    }

    const data = await response.json();
    console.log('[raw-api] getHotelDetailsServer:', {
      id: data?.id,
      name: data?.name,
      ratings: data?.ratings,
      reviews_breakdown: data?.reviews_breakdown,
    });
    const transformed = adaptHotelDetails(data, searchParams as unknown as SearchParams);

    return { property: transformed };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof HotelApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición ha excedido el tiempo de espera.');
    }

    console.error('❌ Error en getHotelDetailsServer():', error);
    throw error;
  }
}

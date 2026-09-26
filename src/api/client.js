import axios from 'axios';

const apiHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

const api = axios.create({
  baseURL: `http://${apiHost}/api`,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
  // Timeout to prevent hanging requests
  timeout: 30000,
});

// ============================================================================
// IN-FLIGHT DEDUPLICATION + SHORT-LIVED RESPONSE CACHE
// Prevents duplicate GET requests AND caches responses for 3 seconds
// to avoid redundant network calls when switching tabs/components quickly
// ============================================================================
const inFlightRequests = new Map();
const responseCache = new Map();
const CACHE_TTL_MS = 3000; // 3 seconds — enough for tab switches, not stale for real data

// Attach token and active outlet automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pos_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const activeBusinessId = localStorage.getItem('pos_active_business_id');
  if (activeBusinessId) {
    config.headers['X-Business-Id'] = activeBusinessId;
  }

  const user = JSON.parse(localStorage.getItem('pos_user') || '{}');
  const isEmployeeOrOutletUser = user.role && !['owner_bisnis', 'owner', 'admin', 'owner_website', 'superadmin_platform', 'superadmin'].includes(user.role);

  // If user is employee/outlet user, ALWAYS force their user.outlet_id
  const activeOutletId = (isEmployeeOrOutletUser && user.outlet_id)
    ? String(user.outlet_id)
    : (localStorage.getItem('pos_active_outlet_id') || user.outlet_id);

  if (activeOutletId && activeOutletId !== 'ALL' && activeOutletId !== 'all') {
    config.headers['X-Outlet-Id'] = activeOutletId;
    // Auto attach outlet_id param to GET requests if not explicitly specified
    if (config.method === 'get' && config.params && config.params.outlet_id === undefined) {
      config.params.outlet_id = activeOutletId;
    } else if (config.method === 'get' && !config.params) {
      config.params = { outlet_id: activeOutletId };
    }
  }

  return config;
});

// Build a cache key from URL + params + context
function buildCacheKey(url, config = {}) {
  return `${url}:${JSON.stringify(config.params || {})}:${localStorage.getItem('pos_active_outlet_id') || ''}:${localStorage.getItem('pos_active_business_id') || ''}`;
}

// Wrap api.get with deduplication + short-lived caching
const originalGet = api.get.bind(api);
api.get = function (url, config = {}) {
  // Bypass deduplication/cache if explicitly requested
  if (config.skipDedupe || config.skipCache) {
    return originalGet(url, config);
  }

  const key = buildCacheKey(url, config);

  // Return cached response if still fresh
  const cached = responseCache.get(key);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    return Promise.resolve(cached.response);
  }

  // Return in-flight promise if same request is already pending
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const promise = originalGet(url, config)
    .then(response => {
      // Cache the successful response
      responseCache.set(key, { response, ts: Date.now() });
      return response;
    })
    .finally(() => {
      // Clear in-flight tracker after microtask
      setTimeout(() => inFlightRequests.delete(key), 50);
    });

  inFlightRequests.set(key, promise);
  return promise;
};

// Invalidate cache for a specific endpoint pattern (call after mutations)
api.invalidateCache = function (urlPattern) {
  if (!urlPattern) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.includes(urlPattern)) {
      responseCache.delete(key);
    }
  }
};

// Clear cache on outlet/business change
if (typeof window !== 'undefined') {
  window.addEventListener('pos:outlet_changed', () => responseCache.clear());
  window.addEventListener('pos:business_changed', () => responseCache.clear());
}

// Handle 401 globally (only redirect if not already on /login)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      responseCache.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

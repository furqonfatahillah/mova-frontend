import axios from 'axios';

const getBaseUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol;
    const host = window.location.hostname;
    // If running on dev localhost (e.g. port 5173), default to port 8000 for standard Laravel backend
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${proto}//${host}:8000/api`;
    }
    return `${proto}//${window.location.host}/api`;
  }
  return 'http://localhost:8000/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
  // Timeout to prevent hanging requests
  timeout: 30000,
});

export const getMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const baseUrl = (api.defaults.baseURL || getBaseUrl() || '').replace(/\/api\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
};

// ============================================================================
// IN-FLIGHT DEDUPLICATION + SHORT-LIVED RESPONSE CACHE
// Prevents duplicate GET requests AND caches responses for 3 seconds
// Auto-invalidates immediately when any mutation (POST/PUT/PATCH/DELETE) occurs
// ============================================================================
const inFlightRequests = new Map();
const responseCache = new Map();
const CACHE_TTL_MS = 2500; // 2.5 seconds max for quick tab/component switches

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

  // Auto-invalidate GET cache on mutating requests (POST, PUT, PATCH, DELETE)
  const method = (config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    responseCache.clear();
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
  (res) => {
    // If mutation succeeded, ensure cache is cleared
    const method = (res.config?.method || 'get').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      responseCache.clear();
    }
    return res;
  },
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

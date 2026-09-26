import axios from 'axios';

const apiHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

const api = axios.create({
  baseURL: `http://${apiHost}/api`,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
});

// In-flight request deduplicator to prevent parallel duplicate GET network calls
const inFlightRequests = new Map();

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

// Wrap api.get with in-flight deduplication
const originalGet = api.get.bind(api);
api.get = function (url, config = {}) {
  // If skipDedupe is specified or method is not GET, bypass
  if (config.skipDedupe) {
    return originalGet(url, config);
  }

  const key = `${url}:${JSON.stringify(config.params || {})}:${localStorage.getItem('pos_active_outlet_id') || ''}:${localStorage.getItem('pos_active_business_id') || ''}`;

  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const promise = originalGet(url, config)
    .finally(() => {
      // Clear after short microtask to allow all concurrent components to share the same response
      setTimeout(() => inFlightRequests.delete(key), 120);
    });

  inFlightRequests.set(key, promise);
  return promise;
};

// Handle 401 globally (only redirect if not already on /login)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

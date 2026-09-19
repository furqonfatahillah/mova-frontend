import axios from 'axios';

const apiHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

const api = axios.create({
  baseURL: `http://${apiHost}/api`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

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

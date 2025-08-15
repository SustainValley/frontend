import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://3.27.150.124:8080/hackathon';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

const getAccessToken = () => localStorage.getItem(ACCESS_KEY) || '';
const setAccessToken = (t) => (t ? localStorage.setItem(ACCESS_KEY, t) : localStorage.removeItem(ACCESS_KEY));
const getRefreshToken = () => localStorage.getItem(REFRESH_KEY) || '';
const setRefreshToken = (t) => (t ? localStorage.setItem(REFRESH_KEY, t) : localStorage.removeItem(REFRESH_KEY));
export const setTokens = ({ accessToken, refreshToken }) => {
  if (accessToken) setAccessToken(accessToken);
  if (refreshToken) setRefreshToken(refreshToken);
};
export const clearAuth = () => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
};

const instance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 10000,
});

const refreshClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 10000,
});

let isRefreshing = false;
let queue = [];
const waitForToken = () => new Promise((resolve, reject) => queue.push({ resolve, reject }));
const flushQueue = (err, token) => {
  queue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve(token)));
  queue = [];
};

async function refreshAccessToken() {
  const rt = getRefreshToken();
  try {
    const { data } = await refreshClient.post('/api/auth/refresh', {});
    const nextAccess = data?.accessToken || data?.token;
    if (!nextAccess) throw new Error('no access token in POST refresh');
    setAccessToken(nextAccess);
    if (data?.refreshToken) setRefreshToken(data.refreshToken);
    return nextAccess;
  } catch {
    const headers = rt ? { Authorization: `Bearer ${rt}` } : {};
    const { data } = await refreshClient.get('/api/auth/refresh', { headers });
    const nextAccess = data?.accessToken || data?.token;
    if (!nextAccess) throw new Error('no access token in GET refresh');
    setAccessToken(nextAccess);
    if (data?.refreshToken) setRefreshToken(data.refreshToken);
    return nextAccess;
  }
}

instance.interceptors.request.use((config) => {
  const at = getAccessToken();
  if (at) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${at}`;
  }
  return config;
});

instance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    const original = config || {};
    if (!response) return Promise.reject(error);

    const url = (original.url || '').toLowerCase();
    const isAuthApi =
      url.includes('/api/auth/login') ||
      url.includes('/api/users/login') ||
      url.includes('/api/auth/refresh') ||
      url.includes('/api/auth/logout');

    if (response.status !== 401 || original._retry || isAuthApi) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      try {
        const newToken = await waitForToken();
        original._retry = true;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return instance(original);
      } catch (e) {
        return Promise.reject(e);
      }
    }

    original._retry = true;
    isRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      flushQueue(null, newToken);
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newToken}`;
      return instance(original);
    } catch (e) {
      flushQueue(e, null);
      clearAuth();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

export default instance;

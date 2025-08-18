import axios from "axios";

const isProd = process.env.NODE_ENV === "production";

const BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (isProd ? "/hackathon" : "http://localhost:8080/hackathon");

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const USER_ID_KEY = "user_id"; 

// === LocalStorage helpers ===
const getAccessToken = () => localStorage.getItem(ACCESS_KEY) || "";
const setAccessToken = (t) =>
  t ? localStorage.setItem(ACCESS_KEY, t) : localStorage.removeItem(ACCESS_KEY);

const getRefreshToken = () => localStorage.getItem(REFRESH_KEY) || "";
const setRefreshToken = (t) =>
  t ? localStorage.setItem(REFRESH_KEY, t) : localStorage.removeItem(REFRESH_KEY);

export const getUserId = () => localStorage.getItem(USER_ID_KEY) || "";
const setUserId = (id) =>
  id ? localStorage.setItem(USER_ID_KEY, id) : localStorage.removeItem(USER_ID_KEY);

export const setTokens = ({ accessToken, refreshToken, userId }) => {
  if (accessToken) setAccessToken(accessToken);
  if (refreshToken) setRefreshToken(refreshToken);
  if (userId) setUserId(userId);
};

export const clearAuth = () => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_ID_KEY);
};

// === Axios instances ===
const instance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// ✅ refresh 전용 클라이언트 (interceptor 없음, 쿠키 불필요)
export const refreshClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// === Refresh ===
async function refreshAccessToken() {
  const rt = getRefreshToken();
  if (!rt) throw new Error("No refresh token available");

  const { data } = await refreshClient.post(
    "/api/users/refresh",
    {},
    { headers: { Authorization: `Bearer ${rt}` } }
  );

  const nextAccess = data?.accessToken;
  if (!nextAccess) throw new Error("No access token in refresh response");

  setAccessToken(nextAccess);
  if (data?.refreshToken) setRefreshToken(data.refreshToken);

  return nextAccess;
}

// === Request interceptor (accessToken) ===
instance.interceptors.request.use((config) => {
  const at = getAccessToken();
  if (at) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${at}`;
  }
  return config;
});

// === Response interceptor (401 → refresh) ===
let isRefreshing = false;
let queue = [];

const waitForToken = () =>
  new Promise((resolve, reject) => queue.push({ resolve, reject }));

const flushQueue = (err, token) => {
  queue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve(token)));
  queue = [];
};

instance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    if (!response) throw error;

    const original = config || {};
    const status = response.status;

    if (status !== 401 || original._retry) {
      throw error;
    }

    if (isRefreshing) {
      const newToken = await waitForToken();
      original._retry = true;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newToken}`;
      return instance(original);
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
      if (typeof window !== "undefined") window.location.href = "/login";
      throw e;
    } finally {
      isRefreshing = false;
    }
  }
);

export default instance;

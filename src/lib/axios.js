// src/lib/axios.js
import axios from 'axios';

const isProd = process.env.NODE_ENV === 'production';

// ✅ Swagger 기준: 모든 API는 /hackathon/api 아래에 존재
//    - 배포: 동일 도메인 리버스 프록시가 있으면 상대경로('/hackathon/api') 사용
//    - 별도 도메인/아이피로 직접 칠 땐 REACT_APP_API_BASE_URL을 절대경로로 지정
//      예) http://3.27.150.124:8080/hackathon/api
const BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (isProd ? '/hackathon' : 'http://localhost:8080/hackathon');

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

const getAccessToken = () => localStorage.getItem(ACCESS_KEY) || '';
const setAccessToken = (t) =>
  t ? localStorage.setItem(ACCESS_KEY, t) : localStorage.removeItem(ACCESS_KEY);
const getRefreshToken = () => localStorage.getItem(REFRESH_KEY) || '';
const setRefreshToken = (t) =>
  t ? localStorage.setItem(REFRESH_KEY, t) : localStorage.removeItem(REFRESH_KEY);

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

// ---- Refresh 로직 ----
let isRefreshing = false;
let queue = [];
const waitForToken = () =>
  new Promise((resolve, reject) => queue.push({ resolve, reject }));
const flushQueue = (err, token) => {
  queue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve(token)));
  queue = [];
};

async function refreshAccessToken() {
  const rt = getRefreshToken();
  const headers = {};
  if (rt) headers.Authorization = `Bearer ${rt}`;

  // ✅ baseURL가 이미 /hackathon/api 이므로 여기서는 '/auth/refresh'만!
  const { data } = await refreshClient.post(
    '/auth/refresh',
    rt ? { refreshToken: rt } : {},
    { headers }
  );

  const nextAccess = data?.accessToken || data?.token;
  if (!nextAccess) throw new Error('No access token in refresh response');

  setAccessToken(nextAccess);
  if (data?.refreshToken) setRefreshToken(data.refreshToken);
  return nextAccess;
}

// ---- 요청 인터셉터 ----
instance.interceptors.request.use((config) => {
  const at = getAccessToken();
  if (at) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${at}`;
  }
  return config;
});

// ---- 응답 인터셉터 ----
instance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    if (!response) throw error;

    const original = config || {};
    const status = response.status;
    const url = (original.url || '').toLowerCase();

    // ✅ 인증 관련 경로 식별 (이제 '/api' 접두어 없음)
    const isAuthApi =
      url.includes('/auth/login') ||
      url.includes('/users/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout');

    // 401이 아닌 경우, 혹은 이미 재시도한 경우, 혹은 인증 API 자체면 통과
    if (status !== 401 || original._retry || isAuthApi) {
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
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw e;
    } finally {
      isRefreshing = false;
    }
  }
);

export default instance;

// 디버깅용
if (typeof window !== 'undefined') {
  // 실제 어디로 날아가는지 한 번만 찍어보기
  // console.log('[API BASE_URL]', BASE_URL);
}

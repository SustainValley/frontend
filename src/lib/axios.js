import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_BASE_URL || "/hackathon";

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const USER_ID_KEY = "user_id";
const TYPE_KEY = "type";
const CAFE_ID_KEY = "cafe_id";
const HAS_PHONE_KEY = "has_phone_number";

const getAccessToken = () => localStorage.getItem(ACCESS_KEY) || "";
const setAccessToken = (t) =>
  t ? localStorage.setItem(ACCESS_KEY, t) : localStorage.removeItem(ACCESS_KEY);

const getRefreshToken = () => localStorage.getItem(REFRESH_KEY) || "";
const setRefreshToken = (t) =>
  t ? localStorage.setItem(REFRESH_KEY, t) : localStorage.removeItem(REFRESH_KEY);

export const getUserId = () => localStorage.getItem(USER_ID_KEY) || "";
const setUserId = (id) =>
  id ? localStorage.setItem(USER_ID_KEY, id) : localStorage.removeItem(USER_ID_KEY);

export const getType = () => localStorage.getItem(TYPE_KEY) || "";
const setType = (type) =>
  type ? localStorage.setItem(TYPE_KEY, type) : localStorage.removeItem(TYPE_KEY);

export const getCafeId = () => {
  const v = localStorage.getItem(CAFE_ID_KEY);
  return v ?? "";
};
const setCafeId = (id) => {
  if (id === null || id === undefined || id === "") {
    localStorage.removeItem(CAFE_ID_KEY);
  } else {
    localStorage.setItem(CAFE_ID_KEY, String(id));
  }
};


export const getHasPhoneNumber = () =>
  localStorage.getItem(HAS_PHONE_KEY) === "1";
const setHasPhoneNumber = (v) => {
  if (v === undefined || v === null) return;
  localStorage.setItem(HAS_PHONE_KEY, v ? "1" : "0");
};

export const setTokens = ({
  accessToken,
  refreshToken,
  userId,
  type,
  cafeId,
  hasPhoneNumber,
}) => {
  if (accessToken) setAccessToken(accessToken);
  if (refreshToken) setRefreshToken(refreshToken);
  if (userId !== undefined) setUserId(userId);
  if (type) setType(type);
  if (cafeId !== undefined) setCafeId(cafeId);
  if (hasPhoneNumber !== undefined) setHasPhoneNumber(hasPhoneNumber);
};

export const clearAuth = () => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(TYPE_KEY);
  localStorage.removeItem(CAFE_ID_KEY);
  localStorage.removeItem(HAS_PHONE_KEY);
};

const instance = axios.create({
  baseURL: BASE_URL,
  timeout: 100000,
});

export const refreshClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

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
  if (data?.type) setType(data.type);
  if (data?.cafeId !== undefined) setCafeId(data.cafeId);
  if (data?.hasPhoneNumber !== undefined) setHasPhoneNumber(data.hasPhoneNumber);

  return nextAccess;
}

instance.interceptors.request.use((config) => {
  const at = getAccessToken();
  if (at) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${at}`;
  }
  if (process.env.NODE_ENV !== "production") {
    const fullUrl = `${config.baseURL || ""}${config.url || ""}`;
    console.debug("[API]", config.method?.toUpperCase(), fullUrl);
  }
  return config;
});

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

    if (!response) {
      console.error("[API NETWORK/CORS ERROR]", error?.message);
      throw error;
    }

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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
      throw e;
    } finally {
      isRefreshing = false;
    }
  }
);

export default instance;

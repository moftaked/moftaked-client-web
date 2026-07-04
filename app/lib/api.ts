import axios from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    __suppressGlobalError?: boolean;
    _retryCount?: number;
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 20000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isTimeoutOrNetwork = error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK';
    if (isTimeoutOrNetwork && originalRequest && (!originalRequest._retryCount || originalRequest._retryCount < 2)) {
      originalRequest._retryCount = (originalRequest._retryCount ?? 0) + 1;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, originalRequest._retryCount)));
      return api(originalRequest);
    }

    // All 401s → refresh or redirect, NEVER show error dialog
    if (error.response?.status === 401) {
      if (
        !originalRequest._retry &&
        !originalRequest.url?.includes('/auth/login') &&
        !originalRequest.url?.includes('/auth/refresh')
      ) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            originalRequest.headers.Authorization = token;
            return api(originalRequest);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const response = await axios.post(
            `${import.meta.env.VITE_API_URL}/auth/refresh`,
            {},
            { withCredentials: true }
          );

          const { access_token } = response.data.data;
          localStorage.setItem('authToken', access_token);

          processQueue(null, access_token);

          originalRequest.headers.Authorization = access_token;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('authToken');
          window.location.href = '/login';
          failedQueue = [];
          return new Promise<never>(() => {});
        } finally {
          isRefreshing = false;
        }
      }

      // 401 on login/refresh or a retry that still got 401 → just redirect
      localStorage.removeItem('authToken');
      window.location.href = '/login';
      return new Promise<never>(() => {});
    }

    // Don't dispatch global error for network or client errors — they are
    // expected and the calling code already handles them gracefully.
    if (error.code !== 'ERR_NETWORK') {
      const err = error instanceof Error ? error : new Error(error.message ?? String(error));
      const status = error.response?.status;
      if (status && status < 500) return Promise.reject(error);
      const data = error.response?.data;
      if (data?.message) err.message = data.message;
      if (status) err.message = `[${status}] ${err.message}`;

      // Prefetch requests set this flag to avoid showing the error dialog
      // for transient 5xx errors that are handled silently by the prefetch code.
      if ((error.config as any)?.__suppressGlobalError) return Promise.reject(error);

      window.dispatchEvent(new CustomEvent("app-error", { detail: err }));
    }
    return Promise.reject(error);
  }
);

export default api;

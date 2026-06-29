import axios from 'axios';

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

    if (
      error.response?.status === 401 &&
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
        processQueue(error, null);
        localStorage.removeItem('authToken');
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    // Don't dispatch global error for network errors — they are expected when
    // offline and the calling code already handles them gracefully.
    if (error.code !== 'ERR_NETWORK') {
      const err = error instanceof Error ? error : new Error(error.message ?? String(error));
      const status = error.response?.status;
      const data = error.response?.data;
      if (data?.message) err.message = data.message;
      if (status) err.message = `[${status}] ${err.message}`;

      window.dispatchEvent(new CustomEvent("app-error", { detail: err }));
    }
    return Promise.reject(error);
  }
);

export default api;

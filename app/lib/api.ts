import axios from 'axios';
import { redirect } from 'react-router';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  }
});

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
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('authToken');
      return Promise.reject(redirect('/login'));
    }

    const err = error instanceof Error ? error : new Error(error.message ?? String(error));
    const status = error.response?.status;
    const data = error.response?.data;
    if (data?.message) err.message = data.message;
    if (status) err.message = `[${status}] ${err.message}`;

    window.dispatchEvent(new CustomEvent("app-error", { detail: err }));
    return Promise.reject(error);
  }
);

export default api;
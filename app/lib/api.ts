import axios from 'axios';
import { useNavigate, type NavigateFunction } from 'react-router';

let navigate: NavigateFunction | null = null;

export const setNavigate = (navigateFunction: NavigateFunction) => {
  navigate = navigateFunction;
};

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
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (navigate) {
        navigate('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
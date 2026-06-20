import axios from 'axios';

// 后端 API 基础地址，可通过 VITE_API_BASE_URL 环境变量覆盖；
// 默认连本地 FastAPI（http://127.0.0.1:8000/api）
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';

// Axios 实例，15 秒超时，所有后端接口统一使用此实例
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

export default api;

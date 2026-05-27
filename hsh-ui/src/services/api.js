import axios from 'axios';

// 后端 API 基础地址，部署到服务器后改为服务器地址
const API_BASE = 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

export default api;

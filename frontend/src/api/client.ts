import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || '/api';
export const api = axios.create({ baseURL: API_URL, withCredentials: true });
let csrfToken = null;
export const fetchCsrfToken = async () => {
  const res = await axios.get(`${API_URL}/csrf-token`, { withCredentials: true });
  csrfToken = res.data.csrfToken;
  return csrfToken;
};
api.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
    if (!csrfToken) await fetchCsrfToken();
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});
fetchCsrfToken();
export default api;

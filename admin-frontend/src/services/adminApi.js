import axios from 'axios';

const adminApi = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_API_URL || '/admin-api',
  // Evita request pendurada indefinidamente (ex.: backend acordando/instável):
  // falha em ~20s para a UI conseguir mostrar um erro em vez de "Entrando..." eterno.
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

adminApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      // Só redireciona se NÃO estiver já no login. Redirecionar estando na própria
      // tela de login recarrega a página e apaga a mensagem de erro antes de o
      // usuário lê-la (ex.: "Credenciais inválidas"). Na tela de login, deixamos o
      // próprio LoginPage tratar o erro.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;

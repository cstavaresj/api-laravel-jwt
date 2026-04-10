/**
 * API Module — Comunicação com o backend Laravel JWT
 *
 * Responsável por todas as requisições HTTP à API.
 * Injeta automaticamente o Bearer token quando disponível.
 */
const Api = (() => {
    // Base URL do backend Laravel
    const BASE_URL = 'http://localhost:8000/api';

    /**
     * Faz uma requisição à API.
     * @param {string} method - HTTP method (GET, POST, PATCH, DELETE)
     * @param {string} endpoint - Endpoint relativo (ex: '/auth/login')
     * @param {object|null} data - Body da requisição (para POST/PATCH)
     * @param {boolean} withAuth - Se deve incluir o token Bearer
     * @returns {Promise<{ok: boolean, status: number, data: object}>}
     */
    async function request(method, endpoint, data = null, withAuth = true) {
        const url = `${BASE_URL}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        // Inject Bearer token if available and requested
        if (withAuth) {
            const token = localStorage.getItem('jwt_token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        const options = { method, headers };

        if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            const responseData = await response.json();

            return {
                ok: response.ok,
                status: response.status,
                data: responseData,
            };
        } catch (error) {
            console.error('API Request Error:', error);
            return {
                ok: false,
                status: 0,
                data: {
                    success: false,
                    message: 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.',
                },
            };
        }
    }

    // ---- Auth Endpoints ----

    async function login(email, password) {
        return request('POST', '/auth/login', { email, password }, false);
    }

    async function register(name, email, password, password_confirmation) {
        return request('POST', '/auth/register', {
            name, email, password, password_confirmation
        }, false);
    }

    async function me() {
        return request('GET', '/auth/me');
    }

    async function logout() {
        return request('POST', '/auth/logout');
    }

    async function refresh() {
        return request('POST', '/auth/refresh');
    }

    // ---- User Endpoints ----

    async function updateProfile(data) {
        return request('PATCH', '/user/profile', data);
    }

    // ---- Status ----

    async function status() {
        return request('GET', '/', null, false);
    }

    return { login, register, me, logout, refresh, updateProfile, status };
})();

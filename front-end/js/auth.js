/**
 * Auth Module — Gerenciamento de Token JWT
 *
 * Responsável por salvar, recuperar, decodificar e validar tokens.
 * Gerencia o timer de expiração e redirecionamentos.
 */
const Auth = (() => {
    const TOKEN_KEY = 'jwt_token';
    const EXPIRES_KEY = 'jwt_expires_at';

    let timerInterval = null;

    /**
     * Salva o token e calcula a data de expiração.
     */
    function saveToken(accessToken, expiresInSeconds) {
        localStorage.setItem(TOKEN_KEY, accessToken);
        const expiresAt = Date.now() + (expiresInSeconds * 1000);
        localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
    }

    /**
     * Retorna o token armazenado.
     */
    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    /**
     * Remove o token e dados de expiração.
     */
    function removeToken() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(EXPIRES_KEY);
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    /**
     * Verifica se o usuário está autenticado (tem token não expirado).
     */
    function isAuthenticated() {
        const token = getToken();
        if (!token) return false;

        const expiresAt = parseInt(localStorage.getItem(EXPIRES_KEY) || '0');
        if (Date.now() > expiresAt) {
            removeToken();
            return false;
        }

        return true;
    }

    /**
     * Retorna os segundos restantes até a expiração.
     */
    function getSecondsRemaining() {
        const expiresAt = parseInt(localStorage.getItem(EXPIRES_KEY) || '0');
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        return remaining;
    }

    /**
     * Formata segundos em MM:SS.
     */
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    /**
     * Decodifica o payload do JWT (base64) sem validar assinatura.
     * Usado apenas para exibição visual.
     */
    function decodePayload(token) {
        try {
            const base64Payload = token.split('.')[1];
            const payload = atob(base64Payload.replace(/-/g, '+').replace(/_/g, '/'));
            return JSON.parse(payload);
        } catch {
            return null;
        }
    }

    /**
     * Inicia o timer de expiração do token.
     * Chama o callback a cada segundo com (secondsRemaining, isExpired).
     */
    function startTimer(callback) {
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            const remaining = getSecondsRemaining();
            const isExpired = remaining <= 0;

            callback(remaining, isExpired);

            if (isExpired) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }, 1000);

        // Immediate first call
        const remaining = getSecondsRemaining();
        callback(remaining, remaining <= 0);
    }

    /**
     * Realiza o logout: chama API, remove token e redireciona.
     */
    async function logout() {
        try {
            if (typeof Api !== 'undefined') {
                await Api.logout();
            }
        } catch {
            // Even if API fails, we still logout locally
        }
        removeToken();
        window.location.href = 'login.html';
    }

    /**
     * Sanitiza string para prevenir XSS ao inserir no DOM.
     */
    function sanitize(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return {
        saveToken,
        getToken,
        removeToken,
        isAuthenticated,
        getSecondsRemaining,
        formatTime,
        decodePayload,
        startTimer,
        logout,
        sanitize,
    };
})();

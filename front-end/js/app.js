/**
 * App Module — Lógica das Páginas
 *
 * Inicializa cada página com seus event listeners e lógica específica.
 */
const App = (() => {

    // ---- Helpers ----

    function showAlert(alertId, textId, message, type = 'danger') {
        const alertEl = document.getElementById(alertId);
        const textEl = document.getElementById(textId);
        if (!alertEl || !textEl) return;

        // Remove all type classes
        alertEl.className = 'alert-custom mb-3 show';
        alertEl.classList.add(`alert-${type}-custom`);

        // Sanitize message before inserting
        textEl.textContent = message;
        alertEl.style.display = 'flex';

        // Auto hide after 8 seconds
        setTimeout(() => {
            alertEl.style.display = 'none';
        }, 8000);
    }

    function hideAlert(alertId) {
        const el = document.getElementById(alertId);
        if (el) el.style.display = 'none';
    }

    function setLoading(btnId, textId, loadingId, isLoading) {
        const btn = document.getElementById(btnId);
        const text = document.getElementById(textId);
        const loading = document.getElementById(loadingId);
        if (!btn || !text || !loading) return;

        btn.disabled = isLoading;
        text.classList.toggle('d-none', isLoading);
        loading.classList.toggle('d-none', !isLoading);
    }

    /**
     * Extracts the first error message from Laravel validation response.
     */
    function getValidationError(data) {
        if (data.message) {
            // Check if there are detailed errors
            if (data.errors) {
                const firstKey = Object.keys(data.errors)[0];
                if (firstKey && data.errors[firstKey].length > 0) {
                    return data.errors[firstKey][0];
                }
            }
            return data.message;
        }
        return 'Ocorreu um erro inesperado.';
    }

    // ===== LOGIN PAGE =====
    function initLoginPage() {
        const form = document.getElementById('login-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert('login-alert');

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            // Client-side validation
            if (!email || !password) {
                showAlert('login-alert', 'login-alert-text', 'Preencha todos os campos.');
                return;
            }

            setLoading('login-btn', 'login-btn-text', 'login-btn-loading', true);

            const result = await Api.login(email, password);

            setLoading('login-btn', 'login-btn-text', 'login-btn-loading', false);

            if (result.ok && result.data.access_token) {
                Auth.saveToken(result.data.access_token, result.data.expires_in);
                window.location.href = 'dashboard.html';
            } else {
                let message = 'Credenciais inválidas.';
                if (result.status === 429) {
                    message = 'Muitas tentativas. Aguarde 1 minuto e tente novamente.';
                } else if (result.status === 422) {
                    message = getValidationError(result.data);
                } else if (result.data?.message) {
                    message = result.data.message;
                }
                showAlert('login-alert', 'login-alert-text', message);
            }
        });
    }

    // ===== REGISTER PAGE =====
    function initRegisterPage() {
        const form = document.getElementById('register-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert('register-alert');

            const name = document.getElementById('register-name').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            const passwordConfirm = document.getElementById('register-password-confirm').value;

            // Client-side validation
            if (!name || !email || !password || !passwordConfirm) {
                showAlert('register-alert', 'register-alert-text', 'Preencha todos os campos.');
                return;
            }

            if (password.length < 8) {
                showAlert('register-alert', 'register-alert-text', 'A senha deve ter no mínimo 8 caracteres.');
                return;
            }

            if (password !== passwordConfirm) {
                showAlert('register-alert', 'register-alert-text', 'As senhas não conferem.');
                return;
            }

            setLoading('register-btn', 'register-btn-text', 'register-btn-loading', true);

            const result = await Api.register(name, email, password, passwordConfirm);

            setLoading('register-btn', 'register-btn-text', 'register-btn-loading', false);

            if (result.ok) {
                showAlert('register-alert', 'register-alert-text', 'Cadastro realizado! Redirecionando...', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } else {
                const message = result.status === 422
                    ? getValidationError(result.data)
                    : (result.data?.message || 'Erro ao cadastrar.');
                showAlert('register-alert', 'register-alert-text', message);
            }
        });
    }

    // ===== DASHBOARD PAGE =====
    function initDashboardPage() {
        loadUserProfile();
        loadApiStatus();
        initTokenInfo();
        initEditForm();
        initLogoutButton();
        initRefreshButton();
        initCopyButton();
    }

    async function loadUserProfile() {
        const result = await Api.me();

        if (result.ok && result.data.user) {
            const user = result.data.user;
            const nameDisplay = document.getElementById('user-name-display');
            const emailDisplay = document.getElementById('user-email-display');
            const idDisplay = document.getElementById('user-id-display');
            const createdDisplay = document.getElementById('user-created-display');
            const avatarEl = document.getElementById('user-avatar');
            const editName = document.getElementById('edit-name');
            const editEmail = document.getElementById('edit-email');

            if (nameDisplay) nameDisplay.textContent = Auth.sanitize(user.name);
            if (emailDisplay) emailDisplay.textContent = Auth.sanitize(user.email);
            if (idDisplay) idDisplay.textContent = `#${user.id}`;
            if (createdDisplay) {
                const date = new Date(user.created_at);
                createdDisplay.textContent = date.toLocaleDateString('pt-BR');
            }
            if (avatarEl) {
                avatarEl.textContent = user.name.charAt(0).toUpperCase();
            }
            if (editName) editName.value = user.name;
            if (editEmail) editEmail.value = user.email;
        } else if (result.status === 401) {
            console.log('loadUserProfile: API retornou 401 Não Autorizado. Redirecionando...');
            Auth.removeToken();
            window.location.href = 'login.html';
        } else {
            showAlert('dashboard-alert', 'dashboard-alert-text',
                'Erro ao carregar dados do perfil.', 'danger');
        }
    }

    async function loadApiStatus() {
        const result = await Api.status();
        const statusDot = document.getElementById('api-status-dot');
        const statusText = document.getElementById('api-status-text');
        const versionEl = document.getElementById('api-version');

        if (result.ok) {
            if (statusDot) statusDot.classList.add('online');
            if (statusText) statusText.textContent = 'Online';
            if (versionEl && result.data.version) {
                versionEl.textContent = result.data.version;
            }
        } else {
            if (statusDot) { statusDot.classList.add('offline'); }
            if (statusText) statusText.textContent = 'Offline';
        }
    }

    function initTokenInfo() {
        const token = Auth.getToken();
        const tokenDisplay = document.getElementById('token-display');
        if (tokenDisplay && token) {
            tokenDisplay.textContent = token.substring(0, 50) + '...';
        }

        // Start timer
        Auth.startTimer((secondsRemaining, isExpired) => {
            const timerText = document.getElementById('token-timer-text');
            const timerEl = document.getElementById('token-timer');
            const statusDot = document.getElementById('token-status-dot');
            const statusText = document.getElementById('token-status-text');

            if (isExpired) {
                if (timerText) timerText.textContent = 'Token expirado!';
                if (timerEl) timerEl.classList.add('expired');
                if (statusDot) { statusDot.classList.remove('online'); statusDot.classList.add('offline'); }
                if (statusText) statusText.textContent = 'Expirado';
            } else {
                if (timerText) timerText.textContent = `${Auth.formatTime(secondsRemaining)} restantes`;
                if (secondsRemaining <= 60 && timerEl) {
                    timerEl.classList.add('expired');
                }
            }
        });
    }

    function initEditForm() {
        const form = document.getElementById('edit-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAlert('edit-alert');

            const name = document.getElementById('edit-name').value.trim();
            const email = document.getElementById('edit-email').value.trim();

            if (!name && !email) {
                showAlert('edit-alert', 'edit-alert-text', 'Preencha pelo menos um campo.', 'warning');
                return;
            }

            setLoading('edit-btn', 'edit-btn-text', 'edit-btn-loading', true);

            const data = {};
            if (name) data.name = name;
            if (email) data.email = email;

            const result = await Api.updateProfile(data);

            setLoading('edit-btn', 'edit-btn-text', 'edit-btn-loading', false);

            if (result.ok) {
                showAlert('edit-alert', 'edit-alert-text', 'Perfil atualizado com sucesso!', 'success');
                // Reload profile data
                await loadUserProfile();
            } else if (result.status === 401) {
                Auth.removeToken();
                window.location.href = 'login.html';
            } else {
                const message = result.status === 422
                    ? getValidationError(result.data)
                    : (result.data?.message || 'Erro ao atualizar perfil.');
                showAlert('edit-alert', 'edit-alert-text', message);
            }
        });
    }

    function initLogoutButton() {
        const btn = document.getElementById('btn-nav-logout');
        if (!btn) return;

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            await Auth.logout();
        });
    }

    function initRefreshButton() {
        const btn = document.getElementById('btn-refresh-token');
        if (!btn) return;

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Renovando...';

            const result = await Api.refresh();

            if (result.ok && result.data.access_token) {
                Auth.saveToken(result.data.access_token, result.data.expires_in);

                // Update token display
                const tokenDisplay = document.getElementById('token-display');
                if (tokenDisplay) {
                    tokenDisplay.textContent = result.data.access_token.substring(0, 50) + '...';
                }

                // Reset timer visuals
                const timerEl = document.getElementById('token-timer');
                const statusDot = document.getElementById('token-status-dot');
                const statusText = document.getElementById('token-status-text');
                if (timerEl) timerEl.classList.remove('expired');
                if (statusDot) { statusDot.classList.remove('offline'); statusDot.classList.add('online'); }
                if (statusText) statusText.textContent = 'Ativo';

                // Restart timer
                initTokenInfo();

                showAlert('dashboard-alert', 'dashboard-alert-text', 'Token renovado com sucesso!', 'success');
            } else if (result.status === 401) {
                Auth.removeToken();
                window.location.href = 'login.html';
            } else {
                showAlert('dashboard-alert', 'dashboard-alert-text',
                    'Não foi possível renovar o token.', 'danger');
            }

            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Renovar Token';
        });
    }

    function initCopyButton() {
        const btn = document.getElementById('btn-copy-token');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const token = Auth.getToken();
            if (!token) return;

            navigator.clipboard.writeText(token).then(() => {
                btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Copiado!';
                setTimeout(() => {
                    btn.innerHTML = '<i class="bi bi-clipboard me-1"></i>Copiar Token';
                }, 2000);
            }).catch(() => {
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = token;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Copiado!';
                setTimeout(() => {
                    btn.innerHTML = '<i class="bi bi-clipboard me-1"></i>Copiar Token';
                }, 2000);
            });
        });
    }

    return { initLoginPage, initRegisterPage, initDashboardPage };
})();

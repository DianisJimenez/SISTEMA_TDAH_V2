document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const pwdInput = document.getElementById('pwd');
    const toggleBtn = document.getElementById('togglePassword');
    const eyeIcon = document.getElementById('eyeIcon');

    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-banner';
    
    if (loginForm) {
        const submitGroup = loginForm.querySelector('.d-grid');
        loginForm.insertBefore(errorContainer, submitGroup);
    }

    function mostrarError(mensaje) {
        errorContainer.innerHTML = `<i class="ri-error-warning-line"></i> <span>${mensaje}</span>`;
        errorContainer.classList.add('show');
    }

    function ocultarError() {
        errorContainer.classList.remove('show');
        errorContainer.innerHTML = '';
    }

    if (toggleBtn && pwdInput && eyeIcon) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = pwdInput.type === 'password';
            pwdInput.type = isPassword ? 'text' : 'password';
            if (isPassword) {
                eyeIcon.classList.replace('ri-eye-line', 'ri-eye-off-line');
            } else {
                eyeIcon.classList.replace('ri-eye-off-line', 'ri-eye-line');
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            ocultarError();

            const email = document.getElementById('email').value.trim();
            const password = pwdInput.value;
            const submitBtn = loginForm.querySelector('.btn-primary');
            const originalBtnContent = submitBtn.innerHTML;

            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span class="spinner-border" role="status" aria-hidden="true"></span>
                <span>Verificando protocolo...</span>
            `;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (!response.ok) {
                    throw new Error(`Error de servidor: Código ${response.status}`);
                }

                const data = await response.json();

                if (data.success) {
                    localStorage.clear();
                    localStorage.setItem('medicoId', data.medico.id);
                    localStorage.setItem('medicoNombre', data.medico.nombre); 
                    
                    const fotoPerfil = data.medico.foto ? data.medico.foto : 'assets/images/doctor6.png';
                    localStorage.setItem('medicoFoto', fotoPerfil);

                    // Se guarda el acceso ANTERIOR a este login (ya calculado
                    // por el backend antes de sobreescribirlo en la BD). Esto
                    // es lo que se mostrará en perfilMedico.html.
                    localStorage.setItem('ultimoAccesoAnterior', data.ultimoAccesoAnterior || '');

                    window.location.href = 'admi.html';
                } else {
                    mostrarError(data.message || "Credenciales incorrectas.");
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnContent;
                }
            } catch (error) {
                console.error(" Error en autenticación:", error);
                mostrarError("No se pudo establecer conexión con el servidor de DETEC TDAH.");
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnContent;
            }
        });
    }
});
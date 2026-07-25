document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('restablecerForm');

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const id = params.get('id');

    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-banner';

    const successContainer = document.createElement('div');
    successContainer.className = 'error-banner';
    successContainer.style.background = '#e6f4ea';
    successContainer.style.color = '#1e7e34';

    if (form) {
        const submitGroup = form.querySelector('.d-grid');
        form.insertBefore(errorContainer, submitGroup);
        form.insertBefore(successContainer, submitGroup);
    }

    function mostrarError(mensaje) {
        successContainer.classList.remove('show');
        errorContainer.innerHTML = `<i class="ri-error-warning-line"></i> <span>${mensaje}</span>`;
        errorContainer.classList.add('show');
    }

    function mostrarExito(mensaje) {
        errorContainer.classList.remove('show');
        successContainer.innerHTML = `<i class="ri-checkbox-circle-line"></i> <span>${mensaje}</span>`;
        successContainer.classList.add('show');
    }

    // Si falta el token o el id en la URL, el link está mal formado o incompleto
    if (!token || !id) {
        mostrarError("Link inválido o incompleto. Solicita un nuevo enlace de recuperación.");
        if (form) form.querySelector('.btn-primary').disabled = true;
        return;
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const passwordNueva = document.getElementById('passwordNueva').value;
            const passwordConfirmar = document.getElementById('passwordConfirmar').value;
            const submitBtn = form.querySelector('.btn-primary');
            const originalBtnContent = submitBtn.innerHTML;

            if (passwordNueva !== passwordConfirmar) {
                mostrarError("Las contraseñas no coinciden.");
                return;
            }
            if (passwordNueva.length < 8) {
                mostrarError("La contraseña debe tener al menos 8 caracteres.");
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span class="spinner-border" role="status" aria-hidden="true"></span>
                <span>Guardando...</span>
            `;

            try {
                const response = await fetch('/api/restablecer-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, token, passwordNueva })
                });

                const data = await response.json();

                if (data.success) {
                    mostrarExito("Contraseña actualizada. Redirigiendo al login...");
                    form.reset();
                    setTimeout(() => {
                        window.location.href = '/index.html';
                    }, 2000);
                } else {
                    mostrarError(data.error || "No se pudo actualizar la contraseña.");
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnContent;
                }
            } catch (error) {
                console.error("Error al restablecer contraseña:", error);
                mostrarError("No se pudo establecer conexión con el servidor.");
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnContent;
            }
        });
    }
});
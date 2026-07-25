document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('recuperarForm');

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

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value.trim();
            const submitBtn = form.querySelector('.btn-primary');
            const originalBtnContent = submitBtn.innerHTML;

            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span class="spinner-border" role="status" aria-hidden="true"></span>
                <span>Enviando...</span>
            `;

            try {
                const response = await fetch('/api/solicitar-recuperacion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (data.success) {
                    mostrarExito(data.message || "Si el correo existe, se envió un enlace de recuperación.");
                    form.querySelector('#email').value = '';
                } else {
                    mostrarError(data.error || "Ocurrió un error. Intenta de nuevo.");
                }
            } catch (error) {
                console.error("Error al solicitar recuperación:", error);
                mostrarError("No se pudo establecer conexión con el servidor.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnContent;
            }
        });
    }
});
(function() {
    function aplicarConfiguracionVisual() {
        const root = document.documentElement;
        const temaGuardado = localStorage.getItem('selected-theme');

        // Mapa de colores de fondo suaves
        const fondos = {
            'light': '#f4f7f6',
            'dark': '#e9ecef',
            'purple': '#f3e5f5',
            'turquoise': '#e0f2f1',
            'silver': '#f8f9fa'
        };

        if (temaGuardado && temaGuardado !== 'light') {
            root.setAttribute('data-theme', temaGuardado);
            root.style.setProperty('--bg-body', fondos[temaGuardado] || '#f4f7f6');
        } else {
            root.removeAttribute('data-theme');
            root.style.setProperty('--bg-body', '#f4f7f6');
        }
    }

    // Aplicar al cargar
    aplicarConfiguracionVisual();

    // Sincronizar si se cambia en otra pestaña
    window.addEventListener('storage', (e) => {
        if (e.key === 'selected-theme') aplicarConfiguracionVisual();
    });
})();
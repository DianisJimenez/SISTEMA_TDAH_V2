$(window).on('load', function() { 
    $("#loading-wrapper").fadeOut("slow"); 
});

let cachePruebas = []; // Para edición rápida sin reconectar

// Sanitización para prevenir inyección de código maligno (XSS)
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

$(document).ready(function() {
    //  VERIFICACIÓN DE SESIÓN
    const medicoId = localStorage.getItem('medicoId');
    if (!medicoId) { 
        window.location.href = "login.html"; 
        return; 
    }

    //  INICIALIZAR EL LAYOUT DINÁMICO
    if (typeof inicializarLayout === "function") {
        inicializarLayout({
            menuId: 'pruebas', 
            titulo: 'Mis <span class="text-primary">Pruebas</span>'
        });
    }

    //  CARGA INICIAL DE DATOS
    cargarPruebas();

    // EVENTOS DE FORMULARIOS
    $('#formNuevaPrueba').on('submit', function(e) {
        e.preventDefault();
        registrarPrueba();
    });

    $('#formEditarPrueba').on('submit', function(e) {
        e.preventDefault();
        actualizarPrueba();
    });
});

// Obtiene todas las pruebas desde el servidor y las renderiza
async function cargarPruebas() {
    try {
        const response = await fetch('/api/pruebas');
        cachePruebas = await response.json();
        
        $("#contador-pruebas").text(`Pruebas: ${cachePruebas.length}`);

        let html = "";
        cachePruebas.forEach((p, index) => {
            // Evaluamos de forma estricta si el registro cuenta con una ruta de imagen válida
            const tieneImagen = p.imagen_url && p.imagen_url.trim() !== "" && p.imagen_url !== "null";
            
            // Creamos el HTML del contenedor de la imagen:
            // Si tiene imagen, renderiza el tag <img> normal.
            // Si NO tiene, renderiza un div con fondo suave y un icono de Remixicon centrado.
            const mediaHTML = tieneImagen 
                ? `<img src="${escapeHTML('/' + p.imagen_url)}" style="width: 100%; height: 100%; object-fit: cover;">`
                : `<div class="w-100 h-100 d-flex align-items-center justify-content-center bg-light text-secondary">
                     <i class="ri-survey-line" style="font-size: 3.5rem; opacity: 0.5;"></i>
                   </div>`;

            html += `
                <div class="col-xl-4 col-md-6 mb-4">
                    <div class="card device-card-clinical h-100 shadow-sm border-0">
                        <!-- Contenedor superior para la foto o el icono de respaldo -->
                        <div class="device-img-full" style="height: 180px; overflow: hidden; position: relative;">
                            ${mediaHTML}
                        </div>
                        
                        <div class="card-content p-4">
                            <div class="mb-3">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <h5 class="fw-bold text-dark mb-0">${escapeHTML(p.nombre)}</h5>
                                </div>
                                <p class="text-muted small mb-0" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5;">
                                    ${escapeHTML(p.descripcion)}
                                </p>
                            </div>

                            <div class="d-flex justify-content-between align-items-center border-top pt-3">
                                <span class="text-uppercase small fw-bold text-secondary" style="letter-spacing: 0.5px; font-size: 0.7rem;">Prueba cognitiva</span>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-action text-primary" onclick="abrirModalEditar(${index})" title="Editar">
                                        <i class="ri-pencil-line fs-5"></i>
                                    </button>
                                    <button class="btn btn-action text-danger" onclick="eliminarPrueba(${p.id})" title="Eliminar">
                                        <i class="ri-delete-bin-5-line fs-5"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        $('#contenedorPruebas').html(html || '<div class="col-12 text-center py-5 text-muted">No hay pruebas registradas.</div>');

    } catch (error) { 
        console.error("Error al cargar:", error); 
        $('#contenedorPruebas').html('<div class="col-12 text-center py-5 text-danger">Error al conectar con el servidor.</div>');
    }
}

// Envía nueva prueba al backend (incluye imagen)
async function registrarPrueba() {
    const formData = new FormData();
    formData.append('nombre', $('#nombrePrueba').val());
    formData.append('descripcion', $('#descPrueba').val());
    
    const foto = $('#fotoPrueba')[0].files[0];
    if (foto) formData.append('imagen', foto);

    try {
        const res = await fetch('/api/pruebas/registrar', { 
            method: 'POST', 
            body: formData 
        });

        if (res.ok) {
            bootstrap.Modal.getInstance($('#modalRegistroPrueba')[0]).hide();
            $('#formNuevaPrueba')[0].reset();
            cargarPruebas();
        } else {
            alert("Error al registrar la prueba.");
        }
    } catch (err) { alert("Error de conexión."); }
}

// Prepara el modal de edición con los datos del cache
function abrirModalEditar(index) {
    const p = cachePruebas[index];
    $('#editIdPrueba').val(p.id);
    $('#editNombrePrueba').val(p.nombre);
    $('#editDescPrueba').val(p.descripcion);
    
    const modal = new bootstrap.Modal(document.getElementById('modalEditarPrueba'));
    modal.show();
}

// Actualiza la prueba en el servidor
async function actualizarPrueba() {
    const id = $('#editIdPrueba').val();
    const formData = new FormData();
    formData.append('nombre', $('#editNombrePrueba').val());
    formData.append('descripcion', $('#editDescPrueba').val());
    
    const foto = $('#editFotoPrueba')[0].files[0];
    if (foto) formData.append('imagen', foto);

    try {
        const res = await fetch(`/api/pruebas/actualizar/${id}`, { 
            method: 'PUT', 
            body: formData 
        });

        if (res.ok) {
            bootstrap.Modal.getInstance($('#modalEditarPrueba')[0]).hide();
            cargarPruebas();
        } else {
            alert("Error al actualizar la prueba.");
        }
    } catch (err) { alert("Error de conexión."); }
}

// Elimina registro tras confirmación
async function eliminarPrueba(id) {
    if (confirm("¿Desea eliminar este protocolo del catálogo?")) {
        try {
            const res = await fetch(`/api/pruebas/${id}`, { method: 'DELETE' });
            if (res.ok) cargarPruebas();
        } catch (e) { alert("Error al eliminar"); }
    }
}
$(window).on('load', function() { 
    $("#loading-wrapper").fadeOut("slow"); 
});

let cacheDispositivos = []; // Para edición rápida sin reconectar

// Escapa texto antes de insertarlo en HTML (evita ataques XSS)
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
    // 1. VALIDACIÓN DE SEGURIDAD
    if (!localStorage.getItem('medicoId')) { 
        window.location.href = "login.html"; 
        return; 
    }
    if (typeof inicializarLayout === "function") {
        inicializarLayout({
            menuId: 'dispositivos', 
            titulo: 'Dispositivos <span class="text-primary">Registrados</span>'
        });
    }

    // 2. CARGA INICIAL
    cargarDispositivos();

    // 3. EVENTOS DE FORMULARIO
    $('#formNuevoDispositivo').on('submit', registrarEquipo);

    $('#formEditarDispositivo').on('submit', function(e) {
        e.preventDefault();
        actualizarDispositivo();
    });
});

// --- FUNCIONES DE LÓGICA 

async function cargarDispositivos() {
    try {
        const response = await fetch('/api/dispositivos');
        cacheDispositivos = await response.json();
        const dispositivos = cacheDispositivos;
        
        // Actualizar contador visual
        const total = dispositivos.length;
        $("#contador-dispositivos").text(`Dispositivos: ${total} / 10`);
        
        // Controlar el límite de registros
        if (total >= 10) {
            $("#btnNuevoDispositivo")
                .prop('disabled', true)
                .addClass('btn-secondary')
                .removeClass('btn-primary')
                .html('<i class="ri-lock-line"></i> Límite alcanzado');
        } else {
            $("#btnNuevoDispositivo")
                .prop('disabled', false)
                .addClass('btn-primary')
                .removeClass('btn-secondary')
                .html('<i class="ri-add-line"></i> Nuevo Equipo');
        }

       let html = "";
       dispositivos.forEach((d, index) => {
            const fotoUrlSegura = escapeHTML(d.foto_url);
            
            // Si tiene foto cargada la intentamos mostrar; si falla (onerror), se oculta y muestra el microchip
            const contenidoImagen = (d.foto_url && d.foto_url.trim() !== "") 
                ? `<img src="/${fotoUrlSegura}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                   <i class="ri-cpu-line fs-1 text-primary opacity-50" style="display: none;"></i>` 
                : `<i class="ri-cpu-line fs-1 text-primary opacity-50"></i>`;

            html += `
                <div class="col-md-4 col-sm-6 mb-3">
                    <div class="card device-card-clinical shadow-sm border-0 h-100">
                        <div class="card-body p-3">
                            <div class="d-flex align-items-center mb-2">
                                <div class="device-img-container me-3">
                                    ${contenidoImagen}
                                </div>
                                <h6 class="mb-0 fw-bold text-dark">${escapeHTML(d.nombre)}</h6>
                            </div>
                            <div class="device-info-row flex-column align-items-start gap-1">
                                <span class="device-info-item">
                                    <i class="ri-bluetooth-line"></i> ${escapeHTML(d.conexion)}
                                </span>
                                <span class="device-info-item text-muted">
                                    ${escapeHTML(d.descripcion) || 'Sin descripción clínica.'}
                                </span>
                            </div>
                            <div class="text-end mt-2">
                                <button class="btn btn-link text-primary p-0 me-3" onclick="abrirModalEditar(${index})" title="Editar">
                                    <i class="ri-pencil-line fs-5"></i>
                                </button>
                                <button class="btn btn-link text-danger p-0" onclick="eliminarDisp(${d.id})" title="Eliminar">
                                    <i class="ri-delete-bin-5-line fs-5"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        $('#contenedorDispositivos').html(html || '<div class="col-12 text-center py-5 text-muted">No hay dispositivos registrados en su consultorio.</div>');

    } catch (error) { 
        console.error("Error en la conexión con el servidor:", error); 
    }
}

async function eliminarDisp(id) {
    if (confirm("¿Está seguro de eliminar este equipo del sistema NeuroGuardX?")) {
        try {
            const res = await fetch(`/api/dispositivos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                cargarDispositivos();
            }
        } catch (e) { 
            alert("Error de red al intentar eliminar."); 
        }
    }
}

async function registrarEquipo(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('nombre', $('#nombreDisp').val());
    formData.append('conexion', $('#conexionDisp').val());
    formData.append('descripcion', $('#descDisp').val());
    
    const archivoFoto = $('#fotoDisp')[0].files[0];
    if (archivoFoto) formData.append('foto', archivoFoto);

    try {
        const res = await fetch('/api/dispositivos/registrar', { 
            method: 'POST', 
            body: formData 
        });
        
        if (res.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalRegistro'));
            modal.hide();
            
            $('#formNuevoDispositivo')[0].reset();
            cargarDispositivos();
        }
    } catch (err) { 
        alert("Error crítico al registrar el dispositivo."); 
    }
}

function abrirModalEditar(index) {
    const d = cacheDispositivos[index];
    $('#editIdDisp').val(d.id);
    $('#editNombreDisp').val(d.nombre);
    $('#editConexionDisp').val(d.conexion);
    $('#editDescDisp').val(d.descripcion || '');

    const modal = new bootstrap.Modal(document.getElementById('modalEditarDispositivo'));
    modal.show();
}

async function actualizarDispositivo() {
    const id = $('#editIdDisp').val();
    const formData = new FormData();
    formData.append('nombre', $('#editNombreDisp').val());
    formData.append('conexion', $('#editConexionDisp').val());
    formData.append('descripcion', $('#editDescDisp').val());

    const foto = $('#editFotoDisp')[0].files[0];
    if (foto) formData.append('foto', foto);

    try {
        const res = await fetch(`/api/dispositivos/${id}`, { 
            method: 'PUT', 
            body: formData 
        });

        if (res.ok) {
            bootstrap.Modal.getInstance($('#modalEditarDispositivo')[0]).hide();
            cargarDispositivos();
        } else {
            alert("Error al actualizar el dispositivo.");
        }
    } catch (err) { 
        alert("Error de conexión."); 
    }
}
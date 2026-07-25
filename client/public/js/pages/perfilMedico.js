$(document).ready(function() {
    window.cambiarTema = function(tema) {
        const root = document.documentElement;
        const fondos = {
            'light': '#f4f6f8',
            'dark': '#e9ecef',
            'purple': '#f3e5f5',
            'turquoise': '#e0f2f1',
            'silver': '#f8f9fa'
        };

        if (tema === 'light') {
            root.removeAttribute('data-theme');
        } else {
            root.setAttribute('data-theme', tema);
        }
        root.style.setProperty('--bg-body', fondos[tema] || '#f4f6f8');
        localStorage.setItem('selected-theme', tema);
    };

    const medicoId = localStorage.getItem('medicoId');
    const API_BASE = "";

    console.log("[perfilMedico] medicoId en localStorage:", medicoId);

    if (!medicoId) {
        console.warn("[perfilMedico] No hay medicoId en localStorage, redirigiendo a login.");
        window.location.href = "login.html";
        return;
    }

    if (typeof inicializarLayout === "function") {
        inicializarLayout({
            menuId: 'perfil',
            titulo: 'Perfil Médico'
        });
    } else {
        console.error("[perfilMedico] inicializarLayout no está definida. Revisa que js/layout.js esté cargando bien (mira la pestaña Network en F12: ¿da 404?).");
    }

    function obtenerNombreCorto(nombre) {
        const partes = nombre.trim().split(/\s+/);
        if (partes.length >= 3) return `${partes[0]} ${partes[2]}`;
        return partes.length >= 2 ? `${partes[0]} ${partes[1]}` : partes[0];
    }

    async function cargarTodo() {
        try {
            const resMed = await fetch(`${API_BASE}/api/medicos/${medicoId}`);
            if (!resMed.ok) throw new Error(`Error ${resMed.status} al cargar médico`);
            const m = await resMed.json();
            console.log("[perfilMedico] Datos del médico recibidos:", m);

            const nombreCorto = obtenerNombreCorto(m.nombre);
            $('.nombre-medico-perfil, .nombre-medico-perfil-header').text(`Dr. ${nombreCorto}`);
            $('#view_nombre_completo').text(m.nombre);
            $('#edit_nombre').val(m.nombre);
            $('.id-medico-perfil').text(`ID: #${m.id}`);

            if (m.foto_ruta) {
                const urlFoto = `${API_BASE}/${m.foto_ruta}?v=${new Date().getTime()}`;
                $('.img-medico-perfil').attr('src', urlFoto);
                localStorage.setItem('medicoFoto', urlFoto);
            }
            localStorage.setItem('medicoNombre', m.nombre);

            const campos = ['especialidad', 'cedula_gen', 'cedula_esp', 'correo', 'telefono', 'curp', 'rfc'];
            campos.forEach(c => {
                $(`#view_${c}`).text(m[c] || '---');
                $(`#edit_${c}`).val(m[c]);
            });

            if (m.fecha_nac) {
                const fechaLimpia = m.fecha_nac.split('T')[0];
                const [y, mm, d] = fechaLimpia.split('-');
                $('#view_fecha_nac').text(`${d}/${mm}/${y}`);
                $('#edit_fecha_nac').val(fechaLimpia);
            }

            // Último acceso: NO se usa m.ultimo_acceso porque ese valor ya
            // fue actualizado por el login actual. El dato que se muestra
            // -la sesión ANTERIOR a esta- se guardó en localStorage en el
            // momento del login, antes de ser sobreescrito en la BD.
            const ultimoAccesoAnterior = localStorage.getItem('ultimoAccesoAnterior');
            if (ultimoAccesoAnterior && ultimoAccesoAnterior !== 'null') {
                const fechaAcceso = new Date(ultimoAccesoAnterior);
                const fechaTexto = fechaAcceso.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const horaTexto = fechaAcceso.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                $('#ultimoAcceso').text(`Último acceso: ${fechaTexto} ${horaTexto}`);
            } else {
                $('#ultimoAcceso').text('Último acceso: --');
            }

            const resP = await fetch(`${API_BASE}/api/pacientes/medico/${medicoId}`);
            const pacientesRaw = await resP.json();

            let pacientesRecientes = pacientesRaw.slice(0, 5);
            let htmlP = pacientesRecientes.map(p => {
                const fotoDefault = 'assets/images/user.png';
                const fotoPaciente = p.foto_url ? `${API_BASE}/${p.foto_url}` : fotoDefault;
                const estadoActual = p.estado || "Sin Sesión";
                const esEnSesion = estadoActual === 'En Sesión';
                const badgeClase = esEnSesion ? 'bg-success-subtle text-success border-success-subtle' : 'bg-light text-muted border-light';
                const iconoEstado = esEnSesion ? 'ri-checkbox-circle-fill' : 'ri-time-line';

                return `
                <a href="perfilPacientes.html?id=${p.id}" class="paciente-agenda-item">
                    <div class="paciente-agenda-foto" style="background-image: url('${fotoPaciente}'), url('${fotoDefault}');"></div>
                    <div class="paciente-agenda-info">
                        <div class="paciente-agenda-nombre">${p.nombre}</div>
                        <div class="paciente-agenda-edad">${p.edad || '--'} años</div>
                    </div>
                    <span class="badge ${badgeClase} border px-3 py-2 rounded-pill paciente-agenda-badge">
                        <i class="${iconoEstado} me-1"></i> ${estadoActual}
                    </span>
                    <i class="ri-arrow-right-s-line paciente-agenda-flecha"></i>
                </a>`;
            }).join('');

            $('#listaPacientesPerfil').html(htmlP || '<div class="text-center py-5 text-muted">No hay pacientes registrados recientemente</div>');

        } catch (e) {
            console.error("[perfilMedico] Error al cargar perfil:", e);
        } finally {
            $("#loading-wrapper").fadeOut("slow");
        }
    }

    $('#btnEditar').click(function() {
        $('.view-mode').hide();
        $('.editable-input').fadeIn();
        $(this).hide();
        $('#btnGuardar').show();
    });

    $('#btnGuardar').click(async function() {
        const datosActualizados = {
            nombre: $('#edit_nombre').val(),
            especialidad: $('#edit_especialidad').val(),
            cedula_gen: $('#edit_cedula_gen').val(),
            cedula_esp: $('#edit_cedula_esp').val(),
            correo: $('#edit_correo').val(),
            telefono: $('#edit_telefono').val(),
            curp: $('#edit_curp').val(),
            rfc: $('#edit_rfc').val(),
            fecha_nac: $('#edit_fecha_nac').val()
        };

        try {
            const res = await fetch(`${API_BASE}/api/medicos/${medicoId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(datosActualizados)
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                location.reload();
            } else {
                alert("No se pudieron guardar los cambios: " + (data.error || res.status));
            }
        } catch (e) {
            console.error("[perfilMedico] Error de red al guardar:", e);
            alert("Error de conexión al guardar los cambios.");
        }
    });

    $('#inputFoto').on('change', async function() {
        const archivo = this.files[0];
        if (!archivo) return;

        const formData = new FormData();
        formData.append('foto', archivo);
        formData.append('id', medicoId);

        try {
            const res = await fetch(`${API_BASE}/api/medicos/subir-foto`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json().catch(() => ({}));

            if (data.success) {
                const urlFinal = `${API_BASE}/${data.foto_url}?v=${new Date().getTime()}`;
                $('.img-medico-perfil').attr('src', urlFinal);
                localStorage.setItem('medicoFoto', urlFinal);
            } else {
                alert("No se pudo subir la foto: " + (data.error || res.status));
            }
        } catch (e) {
            console.error("[perfilMedico] Error de red al subir foto:", e);
            alert("Error de conexión al subir la foto.");
        }
    });

    cargarTodo();
});
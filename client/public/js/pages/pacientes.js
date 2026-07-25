$(window).on('load', function() { 
    $("#loading-wrapper").fadeOut("slow"); 
});

$(document).ready(function() {
    let todosLosPacientes = [];
    let pacientesFiltrados = [];
    let catalogoDispositivos = {}; 
    
    let paginaActual = 1;
    let registrosPorPagina = 5; 

    const medicoId = localStorage.getItem('medicoId');
    if (!medicoId) { window.location.href = "login.html"; return; }

    // INICIALIZAR EL LAYOUT DINÁMICO
    if (typeof inicializarLayout === "function") {
        inicializarLayout({
            menuId: 'pacientesL', 
            titulo: 'Total de <span class="text-primary">Pacientes</span>'
        });
    }

    // Función auxiliar para quitar acentos/tildes y normalizar búsqueda
    const limpiarTexto = (texto) => {
        if (!texto) return "";
        return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    // Traduce el valor de 'diagnostico' a un badge visual para la columna
    // "Pronóstico". Si el paciente no tiene ninguna sesión registrada, el
    // backend manda diagnostico = null; por lógica eso equivale a que aún
    // no hay diagnóstico, así que se trata igual que 'Sin diagnóstico'.
    function badgePronostico(diagnostico) {
        const valor = diagnostico || 'Sin diagnóstico';
        const mapaClases = {
            'Sin diagnóstico': 'bg-secondary-subtle text-secondary border-secondary-subtle',
            'Sin TDAH': 'bg-success-subtle text-success border-success-subtle',
            'TDAH Detectado': 'bg-danger-subtle text-danger border-danger-subtle'
        };
        const clase = mapaClases[valor] || 'bg-light text-muted border-light';
        return `<span class="badge badge-pronostico ${clase} border px-3 py-2 rounded-pill" title="${valor}">${valor}</span>`;
    }

    //  CARGAR DISPOSITIVOS REGISTRADOS (Ruta relativa)
    async function cargarCatalogoYPacientes() {
        try {
            const resDisp = await fetch('/api/dispositivos');
            if (!resDisp.ok) throw new Error("Fallo al obtener catálogo de dispositivos");
            const dispositivos = await resDisp.json();
            
            catalogoDispositivos = {};
            let options = '<option value="todos">Equipo: Todos</option>';
            
            dispositivos.forEach(d => {
                catalogoDispositivos[String(d.id)] = { nombre: d.nombre };
                options += `<option value="${d.id}">${d.nombre}</option>`;
            });

            $('#filtroDispositivo').html(options);
            await cargarPacientes();
        } catch (e) { 
            console.error("Error inicializando dispositivos:", e); 
        }
    }

    //  OBTENER LISTA DE PACIENTES (Ruta relativa)
    async function cargarPacientes() {
        try {
            const res = await fetch(`/api/pacientes/medico/${medicoId}`);
            if (!res.ok) throw new Error("Error API");
            todosLosPacientes = await res.json();
            actualizarContadores();
            procesarYRenderizar();
        } catch (e) { 
            $('#cuerpoTabla').html('<tr><td colspan="6" class="text-center py-5 text-danger">Error de conexión al cargar pacientes</td></tr>');
        }
    }

    function actualizarContadores() {
        // Inyectar el número de pacientes en el badge dinámico del header que genera layout.js
        $('#totalPacientes').text(todosLosPacientes.length.toString().padStart(2, '0'));
    }

    // MOTOR DE FILTRADO Y BÚSQUEDA
    function procesarYRenderizar() {
        const inputRaw = $('#inputBusqueda').val() || "";
        const busqueda = limpiarTexto(inputRaw);
        
        const fEstado = $('#filtroEstado').val();
        const fSexo = $('#filtroSexo').val();
        const fOrden = $('#filtroOrden').val();
        const fDispositivo = $('#filtroDispositivo').val(); 
        const fPronostico = $('#filtroPronostico').val();
        
        let baseFiltrada = todosLosPacientes.filter(p => {
            // Filtro de Estado
            const estadoPaciente = (p.estado || "Sin Sesión").trim();
            const matchEstado = (fEstado === 'todos' || estadoPaciente === fEstado);

            // Filtro de Sexo
            const matchSexo = (fSexo === 'todos' || p.sexo === fSexo);

            // Filtro de Dispositivo 
            const idsArray = String(p.dispositivos_id || p.dispositivo_id || "").split(',').map(s => s.trim());
            const matchDisp = (fDispositivo === 'todos' || idsArray.includes(String(fDispositivo)));

            // Filtro de Pronóstico. Sin sesión registrada (diagnostico
            // null/undefined) cuenta como 'Sin diagnóstico', por lógica.
            const pronosticoPaciente = p.diagnostico || 'Sin diagnóstico';
            const matchPronostico = (fPronostico === 'todos' || pronosticoPaciente === fPronostico);

            return matchEstado && matchSexo && matchDisp && matchPronostico;
        });

        if (busqueda) {
            pacientesFiltrados = baseFiltrada.filter(p => limpiarTexto(p.nombre).includes(busqueda));

            pacientesFiltrados.sort((a, b) => {
                const nombreA = limpiarTexto(a.nombre);
                const nombreB = limpiarTexto(b.nombre);
                const empiezaA = nombreA.startsWith(busqueda) ? 0 : 1;
                const empiezaB = nombreB.startsWith(busqueda) ? 0 : 1;
                if (empiezaA !== empiezaB) return empiezaA - empiezaB;
                return nombreA.localeCompare(nombreB);
            });
        } else {
            pacientesFiltrados = baseFiltrada;
            pacientesFiltrados.sort((a, b) => {
                if (fOrden === 'az') return a.nombre.localeCompare(b.nombre);
                if (fOrden === 'za') return b.nombre.localeCompare(a.nombre);
                if (fOrden === 'antiguo') return a.id - b.id;
                return b.id - a.id; 
            });
        }

        renderizarTabla();
    }

    // RENDERIZAR TABLA CON AVATARES SEGUROS
    function renderizarTabla() {
        const inicio = (paginaActual - 1) * registrosPorPagina;
        const lista = pacientesFiltrados.slice(inicio, inicio + registrosPorPagina);

        let html = "";
        lista.forEach(p => {
            const fotoDefault = 'assets/images/user.png';
            const fotoPaciente = p.foto_url ? `/${p.foto_url}` : fotoDefault;
            
            // Render de Tags de Dispositivos
            let tagsHtml = "";
            const rawId = p.dispositivos_id || p.dispositivo_id;
            if (rawId) {
                String(rawId).split(',').forEach(id => {
                    const equipo = catalogoDispositivos[id.trim()];
                    if (equipo) {
                        tagsHtml += `<span class="device-tag text-primary" style="border: 1px solid var(--accent-color); background: #f0fbfc; padding: 2px 8px; border-radius: 5px; margin-right: 4px; font-size: 12px;">
                                        <i class="ri-shield-check-line"></i> ${equipo.nombre}
                                     </span>`;
                    }
                });
            }
            if (!tagsHtml) tagsHtml = `<span class="text-muted small opacity-50">Sin dispositivos</span>`;

            // ESTADO DINÁMICO 
            const esEnSesion = p.estado === 'En Sesión';
            const badgeClase = esEnSesion ? 'bg-success-subtle text-success border-success-subtle' : 'bg-light text-muted border-light';
            const iconoEstado = esEnSesion ? 'ri-checkbox-circle-fill' : 'ri-time-line';

            const badgeEstado = `
                <span class="badge ${badgeClase} border px-3 py-2 rounded-pill">
                    <i class="${iconoEstado} me-1"></i> ${p.estado || 'Sin Sesión'}
                </span>`;

            html += `
                <tr>
                    <td class="ps-4 align-middle">
                        <!-- El uso de dos capas en background-image asegura que si la ruta del paciente falla, se cargue de inmediato el avatar genérico de fallback en CSS -->
                        <div class="paciente-foto-tabla" style="background-image: url('${fotoPaciente}'), url('${fotoDefault}');"></div>
                    </td>
                    <td class="align-middle">
                        <div class="fw-bold text-dark fs-6 mb-1">${p.nombre}</div>
                        <div class="d-flex flex-wrap gap-1">${tagsHtml}</div>
                    </td>
                    <td class="align-middle">${p.edad || '--'} años</td>
                    <td class="align-middle">${badgeEstado}</td>
                    <td class="align-middle">${badgePronostico(p.diagnostico)}</td>
                    <td class="text-center align-middle">
                        <a href="perfilPacientes.html?id=${p.id}" class="btn btn-outline-primary btn-sm rounded-circle me-1" title="Ver Expediente"><i class="ri-eye-line"></i></a>
                        <button onclick="eliminarPaciente(${p.id})" class="btn btn-outline-danger btn-sm rounded-circle" title="Eliminar Paciente"><i class="ri-delete-bin-line"></i></button>
                    </td>
                </tr>`;
        });

        $('#cuerpoTabla').html(html || '<tr><td colspan="6" class="text-center py-5">No se encontraron pacientes</td></tr>');
        actualizarPaginacion();
    }

    // CONTROLADORES DE PAGINACIÓN
    function actualizarPaginacion() {
        const totalPaginas = Math.ceil(pacientesFiltrados.length / registrosPorPagina);
        let h = "";
        h += `<li class="page-item ${paginaActual === 1 ? 'disabled' : ''}"><button class="page-link" onclick="cambiarPagina(${paginaActual - 1})">Anterior</button></li>`;
        for (let i = 1; i <= totalPaginas; i++) {
            h += `<li class="page-item ${i === paginaActual ? 'active' : ''}"><button class="page-link" onclick="cambiarPagina(${i})">${i}</button></li>`;
        }
        h += `<li class="page-item ${paginaActual === totalPaginas || totalPaginas === 0 ? 'disabled' : ''}"><button class="page-link" onclick="cambiarPagina(${paginaActual + 1})">Siguiente</button></li>`;
        $('#controlesPaginacion').html(h);
        
        const total = pacientesFiltrados.length;
        const hasta = Math.min(paginaActual * registrosPorPagina, total);
        const desde = total === 0 ? 0 : (paginaActual - 1) * registrosPorPagina + 1;
        $('#infoPaginacion').text(`Mostrando ${desde}-${hasta} de ${total}`);
    }

    window.cambiarPagina = (p) => { 
        if(p > 0 && p <= Math.ceil(pacientesFiltrados.length / registrosPorPagina)) {
            paginaActual = p; 
            renderizarTabla(); 
        }
    };

    // ELIMINAR PACIENTE (Ruta relativa)
    window.eliminarPaciente = async (id) => {
        if (confirm('¿Deseas eliminar permanentemente a este paciente?')) {
            try {
                const res = await fetch(`/api/pacientes/${id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error("Error en la solicitud de eliminación");
                const result = await res.json();
                if (result.success) {
                    cargarPacientes();
                } else {
                    alert("No se pudo eliminar: " + (result.error || "Error desconocido."));
                }
            } catch (error) {
                alert("Error de conexión al eliminar.");
            }
        }
    };

    function limpiarFiltros() {
        $('#inputBusqueda').val("");
        $('#filtroDispositivo').val("todos");
        $('#filtroEstado').val("todos");
        $('#filtroSexo').val("todos");
        $('#filtroOrden').val("reciente");
        $('#filtroPronostico').val("todos");
        paginaActual = 1;
        procesarYRenderizar();
    }

    // Escuchas de eventos
    $('#btnResetFiltros').on('click', limpiarFiltros);
    $('#inputBusqueda').on('input', () => { paginaActual = 1; procesarYRenderizar(); });
    $('#filtroEstado, #filtroSexo, #filtroOrden, #filtroDispositivo, #filtroPronostico').on('change', () => { paginaActual = 1; procesarYRenderizar(); });

    $('#pageSizeOptions').on('click', '.page-size-item', function() {
        $('.page-size-item').removeClass('active');
        $(this).addClass('active');
        registrosPorPagina = parseInt($(this).attr('data-value'));
        paginaActual = 1;
        procesarYRenderizar();
    });

    cargarCatalogoYPacientes();
});